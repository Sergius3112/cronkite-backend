import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, BookOpen } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { useModules } from '@/hooks/useModules';
import { ModuleCard } from '@/components/modules/ModuleCard';
import { ModuleFormDialog } from '@/components/modules/ModuleFormDialog';
import { FOCUS_AREAS, KEY_STAGES } from '@/lib/focus-areas';
import { useToast } from '@/hooks/use-toast';
import type { Module } from '@/lib/supabase';

const Modules = () => {
  const { modules, loading, createModule, updateModule, archiveModule } = useModules();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [focusFilter, setFocusFilter] = useState('all');
  const [ksFilter, setKsFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);

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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

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
              <ModuleCard key={m.id} module={m} onEdit={openEdit} onArchive={handleArchive} />
            ))}
          </div>
        )}
      </main>

      <ModuleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        module={editingModule}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default Modules;
