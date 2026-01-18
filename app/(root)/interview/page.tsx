// app/(root)/interview/page.tsx - INTERVIEW LISTING PAGE
import { getCurrentUser } from "@/lib/actions/auth.action";
import { redirect } from "next/navigation";
import InterviewCard from "@/components/InterviewCard";
import { getInterviewsByUserId } from "@/lib/actions/general.action";

const Page = async () => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const interviews = await getInterviewsByUserId(user.id);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Interview Listings</h1>
      
      {interviews.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No interviews yet.</p>
          <a href="/generate" className="text-blue-600 hover:underline mt-2 inline-block">
            Create an interview
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {interviews.map((interview) => (
            <InterviewCard
              key={interview.id}
              id={interview.id}
              role={interview.role}
              type={interview.type}
              level={interview.level}
              techstack={interview.techstack}
              createdAt={interview.createdAt}
              userId={interview.userId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Page;
