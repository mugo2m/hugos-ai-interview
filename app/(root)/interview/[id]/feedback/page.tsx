import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/actions/auth.action";

// FIX: Prevent caching - feedback shows immediately
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Poll for feedback with retries - CHANGED: 13s → 3s
async function pollFeedback(interviewId: string, userId: string, maxAttempts = 20) {
  console.log("🔄 [pollFeedback] Starting polling for feedback");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`🔄 [pollFeedback] Attempt ${attempt}/${maxAttempts}`);

    const feedback = await getFeedbackByInterviewId({
      interviewId,
      userId,
    });

    if (feedback) {
      console.log(`✅ [pollFeedback] Feedback found on attempt ${attempt}`);
      return feedback;
    }

    // Wait 3 seconds before next attempt - CHANGED: 13s → 3s
    if (attempt < maxAttempts) {
      console.log(`⏳ [pollFeedback] No feedback yet, waiting 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // CHANGED: 13000 → 3000
    }
  }

  console.log("❌ [pollFeedback] No feedback found after all attempts");
  return null;
}

const Feedback = async ({ params }: RouteParams) => {
  const { id } = await params;
  const user = await getCurrentUser();

  console.log("🔍 [Feedback Page] Starting, interview ID:", id);
  console.log("🔍 [Feedback Page] User ID:", user?.id);

  const interview = await getInterviewById(id);
  if (!interview) {
    console.log("❌ [Feedback Page] Interview not found, redirecting");
    redirect("/");
  }

  console.log("🔍 [Feedback Page] Interview found:", interview.role);

  // Try to get feedback immediately
  let feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user?.id!,
  });

  console.log("🔍 [Feedback Page] Initial check - feedback:", feedback ? "FOUND" : "NOT FOUND");

  // If not found, start polling
  if (!feedback) {
    console.log("🔄 [Feedback Page] Starting polling for feedback...");
    feedback = await pollFeedback(id, user?.id!);
  }

  console.log("🔍 [Feedback Page] Final feedback status:", feedback ? "FOUND" : "NOT FOUND");

  // If still no feedback after polling
  if (!feedback) {
    return (
      <section className="section-feedback">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <h1 className="text-3xl font-bold text-center">
            ⏳ Feedback Processing...
          </h1>

          <div className="bg-blue-50 p-6 rounded-lg max-w-2xl">
            <h2 className="text-xl font-semibold mb-4">Status Update</h2>
            <div className="space-y-2 text-sm font-mono">
              <p>Interview ID: <span className="font-bold">{id}</span></p>
              <p>Role: <span className="font-bold">{interview.role}</span></p>
              <p>Status: <span className="font-bold text-yellow-600">AI IS ANALYZING YOUR INTERVIEW</span></p>
              <p>Estimated Time: <span className="font-bold">30-60 seconds</span></p>
              <p>Last Checked: <span className="font-bold">{new Date().toLocaleTimeString()}</span></p>
            </div>
          </div>

          {/* Loading animation */}
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-200"></div>
            <p className="text-gray-600 text-center max-w-md">
              Our AI is analyzing your interview responses and generating detailed feedback.
              This usually takes less than a minute.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button className="btn-secondary">
              <Link href="/" className="flex w-full justify-center">
                <p className="text-sm font-semibold text-primary-200 text-center">
                  Back to dashboard
                </p>
              </Link>
            </Button>

            {/* Simple refresh button */}
            <form action={async () => {
              'use server';
              redirect(`/interview/${id}/feedback`);
            }}>
              <Button type="submit" className="btn-primary">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Check Again
                </span>
              </Button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  // ===== RENDER FEEDBACK IF FOUND =====
  return (
    <section className="section-feedback">
      <div className="flex flex-row justify-center">
        <h1 className="text-4xl font-semibold">
          Feedback on the Interview -{" "}
          <span className="capitalize">{interview.role}</span> Interview
        </h1>
      </div>

      <div className="flex flex-row justify-center ">
        <div className="flex flex-row gap-5">
          {/* Overall Impression */}
          <div className="flex flex-row gap-2 items-center">
            <Image src="/star.svg" width={22} height={22} alt="star" />
            <p>
              Overall Impression:{" "}
              <span className="text-primary-200 font-bold">
                {feedback?.totalScore || "N/A"}
              </span>
              /100
            </p>
          </div>

          {/* Date */}
          <div className="flex flex-row gap-2">
            <Image src="/calendar.svg" width={22} height={22} alt="calendar" />
            <p>
              {feedback?.createdAt
                ? dayjs(feedback.createdAt).format("MMM D, YYYY h:mm A")
                : "N/A"}
            </p>
          </div>
        </div>
      </div>

      <hr />

      <p>{feedback?.finalAssessment || "No final assessment available."}</p>

      {/* Interview Breakdown */}
      <div className="flex flex-col gap-4">
        <h2>Breakdown of the Interview:</h2>
        {feedback?.categoryScores?.length > 0 ? (
          feedback.categoryScores.map((category: any, index: number) => (
            <div key={index}>
              <p className="font-bold">
                {index + 1}. {category.name} ({category.score}/100)
              </p>
              <p>{category.comment}</p>
            </div>
          ))
        ) : (
          <p className="text-gray-500">No breakdown available.</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3>Strengths</h3>
        {feedback?.strengths?.length > 0 ? (
          <ul>
            {feedback.strengths.map((strength: string, index: number) => (
              <li key={index}>{strength}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No strengths identified.</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3>Areas for Improvement</h3>
        {feedback?.areasForImprovement?.length > 0 ? (
          <ul>
            {feedback.areasForImprovement.map((area: string, index: number) => (
              <li key={index}>{area}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No areas for improvement identified.</p>
        )}
      </div>

      <div className="buttons">
        <Button className="btn-secondary flex-1">
          <Link href="/" className="flex w-full justify-center">
            <p className="text-sm font-semibold text-primary-200 text-center">
              Back to dashboard
            </p>
          </Link>
        </Button>

        <Button className="btn-primary flex-1">
          <Link
            href={`/interview/${id}`}
            className="flex w-full justify-center"
          >
            <p className="text-sm font-semibold text-black text-center">
              Retake Interview
            </p>
          </Link>
        </Button>
      </div>
    </section>
  );
};

export default Feedback;