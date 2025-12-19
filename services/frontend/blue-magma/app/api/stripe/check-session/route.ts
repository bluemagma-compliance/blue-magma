import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe secret key not configured");
  }
  return new Stripe(key, { apiVersion: "2025-08-27.basil" });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    console.log("=== CHECKING SESSION AND SAVING BILLING DATA ===");
    console.log("Session ID:", sessionId);

    // Retrieve the checkout session
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "payment_intent", "line_items"],
    });

    console.log("Session retrieved:", {
      id: session.id,
      payment_status: session.payment_status,
      mode: session.mode,
      customer: session.customer,
      subscription: session.subscription,
      metadata: session.metadata,
    });

    // Note: Billing data updates are now handled exclusively by webhooks
    // This endpoint only returns session information for display purposes
    console.log(
      "Session verification complete - billing updates handled by webhooks",
    );

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        customer_email: session.customer_details?.email,
        customer_id: session.customer,
        subscription_id: session.subscription,
        amount_total: session.amount_total,
        currency: session.currency,
        metadata: session.metadata,
      },
    });
  } catch (error) {
    console.error("Error checking session:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to check session",
      },
      { status: 500 },
    );
  }
}
