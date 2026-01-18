import { z } from "zod";

/* ============================
   Feedback Schema (EXPORT THIS)
============================ */
export const feedbackSchema = z.object({
  totalScore: z.number(),
  categoryScores: z.tuple([
    z.object({
      name: z.literal("Communication Skills"),
      score: z.number(),
      comment: z.string(),
    }),
    z.object({
      name: z.literal("Technical Knowledge"),
      score: z.number(),
      comment: z.string(),
    }),
    z.object({
      name: z.literal("Problem Solving"),
      score: z.number(),
      comment: z.string(),
    }),
    z.object({
      name: z.literal("Cultural Fit"),
      score: z.number(),
      comment: z.string(),
    }),
    z.object({
      name: z.literal("Confidence and Clarity"),
      score: z.number(),
      comment: z.string(),
    }),
  ]),
  strengths: z.array(z.string()),
  areasForImprovement: z.array(z.string()),
  finalAssessment: z.string(),
});

/* ============================
   Interview Covers
============================ */
export const interviewCovers = [
  "/adobe.png",
  "/amazon.png",
  "/facebook.png",
  "/hostinger.png",
  "/pinterest.png",
  "/quora.png",
  "/reddit.png",
  "/skype.png",
  "/spotify.png",
  "/telegram.png",
  "/tiktok.png",
  "/yahoo.png",
];

/* ============================
   Tech Stack Mappings
============================ */
export const mappings: Record<string, string> = {
  react: "react",
  reactjs: "react",
  "react.js": "react",

  next: "nextjs",
  nextjs: "nextjs",
  "next.js": "nextjs",

  vue: "vuejs",
  vuejs: "vuejs",
  "vue.js": "vuejs",

  node: "nodejs",
  nodejs: "nodejs",
  "node.js": "nodejs",

  express: "express",
  mongodb: "mongodb",
  mysql: "mysql",
  postgresql: "postgresql",
  firebase: "firebase",
  docker: "docker",
  kubernetes: "kubernetes",
  aws: "aws",
  azure: "azure",
  gcp: "gcp",

  html: "html5",
  css: "css3",
  javascript: "javascript",
  typescript: "typescript",
  tailwindcss: "tailwindcss",

  redux: "redux",
  reactnative: "reactnative",
};
