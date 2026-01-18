import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

console.log("🔥 [Firebase Admin] Initializing Firebase Admin SDK...");

function initFirebaseAdmin() {
  const apps = getApps();

  if (!apps.length) {
    console.log("🔥 [Firebase Admin] No Firebase app found, initializing new one...");

    // Check environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    console.log("🔥 [Firebase Admin] Environment check:");
    console.log("   - FIREBASE_PROJECT_ID:", projectId ? `✅ (${projectId.substring(0, 10)}...)` : "❌ MISSING");
    console.log("   - FIREBASE_CLIENT_EMAIL:", clientEmail ? `✅ (${clientEmail})` : "❌ MISSING");
    console.log("   - FIREBASE_PRIVATE_KEY:", privateKey ? "✅ SET" : "❌ MISSING");

    if (!projectId || !clientEmail || !privateKey) {
      console.error("❌ [Firebase Admin] Missing required environment variables!");
      throw new Error("Firebase Admin environment variables are not set");
    }

    try {
      initializeApp({
        credential: cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: privateKey?.replace(/\\n/g, "\n"),
        }),
      });
      console.log("✅ [Firebase Admin] Firebase Admin SDK initialized successfully");
    } catch (error) {
      console.error("❌ [Firebase Admin] Failed to initialize Firebase Admin SDK:", error);
      throw error;
    }
  } else {
    console.log("✅ [Firebase Admin] Using existing Firebase app");
  }

  const auth = getAuth();
  const db = getFirestore();

  console.log("✅ [Firebase Admin] Auth and Firestore services initialized");

  return { auth, db };
}

export const { auth, db } = initFirebaseAdmin();