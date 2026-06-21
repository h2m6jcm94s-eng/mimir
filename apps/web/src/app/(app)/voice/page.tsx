'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { Mic, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default function VoicePage() {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript((prev) => `${prev} ${final}${interim}`.trim());
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  function toggleListen() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      setTranscript('');
      recognition.start();
      setListening(true);
    }
  }

  function speak() {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(transcript || 'Hello, I am Mimir.');
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice companion"
        description="Talk to Mimir hands-free with speech-to-text and text-to-speech."
      />

      {!supported && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          Web Speech API is not supported in this browser.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={toggleListen}
          disabled={!supported}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
            listening
              ? 'bg-[var(--text-danger)] text-white'
              : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          }`}
        >
          <Mic className="h-3.5 w-3.5" />
          {listening ? 'Stop listening' : 'Start listening'}
        </button>

        <button
          type="button"
          onClick={() => setTtsEnabled((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            ttsEnabled
              ? 'bg-[var(--accent-success)] text-white'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
          }`}
        >
          {ttsEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          {ttsEnabled ? 'TTS on' : 'TTS off'}
        </button>

        <button
          type="button"
          onClick={speak}
          disabled={!transcript}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)] disabled:opacity-50"
        >
          <Volume2 className="h-3.5 w-3.5" /> Speak text
        </button>
      </div>

      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={8}
        placeholder={listening ? 'Listening…' : 'Transcribed text appears here.'}
        className="w-full rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
      />
    </div>
  );
}
