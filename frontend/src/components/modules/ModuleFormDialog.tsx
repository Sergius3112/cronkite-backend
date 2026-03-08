import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FOCUS_AREAS, KEY_STAGES } from '@/lib/focus-areas';
import type { Module } from '@/lib/supabase';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module?: Module | null;
  onSubmit: (data: Pick<Module, 'name' | 'description' | 'focus_area' | 'key_stage'>) => Promise<void>;
}

export function ModuleFormDialog({ open, onOpenChange, module, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [keyStage, setKeyStage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!module;

  useEffect(() => {
    if (module) {
      setName(module.name);
      setDescription(module.description);
      setFocusArea(module.focus_area);
      setKeyStage(module.key_stage);
    } else {
      setName(''); setDescription(''); setFocusArea(''); setKeyStage('');
    }
  }, [module, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !focusArea || !keyStage) return;
    setSubmitting(true);
    try {
      await onSubmit({ name, description, focus_area: focusArea, key_stage: keyStage });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-['Playfair_Display',Georgia,serif] text-xl">
            {isEdit ? 'Edit Module' : 'Create Module'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Module Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Spotting Fake News" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What will students learn?" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Focus Area</Label>
              <Select value={focusArea} onValueChange={setFocusArea} required>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {FOCUS_AREAS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Key Stage</Label>
              <Select value={keyStage} onValueChange={setKeyStage} required>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {KEY_STAGES.map(ks => (
                    <SelectItem key={ks} value={ks}>{ks}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || !name || !focusArea || !keyStage}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Module'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
