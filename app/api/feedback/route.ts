import { NextRequest, NextResponse } from "next/server";
import { createFeedback } from "@/lib/actions/general.action";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { success, feedbackId } = await createFeedback({
      interviewId: body.interviewId,
      userId: body.userId,
      transcript: body.transcript,
      feedbackId: body.feedbackId,
    });

    if (!success) {
      return NextResponse.json(
        { error: "Failed to create feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, feedbackId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to save feedback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}