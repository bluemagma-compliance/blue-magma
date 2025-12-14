import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { API_BASE } from "@/config/api";
import type { Organization, SubscriptionPlan } from "@/types/api";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe secret key not configured");
  }
  return new Stripe(key, { apiVersion: "2025-08-27.basil" });
}

async function getOrganizationPartnersFlag(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    const orgId = cookieStore.get("organization_id")?.value;

    if (!accessToken || !orgId) {
      return false;
    }

    const response = await fetch(`${API_BASE}/org/${orgId}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        "Failed to fetch organization for subscription plans:",
        response.status,
      );
      return false;
    }

	    const org: Organization & { partners?: boolean } = await response.json();
	    // Avoid using `any` casts here so eslint can enforce strict typing.
	    return Boolean(org.partners);
  } catch (error) {
    console.error(
      "Error fetching organization partners flag for subscription plans:",
      error,
    );
    // Fail closed: if we can't determine partner status, treat as non-partner
    // so that partner-only prices are not exposed accidentally.
    return false;
  }
}

export async function GET() {
  try {
    const stripe = getStripe();
    const isPartner = await getOrganizationPartnersFlag();

    // Fetch active recurring prices from Stripe, optionally scoped by
    // lookup_key for partner orgs.
    const priceListParams: Stripe.PriceListParams = {
      expand: ["data.product"],
      active: true,
      type: "recurring",
    };

    if (isPartner) {
      // Partner organizations see partner-specific prices only. These are
      // configured in Stripe with lookup_key="partners".
      priceListParams.lookup_keys = ["partners"];
    }

    const prices = await stripe.prices.list(priceListParams);

    // For non-partner organizations, explicitly filter out any partner-only
    // prices (lookup_key="partners") so they never see discounted partner
    // rates, even if those prices exist on the same product.
    const filteredPrices = isPartner
      ? prices.data
      : prices.data.filter((price) => price.lookup_key !== "partners");

    // Transform Stripe data to our SubscriptionPlan format
    const plans: SubscriptionPlan[] = filteredPrices.map((price) => {
      const product = price.product as Stripe.Product;

      return {
        id: price.id,
        name: product.name,
        description: product.description || "",
        price: price.unit_amount || 0,
        interval: price.recurring?.interval as "month" | "year",
        currency: price.currency,
        features: product.metadata.features
          ? JSON.parse(product.metadata.features)
          : [],
        popular: product.metadata.popular === "true",
        stripePriceId: price.id,
      };
    });

    // Sort plans by price
    plans.sort((a, b) => a.price - b.price);

    return NextResponse.json(plans);
  } catch (error) {
    console.error("Error fetching subscription plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription plans" },
      { status: 500 },
    );
  }
}
