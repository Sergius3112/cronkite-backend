import { useState, useEffect, useCallback } from 'react';
import { sb, type Article } from '@/lib/supabase';

export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data, error } = await sb
        .from('articles')
        .select('*')
        .eq('teacher_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles((data ?? []) as Article[]);
    } catch (e) {
      console.error('Failed to fetch articles:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const analyseArticle = async (url: string): Promise<any> => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await fetch('/api/analyse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? 'Analysis failed');
    }

    const data = await res.json();
    await fetchArticles();
    return data;
  };

  const approveArticle = async (id: string) => {
    await sb.from('articles').update({ status: 'approved' }).eq('id', id);
    setArticles(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' } : a));
  };

  return { articles, loading, analyseArticle, approveArticle, refetch: fetchArticles };
}
