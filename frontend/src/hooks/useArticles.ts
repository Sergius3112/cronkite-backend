import { useState, useEffect, useCallback } from 'react';
import { supabase, type Article } from '@/lib/supabase';

const MOCK_ARTICLES: Article[] = [
  { id: '1', title: 'How to Spot Misinformation Online', url: 'https://example.com/1', source: 'BBC News', summary: 'A comprehensive guide to identifying false claims in social media posts and news articles.', content_type: 'news_article', analysis: { overall_credibility_score: 92, focus_areas: ['evaluating_content'] }, status: 'approved', created_at: '2024-01-10' },
  { id: '2', title: 'The Psychology of Clickbait', url: 'https://example.com/2', source: 'The Guardian', summary: 'Why sensational headlines work and how advertisers exploit our curiosity.', content_type: 'opinion', analysis: { overall_credibility_score: 78, focus_areas: ['persuasion_techniques'] }, status: 'approved', created_at: '2024-01-20' },
  { id: '3', title: 'Social Media and Teen Mental Health', url: 'https://example.com/3', source: 'Channel 4 News', summary: 'Investigation into the effects of excessive social media use on young people.', content_type: 'video', analysis: { overall_credibility_score: 85, focus_areas: ['online_behaviour'] }, status: 'approved', created_at: '2024-02-05' },
];

export function useArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    // No 'articles' table in schema yet — use mock data
    setArticles(MOCK_ARTICLES);
    setLoading(false);
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const addArticle = async (url: string) => {
    const newArt: Article = {
      id: crypto.randomUUID(),
      title: 'New Article (Pending Analysis)',
      url,
      source: (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } })(),
      summary: '',
      content_type: 'news_article',
      analysis: null,
      status: 'pending_analysis',
      created_at: new Date().toISOString(),
    };
    setArticles(prev => [newArt, ...prev]);
    return newArt;
  };

  return { articles, loading, addArticle, refetch: fetchArticles };
}
