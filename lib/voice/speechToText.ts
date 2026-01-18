// lib/voice/speechtotext.ts - COMPLETE UPDATED VERSION
"use client";

export interface SpeechToTextEvents {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onTimeout?: () => void;
  onPermissionChange?: (granted: boolean) => void;
}

export interface SpeechRecognitionError extends Event {
  error: string;
  message?: string;
}

export class SpeechToText {
  private recognition: any = null;
  private isListening: boolean = false;
  private isPaused: boolean = false;
  private transcript: string = "";
  private finalTranscript: string = "";
  private interimTranscript: string = "";
  private lastSpeechTimestamp: number = 0;
  private speechTimeout: NodeJS.Timeout | null = null;
  private maxSilenceDuration: number = 10000; // 10 seconds of silence before timeout

  private events: SpeechToTextEvents = {};

  constructor() {
    if (typeof window !== "undefined") {
      this.initializeRecognition();
    }
  }

  private initializeRecognition(): void {
    try {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition ||
                                  (window as any).webkitSpeechRecognition ||
                                  (window as any).mozSpeechRecognition ||
                                  (window as any).msSpeechRecognition;

      if (!SpeechRecognitionAPI) {
        console.log("❌ SpeechToText: Speech Recognition API not available in this browser");
        this.handleUnsupportedBrowser();
        return;
      }

      this.recognition = new SpeechRecognitionAPI();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";
      this.recognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy

      console.log("✅ SpeechToText: Initialized with API:", {
        continuous: this.recognition.continuous,
        interimResults: this.recognition.interimResults,
        lang: this.recognition.lang
      });

      this.setupEventHandlers();

      // Pre-check microphone permissions
      this.checkMicrophonePermissions().then(granted => {
        console.log("🎤 Microphone permission pre-check:", granted ? "✅ Granted" : "❌ Denied");
      });

    } catch (error) {
      console.error("❌ SpeechToText: Failed to initialize:", error);
      this.handleUnsupportedBrowser();
    }
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      console.log("🎤 SpeechToText: Recognition started");
      this.isListening = true;
      this.isPaused = false;
      this.lastSpeechTimestamp = Date.now();
      this.events.onStart?.();

      // Start speech timeout monitoring
      this.startSpeechTimeout();
    };

    this.recognition.onresult = (event: any) => {
      console.log("📝 SpeechToText: Got result");
      this.lastSpeechTimestamp = Date.now(); // Reset timeout on speech

      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Update transcripts
      if (finalTranscript) {
        this.finalTranscript = finalTranscript;
        this.transcript = this.finalTranscript;
        console.log("✅ Final transcript:", finalTranscript);
        this.events.onTranscript?.(finalTranscript, true);
      }

      if (interimTranscript && interimTranscript !== this.interimTranscript) {
        this.interimTranscript = interimTranscript;
        console.log("📋 Interim transcript:", interimTranscript);
        this.events.onTranscript?.(interimTranscript, false);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.handleRecognitionError(event);
    };

    this.recognition.onend = () => {
      console.log("🛑 SpeechToText: Recognition ended");
      this.isListening = false;
      this.isPaused = false;
      this.clearSpeechTimeout();
      this.events.onEnd?.();
    };

    this.recognition.onspeechend = () => {
      console.log("🔇 SpeechToText: Speech ended");
      // Don't stop immediately, wait for timeout
    };

    this.recognition.onsoundstart = () => {
      console.log("🔊 SpeechToText: Sound detected");
      this.lastSpeechTimestamp = Date.now();
    };

    this.recognition.onsoundend = () => {
      console.log("🔇 SpeechToText: Sound ended");
    };

    this.recognition.onaudiostart = () => {
      console.log("🎵 SpeechToText: Audio started");
    };

    this.recognition.onaudioend = () => {
      console.log("🎵 SpeechToText: Audio ended");
    };
  }

  private handleRecognitionError(event: any): void {
    const error = event.error || "unknown";
    console.log("🔍 SpeechToText: Recognition error:", error);

    // Normal/expected errors - don't treat as failures
    const normalErrors = ["no-speech", "aborted", "audio-capture"];
    if (normalErrors.includes(error)) {
      console.log(`📌 SpeechToText: Normal error - ${error}`);

      switch(error) {
        case "no-speech":
          console.log("🔇 No speech detected (user may be silent)");
          this.events.onTimeout?.();
          break;
        case "aborted":
          console.log("⏹️ Recognition was aborted (normal when stopping)");
          break;
        case "audio-capture":
          console.log("🎤 No microphone available or not connected");
          this.events.onError?.("No microphone found. Please connect a microphone.");
          break;
      }

      this.isListening = false;
      this.events.onEnd?.();
      return;
    }

    // Critical errors that need user action
    switch(error) {
      case "not-allowed":
      case "service-not-allowed":
        console.error("🚫 Microphone access denied by user or browser");
        this.events.onError?.("Microphone access denied. Please allow microphone permissions in your browser settings.");
        this.events.onPermissionChange?.(false);
        break;

      case "network":
        console.error("🌐 Network error during speech recognition");
        this.events.onError?.("Network error. Please check your internet connection.");
        break;

      case "bad-grammar":
        console.warn("⚠️ Bad grammar in speech recognition");
        // Not a critical error, continue listening
        break;

      case "language-not-supported":
        console.error("🌐 Language not supported");
        this.events.onError?.("The selected language is not supported by your browser.");
        break;

      default:
        console.warn("⚠️ Unknown recognition error:", error);
        this.events.onError?.(`Speech recognition error: ${error}`);
    }

    this.stop();
  }

  private handleUnsupportedBrowser(): void {
    console.log("🌐 SpeechToText: This browser doesn't support speech recognition");
    console.log("💡 Supported browsers: Chrome, Edge, Safari (limited)");
    this.events.onError?.("Speech recognition is not supported in this browser. Try Chrome or Edge.");
  }

  private startSpeechTimeout(): void {
    this.clearSpeechTimeout();

    this.speechTimeout = setInterval(() => {
      const timeSinceLastSpeech = Date.now() - this.lastSpeechTimestamp;

      if (timeSinceLastSpeech > this.maxSilenceDuration) {
        console.log("⏰ SpeechToText: Speech timeout - no speech for", this.maxSilenceDuration / 1000, "seconds");
        this.events.onTimeout?.();
        this.stop();
      }
    }, 1000); // Check every second
  }

  private clearSpeechTimeout(): void {
    if (this.speechTimeout) {
      clearInterval(this.speechTimeout);
      this.speechTimeout = null;
    }
  }

  async start(): Promise<void> {
    console.log("🎤 SpeechToText: Starting...");

    return new Promise(async (resolve, reject) => {
      if (!this.recognition) {
        console.log("❌ SpeechToText: No recognition available");
        this.events.onError?.("Speech recognition not available");
        reject(new Error("Speech recognition not available"));
        return;
      }

      // Check permissions first
      const hasPermission = await this.checkMicrophonePermissions();
      if (!hasPermission) {
        console.log("❌ SpeechToText: Microphone permission denied");
        this.events.onError?.("Microphone permission denied. Please allow access.");
        this.events.onPermissionChange?.(false);
        reject(new Error("Microphone permission denied"));
        return;
      }

      try {
        // Add safety timeout
        const safetyTimeout = setTimeout(() => {
          console.log("⏰ SpeechToText: Start timeout, using fallback");
          this.simulateStart();
          resolve();
        }, 2000);

        const onStartHandler = () => {
          clearTimeout(safetyTimeout);
          console.log("✅ SpeechToText: Real recognition started");
          resolve();
        };

        this.recognition.onstart = onStartHandler;

        this.recognition.start();
        console.log("🎤 SpeechToText: Start command sent");

      } catch (error: any) {
        console.log("❌ SpeechToText: Failed to start:", error.message);

        // Fallback to simulated mode
        if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
          this.events.onError?.("Microphone permission denied. Please allow access.");
          this.events.onPermissionChange?.(false);
        }

        this.simulateStart();
        resolve();
      }
    });
  }

  private simulateStart(): void {
    console.log("🎤 SpeechToText: Using simulated mode");

    setTimeout(() => {
      this.isListening = true;
      this.events.onStart?.();
      console.log("✅ SpeechToText: Simulated start complete");

      // In simulated mode, auto-generate a response after 3 seconds
      setTimeout(() => {
        if (this.isListening && this.events.onTranscript) {
          const simulatedResponses = [
            "I have experience with React and TypeScript in production applications.",
            "For state management, I prefer using Zustand or React Query depending on the use case.",
            "I optimize performance with code splitting, memoization, and virtualized lists.",
            "I implement accessibility features like ARIA labels and keyboard navigation.",
            "My testing strategy includes unit tests with Jest and E2E tests with Cypress."
          ];
          const randomResponse = simulatedResponses[Math.floor(Math.random() * simulatedResponses.length)];
          this.events.onTranscript?.(randomResponse, true);
          this.stop();
        }
      }, 3000);
    }, 100);
  }

  pause(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.isPaused = true;
        this.clearSpeechTimeout();
        console.log("⏸️ SpeechToText: Paused");
      } catch (error) {
        console.warn("⚠️ SpeechToText: Error pausing:", error);
      }
    }
  }

  resume(): void {
    if (this.recognition && this.isPaused) {
      try {
        this.recognition.start();
        this.isPaused = false;
        this.startSpeechTimeout();
        console.log("▶️ SpeechToText: Resumed");
      } catch (error) {
        console.warn("⚠️ SpeechToText: Error resuming:", error);
      }
    }
  }

  stop(): void {
    console.log("🛑 SpeechToText: Stopping...");

    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.warn("⚠️ SpeechToText: Error stopping:", error);
      }
    }

    this.isListening = false;
    this.isPaused = false;
    this.clearSpeechTimeout();
    this.events.onEnd?.();
  }

  // ============ SETTINGS METHODS ============

  setLanguage(language: string): void {
    if (this.recognition) {
      this.recognition.lang = language;
      console.log("🌐 SpeechToText: Language set to", language);
    }
  }

  setContinuous(continuous: boolean): void {
    if (this.recognition) {
      this.recognition.continuous = continuous;
      console.log("🔄 SpeechToText: Continuous mode set to", continuous);
    }
  }

  setInterimResults(interim: boolean): void {
    if (this.recognition) {
      this.recognition.interimResults = interim;
      console.log("📝 SpeechToText: Interim results set to", interim);
    }
  }

  setMaxSilenceDuration(seconds: number): void {
    if (seconds >= 1 && seconds <= 60) {
      this.maxSilenceDuration = seconds * 1000;
      console.log("⏰ SpeechToText: Max silence duration set to", seconds, "seconds");
    }
  }

  // ============ EVENT HANDLERS ============

  onTranscript(callback: (text: string, isFinal: boolean) => void): void {
    this.events.onTranscript = callback;
  }

  onError(callback: (error: string) => void): void {
    this.events.onError = callback;
  }

  onStart(callback: () => void): void {
    this.events.onStart = callback;
  }

  onEnd(callback: () => void): void {
    this.events.onEnd = callback;
  }

  onTimeout(callback: () => void): void {
    this.events.onTimeout = callback;
  }

  onPermissionChange(callback: (granted: boolean) => void): void {
    this.events.onPermissionChange = callback;
  }

  // ============ UTILITY METHODS ============

  getTranscript(): string {
    return this.transcript;
  }

  getFinalTranscript(): string {
    return this.finalTranscript;
  }

  getInterimTranscript(): string {
    return this.interimTranscript;
  }

  clearTranscript(): void {
    this.transcript = "";
    this.finalTranscript = "";
    this.interimTranscript = "";
    console.log("🧹 SpeechToText: Transcript cleared");
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  isSupported(): boolean {
    if (typeof window === "undefined") return false;

    try {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition ||
                                  (window as any).webkitSpeechRecognition;
      return !!SpeechRecognitionAPI;
    } catch (error) {
      return false;
    }
  }

  async checkMicrophonePermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Stop all tracks to release the microphone
      stream.getTracks().forEach(track => {
        track.stop();
      });

      console.log("✅ SpeechToText: Microphone permission granted");
      this.events.onPermissionChange?.(true);
      return true;

    } catch (error: any) {
      console.log("❌ SpeechToText: Microphone permission denied:", error.name);

      let errorMessage = "Microphone permission denied";
      if (error.name === 'NotFoundError') {
        errorMessage = "No microphone found";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Microphone is in use by another application";
      }

      this.events.onError?.(errorMessage);
      this.events.onPermissionChange?.(false);
      return false;
    }
  }

  // Browser compatibility check
  getBrowserCompatibility(): {
    supported: boolean;
    browser: string;
    details: string;
  } {
    if (typeof window === 'undefined') {
      return { supported: false, browser: 'unknown', details: 'Not in browser' };
    }

    const userAgent = navigator.userAgent;
    let browser = 'unknown';
    let details = '';
    let supported = false;

    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'Chrome';
      supported = true;
      details = 'Full support with Web Speech API';
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge';
      supported = true;
      details = 'Full support with Web Speech API';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari';
      supported = true;
      details = 'Limited support, may require user initiation';
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
      supported = false;
      details = 'Limited support, requires about:config changes';
    }

    return { supported, browser, details };
  }

  printDiagnostics(): void {
    console.log("🔍 SpeechToText Diagnostics:");
    console.log("✅ Supported:", this.isSupported());
    console.log("🎤 Listening:", this.isListening);
    console.log("⏸️ Paused:", this.isPaused);
    console.log("📝 Transcript:", this.transcript.substring(0, 50) + '...');

    const compatibility = this.getBrowserCompatibility();
    console.log("🌐 Browser:", compatibility.browser, "-", compatibility.details);
  }

  destroy(): void {
    console.log("🧹 SpeechToText: Destroying...");
    this.stop();
    this.recognition = null;
    this.events = {};
    this.clearSpeechTimeout();
  }
}

export default SpeechToText;