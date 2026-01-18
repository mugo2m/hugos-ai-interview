// lib/voice/texttospeech.ts - COMPLETE FIXED VERSION
"use client";

export interface SpeechSynthesisConfig {
  voiceName?: string;
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface TextToSpeechEvents {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onVolumeChange?: (volume: number) => void;
  onRateChange?: (rate: number) => void;
}

export class TextToSpeech {
  private synth: SpeechSynthesis | null = null;
  private isSpeaking: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  private config: SpeechSynthesisConfig = {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    language: 'en-US'
  };

  private events: TextToSpeechEvents = {};

  constructor(config?: SpeechSynthesisConfig) {
    if (typeof window === "undefined") {
      return;
    }

    if ('speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.config = { ...this.config, ...config };

      console.log("🔊 TextToSpeech: Initialized with config:", this.config);
    } else {
      console.warn("⚠️ TextToSpeech: Speech Synthesis API is not supported.");
    }
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        console.log("🤖 AI says:", text);
        resolve();
        return;
      }

      // Cancel any ongoing speech
      if (this.isSpeaking) {
        this.synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance();

      // Set text
      utterance.text = text;

      // Apply configuration
      utterance.rate = this.config.rate || 1.0;
      utterance.pitch = this.config.pitch || 1.0;
      utterance.volume = this.config.volume || 1.0;
      utterance.lang = this.config.language || 'en-US';

      // Try to get a good voice
      this.setBestVoice(utterance);

      // Store current utterance
      this.currentUtterance = utterance;

      // Event handlers
      utterance.onstart = () => {
        this.isSpeaking = true;
        console.log("🔊 TextToSpeech: Started speaking:", text.substring(0, 50) + "...");
        this.events.onStart?.();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        console.log("✅ TextToSpeech: Finished speaking");
        this.events.onEnd?.();
        resolve();
      };

      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        this.isSpeaking = false;
        this.currentUtterance = null;

        // Check error type
        const error = event.error;

        // "interrupted" and "canceled" are NOT errors - they're normal when we cancel speech
        if (error === 'interrupted' || error === 'canceled') {
          console.log("⏹️ TextToSpeech: Speech was interrupted/canceled (normal when stopping)");
          this.events.onEnd?.(); // Still notify that speech ended
          resolve();
          return;
        }

        // Real errors
        console.warn("❌ TextToSpeech: Error:", error);

        // Only report real errors to callers
        this.events.onError?.(`Speech error: ${error}`);

        console.log("🤖 AI says (fallback):", text);
        resolve();
      };

      // Split long text to prevent cut-off
      const MAX_LENGTH = 200;
      if (text.length > MAX_LENGTH) {
        console.log("📝 TextToSpeech: Text too long, splitting:", text.length);
        this.speakInChunks(text, MAX_LENGTH).then(resolve);
        return;
      }

      try {
        this.synth.speak(utterance);

        // Safety timeout (only for real errors, not interruptions)
        const safetyTimeout = setTimeout(() => {
          if (this.isSpeaking) {
            console.warn("⏰ TextToSpeech: Timeout after 10s, cancelling");
            this.synth?.cancel();
            this.isSpeaking = false;
            this.currentUtterance = null;
            console.log("🤖 AI says (timeout):", text);
            resolve();
          }
        }, 10000);

        // Clear timeout when speech ends normally
        const originalOnEnd = utterance.onend;
        utterance.onend = () => {
          clearTimeout(safetyTimeout);
          this.isSpeaking = false;
          this.currentUtterance = null;
          console.log("✅ TextToSpeech: Finished speaking");
          this.events.onEnd?.();
          resolve();
        };

      } catch (error) {
        console.warn("❌ TextToSpeech: Speak failed:", error);
        console.log("🤖 AI says:", text);
        resolve();
      }
    });
  }

  private setBestVoice(utterance: SpeechSynthesisUtterance): void {
    if (!this.synth) return;

    const voices = this.synth.getVoices();
    if (voices.length === 0) {
      console.log("🔊 TextToSpeech: No voices available, using default");
      return;
    }

    // Wait a bit for voices to load if needed
    if (voices.length === 0) {
      setTimeout(() => {
        const loadedVoices = this.synth?.getVoices() || [];
        if (loadedVoices.length > 0) {
          utterance.voice = loadedVoices[0];
        }
      }, 100);
      return;
    }

    // Prefer female voices for natural sound
    const preferredVoices = voices.filter(voice => {
      const name = voice.name.toLowerCase();
      return (
        name.includes('female') ||
        name.includes('samantha') ||
        name.includes('google') ||
        name.includes('microsoft') ||
        voice.lang.startsWith('en-')
      );
    });

    if (preferredVoices.length > 0) {
      utterance.voice = preferredVoices[0];
    } else {
      utterance.voice = voices[0];
    }
  }

  private async speakInChunks(text: string, chunkSize: number): Promise<void> {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      if (!this.isSpeaking) break; // Stop if cancelled
      await this.speak(chunk);
      await this.delay(300); // Small pause between chunks
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============ VOLUME AND RATE CONTROL METHODS ============

  setVolume(volume: number): void {
    if (volume >= 0 && volume <= 1) {
      this.config.volume = volume;
      console.log("🔊 TextToSpeech: Volume set to", volume);
      this.events.onVolumeChange?.(volume);

      // Update current utterance if speaking
      if (this.currentUtterance && this.isSpeaking) {
        this.currentUtterance.volume = volume;
      }
    } else {
      console.warn("⚠️ TextToSpeech: Volume must be between 0 and 1");
    }
  }

  setRate(rate: number): void {
    if (rate >= 0.5 && rate <= 2) {
      this.config.rate = rate;
      console.log("🎵 TextToSpeech: Rate set to", rate);
      this.events.onRateChange?.(rate);

      // Update current utterance if speaking
      if (this.currentUtterance && this.isSpeaking) {
        this.currentUtterance.rate = rate;
      }
    } else {
      console.warn("⚠️ TextToSpeech: Rate must be between 0.5 and 2");
    }
  }

  setPitch(pitch: number): void {
    if (pitch >= 0.5 && pitch <= 2) {
      this.config.pitch = pitch;
      console.log("🎶 TextToSpeech: Pitch set to", pitch);

      // Update current utterance if speaking
      if (this.currentUtterance && this.isSpeaking) {
        this.currentUtterance.pitch = pitch;
      }
    } else {
      console.warn("⚠️ TextToSpeech: Pitch must be between 0.5 and 2");
    }
  }

  setLanguage(language: string): void {
    this.config.language = language;
    console.log("🌐 TextToSpeech: Language set to", language);
  }

  // ============ CONTROL METHODS ============

  pause(): void {
    if (this.synth && this.isSpeaking) {
      this.synth.pause();
      console.log("⏸️ TextToSpeech: Paused");
    }
  }

  resume(): void {
    if (this.synth && this.isSpeaking) {
      this.synth.resume();
      console.log("▶️ TextToSpeech: Resumed");
    }
  }

  stop(): void {
    if (this.synth) {
      // Don't log this as an error - it's a normal stop
      this.synth.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
      console.log("🛑 TextToSpeech: Stopped (normal operation)");
    }
  }

  // ============ GETTER METHODS ============

  getVolume(): number {
    return this.config.volume || 1.0;
  }

  getRate(): number {
    return this.config.rate || 1.0;
  }

  getPitch(): number {
    return this.config.pitch || 1.0;
  }

  getLanguage(): string {
    return this.config.language || 'en-US';
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  // ============ EVENT HANDLERS ============

  onStart(callback: () => void): void {
    this.events.onStart = callback;
  }

  onEnd(callback: () => void): void {
    this.events.onEnd = callback;
  }

  onError(callback: (error: string) => void): void {
    this.events.onError = callback;
  }

  onVolumeChange(callback: (volume: number) => void): void {
    this.events.onVolumeChange = callback;
  }

  onRateChange(callback: (rate: number) => void): void {
    this.events.onRateChange = callback;
  }

  // ============ UTILITY METHODS ============

  isSupported(): boolean {
    return this.synth !== null;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];

    const voices = this.synth.getVoices();
    return voices;
  }

  // Voice diagnostics
  printVoiceDiagnostics(): void {
    if (!this.synth) {
      console.log("❌ TextToSpeech: Not supported");
      return;
    }

    const voices = this.synth.getVoices();
    console.log("🔍 TextToSpeech Diagnostics:");
    console.log("✅ Supported:", this.isSupported());
    console.log("🎤 Voices available:", voices.length);

    if (voices.length > 0) {
      console.log("📋 Voice list:");
      voices.forEach((voice, i) => {
        console.log(`  ${i + 1}. ${voice.name} (${voice.lang}) - ${voice.default ? 'Default' : ''}`);
      });
    }

    console.log("⚙️ Current config:", this.config);
    console.log("🎤 Currently speaking:", this.isSpeaking);
  }

  destroy(): void {
    this.stop();
    this.synth = null;
    this.events = {};
    console.log("🧹 TextToSpeech: Destroyed");
  }
}

export default TextToSpeech;