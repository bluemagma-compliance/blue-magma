import { NextResponse } from "next/server";
import Stripe from "stripe";
import type { CreditPackage } from "@/types/api";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe secret key not configured");
  }
  return new Stripe(key, { apiVersion: "2025-08-27.basil" });
}

export async function GET() {
  try {
    // Fetch all active one-time prices from Stripe for credit packages
    const stripe = getStripe();
    const prices = await stripe.prices.list({
      expand: ["data.product"],
      active: true,
      type: "one_time",
    });

    console.log("🔍 Found", prices.data.length, "one-time prices");

    // Log all products for debugging
    prices.data.forEach((price, index) => {
      const product = price.product as Stripe.Product;
      console.log(`Price ${index + 1}:`, {
        priceId: price.id,
        productId: product.id,
        productName: product.name,
        amount: price.unit_amount,
        metadata: product.metadata,
      });
    });

    // Filter for credit packages - look for specific product ID or metadata
    const creditPackages: CreditPackage[] = prices.data
      .filter((price) => {
        const product = price.product as Stripe.Product;
        // Check for specific product ID or metadata type
        return (
          product.id === "prod_SxAYMckuHd3MGb" ||
          product.metadata.type === "credits" ||
          product.name.toLowerCase().includes("credit")
        );
      })
      .map((price) => {
        const product = price.product as Stripe.Product;

        // Default credits amount if not in metadata
        let credits = parseInt(product.metadata.credits || "0");

        // If no credits in metadata, try to extract from product name or use default
        if (credits === 0) {
          const nameMatch = product.name.match(/(\d+)/);
          credits = nameMatch ? parseInt(nameMatch[1]) : 100; // Default to 100 credits
          console.log(
            `⚠️ No credits in metadata for ${product.name}, using ${credits} from name or default`,
          );
        }

        const creditPackage = {
          id: price.id,
          name: product.name,
          credits: credits,
          price: price.unit_amount || 0,
          currency: price.currency,
          bonus: product.metadata.bonus
            ? parseInt(product.metadata.bonus)
            : undefined,
          popular: product.metadata.popular === "true",
          stripePriceId: price.id,
        };

        console.log("✅ Created credit package:", creditPackage);
        return creditPackage;
      });

    // Sort packages by price
    creditPackages.sort((a, b) => a.price - b.price);

    console.log(
      "🎉 Final credit packages:",
      creditPackages.length,
      "packages found",
    );
    console.log("Packages:", creditPackages);

    return NextResponse.json(creditPackages);
  } catch (error) {
    console.error("Error fetching credit packages:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit packages" },
      { status: 500 },
    );
  }
}
