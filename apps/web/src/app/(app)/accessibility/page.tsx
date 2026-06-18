'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { Ear, Minus, Plus, Type, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const SAMPLE_TEXT =
  'Mimir is the AI built to help humans. It keeps your memories private, cites its sources, and wears whatever hat you need — friend, researcher, coder, marketer, advisor, and lifelong assistant.';

function simplifyText(text: string): string {
  // Heuristic simplification: break long sentences, replace some complex words.
  return text
    .replace(/\bbuilt to help\b/gi, 'made to help')
    .replace(/\bwhatever hat you need\b/gi, 'many roles')
    .replace(/\badvisor\b/gi, 'guide')
    .replace(/\blifelong\b/gi, 'long-term')
    .replace(/\bprivate\b/gi, 'safe')
    .replace(/,\s+/g, '. ')
    .replace(/;\s+/g, '. ')
    .split('. ')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('. ');
}

export default function AccessibilityPage() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [fontSize, setFontSize] = useState(16);
  const [highContrast, setHighContrast] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      if (available.length > 0 && !selectedVoice) {
        setSelectedVoice(available[0].voiceURI);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [selectedVoice]);

  function speak() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find((v) => v.voiceURI === selectedVoice);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  const simplified = simplifyText(text);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accessibility"
        description="Read aloud, simplify text, and adjust the display to suit you."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <section
          className={cn(
            'rounded-xl border p-5 shadow-card',
            highContrast
              ? 'border-black bg-white text-black'
              : 'border-[var(--border-subtle-solid)] bg-[var(--bg-primary)]'
          )}
          style={{ fontSize }}
          data-testid="accessibility-preview"
        >
          <h2
            className={cn(
              'mb-3 flex items-center gap-2 font-medium',
              highContrast ? 'text-black' : 'text-[var(--text-primary)]'
            )}
          >
            <Type className="h-4 w-4" />
            Preview
          </h2>
          <p
            className={cn(
              'leading-relaxed',
              highContrast ? 'text-black' : 'text-[var(--text-secondary)]'
            )}
          >
            {text || 'Type something above to preview it here.'}
          </p>
        </section>

        <section className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-5 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 font-medium text-[var(--text-primary)]">
            <Ear className="h-4 w-4" />
            Simplified
          </h2>
          <p className="leading-relaxed text-[var(--text-secondary)]">{simplified}</p>
        </section>
      </div>

      <section className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-5 shadow-card">
        <label
          htmlFor="accessibility-text"
          className="mb-2 block text-sm font-medium text-[var(--text-primary)]"
        >
          Text to read or simplify
        </label>
        <textarea
          id="accessibility-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-input)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          data-testid="accessibility-text-input"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={speaking ? stop : speak}
            disabled={!text}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              speaking
                ? 'bg-[var(--accent-danger)] text-white'
                : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
            )}
            data-testid="speak-button"
          >
            <Volume2 className="h-3.5 w-3.5" />
            {speaking ? 'Stop' : 'Read aloud'}
          </button>

          {voices.length > 0 && (
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              aria-label="Voice"
            >
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-5 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-[var(--text-primary)]">Display settings</h2>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Type className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-secondary)]">Font size</span>
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.max(12, s - 1))}
              className="rounded-lg bg-[var(--bg-surface)] p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]"
              aria-label="Decrease font size"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[2ch] text-center text-xs font-medium text-[var(--text-primary)]">
              {fontSize}px
            </span>
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.min(32, s + 1))}
              className="rounded-lg bg-[var(--bg-surface)] p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]"
              aria-label="Increase font size"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-subtle-solid)]"
            />
            High contrast preview
          </label>
        </div>
      </section>
    </div>
  );
}
