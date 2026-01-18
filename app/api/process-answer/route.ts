// app/api/process-answer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: NextRequest) {
  try {
    const { question, userAnswer, questionNumber, totalQuestions, interviewId, userId } = await request.json();

    console.log("🤖 Processing answer:", {
      questionNumber,
      question: question.substring(0, 50),
      userAnswer: userAnswer.substring(0, 100)
    });

    // Validate required fields
    if (!question || !userAnswer) {
      return NextResponse.json(
        { error: "Missing question or user answer" },
        { status: 400 }
      );
    }

    // Prepare prompt for AI
    const prompt = `You are an expert technical interview coach.

    The candidate is being interviewed for a technical role.

    QUESTION ${questionNumber}/${totalQuestions}: ${question}

    CANDIDATE'S ANSWER: ${userAnswer}

    Provide CONCISE feedback (2-3 sentences) that:
    1. Acknowledges their answer
    2. Gives constructive feedback on their answer
    3. Encourages them for the next question

    Keep it natural and conversational for voice synthesis. Maximum 50 words.`;

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }

    console.log(`📡 Calling Gemini API for feedback (Q${questionNumber}/${totalQuestions})...`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 150,
        topP: 0.9
      }
    });

    let feedback = "";
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      feedback = response.text().trim();
    } catch (error: any) {
      console.error("Gemini API error:", error.message);
      throw new Error(`Gemini API error: ${error.message}`);
    }

    // Clean up the feedback
    feedback = feedback
      .replace(/"/g, '') // Remove quotes
      .replace(/\*\*/g, '') // Remove bold markers
      .replace(/^\s*[\-•]\s*/g, '') // Remove bullet points
      .substring(0, 200); // Limit length

    if (!feedback) {
      throw new Error("Empty feedback response from AI");
    }

    return NextResponse.json({
      success: true,
      feedback: feedback,
      questionNumber: questionNumber,
      nextQuestion: questionNumber < totalQuestions,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Error processing answer:", error);

    return NextResponse.json({
      success: false,
      error: error.message || "Failed to process answer"
    }, { status: 500 });
  }
}