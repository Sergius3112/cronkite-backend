import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, FileText } from 'lucide-react';
import { useArticles } from '@/hooks/useArticles';
import { useModules } from '@/hooks/useModules';
import { ArticleCard } from '@/components/articles/ArticleCard';
import { AddArticleDialog } from '@/components/articles/AddArticleDialog';
import { FOCUS_AREAS } from '@/lib/focus-areas';
import { useToast } from '@/hooks/use-toast';

const CONTENT_TYPES = [
  { value: 'news_article', label: 'News Article' },
  { value: 'opinion', label: 'Opinion' },
  { value: 'video', label: 'Video' },
  { value: 'research', label: 'Research' },
  { value: 'social_media', label: 'Social Media' },
];

const TAB_STATUS_MAP: Record<string, string[]> = {
  approved: ['approved'],
  analysed: ['analysed'],
  pending: ['pending_analysis'],
};

const Articles = () => {
  const { articles, loading, addArticle } = useArticles();
  const { modules } = useModules();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [contentFilter, setContentFilter] = useState('all');
  const [focusFilter, setFocusFilter] = useState('all');
  const [tab, setTab] = useState('approved');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const statuses = TAB_STATUS_MAP[tab] ?? ['approved'];
    return articles.filter(a => {
      if (!statuses.includes(a.status)) return false;
      if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (contentFilter !== 'all' && a.content_type !== contentFilter) return false;
      if (focusFilter !== 'all') {
        const areas = a.analysis?.focus_areas ?? [];
        if (!areas.includes(focusFilter)) return false;
      }
      return true;
    });
  }, [articles, search, contentFilter, focusFilter, tab]);

  const tabCounts = useMemo(() => ({
    approved: articles.filter(a => a.status === 'approved').length,
    analysed: articles.filter(a => a.status === 'analysed').length,
    pending: articles.filter(a => a.status === 'pending_analysis').length,
  }), [articles]);

  const handleAdd = async (url: string) => {
    try {
      await addArticle(url);
      toast({ title: 'Article added', description: 'It will appear under Pending until analysed.' });
      setTab('pending');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      throw err;
    }
  };

  const handleAssign = (articleId: string, moduleId: string) => {
    const mod = modules.find(m => m.id === moduleId);
    toast({ title: 'Article assigned', description: `Added to "${mod?.name ?? 'module'}"` });
    // In production this would insert into assignments table
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Title + add button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Article Library</h2>
            <p className="text-muted-foreground mt-1">Browse, analyse and assign articles to modules</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="lg">
            <Plus className="mr-2 h-4 w-4" /> Add Content
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="approved">Approved ({tabCounts.approved})</TabsTrigger>
            <TabsTrigger value="analysed">Analysed ({tabCounts.analysed})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({tabCounts.pending})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search articles…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={contentFilter} onValueChange={setContentFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {CONTENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={focusFilter} onValueChange={setFocusFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Focus Areas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Focus Areas</SelectItem>
              {FOCUS_AREAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-semibold">No articles found</h3>
            <p className="text-muted-foreground mt-1">
              {articles.length === 0 ? 'Add your first article to get started.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map(a => (
              <ArticleCard key={a.id} article={a} modules={modules} onAssign={handleAssign} />
            ))}
          </div>
        )}
      <AddArticleDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleAdd} />
    </main>
  );
};

export default Articles;
