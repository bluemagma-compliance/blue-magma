import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { getStripeCustomerId } from "@/app/billing/actions";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe secret key not configured");
  }
  return new Stripe(key, { apiVersion: "2025-08-27.basil" });
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
    // Get customer ID from organization data
    const customerId = await getStripeCustomerId();

    if (!customerId) {
      return NextResponse.json(
        { error: "No Stripe customer found for this organization" },
        { status: 400 },
      );
    }

    // Create billing portal session
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${request.headers.get("origin")}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create portal session",
      },
      { status: 500 },
    );
  }
}
