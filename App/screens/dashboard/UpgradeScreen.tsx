import React, { useState } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import { initStripe, useStripe } from '@stripe/stripe-react-native';
import { ENV, validateEnv } from '@/config/env';
import { Banner } from '@/components/Banner';

export default function UpgradeScreen() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ensureStripeInit() {
    await initStripe({
      publishableKey: ENV.STRIPE_PUBLISHABLE_KEY!,
      merchantIdentifier: 'merchant.onevine'
    });
  }

  async function onSubscribePress() {
    setErrorText(null);
    setLoading(true);
    try {
      const missing = validateEnv(['API_BASE_URL','STRIPE_PUBLISHABLE_KEY','SUB_PRICE_ID']);
      if (missing.length) {
        setErrorText(`Missing env (${ENV.CHANNEL}): ${missing.join(', ')}`);
        setLoading(false);
        return;
      }

      await ensureStripeInit();

      const res = await fetch(`${ENV.API_BASE_URL}/stripe/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: ENV.SUB_PRICE_ID }),
      });

      if (!res.ok) throw new Error(`Server ${res.status}: ${await res.text()}`);
      const { customer, customerEphemeralKeySecret, setupIntentClientSecret } = await res.json();

      console.log('[stripe/subscription:diag]', {
        channel: ENV.CHANNEL,
        pubKey: ENV.STRIPE_PUBLISHABLE_KEY?.slice(0, 16),
        hasSetupSecret: !!setupIntentClientSecret,
        customerId: customer?.id,
        hasEphKey: !!customerEphemeralKeySecret,
        apiBase: ENV.API_BASE_URL,
      });

      if (!setupIntentClientSecret || !customer?.id || !customerEphemeralKeySecret) {
        setErrorText('Missing payment sheet parameters (setup intent / customer / ephemeral key).');
        setLoading(false);
        return;
      }

      const { error: initErr } = await initPaymentSheet({
        merchantDisplayName: 'OneVine',
        customerId: customer.id,
        customerEphemeralKeySecret,
        setupIntentClientSecret,
        allowsDelayedPaymentMethods: false,
      });
      if (initErr) { setErrorText(`initPaymentSheet failed: ${initErr.message}`); setLoading(false); return; }

      const { error: presentErr } = await presentPaymentSheet();
      if (presentErr) { setErrorText(`PaymentSheet error: ${presentErr.message}`); setLoading(false); return; }

      // Success: webhook updates user's subscription; client refetches profile via REST.
    } catch (e: any) {
      console.error('[stripe/subscribe fatal]', e);
      setErrorText(e?.message ?? 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {errorText ? <Banner text={errorText} /> : null}
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>OneVine+ Membership</Text>
      <Button title="Subscribe to OneVine+" onPress={onSubscribePress} disabled={loading} />
      {loading && <ActivityIndicator style={{ marginTop: 10 }} />}
    </View>
  );
}
