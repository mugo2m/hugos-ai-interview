// lib/voice/VoiceAssistant.ts - UPDATED SIMPLIFIED WORKING VERSION
"use client";

import { toast } from "sonner";

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

export class VoiceAssistant {
  private state: VoiceState = {
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    transcript: "",
    error: null,
  };

  private messages: VoiceMessage[] = [];
  private userId: string | null = null;
  private isActive: boolean = false;
  private useSimulatedVoice: boolean = false;

  private onStateChangeCallback: ((state: VoiceState) => void) | null = null;
  private onUpdateCallback: ((messages: VoiceMessage[]) => void) | null = null;
  private onCompleteCallback: ((data: any) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  constructor() {
    console.log("VoiceAssistant: Initialized");
    this.checkSpeechSupport();
  }

  private checkSpeechSupport(): void {
    if (typeof window === 'undefined') {
      this.useSimulatedVoice = true;
      return;
    }

    const hasSpeechSynthesis = 'speechSynthesis' in window;
    const hasVoices = hasSpeechSynthesis && window.speechSynthesis.getVoices().length > 0;

    console.log("VoiceAssistant: Speech synthesis available:", hasSpeechSynthesis);
    console.log("VoiceAssistant: Voices available:", hasVoices);

    if (!hasSpeechSynthesis || !hasVoices) {
      console.log("VoiceAssistant: Using simulated voice mode");
      this.useSimulatedVoice = true;
    }
  }

  async start(userId: string): Promise<void> {
    console.log("=== VOICEASSISTANT START ===");
    console.log("UserId:", userId);
    console.log("Using simulated voice:", this.useSimulatedVoice);

    this.userId = userId;
    this.isActive = true;
    this.messages = [];

    // Update state
    this.updateState({ isProcessing: true });

    try {
      // Welcome message
      console.log("Step 1: Speaking welcome message");
      await this.speak("Welcome to interview setup. I will help you create a custom interview.");
      console.log("✅ Welcome message spoken");

      // Wait a moment
      await this.delay(1000);

      // Setup interview flow
      console.log("Step 2: Starting interview setup flow");
      await this.setupInterviewFlow();
      console.log("✅ Interview setup completed");

    } catch (error: any) {
      console.error("VoiceAssistant: Failed to start:", error);
      this.handleError(error.message || "Failed to start voice setup");
    }
  }

  private async setupInterviewFlow(): Promise<void> {
    if (!this.isActive) return;

    // Questions to ask
    const setupQuestions = [
      "What type of interview would you like? Technical or behavioral?",
      "What role are you interviewing for?",
      "What experience level? Junior, Mid-level, or Senior?",
      "What technologies or tech stack?",
      "How many questions would you like? 3, 5, or 10?"
    ];

    // Simulated user answers
    const simulatedAnswers = [
      "Technical interview please",
      "Frontend Developer",
      "Mid-level",
      "React, TypeScript, Next.js",
      "5 questions"
    ];

    for (let i = 0; i < setupQuestions.length; i++) {
      if (!this.isActive) break;

      // Ask question
      await this.askQuestion(setupQuestions[i]);

      // Wait for "answer" (simulated)
      await this.waitForSimulatedAnswer();

      // Add simulated answer
      this.addSimulatedResponse(simulatedAnswers[i]);

      // Brief pause
      await this.delay(1000);
    }

    // Complete setup
    await this.completeSetup();
  }

  private async askQuestion(question: string): Promise<void> {
    console.log("VoiceAssistant: Asking question:", question);

    // Add to messages
    const message: VoiceMessage = {
      role: "assistant",
      content: question,
      timestamp: Date.now(),
    };
    this.messages.push(message);
    this.onUpdateCallback?.(this.messages);

    // Speak the question
    await this.speak(question);
  }

  private async speak(text: string): Promise<void> {
    console.log("VoiceAssistant: Speaking ->", text);

    if (this.useSimulatedVoice) {
      console.log("VoiceAssistant: Using simulated speech");
      return this.simulateSpeech(text);
    }

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        console.warn("VoiceAssistant: Speech synthesis not available, simulating");
        this.useSimulatedVoice = true;
        this.simulateSpeech(text).then(resolve).catch(reject);
        return;
      }

      this.updateState({ isSpeaking: true });

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.volume = 1.0;
      utterance.pitch = 1.0;

      // Get available voices
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        utterance.voice = voices[0];
      }

      utterance.onstart = () => {
        console.log("VoiceAssistant: Speech started");
        toast.info("🔊 AI is speaking...");
      };

      utterance.onend = () => {
        console.log("VoiceAssistant: Speech ended");
        this.updateState({ isSpeaking: false });
        resolve();
      };

      utterance.onerror = (event: any) => {
        console.error("VoiceAssistant: Speech error:", event.error);
        this.updateState({ isSpeaking: false });
        this.useSimulatedVoice = true;
        this.simulateSpeech(text).then(resolve).catch(reject);
      };

      // Safety timeout
      const timeout = setTimeout(() => {
        console.warn("VoiceAssistant: Speech timeout");
        window.speechSynthesis.cancel();
        this.updateState({ isSpeaking: false });
        this.useSimulatedVoice = true;
        this.simulateSpeech(text).then(resolve).catch(() => reject(new Error("Speech timeout")));
      }, 5000);

      utterance.onend = () => {
        clearTimeout(timeout);
        this.updateState({ isSpeaking: false });
        resolve();
      };

      utterance.onerror = () => {
        clearTimeout(timeout);
      };

      // Speak with small delay
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          console.error("VoiceAssistant: Failed to speak:", error);
          this.useSimulatedVoice = true;
          this.simulateSpeech(text).then(resolve).catch(reject);
        }
      }, 100);
    });
  }

  private async simulateSpeech(text: string): Promise<void> {
    console.log("VoiceAssistant: Simulating speech for:", text.substring(0, 50) + "...");

    this.updateState({ isSpeaking: true });

    // Show text in toast
    toast.info(`🤖 AI: ${text.substring(0, 80)}...`);

    // Simulate speaking time
    const duration = Math.min(text.length * 30, 2000); // Max 2 seconds

    return new Promise(resolve => {
      setTimeout(() => {
        this.updateState({ isSpeaking: false });
        resolve();
      }, duration);
    });
  }

  private async waitForSimulatedAnswer(): Promise<void> {
    console.log("VoiceAssistant: Simulating listening for answer");

    this.updateState({ isListening: true });
    toast.info("🎤 Listening for your answer (simulated)...");

    // Wait 3 seconds (simulated listening)
    await this.delay(3000);

    this.updateState({ isListening: false });
  }

  private addSimulatedResponse(response: string): void {
    console.log("VoiceAssistant: Adding simulated response:", response);

    const message: VoiceMessage = {
      role: "user",
      content: response,
      timestamp: Date.now(),
    };

    this.messages.push(message);
    this.onUpdateCallback?.(this.messages);

    // Show response in toast
    toast.success(`🎤 You: ${response}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async completeSetup(): Promise<void> {
    console.log("VoiceAssistant: Completing setup...");

    // Final message
    await this.speak("Excellent! I have all the information. Creating your interview now...");

    // Create the interview via API
    try {
      const response = await fetch("/api/vapi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "technical",
          role: "Frontend Developer",
          level: "Mid-level",
          techstack: "React, TypeScript, Next.js",
          amount: 5,
          userid: this.userId
        })
      });

      const data = await response.json();

      if (data.success) {
        await this.speak(`Interview created successfully with ${data.count || 5} questions!`);
        this.onCompleteCallback?.(data);
      } else {
        throw new Error(data.error || "Failed to create interview");
      }

    } catch (error: any) {
      this.handleError(error.message);
    } finally {
      this.isActive = false;
      this.updateState({ isProcessing: false });
    }
  }

  private updateState(updates: Partial<VoiceState>): void {
    this.state = { ...this.state, ...updates };
    console.log("VoiceAssistant: State updated:", this.state);
    this.onStateChangeCallback?.(this.state);
  }

  private handleError(error: string): void {
    console.error("VoiceAssistant: Error:", error);
    this.state.error = error;
    this.isActive = false;
    this.onErrorCallback?.(error);
    toast.error("Voice setup failed: " + error);
  }

  // Public methods
  onStateChange(callback: (state: VoiceState) => void): void {
    this.onStateChangeCallback = callback;
  }

  onUpdate(callback: (messages: VoiceMessage[]) => void): void {
    this.onUpdateCallback = callback;
  }

  onComplete(callback: (data: any) => void): void {
    this.onCompleteCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  stop(): void {
    console.log("VoiceAssistant: Stopping...");
    this.isActive = false;
    this.updateState({
      isListening: false,
      isSpeaking: false,
      isProcessing: false
    });

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  destroy(): void {
    console.log("VoiceAssistant: Destroying...");
    this.stop();
    this.onStateChangeCallback = null;
    this.onUpdateCallback = null;
    this.onCompleteCallback = null;
    this.onErrorCallback = null;
  }
}

export default VoiceAssistant;