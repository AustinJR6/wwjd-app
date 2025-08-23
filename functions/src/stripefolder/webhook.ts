import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-03-31.basil" as any });
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export const handleStripeWebhookV1 = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") { res.set("Allow", "POST"); res.status(405).send("Method Not Allowed"); return; }

  const sig = req.headers["stripe-signature"] as string | undefined;
  if (!sig) { res.status(400).send("Missing Stripe signature"); return; }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err: any) {
    console.error("[webhook] signature verify failed:", err?.message);
    res.status(400).send(`Webhook Error: ${err.message}`); return;
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.type === "token_pack") {
          const userId = pi.metadata.userId;
          const tokenAmount = Number(pi.metadata.tokenAmount || "0");
          if (userId && tokenAmount > 0) {
            await admin.firestore().collection("profiles").doc(userId)
              .set({ tokens: admin.firestore.FieldValue.increment(tokenAmount) }, { merge: true });
          }
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId =
          (invoice.metadata?.userId as string) ||
          (invoice.subscription_details as any)?.metadata?.userId ||
          "";
        if (userId) {
          await admin.firestore().collection("profiles").doc(userId)
            .set({ isSubscribed: true }, { merge: true });
        }
        break;
      }
      case "customer.subscription.deleted":
      case "customer.subscription.paused": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata?.userId as string) || "";
        if (userId) {
          await admin.firestore().collection("profiles").doc(userId)
            .set({ isSubscribed: false }, { merge: true });
        }
        break;
      }
      default: break;
    }

    res.status(200).send("ok"); return;
  } catch (err) {
    console.error("[webhook] handler error:", err);
    res.status(500).send("Webhook handler error"); return;
  }
});

