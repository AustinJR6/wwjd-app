import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const PROFILES_COLLECTION = process.env.PROFILES_COLLECTION || "profiles";

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
        if (pi.metadata?.type === "tokens" && pi.metadata?.uid) {
          const uid = pi.metadata.uid;
          const qty = Number(pi.metadata.quantity || 0);
          if (qty > 0) {
            await admin.firestore()
              .collection(PROFILES_COLLECTION)
              .doc(uid)
              .set({ tokens: admin.firestore.FieldValue.increment(qty) }, { merge: true });
          }
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : (invoice as any).customer?.id;
        const subscriptionId =
          typeof (invoice as any).subscription === "string"
            ? (invoice as any).subscription
            : (invoice as any).subscription?.id;

        if (!customerId) break;

        // Find profile by stripeCustomerId
        const profilesRef = admin
          .firestore()
          .collection(PROFILES_COLLECTION)
          .where("stripeCustomerId", "==", customerId)
          .limit(1);

        const snap = await profilesRef.get();
        if (snap.empty) break;

        const doc = snap.docs[0];
        const uid = doc.id;
        const profileRef = admin.firestore().collection(PROFILES_COLLECTION).doc(uid);

        // 1) Mark as subscribed/active
        await profileRef.set(
          { isSubscribed: true, subscriptionStatus: "active" },
          { merge: true },
        );

        // 2) Write subscriptions/{uid} (one-per-user pattern)
        const startedAt = invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date();

        const amountPaid = (invoice.amount_paid ?? 0) / 100;
        const currency = (invoice.currency || "usd").toUpperCase();

        const subscriptionDocRef = admin.firestore().collection("subscriptions").doc(uid);
        await subscriptionDocRef.set(
          {
            uid,
            customerId,
            subscriptionId,
            latestInvoiceId: invoice.id,
            amountPaid,
            currency,
            status: "active",
            startedAt,
            nextBillingAt:
              invoice.lines?.data?.[0]?.period?.end
                ? new Date(invoice.lines.data[0].period.end * 1000)
                : admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        // 3) Optional: log transaction
        await profileRef.collection("transactions").add({
          type: "subscription_payment",
          invoiceId: invoice.id,
          subscriptionId,
          amount: amountPaid,
          currency,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        break;
      }
      case "customer.subscription.deleted":
      case "customer.subscription.paused": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        const status = event.type === "customer.subscription.deleted" ? "canceled" : "paused";
        if (!customerId) break;

        const profilesRef = admin
          .firestore()
          .collection(PROFILES_COLLECTION)
          .where("stripeCustomerId", "==", customerId)
          .limit(1);
        const snap = await profilesRef.get();
        if (snap.empty) break;

        const uid = snap.docs[0].id;
        const profileRef = admin.firestore().collection(PROFILES_COLLECTION).doc(uid);
        await profileRef.set({ isSubscribed: false, subscriptionStatus: status }, { merge: true });
        await admin
          .firestore()
          .collection("subscriptions")
          .doc(uid)
          .set({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
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

