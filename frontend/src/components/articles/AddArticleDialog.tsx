import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { ArticleAnalysisCard, type AnalysisData } from './ArticleAnalysisCard';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string) => Promise<any>;
}

type Phase = 'input' | 'analysing' | 'result';

export function AddArticleDialog({ open, onOpenChange, onSubmit }: Props) {
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
      const data = await onSubmit(trimmed);
      setResult(data);
      setPhase('result');
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
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium">Analysing article…</p>
              <p className="text-xs text-muted-foreground mt-1">
                This usually takes 15–30 seconds
              </p>
            </div>
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
