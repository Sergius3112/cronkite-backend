import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useModules } from '@/hooks/useModules';
import { useToast } from '@/hooks/use-toast';
import type { Article } from '@/lib/supabase';

interface AssignArticleDialogProps {
  article: Article | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignArticleDialog({ article, open, onOpenChange }: AssignArticleDialogProps) {
  const { modules } = useModules();
  const { toast } = useToast();
  const [moduleId, setModuleId] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleAssign() {
    if (!moduleId || !article) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('assignments').insert({
        module_id: moduleId,
        article_id: article.id,
        article_title: article.title,
        article_url: article.url,
        student_email: studentEmail.trim() || null,
        due_date: dueDate || null,
        status: 'assigned',
      });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      toast({ title: 'Error assigning article', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setModuleId('');
      setStudentEmail('');
      setDueDate('');
      setDone(false);
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to Module</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-semibold">Article assigned successfully</p>
            <p className="text-xs text-muted-foreground line-clamp-2 max-w-xs">{article?.title}</p>
            <Button className="mt-2 w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-1">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Article</p>
                <p className="text-sm font-medium line-clamp-2">{article?.title}</p>
                {article?.source && <p className="text-xs text-muted-foreground mt-0.5">{article.source}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Module *</label>
                <Select value={moduleId} onValueChange={setModuleId}>
                  <SelectTrigger><SelectValue placeholder="Select a module…" /></SelectTrigger>
                  <SelectContent>
                    {modules.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">
                  Student email <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input
                  placeholder="student@school.edu"
                  value={studentEmail}
                  onChange={e => setStudentEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">
                  Due date <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button disabled={!moduleId || saving} onClick={handleAssign}>
                {saving ? 'Assigning…' : 'Assign'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
