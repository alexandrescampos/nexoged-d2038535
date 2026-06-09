import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PAUSE-SUBSCRIPTION] ${step}${detailsStr}`);
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

    // Get request body
    const { pause_months } = await req.json();
    if (!pause_months || ![1, 2, 3].includes(pause_months)) {
      throw new Error("Invalid pause duration. Must be 1, 2, or 3 months");
    }
    logStep("Pause duration", { months: pause_months });

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
      .select("stripe_subscription_id, subscription_status")
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (configError) throw new Error(`Stripe config error: ${configError.message}`);
    if (!stripeConfig?.stripe_subscription_id) throw new Error("No subscription found");
    logStep("Stripe config found", { subscriptionId: stripeConfig.stripe_subscription_id });

    // Check if subscription is active
    if (stripeConfig.subscription_status !== "active") {
      throw new Error("Only active subscriptions can be paused");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Calculate resume date
    const resumeDate = new Date();
    resumeDate.setMonth(resumeDate.getMonth() + pause_months);
    const resumeTimestamp = Math.floor(resumeDate.getTime() / 1000);
    logStep("Resume date calculated", { resumeDate: resumeDate.toISOString() });

    // Pause subscription in Stripe
    const subscription = await stripe.subscriptions.update(stripeConfig.stripe_subscription_id, {
      pause_collection: {
        behavior: "void",
        resumes_at: resumeTimestamp,
      },
    });
    logStep("Subscription paused in Stripe", { 
      subscriptionId: subscription.id,
      pauseCollection: subscription.pause_collection 
    });

    // Update stripe_config in database
    const { error: updateError } = await supabaseClient
      .from("stripe_config")
      .update({
        pause_collection_behavior: "void",
        pause_collection_resumes_at: resumeDate.toISOString(),
      })
      .eq("organization_id", profile.organization_id);

    if (updateError) {
      logStep("Error updating stripe_config", { error: updateError.message });
    } else {
      logStep("Updated stripe_config with pause info");
    }

    // Get plan name for response
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

    return new Response(JSON.stringify({
      success: true,
      resumes_at: resumeDate.toISOString(),
      plan_name: planName,
      pause_months: pause_months,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in pause-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
