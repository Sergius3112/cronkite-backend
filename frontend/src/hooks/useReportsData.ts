import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type Assignment = {
  id: string;
  module_id: string;
  article_id: string;
  student_email: string;
  status: string;
  due_date: string | null;
  instructions: string;
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
        .select('id, module_id, article_url, created_at, due_date, instructions')
        .in('module_id', moduleIds),
      supabase
        .from('student_results')
        .select('id, assignment_id, student_id, completed_at'),
    ]);

    if (assignRes.data) {
      setAssignments(assignRes.data.map((a: any) => ({
        id: a.id,
        module_id: a.module_id,
        article_id: a.id,
        student_email: '',
        status: 'pending',
        due_date: a.due_date ?? null,
        instructions: a.instructions ?? '',
      })));
    }
    if (resultRes.data) setResults(resultRes.data as StudentResult[]);
    setLoading(false);
  }, [moduleIds]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { assignments, results, loading };
}
