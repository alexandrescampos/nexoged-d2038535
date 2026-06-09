import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { planId, syncAll } = await req.json();

    console.log("Sync request received:", { planId, syncAll });

    // Fetch plan(s) to sync
    let query = supabase.from("plans").select("*");
    
    if (planId) {
      query = query.eq("id", planId);
    } else if (syncAll) {
      query = query.eq("is_active", true);
    } else {
      return new Response(
        JSON.stringify({ error: "planId or syncAll required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: plans, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching plans:", fetchError);
      throw fetchError;
    }

    if (!plans || plans.length === 0) {
      return new Response(
        JSON.stringify({ error: "No plans found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const plan of plans) {
      console.log(`Processing plan: ${plan.name} (${plan.id})`);

      let stripeProduct: Stripe.Product;

      // Create or update Stripe product
      if (plan.stripe_product_id) {
        console.log(`Updating existing product: ${plan.stripe_product_id}`);
        stripeProduct = await stripe.products.update(plan.stripe_product_id, {
          name: plan.name,
          description: plan.description || undefined,
          metadata: {
            plan_id: plan.id,
            slug: plan.slug,
            max_users: plan.max_users?.toString() || "unlimited",
          },
        });
      } else {
        console.log(`Creating new product for plan: ${plan.name}`);
        stripeProduct = await stripe.products.create({
          name: plan.name,
          description: plan.description || undefined,
          metadata: {
            plan_id: plan.id,
            slug: plan.slug,
            max_users: plan.max_users?.toString() || "unlimited",
          },
        });
      }

      let stripePriceMonthly: Stripe.Price | null = null;
      let stripePriceYearly: Stripe.Price | null = null;

      // Create monthly price if not exists
      if (plan.price_monthly && !plan.stripe_price_id_monthly) {
        console.log(`Creating monthly price: ${plan.price_monthly} centavos`);
        stripePriceMonthly = await stripe.prices.create({
          product: stripeProduct.id,
          unit_amount: plan.price_monthly,
          currency: "brl",
          recurring: { interval: "month" },
          metadata: { plan_id: plan.id, billing_period: "monthly" },
        });
      }

      // Create yearly price if not exists
      if (plan.price_yearly && !plan.stripe_price_id_yearly) {
        console.log(`Creating yearly price: ${plan.price_yearly} centavos`);
        stripePriceYearly = await stripe.prices.create({
          product: stripeProduct.id,
          unit_amount: plan.price_yearly,
          currency: "brl",
          recurring: { interval: "year" },
          metadata: { plan_id: plan.id, billing_period: "yearly" },
        });
      }

      // Update plan with Stripe IDs
      const updateData: any = {
        stripe_product_id: stripeProduct.id,
      };

      if (stripePriceMonthly) {
        updateData.stripe_price_id_monthly = stripePriceMonthly.id;
      }

      if (stripePriceYearly) {
        updateData.stripe_price_id_yearly = stripePriceYearly.id;
      }

      const { error: updateError } = await supabase
        .from("plans")
        .update(updateData)
        .eq("id", plan.id);

      if (updateError) {
        console.error(`Error updating plan ${plan.id}:`, updateError);
        throw updateError;
      }

      results.push({
        planId: plan.id,
        planName: plan.name,
        stripeProductId: stripeProduct.id,
        stripePriceMonthly: stripePriceMonthly?.id || plan.stripe_price_id_monthly,
        stripePriceYearly: stripePriceYearly?.id || plan.stripe_price_id_yearly,
      });

      console.log(`Plan ${plan.name} synced successfully`);
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in stripe-sync:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
