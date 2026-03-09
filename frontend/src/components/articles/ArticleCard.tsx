import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FolderPlus, ExternalLink, CheckCircle } from 'lucide-react';
import { getFocusArea } from '@/lib/focus-areas';
import type { Article } from '@/lib/supabase';
import type { Module } from '@/lib/supabase';

const CONTENT_TYPE_LABELS: Record<string, string> = {
  news_article: 'News',
  opinion: 'Opinion',
  video: 'Video',
  research: 'Research',
  social_media: 'Social',
};

function CredibilityScore({ score }: { score?: number }) {
  if (score == null) return <span className="text-xs text-muted-foreground">No score</span>;
  const color = score >= 75 ? 'text-emerald-600 bg-emerald-500/15' : score >= 50 ? 'text-amber-600 bg-amber-500/15' : 'text-red-600 bg-red-500/15';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}%
    </span>
  );
}

interface ArticleCardProps {
  article: Article;
  modules: Module[];
  onAssign: (articleId: string, moduleId: string) => void;
  onApprove?: (id: string) => void;
}

export function ArticleCard({ article, modules, onAssign, onApprove }: ArticleCardProps) {
  const focusAreas = article.analysis?.focus_areas ?? [];
  const score = article.analysis?.overall_credibility_score;

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow border-border/60">
      {/* Thumbnail placeholder */}
      {article.thumbnail_url ? (
        <div className="h-36 overflow-hidden rounded-t-lg">
          <img src={article.thumbnail_url} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="h-28 rounded-t-lg bg-muted flex items-center justify-center">
          <span className="text-3xl font-bold text-muted-foreground/30 font-['Playfair_Display',Georgia,serif]">
            {article.source?.charAt(0)?.toUpperCase() ?? '?'}
          </span>
        </div>
      )}

      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className="text-[10px] font-medium shrink-0 uppercase tracking-wide">
            {CONTENT_TYPE_LABELS[article.content_type] ?? article.content_type}
          </Badge>
          <CredibilityScore score={score} />
        </div>
        <h3 className="mt-2 text-sm font-semibold leading-snug font-['Playfair_Display',Georgia,serif] line-clamp-2">
          {article.title}
        </h3>
        <p className="text-xs text-muted-foreground">{article.source}</p>
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        <p className="text-xs text-muted-foreground line-clamp-2">{article.summary}</p>
        {focusAreas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {focusAreas.map(fa => {
              const focus = getFocusArea(fa);
              return (
                <Badge key={fa} variant="secondary" className={`text-[10px] border ${focus.colorClass}`}>
                  {focus.label}
                </Badge>
              );
            })}
          </div>
        )}
      </CardContent>

      <div className="flex flex-col gap-2 px-6 pb-4">
        {article.status === 'analysed' && onApprove && (
          <Button
            size="sm"
            className="w-full"
            onClick={() => onApprove(article.id)}
          >
            <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Approve
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <a href={article.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View
            </a>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> Assign
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {modules.length === 0 ? (
                <DropdownMenuItem disabled>No modules yet</DropdownMenuItem>
              ) : (
                modules.map(m => (
                  <DropdownMenuItem key={m.id} onClick={() => onAssign(article.id, m.id)}>
                    {m.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
