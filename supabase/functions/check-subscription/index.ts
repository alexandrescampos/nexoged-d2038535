import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

const formatDate = (timestamp: number | null | undefined): string | null => {
  if (!timestamp) return null;
  try {
    return new Date(timestamp * 1000).toISOString();
  } catch {
    return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Sessão expirada. Faça login novamente." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) return new Response(JSON.stringify({ error: "Sessão expirada. Faça login novamente." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get user's organization
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw new Error(`Profile error: ${profileError.message}`);
    if (!profile?.organization_id) throw new Error("User has no organization");
    logStep("Organization found", { organizationId: profile.organization_id });

    // Get stripe_config for organization
    const { data: stripeConfig } = await supabaseClient
      .from("stripe_config")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (!stripeConfig || !stripeConfig.stripe_subscription_id) {
      logStep("No subscription found in database");
      return new Response(JSON.stringify({
        subscribed: false,
        subscription_status: null,
        current_period_end: null,
        plan_id: null,
        plan_name: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Stripe config found", {
      subscriptionId: stripeConfig.stripe_subscription_id,
      status: stripeConfig.subscription_status,
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(stripeConfig.stripe_subscription_id);
    logStep("Subscription retrieved from Stripe", { status: subscription.status });
    logStep("Subscription details", { 
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      pauseCollection: subscription.pause_collection
    });

    const isActive = subscription.status === "active" || subscription.status === "trialing";
    const productId = subscription.items.data[0]?.price?.product as string;
    const priceId = subscription.items.data[0]?.price?.id;

    // Get plan details from database
    let planName = null;
    if (priceId) {
      const { data: plan } = await supabaseClient
        .from("plans")
        .select("name")
        .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
        .maybeSingle();
      planName = plan?.name;
    }

    // Update stripe_config if status changed or pause_collection changed
    const pauseBehavior = subscription.pause_collection?.behavior || null;
    const pauseResumesAt = subscription.pause_collection?.resumes_at 
      ? formatDate(subscription.pause_collection.resumes_at)
      : null;

    if (stripeConfig.subscription_status !== subscription.status ||
        stripeConfig.pause_collection_behavior !== pauseBehavior) {
      await supabaseClient
        .from("stripe_config")
        .update({
          subscription_status: subscription.status,
          current_period_end: formatDate(subscription.current_period_end),
          pause_collection_behavior: pauseBehavior,
          pause_collection_resumes_at: pauseResumesAt,
        })
        .eq("organization_id", profile.organization_id);
      logStep("Updated subscription status in database");
    }

    return new Response(JSON.stringify({
      subscribed: isActive,
      subscription_status: subscription.status,
      current_period_end: formatDate(subscription.current_period_end),
      product_id: productId,
      price_id: priceId,
      plan_name: planName,
      cancel_at_period_end: subscription.cancel_at_period_end,
      pause_collection: subscription.pause_collection ? {
        behavior: subscription.pause_collection.behavior,
        resumes_at: pauseResumesAt,
      } : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
