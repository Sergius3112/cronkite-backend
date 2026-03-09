import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type Assignment = {
  id: string;
  module_id: string;
  article_id: string;
  article_title: string;
  article_url: string;
  student_email: string;
  status: string;
  due_date: string | null;
  instructions: string;
  bias_direction: number | null;
};

export type StudentResult = {
  id: string;
  assignment_id: string;
  student_id: string;
  completed_at: string;
};

export function useReportsData(moduleIds: string[]) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    if (moduleIds.length === 0) {
      setAssignments([]);
      setResults([]);
      setLoading(false);
      return;
    }

    const [assignRes, resultRes] = await Promise.all([
      supabase
        .from('assignments')
        .select('id, module_id, article_id, article_title, article_url, student_email, status, due_date, instructions, articles(analysis)')
        .in('module_id', moduleIds),
      supabase
        .from('student_results')
        .select('id, assignment_id, student_id, completed_at'),
    ]);

    if (assignRes.data) {
      setAssignments(assignRes.data.map((a: any) => ({
        id: a.id,
        module_id: a.module_id,
        article_id: a.article_id ?? '',
        article_title: a.article_title || a.article_url || '',
        article_url: a.article_url || '',
        student_email: a.student_email ?? '',
        status: a.status ?? 'assigned',
        due_date: a.due_date ?? null,
        instructions: a.instructions ?? '',
        bias_direction: a.articles?.analysis?.bias_direction ?? null,
      })));
    }
    if (resultRes.data) setResults(resultRes.data as StudentResult[]);
    setLoading(false);
  }, [moduleIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  return { assignments, results, loading };
}
