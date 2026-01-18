// lib/voice/VoiceService.ts - SIMPLE WORKING VERSION
"use client";

import { toast } from "sonner";
import SpeechToText from "./speechToText";
import TextToSpeech from "./textToSpeech";

export interface VoiceMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  transcript: string;
  error: string | null;
}

interface VoiceServiceConfig {
  interviewId: string;
  userId: string;
  type: "practice" | "review";
  language?: string;
  speechRate?: number;
  speechVolume?: number;
}

export class VoiceService {
  private state: VoiceState = {
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    transcript: "",
    error: null,
  };

  private messages: VoiceMessage[] = [];
  private interviewId: string;
  private userId: string;
  private type: "practice" | "review";
  private interviewQuestions: string[] = [];
  private currentQuestionIndex: number = 0;
  private isActive: boolean = false;

  private speechToText: SpeechToText | null = null;
  private textToSpeech: TextToSpeech | null = null;

  private onStateChangeCallback: ((state: VoiceState) => void) | null = null;
  private onUpdateCallback: ((messages: VoiceMessage[]) => void) | null = null;
  private onCompleteCallback: ((data: any) => void) | null = null;

  constructor(config: VoiceServiceConfig) {
    this.interviewId = config.interviewId;
    this.userId = config.userId;
    this.type = config.type;

    console.log("?? VoiceService: Initialized");

    // Initialize speech services
    this.speechToText = new SpeechToText();
    this.textToSpeech = new TextToSpeech({
      language: config.language || 'en-US',
      rate: config.speechRate || 1.0,
      volume: config.speechVolume || 1.0,
      pitch: 1.0
    });

    // Setup speech-to-text callbacks
    if (this.speechToText) {
      this.speechToText.onTranscript(this.handleUserTranscript.bind(this));
      this.speechToText.setLanguage(config.language || 'en-US');
    }
  }

  public setInterviewQuestions(questions: string[]): void {
    this.interviewQuestions = questions;
    console.log("?? VoiceService: Set", questions.length, "questions");
  }

  // ============ INTERVIEW CONTROL ============

  public async startInterview(): Promise<void> {
    console.log("?? VoiceService: Starting interview");

    if (this.interviewQuestions.length === 0) {
      throw new Error("No interview questions set");
    }

    this.isActive = true;
    this.currentQuestionIndex = 0;
    this.messages = [];
    this.state = {
      isListening: false,
      isSpeaking: false,
      isProcessing: false,
      transcript: "",
      error: null,
    };

    this.updateState({ isProcessing: true });

    try {
      await this.speak("Interview starting. I will ask questions and wait for your answers.");
      await this.delay(1000);
      await this.askCurrentQuestion();

    } catch (error: any) {
      console.error("? VoiceService: Failed to start:", error);
      this.handleError(error.message);
    }
  }

  private async askCurrentQuestion(): Promise<void> {
    console.log(`?? askCurrentQuestion: index=${this.currentQuestionIndex}, total=${this.interviewQuestions.length}`);

    if (!this.isActive) {
      console.log("? Not active, returning");
      return;
    }

    // Check if all questions are done
    if (this.currentQuestionIndex >= this.interviewQuestions.length) {
      console.log("?? All questions completed, finishing interview");
      await this.completeInterview();
      return;
    }

    const question = this.interviewQuestions[this.currentQuestionIndex];

    console.log(`? Asking question ${this.currentQuestionIndex + 1}: "${question.substring(0, 50)}..."`);

    // Save question
    const questionMessage: VoiceMessage = {
      role: "assistant",
      content: `Question ${this.currentQuestionIndex + 1}: ${question}`,
      timestamp: Date.now(),
    };
    this.messages.push(questionMessage);
    this.onUpdateCallback?.(this.messages);

    // Speak question
    await this.speak(`Question ${this.currentQuestionIndex + 1}. ${question}`);
    await this.speak("When ready, click Submit Answer.");

    // Start listening
    await this.startListening();
  }

  private async startListening(): Promise<void> {
    console.log(`?? startListening: active=${this.isActive}`);

    if (!this.isActive || !this.speechToText) {
      console.log("? Cannot start listening");
      return;
    }

    this.updateState({
      isListening: true,
      isSpeaking: false,
      transcript: ""
    });

    toast.info(`?? Question ${this.currentQuestionIndex + 1} - Speak then click Submit`);

    try {
      this.speechToText.clearTranscript();
      await this.speechToText.start();
      console.log("? Listening started");
    } catch (error: any) {
      console.error("? Failed to start listening:", error);
    }
  }

  private async handleUserTranscript(text: string, isFinal: boolean): Promise<void> {
    console.log(`?? handleUserTranscript: text="${text}", isFinal=${isFinal}`);

    if (!this.isActive) {
      console.log("? Not active, ignoring");
      return;
    }

    // Update transcript
    this.updateState({ transcript: text });

    // DO NOT auto-advance based on speech
    // User must manually submit
  }

  // ============ MANUAL CONTROLS ============

  public async submitAnswer(): Promise<void> {
    console.log(`?? submitAnswer called for question ${this.currentQuestionIndex + 1}`);

    if (!this.isActive) {
      console.log("? Not active, cannot submit");
      toast.error("Interview not active");
      return;
    }

    // Stop listening
    this.speechToText?.stop();
    this.updateState({ isListening: false });

    const answerText = this.state.transcript.trim();

    if (!answerText) {
      console.log("?? No answer to submit");
      toast.warning("Please speak an answer first");
      return;
    }

    console.log(`? Submitting answer: "${answerText.substring(0, 50)}..."`);

    // Save answer
    const answerMessage: VoiceMessage = {
      role: "user",
      content: answerText,
      timestamp: Date.now(),
    };
    this.messages.push(answerMessage);
    this.onUpdateCallback?.(this.messages);

    toast.success(`? Answer ${this.currentQuestionIndex + 1} submitted!`);

    // Acknowledge
    await this.speak("Thank you for your answer.");
    await this.delay(1000);

    // Move to next question
    this.currentQuestionIndex++;

    // Clear transcript
    this.updateState({ transcript: "" });

    // Ask next question (or complete if done)
    await this.askCurrentQuestion();
  }

  public async skipQuestion(): Promise<void> {
    console.log(`?? skipQuestion called for question ${this.currentQuestionIndex + 1}`);

    if (!this.isActive) {
      console.log("? Not active, cannot skip");
      return;
    }

    // Stop listening
    this.speechToText?.stop();
    this.updateState({ isListening: false });

    // Add skip message
    const skipMessage: VoiceMessage = {
      role: "user",
      content: `[Skipped question ${this.currentQuestionIndex + 1}]`,
      timestamp: Date.now(),
    };
    this.messages.push(skipMessage);
    this.onUpdateCallback?.(this.messages);

    toast.info(`?? Question ${this.currentQuestionIndex + 1} skipped`);

    // Acknowledge
    await this.speak("Question skipped.");
    await this.delay(1000);

    // Move to next question
    this.currentQuestionIndex++;

    // Clear transcript
    this.updateState({ transcript: "" });

    // Ask next question (or complete if done)
    await this.askCurrentQuestion();
  }

  // ============ COMPLETION LOGIC ============

  private async completeInterview(): Promise<void> {
    console.log("?? completeInterview() called - FINISHING");

    if (!this.isActive) {
      console.log("? Not active, cannot complete");
      return;
    }

    this.isActive = false;
    this.updateState({
      isListening: false,
      isSpeaking: false,
      isProcessing: true
    });

    await this.speak("Interview completed. Redirecting to feedback...");

    try {
      // Prepare completion data
      const completionData = {
        success: true,
        interviewId: this.interviewId,
        userId: this.userId,
        feedbackId: `local-${Date.now()}`,
        message: "Interview completed successfully",
        questionsAsked: this.interviewQuestions.length,
        answersGiven: this.messages.filter(m => m.role === 'user').length,
        transcript: this.messages,
        timestamp: new Date().toISOString(),
        fallback: false
      };

      console.log("?? Prepared completion data:", completionData);

      // CRITICAL FIX: Call onComplete callback FIRST
      if (this.onCompleteCallback) {
        console.log("?? Calling onComplete callback");
        this.onCompleteCallback(completionData);
      } else {
        console.error("? No onComplete callback registered!");
        // Try again after a short delay
        setTimeout(() => {
          if (this.onCompleteCallback) {
            console.log("?? Retrying onComplete callback");
            this.onCompleteCallback(completionData);
          } else {
            console.error("? Still no callback after retry");
          }
        }, 500);
      }

      // Now try to generate feedback in background (non-blocking)
      setTimeout(async () => {
        try {
          const transcript = this.messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }));

          console.log("?? Sending to feedback API in background...");

          const response = await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              interviewId: this.interviewId,
              userId: this.userId,
              transcript: transcript
            })
          });

          if (response.ok) {
            const data = await response.json();
            console.log("?? Feedback API success:", data);
          } else {
            console.warn("?? Feedback API error:", response.status);
          }
        } catch (feedbackError) {
          console.warn("?? Feedback API failed, but interview completed:", feedbackError);
        }
      }, 1000); // Start after 1 second

    } catch (error: any) {
      console.error("? Error in completeInterview:", error);

      // Call onComplete even with error
      if (this.onCompleteCallback) {
        this.onCompleteCallback({
          success: true,
          interviewId: this.interviewId,
          userId: this.userId,
          feedbackId: `error-${Date.now()}`,
          message: "Interview completed with error",
          fallback: true,
          error: error.message,
          questionsAsked: this.interviewQuestions.length,
          answersGiven: this.messages.filter(m => m.role === 'user').length,
          timestamp: new Date().toISOString()
        });
      }

    } finally {
      this.updateState({ isProcessing: false });
      console.log("?? Interview completion process finished");
    }
  }

  // ============ HELPER METHODS ============

  private async speak(text: string): Promise<void> {
    if (!this.textToSpeech) {
      console.log("?? AI:", text);
      return;
    }

    this.updateState({ isSpeaking: true });

    try {
      await this.textToSpeech.speak(text);
    } catch (error) {
      console.log("?? AI:", text);
    } finally {
      this.updateState({ isSpeaking: false });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateState(updates: Partial<VoiceState>): void {
    this.state = { ...this.state, ...updates };
    this.onStateChangeCallback?.(this.state);
  }

  private handleError(error: string): void {
    console.error("? Error:", error);
    this.state.error = error;
    this.isActive = false;
    toast.error("Voice service error");
  }

  // ============ PUBLIC METHODS ============

  public stop(): void {
    console.log("?? stop() called");
    this.isActive = false;

    this.speechToText?.stop();
    this.textToSpeech?.stop();

    this.updateState({
      isListening: false,
      isSpeaking: false,
      isProcessing: false
    });
  }

  public onStateChange(callback: (state: VoiceState) => void): void {
    this.onStateChangeCallback = callback;
  }

  public onUpdate(callback: (messages: VoiceMessage[]) => void): void {
    this.onUpdateCallback = callback;
  }

  public onComplete(callback: (data: any) => void): void {
    console.log("?? onComplete callback registered");
    this.onCompleteCallback = callback;
  }

  public destroy(): void {
    console.log("?? destroy() called");
    this.stop();

    this.speechToText?.destroy();
    this.textToSpeech?.destroy();

    this.onStateChangeCallback = null;
    this.onUpdateCallback = null;
    this.onCompleteCallback = null;

    this.messages = [];
    this.interviewQuestions = [];
    this.currentQuestionIndex = 0;
  }
}

export default VoiceService;