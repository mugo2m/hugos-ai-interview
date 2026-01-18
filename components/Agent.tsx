"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import VoiceService from "@/lib/voice/VoiceService";
import { VoiceToggle } from "@/components/VoiceToggle";

interface AgentProps {
  userName: string;
  userId?: string;
  interviewId?: string;
  questions?: string[];
  profileImage?: string;
}

interface AnswerHistory {
  question: string;
  answer: string;
  questionNumber: number;
  timestamp: string;
}

const Agent = ({
  userName,
  userId,
  interviewId,
  questions = [],
  profileImage
}: AgentProps) => {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userTranscript, setUserTranscript] = useState("");
  const [answerHistory, setAnswerHistory] = useState<AnswerHistory[]>([]);
  const [currentQuestionText, setCurrentQuestionText] = useState("");
  const [debugInfo, setDebugInfo] = useState({
    callStatus: "INACTIVE",
    currentQuestion: 0,
    totalQuestions: questions.length || 0,
    messages: 0,
    collectedAnswers: 0,
    isListening: false,
    isSpeaking: false,
    userId: userId || "MISSING",
    voiceMode: "SIMULATED" as "REAL" | "SIMULATED",
    serviceStatus: "NOT_INITIALIZED"
  });

  const voiceServiceRef = useRef<VoiceService | null>(null);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [userTranscript, answerHistory]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      voiceServiceRef.current?.destroy();
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  // Check voice support on mount
  useEffect(() => {
    const checkVoiceSupport = async () => {
      if (typeof window !== 'undefined') {
        const hasSpeechSynthesis = 'speechSynthesis' in window;
        const hasVoices = hasSpeechSynthesis && window.speechSynthesis.getVoices().length > 0;

        setDebugInfo(prev => ({
          ...prev,
          voiceMode: hasVoices ? "REAL" : "SIMULATED"
        }));
      }
    };

    checkVoiceSupport();
    setTimeout(checkVoiceSupport, 500);
  }, []);

  // Handle interview completion
  const handleInterviewCompletion = (data: any) => {
    console.log("🎉 Interview completion data received:", data);

    // Save completion data to localStorage immediately
    const completionData = {
      interviewId: data.interviewId || interviewId,
      timestamp: new Date().toISOString(),
      totalQuestions: data.questionsAsked || questions.length,
      answeredQuestions: data.answersGiven || 0,
      userId: data.userId || userId || debugInfo.userId,
      feedbackId: data.feedbackId,
      success: data.success,
      fallback: data.fallback
    };

    localStorage.setItem('interviewCompletion', JSON.stringify(completionData));
    console.log("💾 Saved to localStorage:", completionData);

    // Show immediate success message
    toast.success("✅ Interview completed! Redirecting to feedback...");

    // Clear any existing timeout
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
    }

    // Redirect after 3 seconds
    redirectTimerRef.current = setTimeout(() => {
      const targetInterviewId = data.interviewId || interviewId;
      if (targetInterviewId) {
        console.log("🚀 Redirecting to feedback page for interview:", targetInterviewId);
        window.location.href = `/interview/${targetInterviewId}/feedback`;
      } else {
        console.error("No interview ID available for redirect");
        window.location.href = '/';
      }
    }, 3000);
  };

  // Initialize voice service when voice is enabled
  useEffect(() => {
    if (!voiceEnabled) {
      voiceServiceRef.current?.destroy();
      voiceServiceRef.current = null;
      setDebugInfo(prev => ({ ...prev, serviceStatus: "DISABLED" }));
      return;
    }

    if (questions.length === 0) {
      toast.warning("No questions available for practice");
      return;
    }

    // Get or create userId
    let currentUserId = userId;
    if (!currentUserId) {
      currentUserId = localStorage.getItem('userId') || `user-${Date.now()}`;
      localStorage.setItem('userId', currentUserId);
    }

    try {
      voiceServiceRef.current = new VoiceService({
        interviewId: interviewId || `demo-${Date.now()}`,
        userId: currentUserId,
        type: "practice",
        speechRate: 1.0,
        speechVolume: 0.8
      });

      // Set questions
      voiceServiceRef.current.setInterviewQuestions(questions);

      // Setup callbacks
      voiceServiceRef.current.onStateChange((state) => {
        // Update user transcript display
        if (state.transcript !== userTranscript) {
          setUserTranscript(state.transcript);
        }

        setDebugInfo(prev => ({
          ...prev,
          isListening: state.isListening,
          isSpeaking: state.isSpeaking,
          isProcessing: state.isProcessing,
          callStatus: state.isListening ? "LISTENING" :
                     state.isSpeaking ? "SPEAKING" :
                     state.isProcessing ? "PROCESSING" :
                     prev.callStatus === "STARTING" ? "ACTIVE" : prev.callStatus,
          serviceStatus: "ACTIVE"
        }));
      });

      voiceServiceRef.current.onUpdate((messages) => {
        const userMessages = messages.filter(m => m.role === "user");
        const assistantMessages = messages.filter(m => m.role === "assistant");

        // Calculate current question based on assistant messages
        const currentQ = Math.max(0, Math.min(assistantMessages.length, questions.length));

        // Get current question text
        if (assistantMessages.length > 0 && currentQ > 0) {
          const latestQuestion = assistantMessages[assistantMessages.length - 1].content;
          const questionText = latestQuestion.replace(`Question ${currentQ}: `, '');
          setCurrentQuestionText(questionText);
        }

        // Update answer history
        if (userMessages.length > answerHistory.length) {
          const latestAnswer = userMessages[userMessages.length - 1];
          const latestQuestion = assistantMessages[assistantMessages.length - 1]?.content || `Question ${currentQ}`;
          const questionText = latestQuestion.replace(`Question ${currentQ}: `, '');

          setAnswerHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length >= currentQ) {
              newHistory[currentQ - 1] = {
                question: questionText,
                answer: latestAnswer.content,
                questionNumber: currentQ,
                timestamp: new Date(latestAnswer.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })
              };
            } else {
              newHistory.push({
                question: questionText,
                answer: latestAnswer.content,
                questionNumber: currentQ,
                timestamp: new Date(latestAnswer.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })
              });
            }
            return newHistory;
          });
        }

        setDebugInfo(prev => ({
          ...prev,
          messages: messages.length,
          collectedAnswers: userMessages.length,
          currentQuestion: currentQ
        }));
      });

      // CRITICAL: Register onComplete callback
      voiceServiceRef.current.onComplete((data) => {
        console.log("🎉 Interview completed:", data);

        setIsLoading(false);

        setDebugInfo(prev => ({
          ...prev,
          callStatus: "COMPLETED",
          currentQuestion: questions.length,
          collectedAnswers: data.answersGiven || 0,
          serviceStatus: "COMPLETED"
        }));

        // Handle interview completion
        handleInterviewCompletion(data);
      });

      setDebugInfo(prev => ({ ...prev, serviceStatus: "READY" }));
      toast.success("🎤 Voice service ready! Click 'Start Practice'.");

    } catch (error: any) {
      console.error("❌ Failed to initialize VoiceService:", error);
      toast.error("Failed to initialize voice service: " + error.message);
      setDebugInfo(prev => ({ ...prev, serviceStatus: "ERROR" }));
    }

    return () => {
      voiceServiceRef.current?.destroy();
    };
  }, [voiceEnabled, interviewId, userId, questions]);

  const handleVoiceToggle = (enabled: boolean) => {
    setVoiceEnabled(enabled);

    if (enabled) {
      toast.success("Voice mode activated!");
      setDebugInfo(prev => ({
        ...prev,
        callStatus: "READY",
        serviceStatus: "INITIALIZING"
      }));
    } else {
      toast.info("Voice mode disabled");
      setDebugInfo(prev => ({
        ...prev,
        callStatus: "INACTIVE",
        isListening: false,
        isSpeaking: false,
        serviceStatus: "DISABLED"
      }));
    }
  };

  const startVoiceInterview = async () => {
    if (!voiceServiceRef.current) {
      toast.error("Voice service not ready. Please enable voice first.");
      return;
    }

    if (questions.length === 0) {
      toast.error("No questions available");
      return;
    }

    // Reset state for new interview
    setAnswerHistory([]);
    setUserTranscript("");
    setCurrentQuestionText("");

    setIsLoading(true);
    setDebugInfo(prev => ({
      ...prev,
      callStatus: "STARTING",
      currentQuestion: 0,
      collectedAnswers: 0
    }));

    try {
      await voiceServiceRef.current.startInterview();
      setDebugInfo(prev => ({ ...prev, callStatus: "ACTIVE" }));
      toast.success("🎤 Interview started! Speak your answers clearly.");
    } catch (error: any) {
      console.error("❌ Failed to start interview:", error);
      toast.error("Failed to start: " + error.message);
      setDebugInfo(prev => ({ ...prev, callStatus: "ERROR" }));
      setIsLoading(false);
    }
  };

  const stopInterview = () => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.stop();
      setIsLoading(false);
      setDebugInfo(prev => ({
        ...prev,
        callStatus: "STOPPED",
        isListening: false,
        isSpeaking: false
      }));
      toast.info("🛑 Interview stopped");
    }
  };

  // ============ MANUAL CONTROL FUNCTIONS ============

  const submitAnswer = async () => {
    if (voiceServiceRef.current) {
      try {
        await voiceServiceRef.current.submitAnswer();
        setUserTranscript(""); // Clear transcript after submission
      } catch (error) {
        console.error("❌ Failed to submit answer:", error);
        toast.error("Failed to submit answer");
      }
    } else {
      toast.error("Submit function not available");
    }
  };

  const skipQuestion = async () => {
    if (voiceServiceRef.current) {
      try {
        await voiceServiceRef.current.skipQuestion();
        setUserTranscript(""); // Clear transcript
      } catch (error) {
        console.error("❌ Failed to skip question:", error);
        toast.error("Failed to skip question");
      }
    } else {
      toast.error("Skip function not available");
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
            <p className="text-sm text-gray-500">Interview Practice</p>
            <p className="text-xs text-gray-400">ID: {debugInfo.userId.substring(0, 8)}...</p>
          </div>
        </div>

        <button
          onClick={startVoiceInterview}
          disabled={isLoading || !voiceEnabled || debugInfo.callStatus === "COMPLETED" || questions.length === 0}
          className={`px-4 py-2 rounded-lg font-medium ${
            voiceEnabled && debugInfo.callStatus !== "COMPLETED" && questions.length > 0
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          } ${isLoading ? 'animate-pulse' : ''}`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Starting...
            </span>
          ) : debugInfo.callStatus === "COMPLETED" ? (
            "✅ Completed"
          ) : questions.length === 0 ? (
            "No Questions"
          ) : (
            "Start Practice"
          )}
        </button>
      </div>

      {/* Voice Toggle */}
      <div className="border border-gray-300 rounded-xl p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold">Voice Practice</h4>
          <span className={`text-sm font-medium px-2 py-1 rounded ${
            debugInfo.callStatus === "COMPLETED" ? 'bg-green-100 text-green-800' :
            debugInfo.callStatus === "ACTIVE" ? 'bg-blue-100 text-blue-800' :
            debugInfo.callStatus === "LISTENING" ? 'bg-yellow-100 text-yellow-800' :
            debugInfo.callStatus === "SPEAKING" ? 'bg-purple-100 text-purple-800' :
            debugInfo.callStatus === "STARTING" ? 'bg-orange-100 text-orange-800' :
            debugInfo.callStatus === "STOPPED" ? 'bg-gray-100 text-gray-800' :
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
          <p>• Speak your answer after each question</p>
          <p>• Click "Submit Answer" to move forward</p>
          <p>• Your answers are saved below</p>
        </div>
      </div>

      {/* Current Question Display */}
      {debugInfo.currentQuestion > 0 && currentQuestionText && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
              {debugInfo.currentQuestion}
            </div>
            <h4 className="font-bold text-blue-800">Current Question</h4>
          </div>
          <p className="text-blue-900">{currentQuestionText}</p>
          {debugInfo.isListening && (
            <div className="mt-3 flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-red-600">🎤 Listening...</span>
            </div>
          )}
        </div>
      )}

      {/* Real-time Transcript Display */}
      {debugInfo.isListening && (
        <div className="border border-green-200 bg-green-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center">
                <span className="text-sm">🎤</span>
              </div>
              <h4 className="font-bold text-green-800">Live Transcription</h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                {userTranscript.length} chars
              </span>
              <button
                onClick={() => setUserTranscript("")}
                className="text-sm text-green-600 hover:text-green-800 hover:bg-green-100 px-2 py-1 rounded"
              >
                Clear
              </button>
            </div>
          </div>

          <div
            ref={transcriptRef}
            className="min-h-[100px] max-h-[200px] overflow-y-auto bg-white border border-green-100 rounded-lg p-3"
          >
            {userTranscript ? (
              <p className="text-gray-800 leading-relaxed">{userTranscript}</p>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <span className="text-2xl mb-2">🎤</span>
                <p>Start speaking to see your words here...</p>
                <p className="text-xs mt-1">Your speech will appear in real-time</p>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-xs text-gray-500">Words</div>
              <div className="font-bold text-gray-700">
                {userTranscript.split(/\s+/).filter(w => w.length > 0).length}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Characters</div>
              <div className="font-bold text-gray-700">
                {userTranscript.length}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Status</div>
              <div className={`font-bold ${debugInfo.isListening ? 'text-green-600' : 'text-gray-600'}`}>
                {debugInfo.isListening ? 'Listening' : 'Idle'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Answer History */}
      {answerHistory.length > 0 && (
        <div className="border border-purple-200 bg-purple-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center">
              <span className="text-sm">📝</span>
            </div>
            <h4 className="font-bold text-purple-800">Your Answers</h4>
            <span className="ml-auto text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded">
              {answerHistory.length} answered
            </span>
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {answerHistory.map((item, index) => (
              <div key={index} className="bg-white border border-purple-100 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {item.questionNumber}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h5 className="font-bold text-purple-800">Question {item.questionNumber}</h5>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {item.timestamp}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm mb-3">{item.question}</p>
                    <div className="border-t pt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs">
                          ✓
                        </div>
                        <h6 className="font-semibold text-green-700">Your Answer</h6>
                      </div>
                      <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                        <p className="text-gray-800 whitespace-pre-wrap">{item.answer}</p>
                        <div className="mt-2 text-xs text-gray-500 flex justify-between">
                          <span>{item.answer.length} characters</span>
                          <span>{item.answer.split(/\s+/).filter(w => w.length > 0).length} words</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Panel */}
      <div className="border border-gray-300 rounded-xl p-4">
        <h4 className="font-bold text-lg mb-4">📊 Interview Status</h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Questions</div>
            <div className="font-bold text-gray-800">
              {debugInfo.currentQuestion}/{debugInfo.totalQuestions}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Answers</div>
            <div className="font-bold text-gray-800">
              {debugInfo.collectedAnswers}
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
        </div>

        {/* Progress Bar */}
        {questions.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-bold text-gray-800">
                {Math.round((debugInfo.currentQuestion / debugInfo.totalQuestions) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (debugInfo.currentQuestion / debugInfo.totalQuestions) * 100)}%`
                }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Question {debugInfo.currentQuestion} of {debugInfo.totalQuestions}</span>
              <span>{debugInfo.collectedAnswers} answered</span>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          {/* Start Button */}
          <button
            onClick={startVoiceInterview}
            disabled={isLoading || !voiceEnabled || debugInfo.callStatus === "COMPLETED" || questions.length === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
          >
            <span>🎤</span>
            {debugInfo.callStatus === "COMPLETED" ? "Interview Done" : "Start Practice"}
          </button>

          {/* Stop Button */}
          {(debugInfo.callStatus === "ACTIVE" || debugInfo.callStatus === "LISTENING" || debugInfo.callStatus === "SPEAKING") && (
            <button
              onClick={stopInterview}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
            >
              <span>🛑</span>
              Stop
            </button>
          )}

          {/* Manual Control Buttons - Only show during active interview */}
          {(debugInfo.callStatus === "ACTIVE" || debugInfo.callStatus === "LISTENING") && (
            <>
              <button
                onClick={submitAnswer}
                disabled={!userTranscript.trim()}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
              >
                <span>✅</span>
                Submit Answer
              </button>

              <button
                onClick={skipQuestion}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
              >
                <span>⏭️</span>
                Skip Question
              </button>
            </>
          )}
        </div>

        {/* Completion Status */}
        {debugInfo.callStatus === "COMPLETED" && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-green-800">✅ Interview Completed!</h4>
                <p className="text-green-700 text-sm">
                  Redirecting to feedback...
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
              {debugInfo.callStatus === "COMPLETED"
                ? "Interview completed!"
                : debugInfo.currentQuestion > 0
                ? `Question ${debugInfo.currentQuestion} of ${debugInfo.totalQuestions}`
                : `Ready with ${debugInfo.totalQuestions} questions`
              }
            </p>
            {debugInfo.isListening && (
              <p className="text-sm text-blue-600 mt-1 animate-pulse">
                🎤 I'm listening to your answer...
              </p>
            )}
            {debugInfo.isSpeaking && (
              <p className="text-sm text-purple-600 mt-1 animate-pulse">
                🔊 Asking question...
              </p>
            )}
            {debugInfo.callStatus === "ACTIVE" && !debugInfo.isListening && !debugInfo.isSpeaking && (
              <p className="text-sm text-green-600 mt-1">
                ⏳ Ready for your answer
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
              {debugInfo.callStatus === "COMPLETED"
                ? "Redirecting to feedback..."
                : debugInfo.isListening
                ? "🎤 Speak clearly - I can see your words in real-time"
                : voiceEnabled && debugInfo.callStatus === "ACTIVE"
                ? "Ready - speak your answer and click Submit"
                : voiceEnabled
                ? "Enable voice and click Start Practice"
                : "Enable voice mode to begin"
              }
            </p>
            {debugInfo.callStatus === "ACTIVE" && (
              <div className="mt-2 text-sm text-gray-500">
                <p>• Speak your answer into microphone</p>
                <p>• Watch your words appear in real-time</p>
                <p>• Click "Submit Answer" when done</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Agent;