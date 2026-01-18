import { interviewCovers, mappings } from "@/constants";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const techIconBaseURL = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons";

export const normalizeTechName = (tech: string) => {
  if (!tech) return "tech";

  const key = tech
    .toLowerCase()
    .replace(/\.js$/, "")
    .replace(/\s+/g, "");

  return mappings[key] ?? key;
};

const checkIconExists = async (url: string) => {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
};

export const getTechLogos = async (techArray: string[]) => {
  if (!Array.isArray(techArray)) return [];

  const logoURLs = techArray.map((tech) => {
    const normalized = normalizeTechName(tech);
    return {
      tech,
      url: `${techIconBaseURL}/${normalized}/${normalized}-original.svg`,
    };
  });

  const results = await Promise.all(
    logoURLs.map(async ({ tech, url }) => ({
      tech,
      url: (await checkIconExists(url)) ? url : "/tech.svg",
    }))
  );

  return results;
};

export const getRandomInterviewCover = () => {
  // List of covers you ACTUALLY have in public/covers/
  const availableCovers = [
    "/covers/adobe.png",
    "/covers/amazon.png",
    "/covers/facebook.png",
    "/covers/hostinger.png",
    "/covers/pinterest.png",
    "/covers/quora.png",
    "/covers/reddit.png",
    "/covers/telegram.png",
    "/covers/tiktok.png",
    "/covers/yahoo.png"
  ];

  // Make sure we have covers
  if (availableCovers.length === 0) {
    return "/covers/adobe.png"; // Fallback
  }

  const randomIndex = Math.floor(Math.random() * availableCovers.length);
  return availableCovers[randomIndex];
};

// Helper function for DisplayTechIcons component
export const getTechIconUrl = (tech: string): string => {
  const normalized = normalizeTechName(tech);

  // Special handling for SQL and R since they might not be in devicon
  const specialIcons: Record<string, string> = {
    'sql': '/icons/sql.svg',
    'r': '/icons/r.svg',
    'postgresql': '/icons/sql.svg', // Fallback for PostgreSQL
  };

  // Check if it's a special icon
  const lowerTech = tech.toLowerCase();
  if (specialIcons[lowerTech]) {
    return specialIcons[lowerTech];
  }

  // Use devicon for known techs
  if (mappings[normalized]) {
    return `${techIconBaseURL}/${normalized}/${normalized}-original.svg`;
  }

  // Fallback to local icon
  return "/icons/default.svg";
};