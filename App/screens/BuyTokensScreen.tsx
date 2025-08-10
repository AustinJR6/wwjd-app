import React, { useState } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import { initStripe, useStripe } from '@stripe/stripe-react-native';
import { ENV, validateEnv } from '@/config/env';
import { Banner } from '@/components/Banner';

export default function BuyTokensScreen() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ensureStripeInit() {
    await initStripe({
      publishableKey: ENV.STRIPE_PUBLISHABLE_KEY!,
      merchantIdentifier: 'merchant.onevine'
    });
  }

  async function onPurchase(envKey: 'TOKENS_20_PRICE_ID' | 'TOKENS_50_PRICE_ID' | 'TOKENS_100_PRICE_ID', tokenAmount: number) {
    setErrorText(null);
    setLoading(true);
    try {
      const priceId = (ENV as any)[envKey] as string | undefined;
      const missing = validateEnv(['API_BASE_URL', 'STRIPE_PUBLISHABLE_KEY', envKey]);
      if (missing.length) {
        setErrorText(`Missing env (${ENV.CHANNEL}): ${missing.join(', ')}`);
        setLoading(false);
        return;
      }

      await ensureStripeInit();

      const res = await fetch(`${ENV.API_BASE_URL}/stripe/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, tokenAmount }),
      });

      if (!res.ok) throw new Error(`Server ${res.status}: ${await res.text()}`);
      const { paymentIntentClientSecret } = await res.json();

      console.log('[stripe/tokens:diag]', {
        channel: ENV.CHANNEL,
        priceId: priceId?.slice(0, 16),
        hasPiSecret: !!paymentIntentClientSecret,
        apiBase: ENV.API_BASE_URL,
      });

      if (!paymentIntentClientSecret) {
        setErrorText('Missing payment sheet parameters (payment intent).');
        setLoading(false);
        return;
      }

      const { error: initErr } = await initPaymentSheet({
        merchantDisplayName: 'OneVine',
        paymentIntentClientSecret,
      });
      if (initErr) { setErrorText(`initPaymentSheet failed: ${initErr.message}`); setLoading(false); return; }

      const { error: presentErr } = await presentPaymentSheet();
      if (presentErr) { setErrorText(`PaymentSheet error: ${presentErr.message}`); setLoading(false); return; }

      // Success: webhook updates user tokens; client can refetch via REST.
    } catch (e: any) {
      console.error('[stripe/tokens fatal]', e);
      setErrorText(e?.message ?? 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {errorText ? <Banner text={errorText} /> : null}
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Buy Grace Tokens</Text>
      <Button title="Buy 20 Tokens" onPress={() => onPurchase('TOKENS_20_PRICE_ID', 20)} disabled={loading} />
      <Button title="Buy 50 Tokens" onPress={() => onPurchase('TOKENS_50_PRICE_ID', 50)} disabled={loading} />
      <Button title="Buy 100 Tokens" onPress={() => onPurchase('TOKENS_100_PRICE_ID', 100)} disabled={loading} />
      {loading && <ActivityIndicator style={{ marginTop: 10 }} />}
    </View>
  );
}
