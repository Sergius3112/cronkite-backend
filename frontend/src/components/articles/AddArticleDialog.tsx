import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string) => Promise<void>;
}

export function AddArticleDialog({ open, onOpenChange, onSubmit }: Props) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

    if (trimmed.length > 2048) {
      setError('URL is too long');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setUrl('');
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message ?? 'Failed to add article');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-['Playfair_Display',Georgia,serif] text-xl">Add Content</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="article-url">Article URL</Label>
            <Input
              id="article-url"
              type="url"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(''); }}
              placeholder="https://www.bbc.co.uk/news/..."
              required
              maxLength={2048}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              Paste a URL and the system will save it for analysis. The article will appear under Pending until reviewed.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || !url.trim()}>
              {submitting ? 'Adding…' : 'Add Content'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
