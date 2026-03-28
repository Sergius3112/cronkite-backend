import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Archive, FileText, ClipboardList } from 'lucide-react';
import { getFocusArea } from '@/lib/focus-areas';
import type { Module } from '@/lib/supabase';

interface ModuleCardProps {
  module: Module;
  onEdit: (module: Module) => void;
  onArchive: (id: string) => void;
  onViewDetail?: (module: Module) => void;
}

export function ModuleCard({ module, onEdit, onArchive, onViewDetail }: ModuleCardProps) {
  const focus = getFocusArea(module.focus_area);
  const Icon = focus.icon;

  return (
    <Card className="flex flex-col justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#1A1714', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon style={{ width: '14px', height: '14px', color: '#F7F3EC' }} />
          </div>
          <Badge variant="outline" className="text-xs font-medium shrink-0">
            {module.key_stage}
          </Badge>
        </div>
        <h3 className="mt-3 text-lg font-semibold leading-tight font-['Playfair_Display',Georgia,serif]">
          {module.name}
        </h3>
      </CardHeader>

      <CardContent className="pb-3">
        <p className="text-sm text-muted-foreground line-clamp-2">{module.description}</p>
        <div className="mt-3">
          <Badge variant="secondary" className="bg-[#F7F3EC] border border-[rgba(26,23,20,0.1)] text-[#1A1714] text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full">
            {focus.label}
          </Badge>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{module.article_count ?? 0} articles</span>
          <span className="flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" />{module.assignment_count ?? 0} assigned</span>
        </div>
      </CardContent>

      <CardFooter className="gap-2 pt-0 flex-wrap">
        <Button variant="default" size="sm" className="flex-1" onClick={() => onViewDetail?.(module)}>
          <FileText className="mr-1.5 h-3.5 w-3.5" /> View Articles
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(module)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => onArchive(module.id)}>
          <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
        </Button>
      </CardFooter>
    </Card>
  );
}
