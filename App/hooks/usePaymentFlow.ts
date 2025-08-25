import { Alert } from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { useUserProfileStore } from "@/state/userProfile";
import { getCurrentUserId } from "@/utils/authUtils";
import { sendRequestWithGusBugLogging } from "@/utils/gusBugLogger";
import { createTokenPaymentIntent, createSubscriptionPayment } from "@/services/apiService";

export type PaymentFlowParams = {
  mode: "setup" | "payment";
  amount?: number;
  currency?: string;
  logType?: string;
};

type BuyTokensParams = { tokenAmount: number; amountUsd: number };

export function usePaymentFlow() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const refetchProfile = useUserProfileStore((s) => s.refetch);

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

      const { clientSecret } = await createTokenPaymentIntent({
        userId,
        tokenAmount,
        amountUsd,
      });

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

      await refetchProfile?.();
      return true;
    } catch (err: any) {
      sendRequestWithGusBugLogging("buyTokens_error", { err: String(err?.message || err) }, async () => Promise.resolve());
      Alert.alert("Payment Error", err?.message || "Something went wrong.");
      return false;
    }
  }

  /**
   * Subscriptions with PaymentSheet using PaymentIntent client secret
   */
  async function startSubscription(): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        Alert.alert("Authentication Required", "Please sign in again.");
        return false;
      }

      const { clientSecret } = await createSubscriptionPayment();
      if (!clientSecret) throw new Error("No client secret returned");

      const init = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "OneVine",
      });
      if (init.error) {
        Alert.alert("Payment init failed", init.error.message);
        return false;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== "Canceled") {
          Alert.alert("Subscription error", presentError.message);
        }
        return false;
      }

      await refetchProfile?.();
      return true;
    } catch (err: any) {
      sendRequestWithGusBugLogging("startSubscription_error", { err: String(err?.message || err) }, async () => Promise.resolve());
      Alert.alert("Subscription error", err?.message || String(err));
      return false;
    }
  }

  return { buyTokens, startSubscription };
}

