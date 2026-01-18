// app/api/process-answer/route.ts
import { NextRequest, NextResponse } from "next/server";

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

    // Call AI service (using HuggingFace as an example)
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
      // Fallback: Simple feedback generation
      return generateFallbackFeedback(questionNumber, totalQuestions);
    }

    const response = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 100,
            temperature: 0.7,
            return_full_text: false
          }
        })
      }
    );

    if (!response.ok) {
      console.warn("AI service failed, using fallback");
      return generateFallbackFeedback(questionNumber, totalQuestions);
    }

    const data = await response.json();

    // Extract AI response
    let feedback = "";
    if (Array.isArray(data) && data[0]?.generated_text) {
      feedback = data[0].generated_text.trim();
    } else if (typeof data === 'string') {
      feedback = data.trim();
    } else if (data?.generated_text) {
      feedback = data.generated_text.trim();
    }

    // Clean up the feedback
    feedback = feedback
      .replace(/<\/?s>/g, '') // Remove special tokens
      .replace(/\[.*?\]/g, '') // Remove brackets
      .replace(/"/g, '') // Remove quotes
      .substring(0, 200); // Limit length

    if (!feedback) {
      feedback = `Good answer for question ${questionNumber}. Let's continue.`;
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
      error: error.message || "Failed to process answer",
      feedback: "Thank you for your answer. Let's move to the next question.",
      fallback: true
    }, { status: 500 });
  }
}

function generateFallbackFeedback(questionNumber: number, totalQuestions: number) {
  const feedbacks = [
    "Thank you for your detailed answer. That demonstrates good understanding of the concept.",
    "Good response. You've covered the main points well.",
    "I appreciate your answer. You're thinking in the right direction.",
    "Well explained. You've articulated that clearly.",
    "Good insight. That shows practical experience with this topic."
  ];

  const feedback = feedbacks[Math.floor(Math.random() * feedbacks.length)];

  return NextResponse.json({
    success: true,
    feedback: `${feedback} Let's move to ${questionNumber < totalQuestions ? 'the next question' : 'the final summary'}.`,
    questionNumber: questionNumber,
    nextQuestion: questionNumber < totalQuestions,
    fallback: true
  });
}