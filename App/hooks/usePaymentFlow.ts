import { useEffect } from "react";
import { Alert, Linking } from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { useUserProfileStore } from "@/state/userProfile";
import { getCurrentUserId } from "@/utils/authUtils";
import { sendRequestWithGusBugLogging } from "@/utils/gusBugLogger";
import {
  createTokenPaymentIntent,       // POST createTokenPaymentIntent -> { clientSecret }
  createSubscriptionSetup,        // POST createSubscriptionSetup -> { setupClientSecret, ephemeralKeySecret }
  activateSubscription,           // POST activateSubscription -> { status, paymentIntentClientSecret? }
} from "@/services/apiService";

export type PaymentFlowParams = {
  mode: "setup" | "payment";
  amount?: number;
  currency?: string;
  logType?: string;
};

type BuyTokensParams = { tokenAmount: number; amountUsd: number };
type StartSubParams = { priceId: string; customerId?: string };

export function usePaymentFlow() {
  const {
    initPaymentSheet,
    presentPaymentSheet,
    confirmPaymentSheetPayment,
    handleURLCallback,
  } = useStripe();

  const refetchProfile = useUserProfileStore((s) => s.refetch);
  const profile = useUserProfileStore((s) => s.profile);

  useEffect(() => {
    const sub = Linking.addEventListener("url", (e) => handleURLCallback(e.url));
    return () => sub.remove();
  }, [handleURLCallback]);

  /**
   * Token packs with PaymentSheet (PaymentIntent)
   */
  async function buyTokens({ tokenAmount, amountUsd }: BuyTokensParams): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        Alert.alert("Authentication Required", "Please sign in again.");
        return false;
      }

      // 1) Backend returns a PaymentIntent client secret
      const { clientSecret } = await createTokenPaymentIntent({
        userId,
        tokenAmount,
        amountUsd,
      });

      // 2) Init + present PaymentSheet
      const init = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "OneVine",
      });
      if (init.error) {
        Alert.alert("Payment init failed", init.error.message);
        return false;
      }

      const r = await presentPaymentSheet();
      if (r.error) {
        if (r.error.code !== "Canceled") {
          Alert.alert("Payment Error", r.error.message);
        }
        return false;
      }

      // 3) Webhook will credit tokens; just refresh profile
      await refetchProfile?.();
      return true;
    } catch (err: any) {
      sendRequestWithGusBugLogging("buyTokens_error", { err: String(err?.message || err) }, async () => Promise.resolve());
      Alert.alert("Payment Error", err?.message || "Something went wrong.");
      return false;
    }
  }

  /**
   * Subscriptions with PaymentSheet (SetupIntent -> activate -> maybe confirm PI)
   */
  async function startSubscription({ priceId, customerId }: StartSubParams): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        Alert.alert("Authentication Required", "Please sign in again.");
        return false;
      }

      const cid = customerId || (profile as any)?.stripeCustomerId;
      if (!cid) {
        Alert.alert(
          "Missing Stripe customer",
          "We couldn’t find your Stripe customer. Please try again from your profile screen."
        );
        return false;
      }

      // 1) Collect a payment method via SetupIntent
      const { setupClientSecret, ephemeralKeySecret } = await createSubscriptionSetup({
        customerId: cid,
      });

      const init = await initPaymentSheet({
        setupIntentClientSecret: setupClientSecret,
        customerId: cid,
        customerEphemeralKeySecret: ephemeralKeySecret,
        merchantDisplayName: "OneVine",
      });
      if (init.error) {
        Alert.alert("Payment init failed", init.error.message);
        return false;
      }

      const r1 = await presentPaymentSheet();
      if (r1.error) {
        if (r1.error.code !== "Canceled") {
          Alert.alert("Payment Error", r1.error.message);
        }
        return false;
      }

      // 2) Activate subscription server-side using the PM from the SetupIntent
      const act = await activateSubscription({
        customerId: cid,
        setupClientSecret,
        priceId,
        userId,
      });

      // 3) If first invoice needs 3DS, confirm once
      if (act?.status === "requires_confirmation" && act.paymentIntentClientSecret) {
        const r2 = await confirmPaymentSheetPayment();
        if (r2.error) {
          Alert.alert("Confirmation failed", r2.error.message);
          return false;
        }
      }

      // 4) Webhook flips isSubscribed; refresh
      await refetchProfile?.();
      return true;
    } catch (err: any) {
      sendRequestWithGusBugLogging("startSubscription_error", { err: String(err?.message || err) }, async () => Promise.resolve());
      Alert.alert("Subscription Error", err?.message || "Something went wrong.");
      return false;
    }
  }

  return {
    buyTokens,
    startSubscription,
  };
}
