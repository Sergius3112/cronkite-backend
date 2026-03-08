import { useState, useEffect, useCallback } from 'react';
import type { Module } from '@/lib/supabase';

export type SuggestedArticle = {
  id: string;
  title: string;
  url: string;
  source: string;
  relevance_reason: string;
  credibility_score: number;
  focus_area: string;
  module_id: string;
};

const MOCK_SUGGESTIONS: Record<string, SuggestedArticle[]> = {
  '1': [
    { id: 's1', title: 'Five Ways to Verify a News Story', url: 'https://bbc.co.uk/verify-news', source: 'BBC News', relevance_reason: 'Directly teaches source verification skills aligned with evaluating content objectives', credibility_score: 94, focus_area: 'evaluating_content', module_id: '1' },
    { id: 's2', title: 'How Algorithms Shape What You See', url: 'https://guardian.com/algorithms', source: 'The Guardian', relevance_reason: 'Explores filter bubbles — relevant to understanding how content is curated online', credibility_score: 87, focus_area: 'evaluating_content', module_id: '1' },
    { id: 's3', title: 'Reverse Image Search: A Student Guide', url: 'https://fullfact.org/image-search', source: 'Full Fact', relevance_reason: 'Practical tool-based lesson for fact-checking images in news articles', credibility_score: 91, focus_area: 'evaluating_content', module_id: '1' },
  ],
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://cronkite-backend-production.up.railway.app';

export function useSuggestions(modules: Module[]) {
  const [suggestions, setSuggestions] = useState<Record<string, SuggestedArticle[]>>({});
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);

    const result: Record<string, SuggestedArticle[]> = {};
    await Promise.all(
      modules.map(async (m) => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/suggest-articles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module_id: m.id, focus_area: m.focus_area, key_stage: m.key_stage }),
          });
          if (res.ok) {
            const data = await res.json();
            result[m.id] = data.suggestions ?? [];
          }
        } catch {
          // Fall back to mock suggestions for this module
          if (MOCK_SUGGESTIONS[m.id]) {
            result[m.id] = MOCK_SUGGESTIONS[m.id];
          }
        }
      })
    );
    setSuggestions(result);
    setLoading(false);
  }, [modules]);

  useEffect(() => {
    if (modules.length > 0) fetchSuggestions();
    else setLoading(false);
  }, [fetchSuggestions, modules]);

  const dismiss = (suggestionId: string) => {
    setDismissed(prev => new Set(prev).add(suggestionId));
  };

  const addToModule = async (suggestion: SuggestedArticle) => {
    dismiss(suggestion.id);
  };

  const visibleSuggestions: Record<string, SuggestedArticle[]> = {};
  Object.entries(suggestions).forEach(([moduleId, items]) => {
    const visible = items.filter(s => !dismissed.has(s.id));
    if (visible.length > 0) visibleSuggestions[moduleId] = visible;
  });

  return { suggestions: visibleSuggestions, loading, dismiss, addToModule, refetch: fetchSuggestions };
}
