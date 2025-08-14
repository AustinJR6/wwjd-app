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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withCors = withCors;
exports.verifyIdToken = verifyIdToken;
exports.extractAuthToken = extractAuthToken;
exports.verifyAuth = verifyAuth;
exports.writeDoc = writeDoc;
exports.logError = logError;
exports.getSecret = getSecret;
const functions = __importStar(require("firebase-functions/v1"));
const secret_manager_1 = require("@google-cloud/secret-manager");
const cors_1 = __importDefault(require("cors"));
const firebase_1 = require("./firebase");
const corsHandler = (0, cors_1.default)({ origin: true, credentials: true });
function withCors(handler) {
    return (req, res) => corsHandler(req, res, () => handler(req, res));
}
async function verifyIdToken(req) {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token)
        throw new Error('Unauthorized');
    return await firebase_1.auth.verifyIdToken(token);
}
function extractAuthToken(req) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
        return undefined;
    return header.split('Bearer ')[1];
}
async function verifyAuth(req) {
    const token = extractAuthToken(req);
    if (!token) {
        throw new Error('Missing Authorization header');
    }
    const decoded = await firebase_1.auth.verifyIdToken(token);
    return { uid: decoded.uid, token };
}
async function writeDoc(path, data) {
    return await firebase_1.db.doc(path).set(data, { merge: true });
}
function logError(context, err) {
    functions.logger.error(context, err);
}
const secretClient = new secret_manager_1.SecretManagerServiceClient();
async function getSecret(secretName) {
    const [version] = await secretClient.accessSecretVersion({
        name: `projects/wwjd-app/secrets/${secretName}/versions/latest`,
    });
    const payload = version.payload?.data?.toString();
    if (!payload)
        throw new Error(`Secret ${secretName} is empty or undefined`);
    return payload;
}
