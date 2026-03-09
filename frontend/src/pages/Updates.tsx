import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, X, Sparkles, Lightbulb } from 'lucide-react';
import { useModules } from '@/hooks/useModules';
import { useSuggestions, type SuggestedArticle } from '@/hooks/useSuggestions';
import { getFocusArea } from '@/lib/focus-areas';
import { useToast } from '@/hooks/use-toast';

function CredibilityDot({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {score}%
    </span>
  );
}

function SuggestionCard({
  suggestion,
  onAdd,
  onDismiss,
  adding,
}: {
  suggestion: SuggestedArticle;
  onAdd: () => void;
  onDismiss: () => void;
  adding: boolean;
}) {
  const focus = getFocusArea(suggestion.focus_area);
  const Icon = focus.icon;

  return (
    <Card className="border-border/60 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide shrink-0">
                {suggestion.source}
              </Badge>
              <CredibilityDot score={suggestion.credibility_score} />
            </div>
            <h4 className="text-sm font-semibold leading-snug font-['Playfair_Display',Georgia,serif] line-clamp-2 mb-1.5">
              {suggestion.title}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {suggestion.relevance_reason}
            </p>
            <Badge variant="secondary" className={`text-[10px] border ${focus.colorClass}`}>
              <Icon className="h-3 w-3 mr-1" />
              {focus.label}
            </Badge>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button size="sm" onClick={onAdd} disabled={adding} className="h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss} className="h-8 text-xs text-muted-foreground">
              <X className="h-3.5 w-3.5 mr-1" /> Dismiss
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const Updates = () => {
  const { modules, loading: modulesLoading } = useModules();
  const activeModules = useMemo(() => modules.filter(m => m.status === 'active'), [modules]);
  const { suggestions, loading: sugLoading, dismiss, addToModule } = useSuggestions(activeModules);
  const { toast } = useToast();
  const [addingId, setAddingId] = useState<string | null>(null);

  const loading = modulesLoading || sugLoading;
  const hasAnySuggestions = Object.keys(suggestions).length > 0;

  const handleAdd = async (suggestion: SuggestedArticle, moduleName: string) => {
    setAddingId(suggestion.id);
    try {
      await addToModule(suggestion);
      toast({ title: 'Article added', description: `"${suggestion.title}" added to ${moduleName}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAddingId(null);
    }
  };

  const handleDismiss = (id: string) => {
    dismiss(id);
    toast({ title: 'Suggestion dismissed' });
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="h-6 w-48 bg-muted animate-pulse rounded mb-3" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-36 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight">Module Updates</h2>
          </div>
          <p className="text-muted-foreground mt-1">AI-suggested articles matched to your active modules</p>
        </div>

        {!hasAnySuggestions ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Lightbulb className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No suggestions yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                AI suggestions will appear here based on your modules. Create modules with focus areas and key stages to receive tailored article recommendations.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {activeModules.map(mod => {
              const modSuggestions = suggestions[mod.id];
              if (!modSuggestions || modSuggestions.length === 0) return null;
              const focus = getFocusArea(mod.focus_area);

              return (
                <section key={mod.id}>
                  <CardHeader className="px-0 pb-3 pt-0">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs ${focus.colorClass}`}>
                        <focus.icon className="h-3.5 w-3.5" />
                      </span>
                      {mod.name}
                      <Badge variant="outline" className="text-[10px] ml-1">{mod.key_stage}</Badge>
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        {modSuggestions.length} suggestion{modSuggestions.length !== 1 ? 's' : ''}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {modSuggestions.map(s => (
                      <SuggestionCard
                        key={s.id}
                        suggestion={s}
                        onAdd={() => handleAdd(s, mod.name)}
                        onDismiss={() => handleDismiss(s.id)}
                        adding={addingId === s.id}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
    </main>
  );
};

export default Updates;
