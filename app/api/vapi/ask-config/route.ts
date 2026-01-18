import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const configQuestions = [
      {
        id: "role",
        question: "What role do you want to be interviewed for?",
        example: "Frontend Developer, Backend Engineer, Data Scientist",
        type: "text"
      },
      {
        id: "type",
        question: "What type of interview do you want?",
        options: ["Technical", "Behavioral", "Mixed"],
        type: "select"
      },
      {
        id: "level",
        question: "What's your experience level?",
        options: ["Entry", "Junior", "Mid-level", "Senior"],
        type: "select"
      },
      {
        id: "techstack",
        question: "What technologies should we focus on?",
        example: "React, Python, AWS, etc.",
        type: "text"
      },
      {
        id: "amount",
        question: "How many questions do you want?",
        options: ["3", "5", "10"],
        type: "select"
      }
    ];

    return NextResponse.json({
      success: true,
      questions: configQuestions,
      message: "Answer these questions to configure your interview"
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/vapi/ask-config",
    description: "Get interview configuration questions"
  });
}