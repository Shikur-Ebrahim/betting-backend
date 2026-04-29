const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

// Startup Security Check
if (!process.env.API_FOOTBALL_KEY) {
  throw new Error("CRITICAL: API_FOOTBALL_KEY is missing in environment variables.");
}

let serviceAccount;

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
  serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  };
} else {
  try {
    // Fallback to local file for development if individual vars are missing
    const serviceAccountPath = path.join(__dirname, '../tipico.json');
    serviceAccount = require(serviceAccountPath);
  } catch (error) {
    console.error('Firebase Service Account not found or individual env vars missing.');
  }
}

if (!admin.apps.length && serviceAccount) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully using individual env vars');
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

const db = admin.apps.length ? admin.firestore() : null;
const auth = admin.apps.length ? admin.auth() : null;

module.exports = { db, auth, admin };
