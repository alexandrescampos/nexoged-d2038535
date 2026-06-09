import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        // CRITICAL: Use async method for Deno/Edge Functions
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        console.log("[STRIPE-WEBHOOK] Signature verified successfully");
      } catch (err: any) {
        console.error("[STRIPE-WEBHOOK] Signature verification failed:", err.message);
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // For development/testing without signature verification
      event = JSON.parse(body);
      console.warn("[STRIPE-WEBHOOK] Signature not verified - development mode");
    }

    console.log(`[STRIPE-WEBHOOK] Processing event: ${event.type}`);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Subscription ${event.type}:`, subscription.id);

        // Get customer and find organization
        const customerId = typeof subscription.customer === 'string' 
          ? subscription.customer 
          : subscription.customer.id;

        const { data: stripeConfig, error: configError } = await supabase
          .from("stripe_config")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .single();

        if (configError && configError.code !== "PGRST116") {
          console.error("Error finding stripe_config:", configError);
        }

        if (stripeConfig) {
          const { error: updateError } = await supabase
            .from("stripe_config")
            .update({
              stripe_subscription_id: subscription.id,
              subscription_status: subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("id", stripeConfig.id);

          if (updateError) {
            console.error("Error updating stripe_config:", updateError);
          } else {
            console.log(`Updated stripe_config for organization ${stripeConfig.organization_id}`);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Subscription deleted:`, subscription.id);

        const { error: updateError } = await supabase
          .from("stripe_config")
          .update({
            subscription_status: "canceled",
            stripe_subscription_id: null,
          })
          .eq("stripe_subscription_id", subscription.id);

        if (updateError) {
          console.error("Error updating cancelled subscription:", updateError);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice paid:`, invoice.id);

        // Update subscription status to active if payment succeeded
        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;

          const { error: updateError } = await supabase
            .from("stripe_config")
            .update({ subscription_status: "active" })
            .eq("stripe_subscription_id", subscriptionId);

          if (updateError) {
            console.error("Error updating subscription status:", updateError);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice payment failed:`, invoice.id);

        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;

          const { error: updateError } = await supabase
            .from("stripe_config")
            .update({ subscription_status: "past_due" })
            .eq("stripe_subscription_id", subscriptionId);

          if (updateError) {
            console.error("Error updating subscription status:", updateError);
          }
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`Checkout completed:`, session.id);

        // Handle completed checkout - link customer to organization
        if (session.metadata?.organization_id && session.customer) {
          const customerId = typeof session.customer === 'string'
            ? session.customer
            : session.customer.id;

          // Check if stripe_config exists for this org
          const { data: existingConfig } = await supabase
            .from("stripe_config")
            .select("*")
            .eq("organization_id", session.metadata.organization_id)
            .single();

          if (existingConfig) {
            const { error: updateError } = await supabase
              .from("stripe_config")
              .update({
                stripe_customer_id: customerId,
                stripe_subscription_id: session.subscription as string,
              })
              .eq("organization_id", session.metadata.organization_id);

            if (updateError) {
              console.error("Error updating stripe_config:", updateError);
            }
          } else {
            const { error: insertError } = await supabase
              .from("stripe_config")
              .insert({
                organization_id: session.metadata.organization_id,
                stripe_customer_id: customerId,
                stripe_subscription_id: session.subscription as string,
                subscription_status: "active",
              });

            if (insertError) {
              console.error("Error creating stripe_config:", insertError);
            }
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in stripe-webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
