import { NextResponse } from "next/server";
import { db } from "@/firebase/admin";

export async function GET() {
  console.log("🔥 [Debug API] Checking Firebase connection...");

  try {
    // Count total interviews
    const countSnapshot = await db.collection("interviews").count().get();
    const totalInterviews = countSnapshot.data().count;

    // Get first few interviews
    const interviewsSnapshot = await db.collection("interviews").limit(5).get();
    const sampleInterviews = interviewsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      firebase: {
        connected: true,
        totalInterviews: totalInterviews,
        sampleInterviews: sampleInterviews
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("❌ [Debug API] Firebase connection failed:", error);

    return NextResponse.json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
        details: "Check Firebase Admin SDK initialization and credentials"
      },
      envCheck: {
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? "SET" : "MISSING",
        FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? "SET" : "MISSING",
        FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? "SET" : "MISSING"
      }
    }, { status: 500 });
  }
}