"use server";
import { db } from "@/firebase/admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  console.log("📝 [createFeedback] Starting feedback creation for interview:", interviewId);

  // Validate input parameters before proceeding
  if (!interviewId || !userId) {
    console.error("❌ [createFeedback] Missing required parameters:", {
      interviewId,
      userId,
      hasInterviewId: !!interviewId,
      hasUserId: !!userId
    });
    return {
      success: false,
      error: "Missing interview ID or user ID"
    };
  }

  if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
    console.error("❌ [createFeedback] Invalid transcript:", transcript);
    return {
      success: false,
      error: "Invalid or empty transcript"
    };
  }

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    console.log("🤖 [createFeedback] Generating AI feedback for transcript length:", transcript.length);

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      console.error("Google Generative AI API key is missing");
      return {
        success: false,
        error: "API configuration error"
      };
    }

    const prompt = `You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories.

INTERVIEW TRANSCRIPT:
${formattedTranscript}

IMPORTANT FORMATTING RULES:
1. Return ONLY a valid JSON object with this exact structure:
{
  "totalScore": 85,
  "categoryScores": [
    {"name": "Communication Skills", "score": 80, "comment": "Clear and structured responses with good articulation"},
    {"name": "Technical Knowledge", "score": 85, "comment": "Good understanding of relevant concepts"},
    {"name": "Problem Solving", "score": 90, "comment": "Strong analytical and problem-solving skills"},
    {"name": "Cultural Fit", "score": 75, "comment": "Good alignment with company values and role requirements"},
    {"name": "Confidence and Clarity", "score": 85, "comment": "Confident delivery and clear communication"}
  ],
  "strengths": ["Strong technical foundation", "Clear communication style", "Good problem-solving approach"],
  "areasForImprovement": ["Could provide more specific examples", "Work on time management during responses", "Include more detailed explanations"],
  "finalAssessment": "Candidate demonstrates strong technical knowledge and good communication skills. Shows potential for the role with some areas for improvement in providing detailed examples and structuring responses."
}

2. categoryScores MUST be an array of exactly 5 objects
3. Each categoryScore object MUST have: name, score (0-100), and comment
4. strengths MUST be an array of strings
5. areasForImprovement MUST be an array of strings
6. No explanations, no markdown, no additional text outside the JSON object`;

    console.log("📡 [createFeedback] Calling Gemini API with model: gemini-2.5-pro");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro"
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    let generatedText;
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      generatedText = response.text();
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error("❌ [createFeedback] Gemini API error:", fetchError.message);
      return {
        success: false,
        error: `Gemini API error: ${fetchError.message}`
      };
    }

    clearTimeout(timeoutId);

    if (!generatedText || !generatedText.trim()) {
      console.error("❌ [createFeedback] Empty response from Gemini");
      return {
        success: false,
        error: "Empty response from AI"
      };
    }

    console.log("📄 [createFeedback] Raw response received (first 500 chars):", generatedText.substring(0, 500) + "...");

    let feedbackData = parseAndValidateFeedback(generatedText);

    console.log("✅ [createFeedback] Parsed feedback data:", {
      totalScore: feedbackData.totalScore,
      categoryScoresLength: feedbackData.categoryScores?.length || 0,
      isCategoryScoresArray: Array.isArray(feedbackData.categoryScores)
    });

    // Validate parsed data - REAL INTERVIEW ONLY
    if (!feedbackData.totalScore || !Array.isArray(feedbackData.categoryScores) || feedbackData.categoryScores.length === 0) {
      console.error("❌ [createFeedback] Invalid feedback data from AI");
      return {
        success: false,
        error: "AI returned invalid evaluation format"
      };
    }

    const feedback = {
      interviewId: interviewId,
      userId: userId,
      totalScore: feedbackData.totalScore,
      categoryScores: feedbackData.categoryScores,
      strengths: feedbackData.strengths || [],
      areasForImprovement: feedbackData.areasForImprovement || [],
      finalAssessment: feedbackData.finalAssessment || "Evaluation completed.",
      createdAt: new Date().toISOString(),
      model: "gemini-2.5-pro",
      status: "completed",
      version: "1.0",
      isRealInterview: true
    };

    console.log("💾 [createFeedback] Saving feedback to Firestore...");
    console.log("🔍 [createFeedback] Feedback data to save:", {
      interviewId: feedback.interviewId,
      userId: feedback.userId,
      totalScore: feedback.totalScore
    });

    const feedbackRef = feedbackId
      ? db.collection("feedback").doc(feedbackId)
      : db.collection("feedback").doc();

    await feedbackRef.set(feedback, { ignoreUndefinedProperties: true });

    console.log("✅ [createFeedback] Feedback saved with ID:", feedbackRef.id);

    return {
      success: true,
      feedbackId: feedbackRef.id,
      data: {
        totalScore: feedback.totalScore,
        categoryScoresCount: feedback.categoryScores.length
      }
    };
  } catch (error: any) {
    console.error("❌ [createFeedback] Error in feedback creation:", error.message);

    return {
      success: false,
      error: error.message || "Failed to generate interview evaluation"
    };
  }
}

function parseAndValidateFeedback(text: string): any {
  const cleanedText = text.trim();

  const withoutMarkdown = cleanedText
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .replace(/^JSON:\s*/i, '')
    .trim();

  let parsedData;

  try {
    parsedData = JSON.parse(withoutMarkdown);
  } catch (e) {
    const jsonMatch = withoutMarkdown.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsedData = JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.error("❌ Could not parse JSON from AI response");
        throw new Error("Invalid JSON response from AI");
      }
    } else {
      console.error("❌ No JSON found in AI response");
      throw new Error("No valid evaluation data found");
    }
  }

  return normalizeFeedbackStructure(parsedData);
}

function normalizeFeedbackStructure(data: any): any {
  const result: any = {};

  result.totalScore = typeof data.totalScore === 'number'
    ? Math.max(0, Math.min(100, data.totalScore))
    : 75;

  if (Array.isArray(data.categoryScores)) {
    result.categoryScores = data.categoryScores.map((item: any, index: number) => {
      const defaultCategories = [
        "Communication Skills",
        "Technical Knowledge",
        "Problem Solving",
        "Cultural Fit",
        "Confidence and Clarity"
      ];

      return {
        name: item.name || defaultCategories[index] || `Category ${index + 1}`,
        score: typeof item.score === 'number'
          ? Math.max(0, Math.min(100, item.score))
          : 70,
        comment: item.comment || `Evaluation based on interview performance`
      };
    }).slice(0, 5);
  } else {
    throw new Error("Invalid category scores format");
  }

  if (Array.isArray(data.strengths)) {
    result.strengths = data.strengths
      .filter((item: any) => typeof item === 'string')
      .slice(0, 5);
  } else {
    result.strengths = [];
  }

  if (Array.isArray(data.areasForImprovement)) {
    result.areasForImprovement = data.areasForImprovement
      .filter((item: any) => typeof item === 'string')
      .slice(0, 5);
  } else {
    result.areasForImprovement = [];
  }

  result.finalAssessment = typeof data.finalAssessment === 'string'
    ? data.finalAssessment
    : "Evaluation completed based on interview performance.";

  return result;
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  'use server'; // CRITICAL: Ensure server-side execution

  const { interviewId, userId } = params;

  console.log("🔄 [getFeedbackByInterviewId] FRESH FETCH - No cache", {
    timestamp: new Date().toISOString(),
    interviewId,
    userId
  });

  if (!interviewId || !userId) {
    console.warn("⚠️ [getFeedbackByInterviewId] Missing userId or interviewId:", {
      interviewId,
      userId,
      hasUserId: !!userId,
      hasInterviewId: !!interviewId
    });
    return null;
  }

  console.log("📝 [getFeedbackByInterviewId] Looking for feedback:", { interviewId, userId });

  try {
    const querySnapshot = await db
      .collection("feedback")
      .where("interviewId", "==", interviewId)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    console.log("📊 [getFeedbackByInterviewId] Query results:", querySnapshot.size, "found");

    if (querySnapshot.empty) {
      console.log("📭 [getFeedbackByInterviewId] No feedback found");
      return null;
    }

    const feedbackDoc = querySnapshot.docs[0];
    const feedbackData = feedbackDoc.data();

    console.log("✅ [getFeedbackByInterviewId] Feedback found with ID:", feedbackDoc.id);
    console.log("📋 [getFeedbackByInterviewId] Feedback data:", {
      totalScore: feedbackData.totalScore,
      categoryScores: feedbackData.categoryScores?.length || 0,
      timestamp: feedbackData.createdAt
    });

    return { id: feedbackDoc.id, ...feedbackData } as Feedback;
  } catch (error) {
    console.error("❌ [getFeedbackByInterviewId] Error fetching feedback:", error);
    return null;
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  'use server'; // CRITICAL: Ensure server-side execution

  console.log("🔄 [getInterviewById] FRESH FETCH:", {
    id,
    timestamp: new Date().toISOString()
  });

  console.log("🔍 [getInterviewById] ==========================================");
  console.log("🔍 [getInterviewById] Starting with ID:", id);
  console.log("🔍 [getInterviewById] Timestamp:", new Date().toISOString());

  if (!id || typeof id !== 'string' || id.trim() === '') {
    console.error("❌ [getInterviewById] Invalid ID provided:", id);
    return null;
  }

  try {
    console.log("🔥 [getInterviewById] Checking Firebase Admin initialization...");

    if (!db) {
      console.error("❌ [getInterviewById] Firebase Admin 'db' is undefined or null");
      console.error("❌ [getInterviewById] Check if @/firebase/admin is exporting 'db' correctly");
      return null;
    }

    console.log("📁 [getInterviewById] Using collection: 'interviews'");
    console.log("📁 [getInterviewById] Document ID:", id);

    const docRef = db.collection("interviews").doc(id);
    console.log("📄 [getInterviewById] Document reference path:", docRef.path);

    console.log("⚡ [getInterviewById] Attempting to fetch document from Firestore...");
    const doc = await docRef.get();

    console.log("✅ [getInterviewById] Document retrieval complete");
    console.log("📊 [getInterviewById] Document exists:", doc.exists);

    if (!doc.exists) {
      console.warn(`❌ [getInterviewById] Interview not found with id: ${id}`);

      console.log("🩺 [getInterviewById] Running diagnostic check...");
      try {
        const testQuery = await db.collection("interviews").limit(1).get();
        console.log(`📈 [getInterviewById] Collection 'interviews' exists with ${testQuery.size} total document(s)`);

        const allDocs = await db.collection("interviews").get();
        console.log(`📈 [getInterviewById] Total interviews in database: ${allDocs.size}`);

        const docIds = allDocs.docs.slice(0, 5).map(doc => doc.id);
        console.log(`📋 [getInterviewById] Sample document IDs: ${docIds.join(', ')}`);

        const similarIds = allDocs.docs
          .filter(d => d.id.toLowerCase().includes(id.toLowerCase()))
          .map(d => d.id);

        if (similarIds.length > 0) {
          console.log(`🔍 [getInterviewById] Found similar IDs (case-insensitive): ${similarIds.join(', ')}`);
        }
      } catch (diagError) {
        console.error("❌ [getInterviewById] Diagnostic check failed:", diagError);
      }

      console.log("🔍 [getInterviewById] ==========================================");
      return null;
    }

    const data = doc.data();
    console.log("📋 [getInterviewById] Document data received");

    if (!data) {
      console.warn("❌ [getInterviewById] Document exists but data is null/undefined");
      console.log("🔍 [getInterviewById] ==========================================");
      return null;
    }

    console.log("🎯 [getInterviewById] Key fields found:");
    console.log("   - id:", doc.id);
    console.log("   - role:", data.role || "MISSING");
    console.log("   - type:", data.type || "MISSING");
    console.log("   - level:", data.level || "MISSING");
    console.log("   - userId:", data.userId || "MISSING");
    console.log("   - questions count:", Array.isArray(data.questions) ? data.questions.length : "INVALID");
    console.log("   - techstack:", Array.isArray(data.techstack) ? data.techstack.join(', ') : "INVALID");
    console.log("   - createdAt:", data.createdAt || "MISSING");
    console.log("   - finalized:", data.finalized !== undefined ? data.finalized : "MISSING");

    const requiredFields = ['role', 'type', 'questions', 'userId'];
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      console.warn(`⚠️ [getInterviewById] Missing required fields: ${missingFields.join(', ')}`);
    }

    const interview = {
      id: doc.id,
      ...data
    } as Interview;

    console.log("✅ [getInterviewById] Successfully parsed interview object");
    console.log("✅ [getInterviewById] Interview found and ready to return");
    console.log("🔍 [getInterviewById] ==========================================");

    return interview;
  } catch (error: any) {
    console.error("❌ [getInterviewById] ERROR fetching interview:");
    console.error("   Error name:", error?.name);
    console.error("   Error message:", error?.message);
    console.error("   Error code:", error?.code);
    console.error("   Error stack:", error?.stack?.split('\n')[0]);

    if (error?.code === 'permission-denied') {
      console.error("   🔐 PERMISSION DENIED - Firebase rules are blocking access");
      console.error("   🔐 Ensure Firebase Admin SDK has proper service account credentials");
    } else if (error?.code === 'not-found') {
      console.error("   🔍 NOT FOUND - Collection or document doesn't exist");
    } else if (error?.message?.includes('No app')) {
      console.error("   🔥 FIREBASE NOT INITIALIZED - Check environment variables:");
      console.error("   🔥 FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID ? "SET" : "MISSING");
      console.error("   🔥 FIREBASE_CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL ? "SET" : "MISSING");
      console.error("   🔥 FIREBASE_PRIVATE_KEY:", process.env.FIREBASE_PRIVATE_KEY ? "SET (first 20 chars)" : "MISSING");
    } else if (error?.message?.includes('network')) {
      console.error("   🌐 NETWORK ERROR - Check internet connection and Firebase access");
    }

    console.log("🔍 [getInterviewById] ==========================================");
    return null;
  }
}

export async function getInterviewsByUserId(
  userId?: string
): Promise<Interview[]> {
  console.log("📋 [getInterviewsByUserId] Fetching interviews for user:", userId);

  if (!userId) {
    console.log("👤 [getInterviewsByUserId] No userId provided, returning empty array");
    return [];
  }

  try {
    console.log("🔍 [getInterviewsByUserId] Querying Firestore for userId:", userId);

    const interviews = await db
      .collection("interviews")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    console.log("✅ [getInterviewsByUserId] Found", interviews.docs.length, "interviews");

    const result = interviews.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Interview[];

    if (result.length > 0) {
      console.log("📋 [getInterviewsByUserId] Sample interview IDs:", result.slice(0, 3).map(i => i.id));
    }

    return result;
  } catch (error) {
    console.error("❌ [getInterviewsByUserId] Error fetching interviews:", error);
    return [];
  }
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[]> {
  const { userId, limit = 20 } = params;

  console.log("🌐 [getLatestInterviews] Fetching latest interviews, excluding user:", userId);

  if (!userId) {
    console.log("👤 [getLatestInterviews] No userId provided, returning empty array");
    return [];
  }

  try {
    console.log("🔍 [getLatestInterviews] Querying for finalized interviews...");

    const interviews = await db
      .collection("interviews")
      .where("finalized", "==", true)
      .where("userId", "!=", userId)
      .orderBy("userId")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    console.log("✅ [getLatestInterviews] Found", interviews.docs.length, "interviews");

    const result = interviews.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Interview[];

    return result;
  } catch (error) {
    console.error("❌ [getLatestInterviews] Error fetching latest interviews:", error);
    return [];
  }
}

// Type definitions
interface CreateFeedbackParams {
  interviewId: string;
  userId: string;
  transcript: Array<{ role: string; content: string }>;
  feedbackId?: string;
}

interface GetFeedbackByInterviewIdParams {
  interviewId: string;
  userId: string;
}

interface Feedback {
  id: string;
  interviewId: string;
  userId: string;
  totalScore: number;
  categoryScores: Array<{ name: string; score: number; comment: string }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: string;
  model: string;
  status: string;
  version: string;
  isRealInterview?: boolean;
}

interface Interview {
  id: string;
  role: string;
  type: string;
  level: string;
  techstack: string[];
  questions: string[];
  userId: string;
  finalized: boolean;
  coverImage: string;
  createdAt: string;
  questionCount?: number;
}

interface GetLatestInterviewsParams {
  userId: string;
  limit?: number;
}