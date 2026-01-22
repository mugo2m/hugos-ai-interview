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
  const [userTranscript, setUserTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [currentStep, setCurrentStep] = useState<"idle" | "configuring" | "generating" | "redirecting" | "error">("idle");
  const [configStep, setConfigStep] = useState(0);

  const [userConfig, setUserConfig] = useState({
    role: "",
    level: "Mid-level",
    type: "Technical",
    techstack: "",
    amount: 5
  });

  const [debugInfo, setDebugInfo] = useState({
    callStatus: "INACTIVE",
    currentQuestion: 0,
    totalQuestions: 0,
    isListening: false,
    userId: userId || "MISSING",
    voiceMode: "SIMULATED" as "REAL" | "SIMULATED",
    generatedInterviewId: ""
  });

  const voiceAssistantRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const isRecognitionActiveRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Configuration questions
  const configQuestions = [
    {
      id: "role",
      question: "What role are you interviewing for? For example: Frontend Developer, Backend Engineer, or Product Manager.",
      parse: (answer: string) => answer
    },
    {
      id: "level",
      question: "What experience level? For example: Junior, Mid-level, or Senior.",
      parse: (answer: string) => {
        if (answer.toLowerCase().includes("junior")) return "Junior";
        if (answer.toLowerCase().includes("senior")) return "Senior";
        if (answer.toLowerCase().includes("entry")) return "Entry";
        return "Mid-level";
      }
    },
    {
      id: "techstack",
      question: "What technologies or skills should we focus on? For example: React, TypeScript, Node.js.",
      parse: (answer: string) => answer
    },
    {
      id: "type",
      question: "What type of interview? Technical, behavioral, or mixed?",
      parse: (answer: string) => {
        if (answer.toLowerCase().includes("behavioral")) return "Behavioral";
        if (answer.toLowerCase().includes("mixed")) return "Mixed";
        return "Technical";
      }
    },
    {
      id: "amount",
      question: "How many questions would you like? 3, 5, or 10?",
      parse: (answer: string) => {
        const num = parseInt(answer);
        if ([3, 5, 10].includes(num)) return num;
        return 5;
      }
    }
  ];

  // Initialize voice and speech recognition
  useEffect(() => {
    const checkVoiceSupport = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        const hasRealVoice = voices.length > 0;
        setDebugInfo(prev => ({
          ...prev,
          voiceMode: hasRealVoice ? "REAL" : "SIMULATED"
        }));
      }
    };

    checkVoiceSupport();
    setTimeout(checkVoiceSupport, 500);

    // Initialize speech recognition if available
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.timeout = 15000;
      recognitionRef.current.nospeech_timeout = 15000;

      recognitionRef.current.onresult = (event: any) => {
        console.log("Speech recognition result received");
        retryCountRef.current = 0;

        if (isRecognitionActiveRef.current) {
          isRecognitionActiveRef.current = false;
          setDebugInfo(prev => ({ ...prev, isListening: false }));
        }

        const transcript = event.results[0][0].transcript;
        console.log("Voice input:", transcript);
        setUserTranscript(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);

        if (isRecognitionActiveRef.current) {
          isRecognitionActiveRef.current = false;
          setDebugInfo(prev => ({ ...prev, isListening: false }));
        }

        if (event.error === 'no-speech') {
          retryCountRef.current++;
          if (retryCountRef.current <= maxRetries) {
            toast.info(`No speech detected. Please speak. Retry ${retryCountRef.current}/${maxRetries}`);
            setTimeout(() => safeStartListening(), 2000);
          } else {
            toast.error("No speech detected after multiple attempts.");
            setCurrentStep("idle");
            retryCountRef.current = 0;
          }
        } else if (event.error === 'not-allowed') {
          toast.error("Microphone access denied. Please allow microphone access.");
        } else {
          toast.error(`Voice error: ${event.error}. Please try again.`);
        }
      };

      recognitionRef.current.onend = () => {
        if (isRecognitionActiveRef.current) {
          isRecognitionActiveRef.current = false;
          setDebugInfo(prev => ({ ...prev, isListening: false }));
        }
      };

      recognitionRef.current.onstart = () => {
        console.log("Speech recognition started");
        isRecognitionActiveRef.current = true;
        setDebugInfo(prev => ({ ...prev, isListening: true }));
        retryCountRef.current = 0;
      };
    }

    return () => {
      if (recognitionRef.current && isRecognitionActiveRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error("Error stopping recognition on cleanup:", error);
        }
      }
    };
  }, [currentStep]);

  // Initialize voice assistant
  useEffect(() => {
    if (!voiceEnabled) {
      voiceAssistantRef.current = null;
      return;
    }

    voiceAssistantRef.current = {
      speak: async (text: string) => {
        return new Promise((resolve) => {
          if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            console.log("Would speak:", text.substring(0, 50) + "...");
            setTimeout(resolve, 2000);
            return;
          }

          setIsSpeaking(true);

          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.volume = 1.0;
          utterance.pitch = 1.0;

          utterance.onend = () => {
            console.log("Finished speaking");
            setIsSpeaking(false);
            resolve();
          };

          utterance.onerror = (error) => {
            console.error("Speech error:", error);
            setIsSpeaking(false);
            resolve();
          };

          window.speechSynthesis.speak(utterance);
        });
      }
    };

    toast.success("🎤 Voice assistant ready!");
  }, [voiceEnabled]);

  const handleVoiceToggle = (enabled: boolean) => {
    setVoiceEnabled(enabled);

    if (enabled) {
      toast.success("Voice mode activated!");
      setDebugInfo(prev => ({ ...prev, callStatus: "READY" }));
    } else {
      toast.info("Voice mode disabled");
      setDebugInfo(prev => ({
        ...prev,
        callStatus: "INACTIVE",
        isListening: false
      }));
    }
  };

  const processAnswer = (transcript: string) => {
    console.log("Processing answer:", transcript);

    if (currentStep === "configuring") {
      const currentConfig = configQuestions[configStep];
      const parsedValue = currentConfig.parse(transcript);

      setUserConfig(prev => ({
        ...prev,
        [currentConfig.id]: parsedValue
      }));

      toast.success(`✅ ${currentConfig.id}: ${parsedValue}`);

      if (configStep < configQuestions.length - 1) {
        setConfigStep(prev => prev + 1);
        setTimeout(() => askConfigurationQuestion(configStep + 1), 1500);
      } else {
        setCurrentStep("generating");
        generateInterviewWithVoice();
      }
    }
  };

  const safeStartListening = () => {
    if (!recognitionRef.current || isRecognitionActiveRef.current || isSpeaking) {
      console.log("Cannot start listening - already active or speaking");
      return;
    }

    try {
      console.log("Starting speech recognition...");
      recognitionRef.current.start();
      setDebugInfo(prev => ({ ...prev, isListening: true }));
      toast.info("🎤 Listening... Speak now!");
    } catch (error: any) {
      console.error("Failed to start speech recognition:", error);

      if (error.name === 'InvalidStateError') {
        isRecognitionActiveRef.current = false;
        setDebugInfo(prev => ({ ...prev, isListening: false }));

        setTimeout(() => {
          if (!isRecognitionActiveRef.current) {
            safeStartListening();
          }
        }, 500);
      }
    }
  };

  const safeStopListening = () => {
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error("Error stopping recognition:", error);
      } finally {
        isRecognitionActiveRef.current = false;
        setDebugInfo(prev => ({ ...prev, isListening: false }));
      }
    }
  };

  const startVoiceSetup = async () => {
    if (!voiceEnabled || !voiceAssistantRef.current) {
      toast.error("Please enable voice mode first");
      return;
    }

    console.log("Starting voice setup...");

    // Reset everything
    safeStopListening();
    setCurrentStep("configuring");
    setConfigStep(0);
    setUserTranscript("");
    setUserConfig({
      role: "",
      level: "Mid-level",
      type: "Technical",
      techstack: "",
      amount: 5
    });
    retryCountRef.current = 0;
    setDebugInfo(prev => ({
      ...prev,
      callStatus: "CONFIGURING",
      currentQuestion: 0,
      generatedInterviewId: ""
    }));

    await voiceAssistantRef.current.speak(
      "Welcome! I'll help you create interview and practice for job you are applying for. " +
      "First, I need to ask you a few questions . " +
      "Please speak clearly after each question."
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    askConfigurationQuestion(0);
  };

  const askConfigurationQuestion = async (step: number) => {
    if (!voiceAssistantRef.current || step >= configQuestions.length) return;

    if (isSpeaking) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const question = configQuestions[step].question;
    console.log("Asking config question", step + 1);

    setDebugInfo(prev => ({
      ...prev,
      currentQuestion: step + 1,
      totalQuestions: configQuestions.length
    }));

    await voiceAssistantRef.current.speak(question);
    await new Promise(resolve => setTimeout(resolve, 1000));

    safeStartListening();
  };

  const generateInterviewWithVoice = async () => {
    if (!voiceAssistantRef.current) return;

    setIsLoading(true);
    setDebugInfo(prev => ({ ...prev, callStatus: "GENERATING" }));

    await voiceAssistantRef.current.speak(
      `Thank you for your answers! Based on your preferences, I'm now generating your interview questions. ` +
      `You'll be interviewing for a ${userConfig.level} ${userConfig.role} position. ` +
      `Please wait a moment while I create the questions.`
    );

    // Get or create userId
    let currentUserId = userId;
    if (!currentUserId) {
      currentUserId = localStorage.getItem('userId') || `user-${Date.now()}`;
      localStorage.setItem('userId', currentUserId);
    }

    try {
      const response = await fetch("/api/vapi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...userConfig,
          userid: currentUserId
        })
      });

      const data = await response.json();

      if (data.success && data.questions && data.interviewId) {
        setDebugInfo(prev => ({
          ...prev,
          generatedInterviewId: data.interviewId,
          totalQuestions: data.questions.length,
          callStatus: "REDIRECTING"
        }));

        await voiceAssistantRef.current.speak(
          `Perfect! I've generated ${data.questions.length} interview questions. ` +
          `I'll now redirect you to the interview practice page where you can answer them one by one.`
        );

        toast.success(`✅ Generated ${data.questions.length} questions! Redirecting...`);

        // Redirect to interview practice page after a delay
        setTimeout(() => {
          if (data.interviewId) {
            window.location.href = `/interview/${data.interviewId}`;
          } else {
            window.location.href = '/';
          }
        }, 3000);

        setCurrentStep("redirecting");

      } else {
        throw new Error(data.error || "Failed to generate questions");
      }
    } catch (error: any) {
      console.error("Error generating interview:", error);
      await voiceAssistantRef.current.speak(
        "Sorry, there was an error generating your interview questions. Please try again."
      );
      toast.error(`❌ ${error.message}`);
      setCurrentStep("error");
      setDebugInfo(prev => ({ ...prev, callStatus: "ERROR" }));
    } finally {
      setIsLoading(false);
    }
  };

  const stopEverything = () => {
    safeStopListening();
    setCurrentStep("idle");
    retryCountRef.current = 0;
    toast.info("Setup stopped");
  };

  // NEW: Submit answer function
  const submitAnswer = () => {
    if (userTranscript.trim()) {
      processAnswer(userTranscript);
      setUserTranscript("");
      toast.success("✅ Answer submitted!");
    } else {
      toast.error("Please speak or enter an answer first");
    }
  };

  const skipQuestion = () => {
    if (currentStep === "configuring") {
      const defaultAnswers = ["Software Developer", "Mid-level", "General", "Technical", "5"];
      const answer = defaultAnswers[configStep];

      processAnswer(answer);
      toast.info(`⏭️ Skipped to next question`);
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
            <p className="text-sm text-gray-500">Create Interview</p>
            <p className="text-xs text-gray-400">ID: {debugInfo.userId.substring(0, 8)}...</p>
          </div>
        </div>

        <button
          onClick={startVoiceSetup}
          disabled={isLoading || !voiceEnabled || currentStep !== "idle"}
          className={`px-4 py-2 rounded-lg font-medium ${
            voiceEnabled && currentStep === "idle"
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          } ${isLoading ? 'animate-pulse' : ''}`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Generating...
            </span>
          ) : currentStep === "redirecting" ? (
            "Redirecting..."
          ) : (
            "Start Voice Setup"
          )}
        </button>
      </div>

      {/* Voice Toggle */}
      <div className="border border-gray-300 rounded-xl p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold">Voice Interview Setup</h4>
          <span className={`text-sm font-medium px-2 py-1 rounded ${
            debugInfo.callStatus === "REDIRECTING" ? 'bg-green-100 text-green-800' :
            debugInfo.callStatus === "GENERATING" ? 'bg-blue-100 text-blue-800' :
            debugInfo.callStatus === "CONFIGURING" ? 'bg-yellow-100 text-yellow-800' :
            debugInfo.callStatus === "ERROR" ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {debugInfo.callStatus}
          </span>
        </div>

        <VoiceToggle
          onVoiceToggle={handleVoiceToggle}
          initialEnabled={voiceEnabled}
        />

        <div className="mt-4 text-sm text-gray-600 space-y-1">
          <p>• I will ask you 5 configuration questions</p>
          <p>• I'll generate personalized interview questions</p>
          <p>• You'll be redirected to practice answering them</p>
        </div>
      </div>

      {/* Current Configuration Status */}
      {currentStep === "configuring" && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
              {debugInfo.currentQuestion}
            </div>
            <h4 className="font-bold text-blue-800">Configuration Question {debugInfo.currentQuestion} of 5</h4>
          </div>
          <p className="text-blue-900 mb-3">{configQuestions[configStep]?.question}</p>

          {userTranscript && (
            <div className="mt-3 p-3 bg-white border border-blue-100 rounded-lg mb-3">
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-medium text-blue-700">Your Answer:</span>
                <button
                  onClick={() => setUserTranscript("")}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
              <p className="text-gray-800">{userTranscript}</p>
            </div>
          )}

          {debugInfo.isListening && (
            <div className="mt-3 flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-red-600">🎤 Listening... Speak now</span>
            </div>
          )}
        </div>
      )}

      {/* Configuration Summary */}
      {(currentStep === "configuring" || currentStep === "generating" || currentStep === "redirecting") && (
        <div className="border border-purple-200 bg-purple-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center">
              <span className="text-sm">⚙️</span>
            </div>
            <h4 className="font-bold text-purple-800">Your Configuration</h4>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-lg border border-purple-100">
              <div className="text-xs text-purple-600">Role</div>
              <div className="font-medium">{userConfig.role || "Not set yet"}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-purple-100">
              <div className="text-xs text-purple-600">Level</div>
              <div className="font-medium">{userConfig.level}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-purple-100">
              <div className="text-xs text-purple-600">Type</div>
              <div className="font-medium">{userConfig.type}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-purple-100">
              <div className="text-xs text-purple-600">Tech Stack</div>
              <div className="font-medium">{userConfig.techstack || "Not set yet"}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-purple-100">
              <div className="text-xs text-purple-600">Questions</div>
              <div className="font-medium">{userConfig.amount}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-purple-100">
              <div className="text-xs text-purple-600">Status</div>
              <div className="font-medium">{currentStep === "configuring" ? "Configuring" :
                                          currentStep === "generating" ? "Generating" :
                                          currentStep === "redirecting" ? "Redirecting" : "Ready"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Status Panel with Control Buttons */}
      <div className="border border-gray-300 rounded-xl p-4">
        <h4 className="font-bold text-lg mb-4">📊 Setup Status</h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Step</div>
            <div className="font-bold text-gray-800">
              {debugInfo.currentQuestion}/5
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Voice</div>
            <div className={`font-bold ${voiceEnabled ? 'text-green-600' : 'text-red-600'}`}>
              {voiceEnabled ? "ON" : "OFF"}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Mode</div>
            <div className={`font-bold ${
              debugInfo.voiceMode === "REAL" ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {debugInfo.voiceMode}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Questions</div>
            <div className="font-bold text-gray-800">
              {userConfig.amount}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-bold text-gray-800">
              {currentStep === "idle" ? "0%" :
               currentStep === "configuring" ? `${debugInfo.currentQuestion * 20}%` :
               currentStep === "generating" ? "80%" :
               currentStep === "redirecting" ? "100%" : "0%"}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
              style={{
                width: currentStep === "idle" ? "0%" :
                       currentStep === "configuring" ? `${debugInfo.currentQuestion * 20}%` :
                       currentStep === "generating" ? "80%" :
                       currentStep === "redirecting" ? "100%" : "0%"
              }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>
              {currentStep === "idle" ? "Ready to start" :
               currentStep === "configuring" ? `Question ${debugInfo.currentQuestion} of 5` :
               currentStep === "generating" ? "Generating questions..." :
               currentStep === "redirecting" ? "Redirecting to practice..." : "Error"}
            </span>
            <span>
              {currentStep === "redirecting" && debugInfo.generatedInterviewId ?
               `ID: ${debugInfo.generatedInterviewId.substring(0, 8)}...` : ""}
            </span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          {/* Start Button */}
          <button
            onClick={startVoiceSetup}
            disabled={isLoading || !voiceEnabled || currentStep !== "idle"}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
          >
            <span>🎤</span>
            {currentStep === "idle" ? "Start Voice Setup" : "In Progress"}
          </button>

          {/* Stop Button */}
          {(currentStep === "configuring" || currentStep === "generating") && (
            <button
              onClick={stopEverything}
              disabled={isSpeaking}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2 disabled:opacity-50"
            >
              <span>🛑</span>
              Stop Setup
            </button>
          )}

          {/* NEW: Submit Answer Button */}
          {currentStep === "configuring" && userTranscript && (
            <button
              onClick={submitAnswer}
              disabled={!userTranscript.trim()}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
            >
              <span>✅</span>
              Submit Answer
            </button>
          )}

          {/* Skip Button */}
          {currentStep === "configuring" && (
            <button
              onClick={skipQuestion}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
            >
              <span>⏭️</span>
              Skip Question
            </button>
          )}

          {/* Redirect Button */}
          {currentStep === "redirecting" && debugInfo.generatedInterviewId && (
            <button
              onClick={() => window.location.href = `/interview/${debugInfo.generatedInterviewId}`}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
            >
              <span>🚀</span>
              Go to Interview Now
            </button>
          )}
        </div>

        {/* Completion Status */}
        {currentStep === "redirecting" && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-green-800">✅ Interview Created!</h4>
                <p className="text-green-700 text-sm">
                  {userConfig.amount} questions generated for {userConfig.level} {userConfig.role}
                </p>
                <p className="text-green-600 text-xs mt-1">
                  Redirecting to practice page...
                </p>
              </div>
              <div className="animate-pulse">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Interviewer */}
      <div className="border border-gray-300 rounded-xl p-4">
        <div className="flex flex-row items-center gap-4">
          <Image
            src="/interview-panel.jpg"
            alt={aiAltText}
            width={40}
            height={40}
            className="rounded-full object-cover size-10"
          />
          <div className="flex-1">
            <h4 className="font-semibold">AI Interviewer</h4>
            <p className="text-gray-600">
              {currentStep === "idle"
                ? "Ready to create your custom interview"
                : currentStep === "configuring"
                ? `Asking configuration question ${debugInfo.currentQuestion} of 5`
                : currentStep === "generating"
                ? "Generating personalized interview questions..."
                : currentStep === "redirecting"
                ? "Redirecting you to practice the interview..."
                : "Error occurred"}
            </p>
            {debugInfo.isListening && (
              <p className="text-sm text-blue-600 mt-1 animate-pulse">
                🎤 I'm listening to your answer...
              </p>
            )}
            {isSpeaking && (
              <p className="text-sm text-purple-600 mt-1 animate-pulse">
                🔊 Asking question...
              </p>
            )}
            {currentStep === "configuring" && !debugInfo.isListening && !isSpeaking && userTranscript && (
              <p className="text-sm text-green-600 mt-1">
                ✅ Ready to submit your answer
              </p>
            )}
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
              {currentStep === "idle"
                ? "Enable voice mode and click Start Voice Setup"
                : currentStep === "configuring"
                ? "🎤 Speak your answer, then click Submit Answer"
                : currentStep === "generating"
                ? "Please wait while I generate your interview..."
                : currentStep === "redirecting"
                ? "✅ Interview created! Redirecting to practice..."
                : "Please try again"}
            </p>
            {currentStep === "configuring" && (
              <div className="mt-2 text-sm text-gray-500">
                <p>• Speak clearly into your microphone</p>
                <p>• Click <span className="font-medium text-green-600">Submit Answer</span> to continue</p>
                <p>• Click <span className="font-medium text-yellow-600">Skip Question</span> to use default value</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="border border-gray-300 rounded-xl p-4">
        <h4 className="font-bold mb-3">📋 How It Works:</h4>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li><span className="font-medium">Turn on Voice Mode</span> above</li>
          <li><span className="font-medium">Click Start Voice Setup</span></li>
          <li><span className="font-medium">Answer 5 configuration questions</span> by voice</li>
          <li><span className="font-medium">Click Submit Answer</span> after each response</li>
          <li><span className="font-medium">I generate personalized interview questions</span></li>
          <li><span className="font-medium">You'll be redirected to practice</span> answering the questions</li>
        </ol>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          <p className="font-medium text-blue-800">🎯 Submit Button Guide:</p>
          <div className="grid grid-cols-1 gap-2 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500 text-white rounded-lg flex items-center justify-center text-sm">✅</div>
              <div>
                <p className="font-medium text-blue-800">Submit Answer</p>
                <p className="text-blue-600 text-xs">Click this button after speaking to submit your answer and move to the next question</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-yellow-500 text-white rounded-lg flex items-center justify-center text-sm">⏭️</div>
              <div>
                <p className="font-medium text-blue-800">Skip Question</p>
                <p className="text-blue-600 text-xs">Use this if you want to skip the current question</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500 text-white rounded-lg flex items-center justify-center text-sm">🛑</div>
              <div>
                <p className="font-medium text-blue-800">Stop Setup</p>
                <p className="text-blue-600 text-xs">Cancel the interview creation process</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateInterviewAgent;