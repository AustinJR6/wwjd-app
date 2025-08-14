"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGeminiModel = createGeminiModel;
exports.fetchReligionContext = fetchReligionContext;
const logger = __importStar(require("firebase-functions/logger"));
const functions = __importStar(require("firebase-functions/v1"));
const generative_ai_1 = require("@google/generative-ai");
const firebase_1 = require("./firebase");
const GEMINI_API_KEY = functions.config().gemini?.key || '';
function createGeminiModel(apiKey = GEMINI_API_KEY) {
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        return genAI.getGenerativeModel({ model: 'models/gemini-2.5-pro' });
    }
    catch (err) {
        logger.error('Failed to initialize GoogleGenerativeAI', err);
        throw err;
    }
}
async function fetchReligionContext(religionId) {
    const fallback = { name: 'Spiritual Guide', aiVoice: 'Reflective Mentor' };
    if (!religionId)
        return fallback;
    try {
        const doc = await firebase_1.db.collection('religion').doc(religionId).get();
        if (!doc.exists)
            return fallback;
        const data = doc.data() || {};
        return {
            name: data.name || fallback.name,
            aiVoice: data.aiVoice || fallback.aiVoice,
        };
    }
    catch (err) {
        logger.warn('Failed to fetch religion context', err);
        return fallback;
    }
}
