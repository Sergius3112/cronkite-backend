import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sb } from '@/lib/supabase';
import { ArticleAnalysisCard, type AnalysisData } from './ArticleAnalysisCard';

const ANALYSIS_STEPS = [
  'Retrieving article content...',
  'Identifying rhetorical devices and loaded language...',
  'Cross-referencing claims against primary sources...',
  'Profiling publication ownership and editorial history...',
  'Assessing source credibility and bias indicators...',
  'Mapping persuasion techniques...',
  'Synthesising scholar-grade analysis...',
  'Finalising report...',
];

function AnalysisProgressFeed() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (activeStep >= ANALYSIS_STEPS.length - 1) return;
    const t = setTimeout(() => setActiveStep(s => s + 1), 2500);
    return () => clearTimeout(t);
  }, [activeStep]);

  return (
    <>
      <style>{`
        @keyframes stepFadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .step-row { animation: stepFadeIn 0.35s ease forwards; }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.8); }
        }
        .active-dot { animation: dotPulse 1s ease-in-out infinite; }
      `}</style>
      <div style={{
        background: '#f5f0e8',
        borderRadius: 12,
        padding: '24px 28px',
        fontFamily: "'Playfair Display', Georgia, serif",
        minHeight: 200,
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 18, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
          Cronkite Analysis Engine
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ANALYSIS_STEPS.slice(0, activeStep + 1).map((step, i) => (
            <div key={i} className="step-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flexShrink: 0, width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {i < activeStep ? (
                  <span style={{ color: '#2d6a4f', fontSize: 13, fontWeight: 700 }}>✓</span>
                ) : (
                  <span className="active-dot" style={{
                    display: 'inline-block', width: 7, height: 7,
                    borderRadius: '50%', background: '#c41e3a',
                  }} />
                )}
              </span>
              <span style={{
                fontSize: 13,
                color: i < activeStep ? '#9ca3af' : '#1a1a1a',
                fontFamily: "'Playfair Display', Georgia, serif",
              }}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type Phase = 'input' | 'analysing' | 'result';

export function AddArticleDialog({ open, onOpenChange, onComplete }: Props) {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisData | null>(null);

  const reset = () => {
    setUrl('');
    setPhase('input');
    setError('');
    setResult(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = url.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setPhase('analysing');
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('Not authenticated — please sign in again');

      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? 'Analysis failed');
      }

      const data: AnalysisData = await res.json();
      setResult(data);
      setPhase('result');
      onComplete?.();
    } catch (err: any) {
      setError(err.message ?? 'Analysis failed');
      setPhase('input');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={
          phase === 'result'
            ? 'sm:max-w-[600px] max-h-[85vh] overflow-y-auto'
            : 'sm:max-w-[480px]'
        }
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {phase === 'input' && 'Add Content'}
            {phase === 'analysing' && 'Analysing…'}
            {phase === 'result' && (result?.title ?? 'Analysis Complete')}
          </DialogTitle>
          {phase === 'result' && result?.source && (
            <p className="text-xs text-muted-foreground mt-1">{result.source}</p>
          )}
        </DialogHeader>

        {phase === 'input' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="article-url">URL</Label>
              <Input
                id="article-url"
                type="url"
                value={url}
                onChange={e => { setUrl(e.target.value); setError(''); }}
                placeholder="https://www.bbc.co.uk/news/…"
                required
                maxLength={2048}
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">
                Supports news articles, YouTube videos, tweets, TikToks, and Instagram posts.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!url.trim()}>
                Analyse Article
              </Button>
            </div>
          </form>
        )}

        {phase === 'analysing' && (
          <div className="py-4">
            <AnalysisProgressFeed />
            <p className="text-xs text-muted-foreground text-center mt-4">
              This usually takes 15–30 seconds
            </p>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="space-y-4">
            <ArticleAnalysisCard analysis={result} />
            <div className="flex justify-end pt-2 border-t border-border">
              <Button onClick={() => handleClose(false)}>
                Done — Saved to Library
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
