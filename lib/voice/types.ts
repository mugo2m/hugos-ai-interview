// lib/voice/types.ts - COMPLETE UPDATED VERSION
export interface VoiceMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  transcript: string;
  messages: VoiceMessage[];
  error: string | null;
}

export interface InterviewContext {
  role: string;
  level: string;
  techStack?: string[];
  type?: "technical" | "behavioral" | "mixed";
  amount?: number;
  userId?: string;
  interviewId?: string;
}

export interface VoiceConfig {
  language?: string;
  voiceName?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface InterviewParams {
  role: string;
  level: string;
  techstack: string | string[];
  type: string;
  amount: number | string;
  userid: string;
}

export interface InterviewResponse {
  success: boolean;
  questions?: string[];
  count?: number;
  interviewId?: string;
  error?: string;
  fallback?: boolean;
}

export interface FeedbackParams {
  interviewId: string;
  userId: string;
  transcript: VoiceMessage[];
  feedbackId?: string;
}

export interface AIResponse {
  text: string;
  isComplete: boolean;
}

// NEW: Voice state change notification
export interface VoiceStateChange {
  isSpeaking: boolean;
  isListening: boolean;
}

// NEW: Interview setup step
export interface InterviewStep {
  question: string;
  field: keyof InterviewParams;
  validator: (value: string) => boolean;
}

// NEW: Voice assistant callbacks
export interface VoiceAssistantCallbacks {
  onUpdate?: (messages: VoiceMessage[]) => void;
  onStateChange?: (state: VoiceStateChange) => void;
  onComplete?: (data: InterviewParams) => void;
  onError?: (error: string) => void;
}

// NEW: Voice service interface
export interface VoiceServiceInterface {
  startInterview(): Promise<void>;
  stopInterview(): Promise<void>;
  submitAnswer(answer: string): Promise<void>;
  getState(): VoiceState;
  getMessages(): VoiceMessage[];
  isVoiceSupported(): boolean;
}

// NEW: Browser compatibility check
export interface BrowserCompatibility {
  supported: boolean;
  details: {
    speechRecognition: {
      supported: boolean;
      note: string;
      api: string;
    };
    speechSynthesis: {
      supported: boolean;
      note: string;
      voices: number;
    };
    getUserMedia: {
      supported: boolean;
      note: string;
    };
    browser: {
      name: string;
      version: string;
      recommended: boolean;
    };
  };
  message: string;
  recommendations: string[];
}

// NEW: Create feedback parameters
export interface CreateFeedbackParams {
  interviewId: string;
  userId: string;
  transcript: Array<{ role: string; content: string }>;
  feedbackId?: string;
}

// NEW: Get feedback parameters
export interface GetFeedbackByInterviewIdParams {
  interviewId: string;
  userId: string;
}

// NEW: Get latest interviews parameters
export interface GetLatestInterviewsParams {
  userId: string;
  limit?: number;
}

// NEW: Feedback data structure
export interface Feedback {
  id?: string;
  interviewId: string;
  userId: string;
  totalScore: number;
  categoryScores: Array<{
    name: string;
    score: number;
    comment: string;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: string;
  model: string;
  status: string;
  version: string;
  isFallback?: boolean;
  error?: string;
}

// NEW: Interview data structure
export interface Interview {
  id: string;
  role: string;
  type: string;
  level: string;
  techstack: string[];
  questions: string[];
  userId: string;
  finalized: boolean;
  coverImage: string;
  createdAt: string;
  questionCount: number;
  source: string;
}

// NEW: Interview card props
export interface InterviewCardProps {
  id: string;
  userId: string;
  role: string;
  type: string;
  techstack: string[];
  createdAt: string;
}

// NEW: Route parameters
export interface RouteParams {
  params: Promise<{ id: string }>;
}

// NEW: Text-to-speech events
export interface TextToSpeechEvents {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

// NEW: Speech-to-text events
export interface SpeechToTextEvents {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

// NEW: Voice toggle props
export interface VoiceToggleProps {
  onVoiceToggle?: (enabled: boolean) => void;
  initialEnabled?: boolean;
}

// NEW: Agent component props
export interface AgentProps {
  userName: string;
  userId?: string;
  interviewId?: string;
  type: "generate" | "interview";
  questions?: string[];
  feedbackId?: string;
  profileImage?: string;
}

// NEW: User data structure
export interface User {
  id: string;
  name: string;
  email?: string;
  profileURL?: string;
  createdAt?: string;
}

// NEW: API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}