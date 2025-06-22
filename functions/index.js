const functions = require('firebase-functions');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require("firebase-admin");
if (!admin.apps.length) {
  admin.initializeApp();
}

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

































































































































// 🔐 incrementReligionPoints: Safely update religion totals
exports.incrementReligionPoints = functions.https.onRequest(async (req, res) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    res.status(401).send('Unauthorized – no token');
    return;
  }
  try {
    await admin.auth().verifyIdToken(idToken);
    const { religion, points } = req.body;
    if (
      typeof religion !== 'string' ||
      typeof points !== 'number' ||
      points <= 0 ||
      points > 100
    ) {
      res.status(400).send('Invalid input.');
      return;
    }
    const ref = admin.firestore().collection('religions').doc(religion);
    await admin.firestore().runTransaction(async (t) => {
      const snap = await t.get(ref);
      const current = snap.exists ? snap.data().totalPoints || 0 : 0;
      t.set(ref, { totalPoints: current + points }, { merge: true });
    });
    res.status(200).send({ message: 'Points updated' });
  } catch (err) {
    console.error('🔥 Religion update failed:', err.message);
    res.status(500).send('Internal error');
  }
});
