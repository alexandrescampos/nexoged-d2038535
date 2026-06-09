import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RESUME-SUBSCRIPTION] ${step}${detailsStr}`);
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
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Check if user is org_admin
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "org_admin")
      .maybeSingle();

    if (!roleData) {
      throw new Error("User is not an organization admin");
    }
    logStep("User is org_admin");

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
    const { data: stripeConfig, error: configError } = await supabaseClient
      .from("stripe_config")
      .select("stripe_subscription_id, pause_collection_behavior")
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (configError) throw new Error(`Stripe config error: ${configError.message}`);
    if (!stripeConfig?.stripe_subscription_id) throw new Error("No subscription found");
    logStep("Stripe config found", { subscriptionId: stripeConfig.stripe_subscription_id });

    // Check if subscription is actually paused
    if (!stripeConfig.pause_collection_behavior) {
      throw new Error("Subscription is not paused");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Resume subscription in Stripe by removing pause_collection
    const subscription = await stripe.subscriptions.update(stripeConfig.stripe_subscription_id, {
      pause_collection: null,
    });
    logStep("Subscription resumed in Stripe", { subscriptionId: subscription.id });

    // Update stripe_config in database
    const { error: updateError } = await supabaseClient
      .from("stripe_config")
      .update({
        pause_collection_behavior: null,
        pause_collection_resumes_at: null,
      })
      .eq("organization_id", profile.organization_id);

    if (updateError) {
      logStep("Error updating stripe_config", { error: updateError.message });
    } else {
      logStep("Updated stripe_config - pause info removed");
    }

    // Get plan name and next billing date
    const priceId = subscription.items.data[0]?.price?.id;
    let planName = "Assinatura";
    if (priceId) {
      const { data: plan } = await supabaseClient
        .from("plans")
        .select("name")
        .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
        .maybeSingle();
      if (plan?.name) planName = plan.name;
    }

    const nextBillingDate = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    return new Response(JSON.stringify({
      success: true,
      plan_name: planName,
      next_billing_date: nextBillingDate,
      status: subscription.status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in resume-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
