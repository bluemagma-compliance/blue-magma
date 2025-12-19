import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { webhookBillingService } from "@/services/webhookBillingService";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe secret key not configured");
  }
  // NOTE: Keep apiVersion in sync with the installed stripe SDK types.
  return new Stripe(key, { apiVersion: "2025-08-27.basil" });
}

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

	let event: Stripe.Event;

	try {
	  const stripe = getStripe();
	  event = stripe.webhooks.constructEvent(body, sig, endpointSecret);

	  console.log("[Stripe Webhook] Event received", {
	    id: event.id,
	    type: event.type,
	    created: event.created,
	  });
	} catch (err) {
	  console.error("[Stripe Webhook] Error verifying webhook signature:", err);
	  return NextResponse.json(
	    {
	      error: `Webhook Error: ${
	        err instanceof Error ? err.message : "Unknown error"
	      }`,
	    },
	    { status: 400 },
	  );
	}

	// Handle the event
	try {
	  switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;
	    case "checkout.session.completed":
	      await handleCheckoutSessionCompleted(event.data.object);
	      break;
	    default:
	      console.log("[Stripe Webhook] Unhandled event type", event.type);
	  }

	  console.log("[Stripe Webhook] Event processed successfully", {
	    id: event.id,
	    type: event.type,
	  });
	  return NextResponse.json({ received: true });
	} catch (error) {
	  console.error("[Stripe Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

async function handleSubscriptionCreated(
  subscription: Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  },
) {
  try {
    // Get organization ID from subscription metadata
	    const orgId = subscription.metadata.organization_id;
	    console.log("[Stripe Webhook] customer.subscription.created", {
	      subscriptionId: subscription.id,
	      status: subscription.status,
	      orgId,
	    });
    if (!orgId) {
      console.error("No organization ID found in subscription metadata");
      return;
    }

	    // Get the price to determine plan name
	    const priceId = subscription.items.data[0]?.price.id;

    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId, {
      expand: ["product"],
    });
    const product = price.product as Stripe.Product;
    const planName = product.name;

	    // Extract subscription details
	    const monthlyCost =
	      (subscription.items.data[0]?.price.unit_amount || 0) / 100; // Convert cents to dollars
    const subscriptionStatus = subscription.status;

	    // Get next billing date from Stripe data
	    let nextBillingDate = "Unknown";
    if (subscription.current_period_end) {
      nextBillingDate = new Date(subscription.current_period_end * 1000)
        .toISOString()
        .split("T")[0];
    } else {
      // Fallback: calculate next month from creation date
      const createdDate = new Date(subscription.created * 1000);
      const nextMonth = new Date(createdDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextBillingDate = nextMonth.toISOString().split("T")[0];
    }

	    console.log("[Stripe Webhook] Updating organization from subscription.created", {
	      orgId,
	      subscriptionId: subscription.id,
	      planName,
	      monthlyCost,
	      subscriptionStatus,
	      nextBillingDate,
	    });

	    // Update organization with complete subscription data in one call
	    await webhookBillingService.updateCompleteSubscriptionData(
	      orgId,
	      subscription.id,
	      planName,
	      subscription.customer as string,
	      monthlyCost,
	      subscriptionStatus,
	      nextBillingDate,
	    );
	    console.log("[Stripe Webhook] subscription.created handling complete", {
	      orgId,
	      subscriptionId: subscription.id,
	    });
	  } catch (error) {
	    console.error("[Stripe Webhook] Error handling subscription created:", error);
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  },
) {
  try {
    const orgId = subscription.metadata.organization_id;
	    console.log("[Stripe Webhook] customer.subscription.updated", {
	      subscriptionId: subscription.id,
	      status: subscription.status,
	      orgId,
	      cancelAtPeriodEnd: subscription.cancel_at_period_end,
	    });
    if (!orgId) {
      console.error("No organization ID found in subscription metadata");
      return;
    }

	    // Check if this is a "cancel at period end" scenario
	    if (subscription.cancel_at_period_end) {
	      await handleCancelAtPeriodEnd(subscription, orgId);
	      return;
	    }

    // Get the price to determine plan name and cost
    const priceId = subscription.items.data[0]?.price.id;
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId, {
      expand: ["product"],
    });
    const product = price.product as Stripe.Product;
    const planName = product.name;
    const monthlyCost = (price.unit_amount || 0) / 100; // Convert cents to dollars
    const subscriptionStatus = subscription.status;

    // Get next billing date from Stripe data
    let nextBillingDate = "Unknown";
    if (subscription.current_period_end) {
      nextBillingDate = new Date(subscription.current_period_end * 1000)
        .toISOString()
        .split("T")[0];
    } else {
      // Fallback: calculate next month from current date
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextBillingDate = nextMonth.toISOString().split("T")[0];
    }

	    console.log("[Stripe Webhook] Updating organization from subscription.updated", {
	      orgId,
	      subscriptionId: subscription.id,
	      planName,
	      monthlyCost,
	      subscriptionStatus,
	      nextBillingDate,
	    });

	    // Update organization with complete subscription info (plan change)
	    await webhookBillingService.updateCompleteSubscriptionData(
	      orgId,
	      subscription.id,
	      planName,
	      subscription.customer as string,
	      monthlyCost,
	      subscriptionStatus,
	      nextBillingDate,
	    );
	    console.log("[Stripe Webhook] subscription.updated handling complete", {
	      orgId,
	      subscriptionId: subscription.id,
	    });
	  } catch (error) {
	    console.error("[Stripe Webhook] Error handling subscription updated:", error);
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  },
) {
  try {
    const orgId = subscription.metadata.organization_id;
	    console.log("[Stripe Webhook] customer.subscription.deleted", {
	      subscriptionId: subscription.id,
	      orgId,
	    });
    if (!orgId) {
      console.error("No organization ID found in subscription metadata");
      return;
    }

	    // Clear subscription data from organization
	    await webhookBillingService.clearSubscriptionData(orgId);
	    console.log("[Stripe Webhook] subscription.deleted handling complete", {
	      orgId,
	      subscriptionId: subscription.id,
	    });
	  } catch (error) {
	    console.error("[Stripe Webhook] Error handling subscription deleted:", error);
  }
}

type InvoiceWebhookObject =
	| Stripe.Invoice
	| {
	    object?: string;
	    id?: string;
	    invoice?: string | { id?: string | null } | null;
	  };

type InvoiceWithExpanded = Stripe.Invoice & {
	subscription?: string | Stripe.Subscription | null;
	lines: Stripe.Invoice["lines"] & {
		data: Array<Stripe.InvoiceLineItem & { price?: Stripe.Price | null }>;
	};
};

async function handleInvoicePaymentSucceeded(invoiceObject: InvoiceWebhookObject) {
	  try {
	    // NOTE: We previously relied on `invoice.billing_reason` and metadata-based
	    // credits. With newer Stripe payloads (which send `invoice_payment`-like
	    // objects) that approach was unreliable and never added credits. For now,
	    // we simplify to hard-coded credits based on the subscription product name
	    // (Blue Magma Pro / Blue Magma Enterprise) per requirements.

	    const stripe = getStripe();

	    // 1) Resolve the real Invoice ID from the event's data.object
	    let invoiceId: string | undefined;

	    if (invoiceObject?.object === "invoice_payment") {
	      const invoiceField = invoiceObject.invoice;
	      if (typeof invoiceField === "string") {
	        invoiceId = invoiceField;
	      } else if (invoiceField && typeof invoiceField.id === "string") {
	        invoiceId = invoiceField.id;
	      }
	    } else if (invoiceObject?.object === "invoice") {
	      invoiceId = invoiceObject.id;
	    } else if (invoiceObject?.id && typeof invoiceObject.id === "string") {
	      // Fallback: treat it as an invoice-like object and use its id directly.
	      invoiceId = invoiceObject.id;
	    }

	    if (!invoiceId) {
	      console.error(
	        "[Stripe Webhook] invoice.payment_succeeded: unable to determine invoice id from event object",
	        { rawObject: { object: invoiceObject?.object, id: invoiceObject?.id } },
	      );
	      return;
	    }

		    const invoice = (await stripe.invoices.retrieve(invoiceId, {
		      expand: ["subscription", "lines.data.price.product"],
		    })) as InvoiceWithExpanded;

	    // 2) Ensure this invoice is tied to a subscription
	    let subscriptionId: string | undefined;
	    let subscription: Stripe.Subscription | undefined;

	    if (typeof invoice.subscription === "string") {
	      subscriptionId = invoice.subscription;
	      subscription = await stripe.subscriptions.retrieve(subscriptionId);
	    } else if (invoice.subscription && typeof invoice.subscription === "object") {
	      // Invoice.subscription is a union (string | Stripe.Subscription | null).
	      const expandedSubscription = invoice.subscription as Stripe.Subscription;
	      subscriptionId = expandedSubscription.id;
	      subscription = expandedSubscription;
	    }

	    if (!subscriptionId || !subscription) {
	      console.error(
	        "[Stripe Webhook] invoice.payment_succeeded: invoice has no subscription",
	        { invoiceId },
	      );
	      return;
	    }

	    const orgId = subscription.metadata?.organization_id;
	    if (!orgId) {
	      console.error(
	        "[Stripe Webhook] invoice.payment_succeeded: no organization_id on subscription metadata",
	        { invoiceId, subscriptionId },
	      );
	      return;
	    }

	    // 3) Determine product name from the first invoice line
	    const firstLine = invoice.lines?.data?.[0];
	    const linePrice = firstLine?.price;

	    if (!firstLine || !linePrice) {
	      console.error(
	        "[Stripe Webhook] invoice.payment_succeeded: unable to determine price/product from invoice lines",
	        { invoiceId, subscriptionId, orgId },
	      );
	      return;
	    }

	    let productName: string | undefined;
	    const product = linePrice.product as Stripe.Product | string | null | undefined;

	    if (product && typeof product !== "string") {
	      productName = product.name;
	    } else if (linePrice.id) {
	      // Fallback: retrieve the price with expanded product in case it wasn't expanded.
	      const priceWithProduct = await stripe.prices.retrieve(linePrice.id, {
	        expand: ["product"],
	      });
	      const expandedProduct = priceWithProduct.product as Stripe.Product;
	      productName = expandedProduct.name;
	    }

	    if (!productName) {
	      console.error(
	        "[Stripe Webhook] invoice.payment_succeeded: missing product name for subscription invoice",
	        { invoiceId, subscriptionId, orgId },
	      );
	      return;
	    }

	    // 4) Map plan name to hard-coded credits
	    let creditsToAdd = 0;

	    if (productName === "Blue Magma Pro") {
	      creditsToAdd = 1000;
	    } else if (productName === "Blue Magma Enterprise") {
	      creditsToAdd = 2000;
	    }

	    if (creditsToAdd <= 0) {
	      console.log(
	        "[Stripe Webhook] invoice.payment_succeeded: plan not configured for credits, skipping",
	        { invoiceId, subscriptionId, orgId, productName },
	      );
	      return;
	    }

	    console.log(
	      "[Stripe Webhook] invoice.payment_succeeded: adding subscription credits",
	      {
	        invoiceId,
	        subscriptionId,
	        orgId,
	        productName,
	        creditsToAdd,
	      },
	    );

	    await webhookBillingService.addCredits(orgId, creditsToAdd);

	    console.log("[Stripe Webhook] invoice.payment_succeeded handling complete", {
	      invoiceId,
	      subscriptionId,
	      orgId,
	      productName,
	      creditsToAdd,
	    });
	  } catch (error) {
	    console.error("[Stripe Webhook] Error handling invoice.payment_succeeded:", error);
	  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // TODO: Handle failed payment (send notification, update status)
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  try {
    const orgId = session.metadata?.organization_id;
    console.log("[Stripe Webhook] checkout.session.completed", {
      sessionId: session.id,
      mode: session.mode,
      paymentStatus: session.payment_status,
      orgId,
    });
    if (!orgId) {
      console.error("No organization ID found in session metadata");
      return;
    }

    if (session.mode === "payment") {
      // Handle one-time payment (credits purchase)
      const stripe = getStripe();
      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id,
      );
      if (lineItems.data.length > 0) {
        const lineItem = lineItems.data[0];
        const priceId = lineItem.price?.id;

        if (priceId) {
          // Retrieve the price to get product metadata
          const stripe = getStripe();
          const price = await stripe.prices.retrieve(priceId, {
            expand: ["product"],
          });
          const product = price.product as Stripe.Product;

          // Get credits amount from product metadata
          const creditsAmount = parseInt(product.metadata.credits || "0");
          const quantity = lineItem.quantity || 1;
          const totalCredits = creditsAmount * quantity;

          if (totalCredits > 0) {
            // Add credits to organization using dedicated credits endpoint
            await webhookBillingService.addCredits(orgId, totalCredits);
          } else {
            console.error("No credits found in product metadata or credits amount is 0");
          }
        }
      }
    } else if (session.mode === "subscription") {
      // Handle subscription creation - this is usually handled by subscription.created webhook
      // The subscription.created webhook will handle the actual subscription setup
      console.log(
        "[Stripe Webhook] checkout.session.completed for subscription - subscription.created will handle plan updates",
      );
    }
  } catch (error) {
	    console.error(
	      "[Stripe Webhook] Error handling checkout session completed:",
	      error,
	    );
  }
}

async function handleCancelAtPeriodEnd(
  subscription: Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  },
  orgId: string,
) {
  try {
    // Get the price to determine current plan details
    const priceId = subscription.items.data[0]?.price.id;
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId, {
      expand: ["product"],
    });
    const product = price.product as Stripe.Product;
    const planName = product.name;
    const monthlyCost = (price.unit_amount || 0) / 100;

    // Calculate when the subscription will actually end
    const cancellationDate = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
          .toISOString()
          .split("T")[0]
      : "Unknown";

    // Update organization with "canceling" status
    await webhookBillingService.updateCompleteSubscriptionData(
      orgId,
      subscription.id,
      planName,
      subscription.customer as string,
      monthlyCost,
      "canceling", // Special status to indicate pending cancellation
      `Cancels on ${cancellationDate}`,
    );
  } catch (error) {
    console.error("Error handling cancel at period end:", error);
  }
}
