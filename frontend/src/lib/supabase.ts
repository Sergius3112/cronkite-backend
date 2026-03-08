import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || 'https://givyodepnqelhhmtmypk.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpdnlvZGVwbnFlbGhobXRteXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzIxODIsImV4cCI6MjA4NzcwODE4Mn0.xqUQLEKfsIs2lxncsYJk7CwkXWat4QCL3xF78ixgnpk'

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Named export used by existing .jsx pages
export const sb = client

// Named export used by chronicle-hub hooks/pages (always non-null since we have fallback keys)
export const supabase = client

// Types used by chronicle-hub components
// Note: our schema stores 'title' and 'focus_point'; hooks SELECT them aliased as 'name' and 'focus_area'
export type Module = {
  id: string
  name: string
  description: string
  focus_area: string
  key_stage: string
  teacher_id: string
  status: string
  created_at: string
  article_count?: number
  assignment_count?: number
}

export type Article = {
  id: string
  title: string
  url: string
  source: string
  summary: string
  content_type: string
  analysis: {
    overall_credibility_score?: number
    focus_areas?: string[]
    [key: string]: unknown
  } | null
  status: string
  created_at: string
  thumbnail_url?: string
}
