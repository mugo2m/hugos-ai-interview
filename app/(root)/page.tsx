import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import InterviewCard from "@/components/InterviewCard";

import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getInterviewsByUserId,
  getLatestInterviews,
} from "@/lib/actions/general.action";

async function Home() {
  const user = await getCurrentUser();

  const [userInterviews, allInterview] = await Promise.all([
    getInterviewsByUserId(user?.id!),
    getLatestInterviews({ userId: user?.id! }),
  ]);

  const hasPastInterviews = userInterviews?.length! > 0;
  const hasUpcomingInterviews = allInterview?.length! > 0;

  return (
    <>
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <h2> Job Interview with instant Result</h2>
          <p className="text-lg">
            Be interviewed for your job & get  result instantly
          </p>

          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/generate">Start here</Link>
          </Button>
        </div>

        <Image
          src="/interview-panel.jpg"
          alt="Professional interview panel"
          width={400}
          height={400}
          className="max-sm:hidden rounded-lg shadow-lg object-cover"
        />
      </section>

      <section className="flex flex-col gap-6 mt-8">
        <h2> Results of interviews You did</h2>

        <div className="interviews-section">
          {hasPastInterviews ? (
            userInterviews?.map((interview) => {
              console.log("DEBUG - User Interview ID:", interview.id);

              return (
                <InterviewCard
                  key={interview.id}
                  id={interview.id} // CHANGED FROM interviewId TO id
                  userId={user?.id}
                  role={interview.role}
                  type={interview.type}
                  techstack={interview.techstack}
                  createdAt={interview.createdAt}
                />
              );
            })
          ) : (
            <p>You haven&apos;t taken any interviews yet</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-6 mt-8">
        <h2>List of Interviews for you to do</h2>

        <div className="interviews-section">
          {hasUpcomingInterviews ? (
            allInterview?.map((interview) => {
              console.log("DEBUG - All Interview ID:", interview.id);

              return (
                <InterviewCard
                  key={interview.id}
                  id={interview.id} // CHANGED FROM interviewId TO id
                  userId={user?.id}
                  role={interview.role}
                  type={interview.type}
                  techstack={interview.techstack}
                  createdAt={interview.createdAt}
                />
              );
            })
          ) : (
            <p>There are no interviews available</p>
          )}
        </div>
      </section>
    </>
  );
}

export default Home;