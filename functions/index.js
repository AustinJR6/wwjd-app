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

































































































































