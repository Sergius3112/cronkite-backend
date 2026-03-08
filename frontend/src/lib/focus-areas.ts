import { BookOpen, Eye, Users, ShieldAlert, FolderSearch } from 'lucide-react';

export const FOCUS_AREAS = [
  { value: 'evaluating_content', label: 'Evaluating Content', icon: BookOpen, colorClass: 'bg-blue-500/15 text-blue-700 border-blue-200' },
  { value: 'persuasion_techniques', label: 'Persuasion Techniques', icon: Eye, colorClass: 'bg-purple-500/15 text-purple-700 border-purple-200' },
  { value: 'online_behaviour', label: 'Online Behaviour', icon: Users, colorClass: 'bg-emerald-500/15 text-emerald-700 border-emerald-200' },
  { value: 'identifying_risks', label: 'Identifying Risks', icon: ShieldAlert, colorClass: 'bg-orange-500/15 text-orange-700 border-orange-200' },
  { value: 'managing_information', label: 'Managing Information', icon: FolderSearch, colorClass: 'bg-rose-500/15 text-rose-700 border-rose-200' },
] as const;

export const KEY_STAGES = ['KS2', 'KS3', 'KS4', 'KS5'] as const;

export function getFocusArea(value: string) {
  return FOCUS_AREAS.find(f => f.value === value) ?? FOCUS_AREAS[0];
}
