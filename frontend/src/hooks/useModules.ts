import { useState, useEffect, useCallback } from 'react';
import { supabase, type Module } from '@/lib/supabase';

export function useModules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Get current session so we can filter by teacher_id
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    // Select real column names (PostgREST doesn't support SQL AS aliasing).
    // Map title → name and focus_point → focus_area in JS to match Module type.
    const { data, error: qErr } = await supabase
      .from('modules')
      .select('id, title, description, focus_point, key_stage, teacher_id, created_at')
      .eq('teacher_id', session.user.id)
      .order('created_at', { ascending: false });

    if (qErr) {
      setError(qErr.message);
      setLoading(false);
      return;
    }

    if (data) {
      // Fetch article + assignment counts for all modules in parallel
      const counts = await Promise.all(
        data.map(async (m: any) => {
          const [artRes, assignRes] = await Promise.all([
            supabase
              .from('assignments')
              .select('article_id', { count: 'exact', head: false })
              .eq('module_id', m.id),
            supabase
              .from('assignments')
              .select('*', { count: 'exact', head: true })
              .eq('module_id', m.id)
              .not('student_email', 'is', null),
          ]);
          // Deduplicate article_ids for the article count
          const uniqueArticles = new Set((artRes.data ?? []).map((r: any) => r.article_id).filter(Boolean));
          return { id: m.id, article_count: uniqueArticles.size, assignment_count: assignRes.count ?? 0 };
        })
      );
      const countById: Record<string, { article_count: number; assignment_count: number }> = {};
      counts.forEach(c => { countById[c.id] = { article_count: c.article_count, assignment_count: c.assignment_count }; });

      setModules(data.map((m: any) => ({
        ...m,
        name: m.title,
        focus_area: m.focus_point,
        status: 'active',
        article_count: countById[m.id]?.article_count ?? 0,
        assignment_count: countById[m.id]?.assignment_count ?? 0,
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

  return { modules, loading, error, createModule, updateModule, archiveModule, refetch: fetchModules };
}
