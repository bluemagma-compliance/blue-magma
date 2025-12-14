import { NextRequest, NextResponse } from "next/server";
import { getOrganizationBilling } from "@/app/billing/actions";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    console.log("=== DEBUG BILLING ENDPOINT ===");

    const orgData = await getOrganizationBilling();

    const analysis = {
      orgData,
      hasSubscription: !!(
        orgData.current_plan && orgData.stripe_subscription_id
      ),
      hasCredits: (orgData.credits || 0) > 0,
      hasStripeCustomer: !!orgData.stripe_customer_id,
      redirectLogic: {
        current_plan: orgData.current_plan,
        stripe_subscription_id: orgData.stripe_subscription_id,
        stripe_customer_id: orgData.stripe_customer_id,
        credits: orgData.credits,
      },
    };

    console.log("Debug analysis:", analysis);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Debug billing error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
