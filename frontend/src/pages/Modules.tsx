import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, BookOpen, ExternalLink, Trash2 } from 'lucide-react';
import { useModules } from '@/hooks/useModules';
import { ModuleCard } from '@/components/modules/ModuleCard';
import { ModuleFormDialog } from '@/components/modules/ModuleFormDialog';
import { FOCUS_AREAS, KEY_STAGES } from '@/lib/focus-areas';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { Module } from '@/lib/supabase';

type ModuleAssignment = {
  id: string;
  status: string;
  article_id: string | null;
  article_title: string | null;
  article_url: string | null;
  articles: { id: string; title: string; source: string; url: string; analysis: Record<string, unknown> | null } | null;
};

const Modules = () => {
  const { modules, loading, error: modulesError, createModule, updateModule, archiveModule } = useModules();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [focusFilter, setFocusFilter] = useState('all');
  const [ksFilter, setKsFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [detailModule, setDetailModule] = useState<Module | null>(null);
  const [moduleAssignments, setModuleAssignments] = useState<ModuleAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const filtered = useMemo(() => {
    return modules.filter(m => {
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (focusFilter !== 'all' && m.focus_area !== focusFilter) return false;
      if (ksFilter !== 'all' && m.key_stage !== ksFilter) return false;
      return true;
    });
  }, [modules, search, focusFilter, ksFilter]);

  const handleSubmit = async (data: Pick<Module, 'name' | 'description' | 'focus_area' | 'key_stage'>) => {
    try {
      if (editingModule) {
        await updateModule(editingModule.id, data);
        toast({ title: 'Module updated' });
      } else {
        await createModule(data);
        toast({ title: 'Module created' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveModule(id);
      toast({ title: 'Module archived' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openCreate = () => { setEditingModule(null); setDialogOpen(true); };
  const openEdit = (m: Module) => { setEditingModule(m); setDialogOpen(true); };

  async function openDetail(m: Module) {
    setDetailModule(m);
    setLoadingAssignments(true);
    const { data, error } = await supabase
      .from('assignments')
      .select('*, articles(*)')
      .eq('module_id', m.id)
      .order('created_at', { ascending: false });
    console.log('[Modules] assignments for module', m.id, data, error);
    setModuleAssignments((data as ModuleAssignment[]) || []);
    setLoadingAssignments(false);
  }

  async function removeAssignment(assignmentId: string) {
    const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
    if (error) {
      toast({ title: 'Error removing article', description: error.message, variant: 'destructive' });
    } else {
      setModuleAssignments(prev => prev.filter(a => a.id !== assignmentId));
    }
  }

  function closeDetail() {
    setDetailModule(null);
    setModuleAssignments([]);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page title + create button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Modules</h2>
            <p className="text-muted-foreground mt-1">Manage your media literacy teaching modules</p>
          </div>
          <Button onClick={openCreate} size="lg">
            <Plus className="mr-2 h-4 w-4" /> Create Module
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search modules…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={focusFilter} onValueChange={setFocusFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Focus Areas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Focus Areas</SelectItem>
              {FOCUS_AREAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ksFilter} onValueChange={setKsFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Key Stages" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Key Stages</SelectItem>
              {KEY_STAGES.map(ks => <SelectItem key={ks} value={ks}>{ks}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Error */}
        {modulesError && (
          <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Failed to load modules: {modulesError}
          </div>
        )}

        {/* Module grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-semibold">No modules found</h3>
            <p className="text-muted-foreground mt-1">
              {modules.length === 0 ? 'Create your first module to get started.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(m => (
              <ModuleCard key={m.id} module={m} onEdit={openEdit} onArchive={handleArchive} onViewDetail={openDetail} />
            ))}
          </div>
        )}

      <ModuleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        module={editingModule}
        onSubmit={handleSubmit}
      />

      {/* Module detail dialog */}
      <Dialog open={!!detailModule} onOpenChange={open => { if (!open) closeDetail(); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-['Playfair_Display',Georgia,serif]">{detailModule?.name}</DialogTitle>
            {detailModule?.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{detailModule.description}</p>
            )}
          </DialogHeader>

          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">
              {moduleAssignments.length} article{moduleAssignments.length !== 1 ? 's' : ''} assigned
            </p>
            <Button size="sm" onClick={() => { closeDetail(); navigate('/articles'); }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Assign Article
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingAssignments ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : moduleAssignments.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground">No articles assigned yet.</p>
                <Button variant="link" className="mt-1 text-xs" onClick={() => { closeDetail(); navigate('/articles'); }}>
                  Go to Article Library →
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {moduleAssignments.map(a => {
                  const art = a.articles;
                  const title = art?.title || a.article_title || a.article_url || a.id;
                  const source = art?.source || '';
                  const score = (art?.analysis as any)?.overall_credibility_score ?? (art?.analysis as any)?.credibility_score;
                  const url = a.article_url || art?.url;

                  return (
                    <div key={a.id} className="flex items-center gap-3 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{title}</p>
                        <p className="text-xs text-muted-foreground">{source}</p>
                      </div>
                      {score != null && (
                        <Badge variant="outline" className={`shrink-0 text-xs font-semibold ${
                          score >= 75 ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : score >= 50 ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                        }`}>
                          {score}%
                        </Badge>
                      )}
                      {url && (
                        <Button variant="ghost" size="sm" className="shrink-0 h-7 w-7 p-0" asChild>
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="sm"
                        className="shrink-0 h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeAssignment(a.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Modules;
