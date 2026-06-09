import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
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

    // Get request body
    const { reason, feedback } = await req.json();
    if (!reason) throw new Error("Cancellation reason is required");
    logStep("Request body parsed", { reason, hasFeedback: !!feedback });

    // Get user's organization
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      throw new Error("Could not find user organization");
    }
    logStep("Organization found", { organizationId: profile.organization_id });

    // Check if user is org_admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id)
      .eq("role", "org_admin")
      .single();

    if (roleError || !roleData) {
      throw new Error("Only organization admins can cancel subscriptions");
    }
    logStep("User role verified as org_admin");

    // Get Stripe subscription from stripe_config
    const { data: stripeConfig, error: configError } = await supabaseClient
      .from("stripe_config")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("organization_id", profile.organization_id)
      .single();

    if (configError || !stripeConfig?.stripe_subscription_id) {
      throw new Error("No active subscription found for this organization");
    }
    logStep("Stripe config found", { subscriptionId: stripeConfig.stripe_subscription_id });

    // Cancel subscription in Stripe (at period end)
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const subscription = await stripe.subscriptions.update(stripeConfig.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
    logStep("Subscription set to cancel at period end", { 
      subscriptionId: subscription.id,
      cancelAt: subscription.cancel_at 
    });

    // Get plan name for logging
    let planName = null;
    if (subscription.items.data[0]?.price?.product) {
      const product = await stripe.products.retrieve(subscription.items.data[0].price.product as string);
      planName = product.name;
    }

    // Save cancellation reason to database
    const { error: insertError } = await supabaseClient
      .from("subscription_cancellations")
      .insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        reason: reason,
        feedback: feedback || null,
        plan_name: planName,
        subscription_id: stripeConfig.stripe_subscription_id,
      });

    if (insertError) {
      logStep("Warning: Failed to save cancellation reason", { error: insertError.message });
    } else {
      logStep("Cancellation reason saved to database");
    }

    // Update stripe_config to reflect cancellation pending
    await supabaseClient
      .from("stripe_config")
      .update({ subscription_status: "canceling" })
      .eq("organization_id", profile.organization_id);

    const cancelDate = subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    return new Response(
      JSON.stringify({
        success: true,
        cancel_at: cancelDate,
        plan_name: planName,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in cancel-subscription", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
