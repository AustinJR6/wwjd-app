const functions = require('firebase-functions');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 🔐 Your Gemini API key is securely stored as a Firebase config variable
const geminiApiKey = functions.config().gemini.api_key;
const genAI = new GoogleGenerativeAI(geminiApiKey);

// 🧠 Main function: generates spiritual reflections using Gemini
exports.generateSpiritualReflection = functions.https.onCall(async (data, context) => {
  // Check auth
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to use this feature.'
    );
  }

  const prompt = data.prompt;
  if (typeof prompt !== 'string' || prompt.length === 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing or invalid "prompt".'
    );
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return { text };
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Something went wrong with Gemini.'
    );
  }
  });


// 💳 createCheckoutSession: Starts a Stripe Checkout session
exports.createCheckoutSession = functions.https.onRequest(async (req, res) => {
  const stripe = require('stripe')(functions.config().stripe.secret_key);
  const { uid, type, amount } = req.body;
  if (!uid || !type) {
    res.status(400).json({ error: 'Missing parameters.' });
    return;
  }
  try {
    let session;
    if (type === 'subscription') {
      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [
          {
            price: functions.config().stripe.subscription_price,
            quantity: 1,
          },
        ],
        metadata: { userId: uid },
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      });
    } else {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: 'Token Pack' },
              unit_amount: Math.round((amount || 0) * 100),
            },
            quantity: 1,
          },
        ],
        metadata: { userId: uid },
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      });
    }
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('❌ createCheckoutSession error:', err);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

































































































































