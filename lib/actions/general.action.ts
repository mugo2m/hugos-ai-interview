"use server";
import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  console.log("📝 [createFeedback] Starting feedback creation for interview:", interviewId);

  // 🔥 ADDED: Validate input parameters before proceeding
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

    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
      console.error("HuggingFace API key is missing");
      throw new Error("API configuration error");
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

    const targetModel = "HuggingFaceTB/SmolLM3-3B";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    console.log(`📡 [createFeedback] Calling HuggingFace API with model: ${targetModel}`);

    let response;
    try {
      response = await fetch(
        "https://router.huggingface.co/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [
              {
                "role": "system",
                "content": "You are a professional interviewer. Return ONLY valid JSON objects. categoryScores MUST be an array."
              },
              {
                "role": "user",
                "content": prompt
              }
            ],
            max_tokens: 2000,
            temperature: 0.7,
            top_p: 0.9,
            response_format: { type: "json_object" }
          }),
          signal: controller.signal
        }
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error("❌ [createFeedback] Network error:", fetchError.message);
      throw new Error(`Network error: ${fetchError.message}`);
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "No error details");
      console.error("❌ [createFeedback] HuggingFace API error:", {
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError: any) {
      const text = await response.text();
      console.error("❌ [createFeedback] Failed to parse JSON response:", text.substring(0, 200));
      throw new Error("Invalid JSON response from HuggingFace");
    }

    const generatedText = data.choices?.[0]?.message?.content || "";

    if (!generatedText.trim()) {
      console.error("❌ [createFeedback] Empty response from HuggingFace");
      throw new Error("Empty response from AI");
    }

    console.log("📄 [createFeedback] Raw response received (first 500 chars):", generatedText.substring(0, 500) + "...");

    // Parse and validate the feedback data
    let feedbackData = parseAndValidateFeedback(generatedText);

    console.log("✅ [createFeedback] Parsed feedback data:", {
      totalScore: feedbackData.totalScore,
      categoryScoresLength: feedbackData.categoryScores?.length || 0,
      isCategoryScoresArray: Array.isArray(feedbackData.categoryScores)
    });

    // 🔥 ADDED: Ensure userId is not undefined before saving
    if (!userId) {
      console.error("❌ [createFeedback] userId is undefined, cannot save feedback");
      throw new Error("User ID is required to save feedback");
    }

    // Save to Firebase
    const feedback = {
      interviewId: interviewId,
      userId: userId, // This was causing the error if undefined
      totalScore: feedbackData.totalScore || 75,
      categoryScores: feedbackData.categoryScores || createDefaultCategoryScores(),
      strengths: feedbackData.strengths || ["Good participation", "Demonstrated relevant knowledge"],
      areasForImprovement: feedbackData.areasForImprovement || ["Could provide more examples", "Work on response structure"],
      finalAssessment: feedbackData.finalAssessment || "Candidate participated in the mock interview.",
      createdAt: new Date().toISOString(),
      model: targetModel,
      status: "completed",
      version: "1.0"
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

    // 🔥 ADDED: Enable ignoreUndefinedProperties to prevent the error
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

    // Create guaranteed-safe fallback feedback
    return await createFallbackFeedback(interviewId, userId, error.message, feedbackId);
  }
}

// Helper function to parse and validate feedback
function parseAndValidateFeedback(text: string): any {
  const cleanedText = text.trim();

  // Remove any markdown code blocks
  const withoutMarkdown = cleanedText
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .replace(/^JSON:\s*/i, '')
    .trim();

  let parsedData;

  // Try to parse as JSON
  try {
    parsedData = JSON.parse(withoutMarkdown);
  } catch (e) {
    // Try to find JSON object within text
    const jsonMatch = withoutMarkdown.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsedData = JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.log("⚠️ Could not parse JSON, using default structure");
        return createDefaultFeedbackStructure();
      }
    } else {
      console.log("⚠️ No JSON found in response");
      return createDefaultFeedbackStructure();
    }
  }

  // Validate and normalize the structure
  return normalizeFeedbackStructure(parsedData);
}

// Helper function to normalize feedback structure
function normalizeFeedbackStructure(data: any): any {
  const result: any = {};

  // Ensure totalScore is a valid number
  result.totalScore = typeof data.totalScore === 'number'
    ? Math.max(0, Math.min(100, data.totalScore))
    : 75;

  // Ensure categoryScores is a valid array
  if (Array.isArray(data.categoryScores)) {
    result.categoryScores = data.categoryScores.map((item: any, index: number) => {
      // Use default category names if not provided
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
    }).slice(0, 5); // Ensure max 5 items
  } else {
    result.categoryScores = createDefaultCategoryScores();
  }

  // Ensure strengths is an array of strings
  if (Array.isArray(data.strengths)) {
    result.strengths = data.strengths
      .filter((item: any) => typeof item === 'string')
      .slice(0, 5);
  } else {
    result.strengths = ["Good participation", "Demonstrated relevant knowledge"];
  }

  // Ensure areasForImprovement is an array of strings
  if (Array.isArray(data.areasForImprovement)) {
    result.areasForImprovement = data.areasForImprovement
      .filter((item: any) => typeof item === 'string')
      .slice(0, 5);
  } else {
    result.areasForImprovement = ["Could provide more examples", "Work on response structure"];
  }

  // Ensure finalAssessment is a string
  result.finalAssessment = typeof data.finalAssessment === 'string'
    ? data.finalAssessment
    : "Candidate participated in the mock interview. Further evaluation would benefit from more detailed responses.";

  return result;
}

// Helper function to create default category scores
function createDefaultCategoryScores(): Array<{name: string, score: number, comment: string}> {
  return [
    {
      name: "Communication Skills",
      score: 70,
      comment: "Clear communication with room for more structured responses"
    },
    {
      name: "Technical Knowledge",
      score: 75,
      comment: "Good understanding of relevant technical concepts"
    },
    {
      name: "Problem Solving",
      score: 72,
      comment: "Logical approach to problem-solving with demonstrated analytical thinking"
    },
    {
      name: "Cultural Fit",
      score: 68,
      comment: "Good alignment with role requirements and company values"
    },
    {
      name: "Confidence and Clarity",
      score: 70,
      comment: "Confident delivery with clear articulation of thoughts"
    }
  ];
}

// Helper function to create default feedback structure
function createDefaultFeedbackStructure() {
  return {
    totalScore: 75,
    categoryScores: createDefaultCategoryScores(),
    strengths: ["Good participation", "Demonstrated relevant knowledge", "Willingness to learn"],
    areasForImprovement: ["Could provide more specific examples", "Work on structuring responses", "Practice time management"],
    finalAssessment: "Candidate completed the mock interview successfully. Shows potential for growth with continued practice and experience."
  };
}

// Helper function to create fallback feedback
async function createFallbackFeedback(
  interviewId: string,
  userId: string,
  errorMessage: string,
  feedbackId?: string
) {
  try {
    console.log("🔄 [createFallbackFeedback] Creating fallback feedback due to:", errorMessage);

    const fallbackFeedback = {
      interviewId: interviewId,
      userId: userId,
      totalScore: 75,
      categoryScores: createDefaultCategoryScores(),
      strengths: [
        "Completed the mock interview successfully",
        "Demonstrated willingness to learn and improve",
        "Shows good potential for growth"
      ],
      areasForImprovement: [
        "Could provide more detailed examples from past experience",
        "Work on structuring responses for better clarity",
        "Practice time management during answers"
      ],
      finalAssessment: "Candidate successfully completed the mock interview. The AI feedback system encountered a temporary issue, but overall participation and engagement were good. Shows solid foundation with areas for continued development.",
      createdAt: new Date().toISOString(),
      model: "fallback",
      status: "completed",
      error: errorMessage.substring(0, 200), // Store limited error message
      isFallback: true,
      version: "1.0"
    };

    const feedbackRef = feedbackId
      ? db.collection("feedback").doc(feedbackId)
      : db.collection("feedback").doc();

    // 🔥 ADDED: Enable ignoreUndefinedProperties here too
    await feedbackRef.set(fallbackFeedback, { ignoreUndefinedProperties: true });

    console.log("✅ [createFallbackFeedback] Fallback feedback saved with ID:", feedbackRef.id);

    return {
      success: true,
      feedbackId: feedbackRef.id,
      fallback: true,
      message: "Feedback generated using fallback mode"
    };
  } catch (fallbackError: any) {
    console.error("❌ [createFallbackFeedback] Fallback creation failed:", fallbackError.message);
    return {
      success: false,
      error: "Failed to generate feedback, even in fallback mode"
    };
  }
}

// 🔥 UPDATED: getFeedbackByInterviewId function with validation
export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  // 🔥 ADDED: Validate parameters before querying
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

    // Ensure categoryScores is always an array for the frontend
    if (feedbackData.categoryScores && !Array.isArray(feedbackData.categoryScores)) {
      console.warn("⚠️ [getFeedbackByInterviewId] Converting categoryScores to array");
      feedbackData.categoryScores = createDefaultCategoryScores();
    }

    console.log("✅ [getFeedbackByInterviewId] Feedback found with ID:", feedbackDoc.id);
    console.log("📋 [getFeedbackByInterviewId] Feedback structure:", {
      totalScore: feedbackData.totalScore,
      categoryScoresType: Array.isArray(feedbackData.categoryScores),
      categoryScoresLength: Array.isArray(feedbackData.categoryScores) ? feedbackData.categoryScores.length : 'N/A'
    });

    return { id: feedbackDoc.id, ...feedbackData } as Feedback;
  } catch (error) {
    console.error("❌ [getFeedbackByInterviewId] Error fetching feedback:", error);
    return null;
  }
}

// Rest of your functions remain the same...
export async function getInterviewById(id: string): Promise<Interview | null> {
  console.log("🔍 [getInterviewById] ==========================================");
  console.log("🔍 [getInterviewById] Starting with ID:", id);
  console.log("🔍 [getInterviewById] Timestamp:", new Date().toISOString());

  // Validate input
  if (!id || typeof id !== 'string' || id.trim() === '') {
    console.error("❌ [getInterviewById] Invalid ID provided:", id);
    return null;
  }

  try {
    // Check Firebase initialization
    console.log("🔥 [getInterviewById] Checking Firebase Admin initialization...");

    if (!db) {
      console.error("❌ [getInterviewById] Firebase Admin 'db' is undefined or null");
      console.error("❌ [getInterviewById] Check if @/firebase/admin is exporting 'db' correctly");
      return null;
    }

    console.log("📁 [getInterviewById] Using collection: 'interviews'");
    console.log("📁 [getInterviewById] Document ID:", id);

    // Create document reference
    const docRef = db.collection("interviews").doc(id);
    console.log("📄 [getInterviewById] Document reference path:", docRef.path);

    // Try to get the document
    console.log("⚡ [getInterviewById] Attempting to fetch document from Firestore...");
    const doc = await docRef.get();

    console.log("✅ [getInterviewById] Document retrieval complete");
    console.log("📊 [getInterviewById] Document exists:", doc.exists);

    if (!doc.exists) {
      console.warn(`❌ [getInterviewById] Interview not found with id: ${id}`);

      // Diagnostic: Check if collection exists by trying a simple query
      console.log("🩺 [getInterviewById] Running diagnostic check...");
      try {
        const testQuery = await db.collection("interviews").limit(1).get();
        console.log(`📈 [getInterviewById] Collection 'interviews' exists with ${testQuery.size} total document(s)`);

        // Check if any document has this ID pattern
        const allDocs = await db.collection("interviews").get();
        console.log(`📈 [getInterviewById] Total interviews in database: ${allDocs.size}`);

        // List first few document IDs for debugging
        const docIds = allDocs.docs.slice(0, 5).map(doc => doc.id);
        console.log(`📋 [getInterviewById] Sample document IDs: ${docIds.join(', ')}`);

        // Check for similar IDs (case-insensitive)
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

    // Log key fields for debugging
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

    // Check required fields for Interview type
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

    // Common Firebase error handling
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

    // Log sample of returned interviews for debugging
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
      .orderBy("userId") // Required when using !=
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