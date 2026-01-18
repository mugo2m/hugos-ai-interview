// components/VoiceToggle.tsx - SHOW BROWSER COMPATIBILITY
"use client";

import { useState, useEffect } from "react";

interface VoiceToggleProps {
  onVoiceToggle?: (enabled: boolean) => void;
  initialEnabled?: boolean;
}

export function VoiceToggle({ onVoiceToggle, initialEnabled = false }: VoiceToggleProps) {
  const [voiceEnabled, setVoiceEnabled] = useState(initialEnabled);
  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [browserName, setBrowserName] = useState("");

  useEffect(() => {
    checkVoiceSupport();

    // Load saved preference
    const saved = localStorage.getItem('voiceEnabled');
    if (saved === 'true' && !initialEnabled) {
      setVoiceEnabled(true);
      onVoiceToggle?.(true);
    }
  }, []);

  const checkVoiceSupport = async () => {
    setIsChecking(true);

    try {
      // Detect browser
      const userAgent = navigator.userAgent;
      let browser = "Unknown";
      if (userAgent.indexOf("Chrome") > -1 && userAgent.indexOf("Edg") === -1) browser = "Chrome";
      else if (userAgent.indexOf("Firefox") > -1) browser = "Firefox";
      else if (userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") === -1) browser = "Safari";
      else if (userAgent.indexOf("Edg") > -1) browser = "Edge";
      setBrowserName(browser);

      // Check browser support
      const hasSpeechRecognition = !!(window.SpeechRecognition ||
                                      (window as any).webkitSpeechRecognition);
      const hasSpeechSynthesis = !!window.speechSynthesis;
      const hasMediaDevices = !!(navigator.mediaDevices &&
                                navigator.mediaDevices.getUserMedia);

      // Chrome/Edge have best support, others are limited
      const supported = (browser === "Chrome" || browser === "Edge") &&
                       hasSpeechRecognition && hasSpeechSynthesis && hasMediaDevices;

      setIsSupported(supported);

      console.log("Voice support check:", {
        browser,
        hasSpeechRecognition,
        hasSpeechSynthesis,
        hasMediaDevices,
        supported
      });

      // Check microphone permission
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const micPermission = await navigator.permissions.query({ name: 'microphone' as any });
          setPermissionGranted(micPermission.state === 'granted');

          micPermission.onchange = () => {
            setPermissionGranted(micPermission.state === 'granted');
          };
        } catch (error) {
          console.log("Permission API not fully supported");
          setPermissionGranted(false);
        }
      } else {
        // Try a quick test
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          setPermissionGranted(true);
        } catch (error) {
          setPermissionGranted(false);
        }
      }
    } catch (error) {
      console.error("Error checking voice support:", error);
      setIsSupported(false);
      setPermissionGranted(false);
    } finally {
      setIsChecking(false);
    }
  };

  const toggleVoice = () => {
    if (!isSupported) {
      alert(`Voice features work best in Google Chrome or Microsoft Edge. You're using ${browserName}. Please switch to Chrome or Edge for full voice functionality.`);
      return;
    }

    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    localStorage.setItem('voiceEnabled', newState.toString());
    onVoiceToggle?.(newState);
  };

  return (
    <div className="flex flex-col gap-3 p-4 border border-gray-300 rounded-lg bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${voiceEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
            <svg
              className={`w-5 h-5 ${voiceEnabled ? 'text-green-600' : 'text-gray-500'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Voice Interview Mode</h4>
            <p className="text-sm text-gray-500">
              Practice with voice responses and feedback
            </p>
          </div>
        </div>

        <button
          onClick={toggleVoice}
          disabled={isChecking}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            voiceEnabled
              ? 'bg-green-500 hover:bg-green-600 text-white shadow-sm'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
          } ${isChecking ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isChecking ? 'Checking...' : voiceEnabled ? 'Voice ON' : 'Voice OFF'}
        </button>
      </div>

      {isChecking ? (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-700">
            Checking voice support and permissions...
          </p>
        </div>
      ) : !isSupported ? (
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-700">
            <strong>⚠️ Limited voice support in {browserName}:</strong> For full voice functionality,
            please use <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.
            You can still use text-based interviews in {browserName}.
          </p>
        </div>
      ) : voiceEnabled ? (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-800">✅ Voice mode active</p>
              <p className="text-sm text-green-700 mt-1">
                {browserName === "Chrome" || browserName === "Edge"
                  ? "You can use voice commands for interview setup and practice."
                  : "Using simulated voice mode. For real voice recognition, try Chrome or Edge."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="font-medium text-gray-700">Browser</div>
            <div className="font-semibold text-gray-800">
              {browserName}
            </div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="font-medium text-gray-700">Voice Support</div>
            <div className={`font-semibold ${isSupported ? 'text-green-600' : 'text-yellow-600'}`}>
              {isSupported ? 'Full' : 'Limited'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VoiceToggle;