"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { VoiceToggle } from "@/components/VoiceToggle";

interface CreateInterviewAgentProps {
  userName: string;
  userId?: string;
  profileImage?: string;
}

const CreateInterviewAgent = ({
  userName,
  userId,
  profileImage
}: CreateInterviewAgentProps) => {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeakingQuestions, setIsSpeakingQuestions] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [debugInfo, setDebugInfo] = useState({
    callStatus: "INACTIVE",
    currentQuestion: 0,
    totalQuestions: 5,
    messages: 0,
    collectedAnswers: 0,
    isListening: false,
    isSpeaking: false,
    userId: userId || "MISSING",
    voiceMode: "SIMULATED" as "REAL" | "SIMULATED"
  });

  const voiceAssistantRef = useRef<any>(null);

  // Interview creation questions to ask
  const creationQuestions = [
    "What role are you interviewing for? For example: Frontend Developer, Backend Engineer, or Product Manager.",
    "What experience level? For example: Junior, Mid-level, or Senior.",
    "What technologies or skills should we focus on? For example: React, TypeScript, Node.js.",
    "What type of interview? Technical, behavioral, or mixed?",
    "How many questions would you like? 3, 5, or 10?"
  ];

  // Generated interview questions (these would come from your API)
  const generatedQuestions = [
    "Explain the Virtual DOM in React and how it improves performance.",
    "How would you handle state management in a large React application?",
    "What are the benefits of using TypeScript with React?",
    "Explain server-side rendering in Next.js and its advantages.",
    "How would you optimize a React application for better performance?"
  ];

  // Check voice support
  useEffect(() => {
    const checkVoice = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        const hasRealVoice = voices.length > 0;
        setDebugInfo(prev => ({
          ...prev,
          voiceMode: hasRealVoice ? "REAL" : "SIMULATED"
        }));
      }
    };

    checkVoice();
    setTimeout(checkVoice, 500);
  }, []);

  // Initialize voice assistant when voice is enabled
  useEffect(() => {
    if (!voiceEnabled) {
      voiceAssistantRef.current = null;
      return;
    }

    voiceAssistantRef.current = {
      speak: async (text: string) => {
        if (!voiceEnabled) return;

        return new Promise((resolve) => {
          if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            toast.info(`🤖 AI: ${text.substring(0, 100)}...`);
            setTimeout(resolve, 1000);
            return;
          }

          setDebugInfo(prev => ({ ...prev, isSpeaking: true }));

          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.volume = 1.0;

          utterance.onend = () => {
            setDebugInfo(prev => ({ ...prev, isSpeaking: false }));
            resolve();
          };

          utterance.onerror = () => {
            setDebugInfo(prev => ({ ...prev, isSpeaking: false }));
            resolve();
          };

          window.speechSynthesis.speak(utterance);
        });
      }
    };

    toast.success("Voice assistant ready for guided setup!");

  }, [voiceEnabled]);

  const handleVoiceToggle = (enabled: boolean) => {
    setVoiceEnabled(enabled);

    if (enabled) {
      toast.success("Voice mode activated! Use 'Voice Guided Setup' to create an interview.");
      setDebugInfo(prev => ({
        ...prev,
        callStatus: "READY"
      }));
    } else {
      toast.info("Voice mode disabled");
      setDebugInfo(prev => ({
        ...prev,
        callStatus: "INACTIVE",
        isListening: false,
        isSpeaking: false
      }));
    }
  };

  const testVoiceDirectly = () => {
    if (!('speechSynthesis' in window)) {
      toast.error("Speech synthesis not supported");
      setDebugInfo(prev => ({ ...prev, voiceMode: "SIMULATED" }));
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      toast.warning("No voices available");
      setDebugInfo(prev => ({ ...prev, voiceMode: "SIMULATED" }));
      return;
    }

    setDebugInfo(prev => ({ ...prev, voiceMode: "REAL", isSpeaking: true }));

    const utterance = new SpeechSynthesisUtterance("Voice assistant ready. I will ask you 5 questions to create a custom interview, then speak the generated questions for your practice.");
    utterance.rate = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => toast.info("🔊 Testing voice assistant...");
    utterance.onend = () => {
      setDebugInfo(prev => ({ ...prev, isSpeaking: false }));
      toast.success("✅ Voice assistant working!");
    };
    utterance.onerror = () => {
      setDebugInfo(prev => ({ ...prev, isSpeaking: false, voiceMode: "SIMULATED" }));
      toast.error("❌ Voice test failed");
    };

    window.speechSynthesis.speak(utterance);
  };

  // FIXED: This function actually speaks the questions
  const speakInterviewQuestions = async () => {
    if (!voiceAssistantRef.current) {
      toast.error("Voice assistant not ready");
      return;
    }

    setIsSpeakingQuestions(true);
    setDebugInfo(prev => ({ ...prev, callStatus: "SPEAKING" }));

    try {
      // Step 1: Welcome message
      await voiceAssistantRef.current.speak("I'm creating a Frontend Developer interview for you. First, let me ask you some questions to customize it.");
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Ask configuration questions
      for (let i = 0; i < creationQuestions.length; i++) {
        setCurrentStep(i + 1);
        setDebugInfo(prev => ({
          ...prev,
          currentQuestion: i + 1,
          isListening: true,
          callStatus: "LISTENING"
        }));

        // Speak the question
        await voiceAssistantRef.current.speak(creationQuestions[i]);
        toast.info(`🎤 Listening for answer ${i + 1}...`);

        // Simulate listening (3 seconds per question)
        await new Promise(resolve => setTimeout(resolve, 3000));

        setDebugInfo(prev => ({ ...prev, isListening: false }));

        // Small pause between questions
        if (i < creationQuestions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Step 3: Process the answers
      setDebugInfo(prev => ({ ...prev, callStatus: "PROCESSING" }));
      await voiceAssistantRef.current.speak("Thank you for your answers! Based on your preferences, I'll create a Frontend Developer interview focused on React, TypeScript, and Next.js.");
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 4: Speak the generated questions
      await voiceAssistantRef.current.speak("Here are the 5 interview questions I've generated for your practice. Listen carefully:");
      await new Promise(resolve => setTimeout(resolve, 1000));

      for (let i = 0; i < generatedQuestions.length; i++) {
        await voiceAssistantRef.current.speak(`Question ${i + 1}: ${generatedQuestions[i]}`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Pause between questions
      }

      // Step 5: Confirm creation
      await voiceAssistantRef.current.speak("Great! I've generated 5 interview questions for you. Now I'll save this interview so you can practice with it.");
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 6: Actually create the interview
      await createQuickInterview();

    } catch (error) {
      console.error("Error speaking questions:", error);
      toast.error("Failed to speak questions");
      setIsSpeakingQuestions(false);
      setDebugInfo(prev => ({ ...prev, callStatus: "ERROR" }));
    }
  };

  const startVoiceSetup = async () => {
    console.log("🎤 Starting voice setup...");

    if (!voiceEnabled) {
      toast.error("Please enable voice mode first");
      return;
    }

    if (!voiceAssistantRef.current) {
      toast.error("Voice assistant not ready");
      return;
    }

    // Call the function that actually speaks questions
    await speakInterviewQuestions();
  };

  const createQuickInterview = async () => {
    setIsLoading(true);
    setDebugInfo(prev => ({ ...prev, callStatus: "GENERATING" }));

    // Get or create userId
    let currentUserId = userId;
    if (!currentUserId) {
      currentUserId = localStorage.getItem('userId') || `user-${Date.now()}`;
      localStorage.setItem('userId', currentUserId);
    }

    try {
      toast.info("🚀 Creating interview...");

      const response = await fetch("/api/vapi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "technical",
          role: "Frontend Developer",
          level: "Mid-level",
          techstack: "React, TypeScript, Next.js",
          amount: 5,
          userid: currentUserId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Speak success message if voice is enabled
        if (voiceEnabled && voiceAssistantRef.current) {
          await voiceAssistantRef.current.speak("Interview created successfully! You can now practice with these questions.");
        }

        toast.success(`✅ Interview created with ${data.count || 5} questions!`);
        setDebugInfo(prev => ({ ...prev, callStatus: "COMPLETED" }));

        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      } else {
        throw new Error(data.error || "Failed to create interview");
      }
    } catch (error: any) {
      toast.error(`❌ Error: ${error.message}`);
      setDebugInfo(prev => ({ ...prev, callStatus: "ERROR" }));

      // Speak error message if voice is enabled
      if (voiceEnabled && voiceAssistantRef.current) {
        await voiceAssistantRef.current.speak("Sorry, there was an error creating the interview. Please try again.");
      }
    } finally {
      setIsLoading(false);
      setIsSpeakingQuestions(false);
    }
  };

  const displayName = userName || "User";
  const userAltText = `${displayName}'s profile picture`;
  const aiAltText = "AI Interviewer avatar";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-4">
          <Image
            src={profileImage || "/beautiful-avatar.png"}
            alt={userAltText}
            width={40}
            height={40}
            className="rounded-full object-cover size-10"
          />
          <div>
            <h4 className="font-semibold">{displayName}</h4>
            <p className="text-sm text-gray-500">Setup Mode - Create New Interview</p>
            <p className="text-xs text-gray-400">User ID: {debugInfo.userId}</p>
          </div>
        </div>

        <button
          onClick={createQuickInterview}
          disabled={isLoading || isSpeakingQuestions}
          className={`px-4 py-2 rounded-lg font-medium ${
            'bg-blue-500 hover:bg-blue-600 text-white'
          } ${isLoading ? 'animate-pulse' : ''}`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Creating...
            </span>
          ) : isSpeakingQuestions ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">🎤</span>
              Speaking...
            </span>
          ) : (
            "Quick Generate"
          )}
        </button>
      </div>

      {/* Voice Toggle */}
      <div className="border border-gray-300 rounded-xl p-4">
        <VoiceToggle
          onVoiceToggle={handleVoiceToggle}
          initialEnabled={voiceEnabled}
        />
      </div>

      {/* Debug Panel */}
      <div className="border border-gray-300 rounded-xl p-4">
        <h4 className="font-bold text-lg mb-4">🎤 Interview Creation Status</h4>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Mode</div>
            <div className="font-bold text-gray-800">GENERATE</div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Voice</div>
            <div className={`font-bold ${voiceEnabled ? 'text-green-600' : 'text-red-600'}`}>
              {voiceEnabled ? "ACTIVE" : "INACTIVE"}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Status</div>
            <div className={`font-bold ${
              debugInfo.callStatus === "LISTENING" ? "text-blue-600" :
              debugInfo.callStatus === "SPEAKING" ? "text-purple-600" :
              debugInfo.callStatus === "PROCESSING" ? "text-orange-600" :
              debugInfo.callStatus === "GENERATING" ? "text-yellow-600" :
              debugInfo.callStatus === "COMPLETED" ? "text-green-700" :
              debugInfo.callStatus === "ERROR" ? "text-red-600" :
              "text-gray-600"
            }`}>
              {debugInfo.callStatus}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Progress</div>
            <div className="font-bold text-gray-800">
              {currentStep}/{debugInfo.totalQuestions}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Voice Type</div>
            <div className={`font-bold ${
              debugInfo.voiceMode === "REAL" ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {debugInfo.voiceMode}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">State</div>
            <div className="flex flex-col gap-1">
              {debugInfo.isListening ? (
                <span className="text-xs text-blue-600 font-bold animate-pulse">🎤 Listening...</span>
              ) : debugInfo.isSpeaking ? (
                <span className="text-xs text-purple-600 font-bold animate-pulse">🔊 Speaking...</span>
              ) : voiceEnabled ? (
                <span className="text-xs text-green-600">✅ Ready</span>
              ) : (
                <span className="text-xs text-gray-500">⏸️ Paused</span>
              )}
            </div>
          </div>
        </div>

        {/* Current Step Display */}
        {(debugInfo.callStatus === "LISTENING" || debugInfo.callStatus === "SPEAKING" || debugInfo.callStatus === "PROCESSING") && currentStep > 0 && (
          <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 text-purple-800 rounded-full flex items-center justify-center text-sm font-bold">
                {currentStep}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-purple-800">
                    {debugInfo.callStatus === "LISTENING" ? "Asking Question:" :
                     debugInfo.callStatus === "SPEAKING" ? "Speaking Question:" :
                     "Processing:"}
                  </p>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                    Step {currentStep} of {debugInfo.totalQuestions}
                  </span>
                </div>
                <p className="text-purple-700">
                  {currentStep <= creationQuestions.length
                    ? creationQuestions[currentStep - 1]
                    : `Generated Question ${currentStep - creationQuestions.length}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={createQuickInterview}
            disabled={isLoading || isSpeakingQuestions}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
          >
            <span>🚀</span>
            Quick Generate Interview
          </button>

          <button
            onClick={startVoiceSetup}
            disabled={!voiceEnabled || isLoading || isSpeakingQuestions}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
          >
            <span>🎤</span>
            Voice Guided Setup
          </button>

          <button
            onClick={testVoiceDirectly}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
          >
            <span>🎵</span>
            Test Voice
          </button>
        </div>

        {/* Instructions */}
        <div className={`mt-4 p-3 rounded-lg border ${
          'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          <p className="text-sm font-medium">
            🎯 Two ways to create an interview:
          </p>
          <p className="text-xs mt-1">
            1. <strong>Quick Generate</strong>: Instantly creates a Frontend Developer interview<br/>
            2. <strong>Voice Guided Setup</strong>: I will ask you 5 questions, then speak 5 generated interview questions
          </p>
        </div>
      </div>

      {/* AI Interviewer */}
      <div className="border border-gray-300 rounded-xl p-4">
        <div className="flex flex-row items-center gap-4">
          <Image
            src="/ai-avatar.png"
            alt={aiAltText}
            width={40}
            height={40}
            className="rounded-full object-cover size-10"
          />
          <div className="flex-1">
            <h4 className="font-semibold">AI Interviewer</h4>
            <p className="text-gray-600">
              {debugInfo.callStatus === "LISTENING"
                ? `Asking question ${currentStep} of ${creationQuestions.length}...`
                : debugInfo.callStatus === "SPEAKING"
                ? `Speaking generated question ${currentStep - creationQuestions.length}...`
                : debugInfo.callStatus === "PROCESSING"
                ? "Processing your answers..."
                : "Ready to help you create a new interview"
              }
            </p>
          </div>
        </div>
      </div>

      {/* User */}
      <div className="border border-gray-300 rounded-xl p-4">
        <div className="flex flex-row items-center gap-4">
          <Image
            src={profileImage || "/beautiful-avatar.png"}
            alt={userAltText}
            width={40}
            height={40}
            className="rounded-full object-cover size-10"
          />
          <div className="flex-1">
            <h4 className="font-semibold">{displayName}</h4>
            <p className="text-gray-600">
              {debugInfo.callStatus === "LISTENING"
                ? `Answering question ${currentStep} of ${creationQuestions.length}...`
                : debugInfo.callStatus === "SPEAKING"
                ? "Listening to generated questions..."
                : voiceEnabled
                ? "Voice mode active. Try 'Voice Guided Setup'!"
                : "Enable voice mode for interactive setup."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateInterviewAgent;