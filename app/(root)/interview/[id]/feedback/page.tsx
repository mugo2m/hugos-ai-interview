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

const Feedback = async ({ params }: RouteParams) => {
  const { id } = await params;
  const user = await getCurrentUser();

  const interview = await getInterviewById(id);
  if (!interview) redirect("/");

  console.log("🔍 [Feedback Page] Fetching feedback for interview:", id);
  console.log("🔍 [Feedback Page] User ID:", user?.id);

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user?.id!,
  });

  console.log("🔍 [Feedback Page] Feedback result:", feedback ? "FOUND" : "NOT FOUND");
  console.log("🔍 [Feedback Page] Feedback data:", feedback);

  // ===== DEBUG: If no feedback =====
  if (!feedback) {
    return (
      <section className="section-feedback">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <h1 className="text-3xl font-bold text-center">
            Feedback Processing...
          </h1>

          <div className="bg-blue-50 p-6 rounded-lg max-w-2xl">
            <h2 className="text-xl font-semibold mb-4">Debug Information:</h2>
            <div className="space-y-2 text-sm font-mono">
              <p>Interview ID: <span className="font-bold">{id}</span></p>
              <p>User ID: <span className="font-bold">{user?.id}</span></p>
              <p>Interview Role: <span className="font-bold">{interview?.role}</span></p>
              <p>Feedback Status: <span className="font-bold text-red-500">NOT FOUND</span></p>
              <p>Timestamp: <span className="font-bold">{new Date().toISOString()}</span></p>
            </div>
          </div>

          <p className="text-center text-gray-600">
            Your interview feedback is being generated. This usually takes 30-60 seconds.
            <br />
            <span className="text-sm text-gray-500">
              Please wait or check back in a minute.
            </span>
          </p>

          <div className="buttons">
            <Button className="btn-secondary">
              <Link href="/" className="flex w-full justify-center">
                <p className="text-sm font-semibold text-primary-200 text-center">
                  Back to dashboard
                </p>
              </Link>
            </Button>
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
          feedback.categoryScores.map((category, index) => (
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
            {feedback.strengths.map((strength, index) => (
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
            {feedback.areasForImprovement.map((area, index) => (
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