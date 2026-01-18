import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

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

    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
      console.error("HuggingFace API key is missing");
      throw new Error("API configuration error");
    }

    const targetModel = "HuggingFaceTB/SmolLM3-3B";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout

    console.log(`Calling HuggingFace API for ${role} ${level} position...`);

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
                "content": "You are a professional interview question generator. ALWAYS respond with valid JSON arrays only. No explanations."
              },
              {
                "role": "user",
                "content": prompt
              }
            ],
            max_tokens: 1000,
            temperature: 0.8,
            top_p: 0.95,
            frequency_penalty: 0.3,
            presence_penalty: 0.2
          }),
          signal: controller.signal
        }
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error("HuggingFace API request timeout (45s)");
      }
      throw new Error(`Network error: ${fetchError.message}`);
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "No error details");
      console.error("HuggingFace API error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });

      // Use fallback questions for API errors
      return NextResponse.json(getFallbackQuestions(role, level, type), {
        status: 200,
        headers: {
          'X-Fallback-Questions': 'true'
        }
      });
    }

    const data = await response.json().catch(async (e) => {
      const text = await response.text();
      console.error("Failed to parse JSON response:", text);
      throw new Error("Invalid JSON response from HuggingFace");
    });

    const generatedText = data.choices?.[0]?.message?.content || "";

    if (!generatedText.trim()) {
      throw new Error("Empty response from HuggingFace");
    }

    console.log("Raw HuggingFace response:", generatedText.substring(0, 200) + "...");

    // Parse the response into an array of questions
    const questionsArray = parseGeneratedText(generatedText, parseInt(amount) || 5);

    // Clean and validate questions
    const cleanQuestionsArray = cleanQuestions(questionsArray);

    if (cleanQuestionsArray.length === 0) {
      throw new Error("No valid questions generated after cleaning");
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
      source: data.choices ? "huggingface" : "fallback"
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
      interviewId: interview.createdAt // Can be used as reference
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (error: any) {
    console.error("API Route Error:", error);

    // Return structured error for client
    return NextResponse.json({
      success: false,
      error: error.message || "Unknown error occurred",
      fallbackQuestions: getFallbackQuestions("Software Engineer", "Mid-level", "technical")
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

// Fallback questions generator
function getFallbackQuestions(role: string, level: string, type: string): string[] {
  const baseQuestions = [
    "Tell me about your experience relevant to this role.",
    "What attracted you to our company and this position?",
    "How do you stay updated with industry trends and new technologies?",
    "Describe a challenging project you worked on and how you overcame the difficulties.",
    "How do you prioritize tasks when working on multiple projects?",
    "What development methodologies are you familiar with?",
    "How do you handle constructive criticism or feedback on your work?",
    "Where do you see yourself professionally in three to five years?",
    "What are your strengths and areas for improvement?",
    "Do you have any questions for me about the role or company?"
  ];

  // Add role-specific questions
  const roleSpecific: Record<string, string[]> = {
    "frontend": [
      "How do you ensure your applications are accessible?",
      "What's your approach to responsive design?",
      "How do you optimize website performance?"
    ],
    "backend": [
      "How do you design scalable APIs?",
      "What's your experience with database optimization?",
      "How do you handle data security and privacy?"
    ],
    "fullstack": [
      "How do you manage state across frontend and backend?",
      "What's your approach to API design for frontend consumption?",
      "How do you ensure consistency between different parts of the application?"
    ]
  };

  // Filter by type
  let filteredQuestions = baseQuestions;
  if (type.toLowerCase().includes('technical')) {
    filteredQuestions = filteredQuestions.filter(q =>
      q.toLowerCase().includes('experience') ||
      q.toLowerCase().includes('technologies') ||
      q.toLowerCase().includes('project') ||
      q.toLowerCase().includes('methodologies')
    );
  } else if (type.toLowerCase().includes('behavioral')) {
    filteredQuestions = filteredQuestions.filter(q =>
      q.toLowerCase().includes('attracted') ||
      q.toLowerCase().includes('challenging') ||
      q.toLowerCase().includes('prioritize') ||
      q.toLowerCase().includes('criticism') ||
      q.toLowerCase().includes('strengths')
    );
  }

  // Add role-specific questions
  const roleKey = role.toLowerCase();
  if (roleKey.includes('frontend')) {
    filteredQuestions = [...filteredQuestions, ...roleSpecific.frontend];
  } else if (roleKey.includes('backend')) {
    filteredQuestions = [...filteredQuestions, ...roleSpecific.backend];
  } else if (roleKey.includes('fullstack')) {
    filteredQuestions = [...filteredQuestions, ...roleSpecific.fullstack];
  }

  return filteredQuestions.slice(0, 10); // Return up to 10 questions
}

export async function GET() {
  return NextResponse.json({
    status: "operational",
    message: "Interview Questions API",
    endpoints: {
      POST: "/api/generate-questions",
      body: {
        type: "string (technical/behavioral)",
        role: "string",
        level: "string (entry/mid/senior)",
        techstack: "string or array",
        amount: "number (optional, default 5)",
        userid: "string"
      }
    }
  }, {
    status: 200
  });
}