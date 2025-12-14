import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe secret key not configured");
  }
  return new Stripe(key, { apiVersion: "2025-08-27.basil" });
}

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) {
    throw new Error("No access token found");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

async function getOrganizationId() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("organization_id")?.value;

  if (!orgId) {
    throw new Error("No organization ID found");
  }

  return orgId;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { priceId, mode = "subscription", successUrl, cancelUrl } = body;

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID is required" },
        { status: 400 },
      );
    }

    // Get organization ID for customer reference
    const orgId = await getOrganizationId();

    // Create checkout session
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: mode as "subscription" | "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url:
        successUrl ||
        `${request.headers.get("origin")}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${request.headers.get("origin")}/subscription`,
      client_reference_id: orgId, // Store org ID for webhook processing
      metadata: {
        organization_id: orgId,
      },
    };

    // For subscriptions, add metadata to the subscription itself
    if (mode === "subscription") {
      sessionConfig.subscription_data = {
        metadata: {
          organization_id: orgId,
        },
      };
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create checkout session",
      },
      { status: 500 },
    );
  }
}
