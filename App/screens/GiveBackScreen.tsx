import React, { useState } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import { initStripe, useStripe } from '@stripe/stripe-react-native';
import { ENV, validateEnv } from '@/config/env';
import { Banner } from '@/components/Banner';

export default function GiveBackScreen() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ensureStripeInit() {
    await initStripe({
      publishableKey: ENV.STRIPE_PUBLISHABLE_KEY!,
      merchantIdentifier: 'merchant.onevine'
    });
  }

  async function onDonate(amount: number) {
    setErrorText(null);
    setLoading(true);
    try {
      const missing = validateEnv(['API_BASE_URL','STRIPE_PUBLISHABLE_KEY']);
      if (missing.length) {
        setErrorText(`Missing env (${ENV.CHANNEL}): ${missing.join(', ')}`);
        setLoading(false);
        return;
      }

      await ensureStripeInit();

      const res = await fetch(`${ENV.API_BASE_URL}/stripe/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      if (!res.ok) throw new Error(`Server ${res.status}: ${await res.text()}`);
      const { paymentIntentClientSecret } = await res.json();

      console.log('[stripe/donation:diag]', {
        channel: ENV.CHANNEL,
        amount,
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
    } catch (e: any) {
      console.error('[stripe/donation fatal]', e);
      setErrorText(e?.message ?? 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {errorText ? <Banner text={errorText} /> : null}
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Give Back</Text>
      <Button title="$5" onPress={() => onDonate(500)} disabled={loading} />
      <Button title="$10" onPress={() => onDonate(1000)} disabled={loading} />
      <Button title="$20" onPress={() => onDonate(2000)} disabled={loading} />
      {loading && <ActivityIndicator style={{ marginTop: 10 }} />}
    </View>
  );
}
