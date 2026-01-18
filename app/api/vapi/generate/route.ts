import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: NextRequest) {
  try {
    const { type, role, level, techstack, amount, userid } = await request.json();

    // Validate required fields
    if (!role || !type || !level || !userid) {
      return NextResponse.json(
        { error: "Missing required fields: role, type, level, userid are required" },
        { status: 400 }
      );
    }

    // Build optimized prompt for better JSON response
    const prompt = `You are a technical interview specialist. Generate ${amount || 5} interview questions with these specifications:

JOB DETAILS:
- Role: ${role}
- Experience Level: ${level}
- Tech Stack: ${techstack || "General technology"}
- Question Focus: ${type}

IMPORTANT FORMATTING RULES:
1. Return ONLY a valid JSON array of strings
2. Each string should be a complete interview question
3. Questions must be suitable for voice synthesis (no special characters like /, *, emojis)
4. No explanations, no markdown, no additional text
5. Maximum 15 words per question for clarity

EXAMPLE FORMAT:
["What experience do you have with React hooks?", "How do you handle state management in large applications?"]

QUESTIONS:`;

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      console.error("Google Generative AI API key is missing");
      return NextResponse.json(
        { error: "API configuration error - Gemini API key required" },
        { status: 500 }
      );
    }

    console.log(`Calling Gemini API for ${role} ${level} position...`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1000,
        responseMimeType: "application/json"
      }
    });

    let generatedText;
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      generatedText = response.text();
    } catch (error: any) {
      console.error("Gemini API error:", error.message);
      // ❌ NO FALLBACK - Return error
      return NextResponse.json({
        success: false,
        error: `Gemini API error: ${error.message}`,
        solution: "Please check your API key and try again"
      }, {
        status: 500,
        headers: {
          'Cache-Control': 'no-store'
        }
      });
    }

    if (!generatedText.trim()) {
      // ❌ NO FALLBACK - Return error
      return NextResponse.json({
        success: false,
        error: "Empty response from Gemini AI",
        solution: "Please try again with a different prompt"
      }, {
        status: 500,
        headers: {
          'Cache-Control': 'no-store'
        }
      });
    }

    console.log("Raw Gemini response:", generatedText.substring(0, 200) + "...");

    // Parse the response into an array of questions
    const questionsArray = parseGeneratedText(generatedText, parseInt(amount) || 5);

    // Clean and validate questions
    const cleanQuestionsArray = cleanQuestions(questionsArray);

    if (cleanQuestionsArray.length === 0) {
      // ❌ NO FALLBACK - Return error
      return NextResponse.json({
        success: false,
        error: "No valid questions generated from AI response",
        solution: "Please try again with more specific requirements"
      }, {
        status: 500,
        headers: {
          'Cache-Control': 'no-store'
        }
      });
    }

    // Save to Firebase
    const interview = {
      role: role,
      type: type,
      level: level,
      techstack: typeof techstack === 'string'
        ? techstack.split(",").map((t: string) => t.trim()).filter(Boolean)
        : Array.isArray(techstack) ? techstack : [],
      questions: cleanQuestionsArray,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
      questionCount: cleanQuestionsArray.length,
      source: "gemini",
      isRealInterview: true
    };

    try {
      await db.collection("interviews").add(interview);
      console.log(`Saved interview with ${cleanQuestionsArray.length} questions to Firebase`);
    } catch (firebaseError) {
      console.error("Firebase save error:", firebaseError);
      // Continue even if Firebase fails - we still return questions
    }

    console.log("Successfully generated questions:", cleanQuestionsArray);

    return NextResponse.json({
      success: true,
      questions: cleanQuestionsArray,
      count: cleanQuestionsArray.length,
      interviewId: interview.createdAt
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (error: any) {
    console.error("API Route Error:", error);

    // ❌ NO FALLBACK - Return error
    return NextResponse.json({
      success: false,
      error: error.message || "Unknown error occurred"
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  }
}

// Helper function to parse generated text into array
function parseGeneratedText(text: string, expectedCount: number): string[] {
  const cleanedText = text.trim();

  // Method 1: Try to parse as JSON array
  if (cleanedText.startsWith('[') && cleanedText.endsWith(']')) {
    try {
      const parsed = JSON.parse(cleanedText);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, expectedCount);
      }
    } catch (e) {
      // JSON parse failed, try to extract array content
      console.log("JSON parse failed, trying regex extraction...");
    }
  }

  // Method 2: Extract array with regex
  const arrayMatch = cleanedText.match(/\[(.*?)\]/s);
  if (arrayMatch) {
    try {
      const arrayText = `[${arrayMatch[1]}]`;
      const parsed = JSON.parse(arrayText);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, expectedCount);
      }
    } catch (e) {
      console.log("Regex array extraction failed");
    }
  }

  // Method 3: Split by common patterns
  const lines = cleanedText.split('\n');
  const questions: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and obvious non-questions
    if (!trimmed ||
        trimmed.startsWith('```') ||
        trimmed.startsWith('{') ||
        trimmed.toLowerCase().includes('here are') ||
        trimmed.toLowerCase().includes('example')) {
      continue;
    }

    // Remove numbering (1., 2., a), b), etc.)
    let question = trimmed
      .replace(/^[\d]+[\.\)]\s*/, '')  // 1., 2., etc.
      .replace(/^[a-zA-Z][\.\)]\s*/, '') // a), b), etc.
      .replace(/^[-*•]\s*/, '')  // Bullet points
      .replace(/^["']|["']$/g, '')  // Quotes
      .trim();

    // Ensure it looks like a question
    if (question.length > 10 && question.length < 200 &&
        (question.endsWith('?') || question.includes('how') || question.includes('what') ||
         question.includes('why') || question.includes('describe') || question.includes('explain'))) {
      questions.push(question);
    }

    if (questions.length >= expectedCount) break;
  }

  return questions;
}

// Helper function to clean questions
function cleanQuestions(questions: string[]): string[] {
  return questions
    .filter((q, index, self) => {
      // Basic validation
      if (typeof q !== 'string') return false;

      const trimmed = q.trim();

      // Remove empty or very short questions
      if (trimmed.length < 10 || trimmed.length > 250) return false;

      // Remove duplicate questions
      const normalized = trimmed.toLowerCase();
      const firstIndex = self.findIndex(item =>
        item.toLowerCase().normalize() === normalized.normalize()
      );

      // Skip common model thinking patterns
      const blacklist = [
        '<think>', '</think>', 'okay', 'alright', 'let me', 'first,',
        'i need to', 'so', 'well,', 'hmm,', 'um,', 'ah,',
        'that should cover', 'here are', 'questions:',
        'technical questions:', 'behavioral questions:'
      ];

      if (blacklist.some(word => normalized.startsWith(word))) {
        return false;
      }

      // Remove questions that are too generic
      const genericPatterns = [
        /^what is your/i,
        /^tell me about/i,
        /^can you describe/i
      ];

      if (genericPatterns.some(pattern => pattern.test(trimmed))) {
        // Keep some generic ones but not all
        return index < 2; // Keep first 2 generic questions
      }

      return firstIndex === index; // Remove duplicates
    })
    .map(q => {
      // Clean up formatting
      return q
        .replace(/\\n/g, ' ')  // Remove newlines
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/["']{2,}/g, '"')  // Fix multiple quotes
        .replace(/^\s*["']|["']\s*$/g, '')  // Trim quotes
        .replace(/[`~@#$%^&*_=+<>]/g, '')  // Remove problematic chars for TTS
        .trim();
    });
}

export async function GET() {
  return NextResponse.json({
    status: "operational",
    message: "Interview Questions API - REAL INTERVIEWS ONLY",
    endpoints: {
      askConfig: "POST /api/vapi/ask-config (get configuration questions)",
      generate: "POST /api/vapi/generate (generate real interview with answers)",
      body: {
        type: "string (technical/behavioral)",
        role: "string",
        level: "string (entry/mid/senior)",
        techstack: "string or array",
        amount: "number (optional, default 5)",
        userid: "string"
      }
    },
    note: "This API only returns real AI-generated interviews. No fallback questions."
  }, {
    status: 200
  });
}