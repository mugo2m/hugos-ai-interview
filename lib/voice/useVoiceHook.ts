// lib/voice/useVoiceHook.ts - UPDATED WITH BETTER STATE SYNC
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { VoiceAssistant } from "./VoiceAssistant";
import VoiceService from "./VoiceService";
import { VoiceState, InterviewContext, VoiceMessage } from "./types";

export default function useVoice(interviewContext: InterviewContext) {
  const [state, setState] = useState<VoiceState>({
    messages: [],
    isSpeaking: false,
    isListening: false,
    isProcessing: false,
    transcript: "",
    error: null,
  });

  const voiceServiceRef = useRef<VoiceService | null>(null);
  const voiceAssistantRef = useRef<VoiceAssistant | null>(null);
  const isGenerateMode = interviewContext.type === "generate";

  console.log("🎤 useVoice Hook:", {
    mode: isGenerateMode ? "GENERATE" : "INTERVIEW",
    context: interviewContext
  });

  // Initialize the appropriate service based on mode
  useEffect(() => {
    console.log("🔄 useVoice: Initializing service for mode:", isGenerateMode ? "generate" : "interview");

    if (isGenerateMode) {
      // Initialize VoiceAssistant for generate mode
      console.log("🤖 useVoice: Creating VoiceAssistant instance");
      voiceAssistantRef.current = new VoiceAssistant();

      voiceAssistantRef.current.onUpdate((messages) => {
        console.log("📨 useVoice: VoiceAssistant messages updated", messages.length);
        setState(prev => ({
          ...prev,
          messages,
          isProcessing: voiceAssistantRef.current?.isActiveState() || false
        }));
      });

      voiceAssistantRef.current.onStateChange((voiceState) => {
        console.log("🔄 useVoice: VoiceAssistant state changed", voiceState);
        setState(prev => ({
          ...prev,
          isSpeaking: voiceState.isSpeaking,
          isListening: voiceState.isListening
        }));
      });

      voiceAssistantRef.current.onComplete((data) => {
        console.log("✅ useVoice: VoiceAssistant setup completed", data);
      });

      voiceAssistantRef.current.onError((error) => {
        console.error("❌ useVoice: VoiceAssistant error", error);
        setState(prev => ({ ...prev, error }));
      });

      return () => {
        console.log("🧹 useVoice: Cleaning up VoiceAssistant");
        voiceAssistantRef.current?.destroy();
        voiceAssistantRef.current = null;
      };
    } else {
      // Initialize VoiceService for interview mode
      console.log("🎯 useVoice: Creating VoiceService instance");
      voiceServiceRef.current = new VoiceService(interviewContext);

      // Update state periodically from VoiceService
      const interval = setInterval(() => {
        if (voiceServiceRef.current) {
          const serviceState = voiceServiceRef.current.getState();
          setState(serviceState);
        }
      }, 300); // Update every 300ms

      return () => {
        console.log("🧹 useVoice: Cleaning up VoiceService");
        clearInterval(interval);
        voiceServiceRef.current?.destroy();
        voiceServiceRef.current = null;
      };
    }
  }, [interviewContext, isGenerateMode]);

  // Start interview (for both modes)
  const startInterview = useCallback(async (userId: string) => {
    console.log("🚀 useVoice: Starting interview, mode:", isGenerateMode ? "generate" : "interview");

    if (isGenerateMode && voiceAssistantRef.current) {
      console.log("🎤 useVoice: Starting VoiceAssistant for user", userId);
      await voiceAssistantRef.current.start(userId);
    } else if (voiceServiceRef.current) {
      console.log("🎯 useVoice: Starting VoiceService for interview practice");
      await voiceServiceRef.current.startInterview();
    } else {
      console.error("❌ useVoice: No service available for mode", isGenerateMode ? "generate" : "interview");
      setState(prev => ({ ...prev, error: "Service not initialized" }));
    }
  }, [isGenerateMode]);

  // Process user response (works for both modes)
  const processUserResponse = useCallback(async (text: string) => {
    console.log("📝 useVoice: Processing user response:", text);

    if (isGenerateMode && voiceAssistantRef.current) {
      await voiceAssistantRef.current.processUserResponse(text);
    } else if (voiceServiceRef.current) {
      await voiceServiceRef.current.processUserResponse(text);
    }
  }, [isGenerateMode]);

  // Manual response submission (works for both modes)
  const submitManualResponse = useCallback(async (text: string) => {
    console.log("📤 useVoice: Submitting manual response:", text);

    if (isGenerateMode && voiceAssistantRef.current) {
      await voiceAssistantRef.current.submitManualResponse(text);
    } else if (voiceServiceRef.current) {
      await voiceServiceRef.current.processUserResponse(text);
    }
  }, [isGenerateMode]);

  // Voice controls
  const startListening = useCallback(async () => {
    console.log("👂 useVoice: Starting listening");
    if (isGenerateMode && voiceAssistantRef.current) {
      // VoiceAssistant manages listening automatically
      return;
    } else if (voiceServiceRef.current) {
      await voiceServiceRef.current.startListening();
    }
  }, [isGenerateMode]);

  const stopListening = useCallback(async () => {
    console.log("🛑 useVoice: Stopping listening");
    if (isGenerateMode && voiceAssistantRef.current) {
      await voiceAssistantRef.current.stop();
    } else if (voiceServiceRef.current) {
      await voiceServiceRef.current.stopListening();
    }
  }, [isGenerateMode]);

  const stopSpeaking = useCallback(() => {
    console.log("🔇 useVoice: Stopping speaking");
    if (isGenerateMode && voiceAssistantRef.current) {
      voiceAssistantRef.current.stop();
    } else if (voiceServiceRef.current) {
      voiceServiceRef.current.stopSpeaking();
    }
  }, [isGenerateMode]);

  // Set questions for interview mode
  const setInterviewQuestions = useCallback((questions: string[]) => {
    console.log("📚 useVoice: Setting interview questions", {
      count: questions?.length,
      sample: questions?.slice(0, 2)
    });
    if (voiceServiceRef.current) {
      voiceServiceRef.current.setInterviewQuestions(questions);
    }
  }, []);

  // Get messages
  const getMessages = useCallback((): VoiceMessage[] => {
    return state.messages;
  }, [state.messages]);

  // Get collected data from VoiceAssistant
  const getCollectedData = useCallback(() => {
    if (isGenerateMode && voiceAssistantRef.current) {
      return voiceAssistantRef.current.getCollectedData();
    }
    return null;
  }, [isGenerateMode]);

  return {
    state,
    startInterview,
    processUserResponse,
    submitManualResponse,
    startListening,
    stopListening,
    stopSpeaking,
    setInterviewQuestions,
    getMessages,
    getCollectedData,
    isGenerateMode,
  };
}