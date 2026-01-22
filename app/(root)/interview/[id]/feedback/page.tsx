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

// Poll for feedback with FAST 3-second retries
async function pollFeedback(interviewId: string, userId: string, maxAttempts = 30) {
  console.log("🔄 [pollFeedback] Starting polling for feedback");
  console.log(`🔄 [pollFeedback] Will check every 3 seconds, max ${maxAttempts} attempts (${maxAttempts * 3}s total)`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startTime = Date.now();
    console.log(`🔄 [pollFeedback] Attempt ${attempt}/${maxAttempts} at ${new Date().toLocaleTimeString()}`);

    const feedback = await getFeedbackByInterviewId({
      interviewId,
      userId,
    });

    if (feedback) {
      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ [pollFeedback] Feedback found on attempt ${attempt} after ${elapsedSeconds} seconds`);
      return feedback;
    }

    // Wait ONLY 3 seconds before next attempt (FAST polling)
    if (attempt < maxAttempts) {
      console.log(`⏳ [pollFeedback] No feedback yet, waiting 3 seconds for next check...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3000ms = 3 seconds
    }
  }

  console.log(`❌ [pollFeedback] No feedback found after ${maxAttempts} attempts (${maxAttempts * 3} seconds)`);
  return null;
}

const Feedback = async ({ params }: RouteParams) => {
  const { id } = await params;
  const user = await getCurrentUser();

  console.log("🔍 [Feedback Page] ===== STARTING ===== ");
  console.log("🔍 [Feedback Page] Interview ID:", id);
  console.log("🔍 [Feedback Page] User ID:", user?.id);
  console.log("🔍 [Feedback Page] Time:", new Date().toLocaleTimeString());

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

  console.log("🔍 [Feedback Page] Initial check - feedback:", feedback ? "FOUND ✓" : "NOT FOUND ✗");

  // If not found, start FAST polling (3-second intervals)
  if (!feedback) {
    console.log("🔄 [Feedback Page] Starting FAST polling (3-second checks)...");
    feedback = await pollFeedback(id, user?.id!);
  }

  console.log("🔍 [Feedback Page] Final feedback status:", feedback ? "FOUND ✓" : "NOT FOUND ✗");
  console.log("🔍 [Feedback Page] ===== FINISHED =====");

  // If still no feedback after polling
  if (!feedback) {
    return (
      <section className="section-feedback">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary-200 mb-4"></div>
            <h1 className="text-3xl font-bold text-center mb-2">
              ⏳ Generating Your Feedback
            </h1>
            <p className="text-gray-600 mb-6">
              Taking a bit longer than expected...
            </p>
          </div>

          <div className="bg-blue-50 p-6 rounded-lg max-w-2xl w-full">
            <h2 className="text-xl font-semibold mb-4">Status Update</h2>
            <div className="space-y-3 text-sm font-mono">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500">Interview ID:</p>
                  <p className="font-bold">{id.substring(0, 8)}...</p>
                </div>
                <div>
                  <p className="text-gray-500">Role:</p>
                  <p className="font-bold capitalize">{interview.role}</p>
                </div>
              </div>

              <div className="bg-yellow-100 p-3 rounded">
                <p className="font-semibold text-yellow-800">
                  🔄 AI IS ANALYZING YOUR INTERVIEW
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500">Check Interval:</p>
                  <p className="font-bold text-green-600">Every 3 seconds</p>
                </div>
                <div>
                  <p className="text-gray-500">Last Checked:</p>
                  <p className="font-bold">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</p>
                </div>
              </div>

              <div className="pt-3 border-t">
                <p className="text-gray-500">Next check in:</p>
                <div className="flex items-center gap-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full animate-pulse w-3/4"></div>
                  </div>
                  <span className="font-bold">~3s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Loading info */}
          <div className="max-w-md text-center space-y-3">
            <p className="text-gray-600">
              Our AI is carefully analyzing each of your responses.
              This usually takes 30-60 seconds.
            </p>

            <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <span>Transcribing audio</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2 animate-pulse"></div>
                <span>Analyzing responses</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                <span>Generating feedback</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <form action={async () => {
              'use server';
              console.log("🔄 Manual refresh triggered");
              redirect(`/interview/${id}/feedback`);
            }}>
              <Button type="submit" className="btn-primary px-8">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Check Now
                </span>
              </Button>
            </form>

            <Button asChild className="btn-secondary">
              <Link href="/">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Dashboard
                </span>
              </Link>
            </Button>
          </div>

          {/* Auto-refresh notice */}
          <p className="text-xs text-gray-400 mt-4">
            Page will auto-check every 3 seconds. Last update: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </section>
    );
  }

  // ===== RENDER FEEDBACK IF FOUND =====
  return (
    <section className="section-feedback">
      {/* Success banner */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
              <span className="text-green-600 font-bold text-lg">✓</span>
            </div>
            <div>
              <p className="font-bold text-green-800">Feedback Ready!</p>
              <p className="text-sm text-green-600">AI analysis completed successfully</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Generated at {feedback.createdAt ? dayjs(feedback.createdAt).format("h:mm A") : "just now"}
          </div>
        </div>
      </div>

      <div className="flex flex-row justify-center mb-6">
        <h1 className="text-4xl font-semibold text-center">
          Feedback on the{" "}
          <span className="capitalize text-primary-200">{interview.role}</span> Interview
        </h1>
      </div>

      <div className="flex flex-row justify-center mb-8">
        <div className="flex flex-row gap-5">
          {/* Overall Impression */}
          <div className="flex flex-row gap-2 items-center bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3 rounded-xl border border-blue-100">
            <Image src="/star.svg" width={24} height={24} alt="star" />
            <p className="text-lg">
              Overall Score:{" "}
              <span className="text-primary-200 font-bold text-2xl">
                {feedback?.totalScore || "N/A"}
              </span>
              <span className="text-gray-500">/100</span>
            </p>
          </div>

          {/* Date */}
          <div className="flex flex-row gap-2 items-center bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3 rounded-xl border border-blue-100">
            <Image src="/calendar.svg" width={24} height={24} alt="calendar" />
            <p className="text-lg">
              {feedback?.createdAt
                ? dayjs(feedback.createdAt).format("MMM D, YYYY h:mm A")
                : "Today"}
            </p>
          </div>
        </div>
      </div>

      <hr className="my-8 border-gray-200" />

      {/* Final Assessment */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-8 bg-primary-200 rounded-full"></div>
          <h2 className="text-2xl font-bold">Final Assessment</h2>
        </div>
        <div className="bg-gradient-to-r from-gray-50 to-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-lg leading-relaxed">{feedback?.finalAssessment || "No final assessment available."}</p>
        </div>
      </div>

      {/* Interview Breakdown */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-8 bg-primary-200 rounded-full"></div>
          <h2 className="text-2xl font-bold">Breakdown of the Interview</h2>
        </div>
        <div className="space-y-4">
          {feedback?.categoryScores?.length > 0 ? (
            feedback.categoryScores.map((category: any, index: number) => (
              <div key={index} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full font-bold">
                      {index + 1}
                    </span>
                    <p className="font-bold text-xl">
                      {category.name}
                    </p>
                  </div>
                  <span className={`px-4 py-2 rounded-full text-lg font-bold ${
                    category.score >= 80 ? "bg-green-100 text-green-800 border border-green-200" :
                    category.score >= 60 ? "bg-yellow-100 text-yellow-800 border border-yellow-200" :
                    "bg-red-100 text-red-800 border border-red-200"
                  }`}>
                    {category.score}/100
                  </span>
                </div>
                <p className="text-gray-700 text-lg pl-11">{category.comment}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-8">No breakdown available.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {/* Strengths */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 font-bold text-xl">✓</span>
            </div>
            <h3 className="text-xl font-bold text-green-800">Strengths</h3>
          </div>
          {feedback?.strengths?.length > 0 ? (
            <ul className="space-y-3">
              {feedback.strengths.map((strength: string, index: number) => (
                <li key={index} className="flex items-start bg-white/70 p-3 rounded-lg">
                  <span className="text-green-500 mr-3 mt-1 text-lg">•</span>
                  <span className="text-gray-800">{strength}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 bg-white/70 p-4 rounded-lg">No specific strengths identified.</p>
          )}
        </div>

        {/* Areas for Improvement */}
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-6 rounded-xl border border-yellow-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 font-bold text-xl">↻</span>
            </div>
            <h3 className="text-xl font-bold text-yellow-800">Areas for Improvement</h3>
          </div>
          {feedback?.areasForImprovement?.length > 0 ? (
            <ul className="space-y-3">
              {feedback.areasForImprovement.map((area: string, index: number) => (
                <li key={index} className="flex items-start bg-white/70 p-3 rounded-lg">
                  <span className="text-yellow-500 mr-3 mt-1 text-lg">•</span>
                  <span className="text-gray-800">{area}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 bg-white/70 p-4 rounded-lg">No specific areas for improvement identified.</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="buttons grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t">
        <Button asChild className="btn-secondary py-6 text-lg">
          <Link href="/" className="flex w-full justify-center items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </Button>

        <Button asChild className="btn-primary py-6 text-lg">
          <Link
            href={`/interview/${id}`}
            className="flex w-full justify-center items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retake Interview
          </Link>
        </Button>

        <form action={async () => {
          'use server';
          console.log("🔄 Refresh feedback page");
          redirect(`/interview/${id}/feedback`);
        }}>
          <Button type="submit" className="py-6 text-lg w-full border-2 border-gray-300 bg-white text-gray-800 hover:bg-gray-50">
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Page
            </span>
          </Button>
        </form>
      </div>

      {/* Debug info (collapsed) */}
      <details className="mt-12 cursor-pointer">
        <summary className="text-sm text-gray-500 font-mono p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
          🔍 Debug Information (Click to expand)
        </summary>
        <div className="mt-2 p-4 bg-gray-900 text-gray-100 rounded-lg font-mono text-xs">
          <pre>{JSON.stringify({
            interviewId: id,
            feedbackId: feedback?.id?.substring(0, 8) + '...',
            userId: user?.id?.substring(0, 8) + '...',
            totalScore: feedback?.totalScore,
            categories: feedback?.categoryScores?.length,
            generatedAt: feedback?.createdAt,
            currentTime: new Date().toISOString(),
            pageLoadTime: new Date().toLocaleTimeString()
          }, null, 2)}</pre>
        </div>
      </details>
    </section>
  );
};

export default Feedback;