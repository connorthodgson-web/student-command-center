"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceInputState =
  | "idle"
  | "listening"
  | "transcribing"
  | "unsupported"
  | "error";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  0: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
  length: number;
};

type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function getRecognitionErrorMessage(error?: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked. Please allow mic permission and try again.";
    case "audio-capture":
      return "No microphone was detected. Check your mic and try again.";
    case "network":
      return "Speech recognition hit a network issue. Please try again.";
    case "no-speech":
      return "I didn't catch any speech. Try again and speak a little closer to the mic.";
    case "aborted":
      return "Voice capture was stopped before a transcript was ready.";
    default:
      return "Voice input ran into a problem. Please try again or type your message.";
  }
}

export function useBrowserVoiceInput(onTranscript: (transcript: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptReceivedRef = useRef(false);
  const hadErrorRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const heardSpeechRef = useRef(false);
  const sessionTimeoutRef = useRef<number | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [state, setState] = useState<VoiceInputState>("idle");
  const [error, setError] = useState<string | null>(null);

  const clearSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current !== null) {
      window.clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
  }, []);

  const cleanupRecognition = useCallback(() => {
    clearSessionTimeout();
    recognitionRef.current = null;
    transcriptReceivedRef.current = false;
    hadErrorRef.current = false;
    stopRequestedRef.current = false;
    heardSpeechRef.current = false;
  }, [clearSessionTimeout]);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    stopRequestedRef.current = true;
    recognitionRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    if (recognitionRef.current) {
      stopRequestedRef.current = true;
      recognitionRef.current.abort();
    }
    clearSessionTimeout();
    cleanupRecognition();
    setError(null);
    setState(isSupported ? "idle" : "unsupported");
  }, [cleanupRecognition, clearSessionTimeout, isSupported]);

  const start = useCallback(() => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setState("unsupported");
      setError("This browser does not support voice input yet.");
      return;
    }

    if (recognitionRef.current) {
      stopRequestedRef.current = true;
      recognitionRef.current.abort();
    }
    transcriptReceivedRef.current = false;
    hadErrorRef.current = false;
    stopRequestedRef.current = false;
    heardSpeechRef.current = false;
    setError(null);

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState("listening");
      clearSessionTimeout();
      sessionTimeoutRef.current = window.setTimeout(() => {
        stopRequestedRef.current = true;
        recognition.stop();
      }, 12000);
    };

    recognition.onspeechstart = () => {
      heardSpeechRef.current = true;
    };

    recognition.onspeechend = () => {
      setState("transcribing");
      recognition.stop();
    };

    recognition.onresult = (event) => {
      const finalTranscript = Array.from(event.results)
        .slice(event.resultIndex ?? 0)
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      if (finalTranscript) {
        clearSessionTimeout();
        transcriptReceivedRef.current = true;
        onTranscript(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      hadErrorRef.current = true;
      setState("error");
      setError(getRecognitionErrorMessage(event.error));
    };

    recognition.onend = () => {
      const nextState = getSpeechRecognitionConstructor() ? "idle" : "unsupported";
      if (hadErrorRef.current) {
        cleanupRecognition();
        return;
      }
      if (stopRequestedRef.current) {
        setState(nextState);
      } else if (!transcriptReceivedRef.current) {
        setState("error");
        setError(
          heardSpeechRef.current
            ? "I heard you, but the browser did not return a transcript. Please try again or type your message."
            : "I didn't catch any speech before the browser stopped listening. Please try again or type your message.",
        );
      } else {
        setState(nextState);
      }
      cleanupRecognition();
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [cleanupRecognition, clearSessionTimeout, onTranscript]);

  useEffect(() => {
    const supported = getSpeechRecognitionConstructor() !== null;
    setIsSupported(supported);
    setState(supported ? "idle" : "unsupported");
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setState(isSupported ? "idle" : "unsupported");
  }, [isSupported]);

  return {
    state,
    error,
    isSupported,
    isListening: state === "listening",
    isTranscribing: state === "transcribing",
    start,
    stop,
    cancel,
    clearError,
  };
}

export function canUseSpeechSynthesis(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

export function speakText(text: string, options?: { onEnd?: () => void }) {
  if (!canUseSpeechSynthesis()) return false;

  const content = text.trim();
  if (!content) return false;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(content);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.onend = () => {
    options?.onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
  return true;
}
