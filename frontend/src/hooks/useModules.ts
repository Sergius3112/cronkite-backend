import { useState, useEffect, useCallback } from 'react';
import { supabase, type Module } from '@/lib/supabase';

export function useModules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModules = useCallback(async () => {
    setLoading(true);
    // SELECT aliasing maps our schema columns to the Module type:
    // title → name, focus_point → focus_area
    const { data, error } = await supabase
      .from('modules')
      .select('id, title as name, description, focus_point as focus_area, key_stage, teacher_id, created_at')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setModules(data.map((m: any) => ({
        ...m,
        status: 'active',
        article_count: 0,
        assignment_count: 0,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  const createModule = async (mod: Pick<Module, 'name' | 'description' | 'focus_area' | 'key_stage'>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    // Map back from Module type to schema columns
    const { data, error } = await supabase.from('modules').insert({
      teacher_id:  session.user.id,
      title:       mod.name,
      description: mod.description || '',
      focus_point: mod.focus_area,
      key_stage:   mod.key_stage,
    }).select().single();
    if (error) throw error;
    await fetchModules();
    return data;
  };

  const updateModule = async (id: string, updates: Partial<Module>) => {
    // Map field names back to schema columns
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined)       dbUpdates.title       = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.focus_area !== undefined)  dbUpdates.focus_point = updates.focus_area;
    if (updates.key_stage !== undefined)   dbUpdates.key_stage   = updates.key_stage;
    if (Object.keys(dbUpdates).length === 0) return;
    const { error } = await supabase.from('modules').update(dbUpdates).eq('id', id);
    if (error) throw error;
    await fetchModules();
  };

  // No status column in schema — archive is a no-op client-side remove
  const archiveModule = async (id: string) => {
    setModules(prev => prev.filter(m => m.id !== id));
  };

  return { modules, loading, createModule, updateModule, archiveModule, refetch: fetchModules };
}
