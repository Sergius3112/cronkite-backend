import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, FileText } from 'lucide-react';
import { useArticles } from '@/hooks/useArticles';
import { useModules } from '@/hooks/useModules';
import { ArticleCard } from '@/components/articles/ArticleCard';
import { AddArticleDialog } from '@/components/articles/AddArticleDialog';
import { ArticleAnalysisCard } from '@/components/articles/ArticleAnalysisCard';
import { AssignArticleDialog } from '@/components/articles/AssignArticleDialog';
import { FOCUS_AREAS } from '@/lib/focus-areas';
import { useToast } from '@/hooks/use-toast';
import type { Article } from '@/lib/supabase';

const CONTENT_TYPES = [
  { value: 'news_article', label: 'News Article' },
  { value: 'opinion', label: 'Opinion' },
  { value: 'video', label: 'Video' },
  { value: 'research', label: 'Research' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'social_media_post', label: 'Social Media Post' },
  { value: 'political_policy', label: 'Political Policy' },
];

const TAB_STATUS_MAP: Record<string, string[]> = {
  approved: ['approved'],
  analysed: ['analysed'],
};

const Articles = () => {
  const { articles, loading, approveArticle, refetch } = useArticles();
  const { modules } = useModules();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [contentFilter, setContentFilter] = useState('all');
  const [focusFilter, setFocusFilter] = useState('all');
  const [tab, setTab] = useState('analysed');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [analyseUrl, setAnalyseUrl] = useState('');
  const [analysisArticle, setAnalysisArticle] = useState<Article | null>(null);
  const [assignArticle, setAssignArticle] = useState<Article | null>(null);

  const filtered = useMemo(() => {
    const statuses = TAB_STATUS_MAP[tab] ?? ['analysed'];
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
  }), [articles]);

  const handleApprove = async (id: string) => {
    await approveArticle(id);
    toast({ title: 'Article approved', description: 'Moved to Approved — ready to assign to modules.' });
  };

  return (
    <main className="max-w-7xl mx-auto px-8 py-8">
      {/* Section 1 — Analyse Content */}
      <h2 className="font-serif" style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '4px', color: '#1A1714' }}>
        Analyse Content
      </h2>
      <p style={{ fontSize: '13px', color: '#7A746E', marginBottom: '20px' }}>
        Paste any article URL, YouTube link, or social media post
      </p>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input
          style={{ flex: 1, background: '#fff', border: '1px solid rgba(26,23,20,0.12)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", color: '#1A1714', outline: 'none' }}
          placeholder="Paste article URL, YouTube link, or social media post…"
          value={analyseUrl}
          onChange={e => setAnalyseUrl(e.target.value)}
        />
        <button
          onClick={() => setDialogOpen(true)}
          style={{ background: 'rgb(196,30,58)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Ask Cronkite
        </button>
      </div>

      {/* Section 2 — Article Library */}
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 700, color: '#1A1714', marginBottom: '4px', marginTop: '32px' }}>
        Article Library
      </h3>
      <p style={{ fontSize: '13px', color: '#7A746E', marginBottom: '16px' }}>
        Browse, analyse and assign articles to modules
      </p>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="analysed">Analysed ({tabCounts.analysed})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({tabCounts.approved})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={contentFilter} onValueChange={setContentFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CONTENT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={focusFilter} onValueChange={setFocusFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Focus Areas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Focus Areas</SelectItem>
            {FOCUS_AREAS.map(f => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
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
            {articles.length === 0
              ? 'Add your first article to get started.'
              : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(a => (
            <ArticleCard
              key={a.id}
              article={a}
              modules={modules}
              onApprove={handleApprove}
              onViewAnalysis={setAnalysisArticle}
              onRequestAssign={setAssignArticle}
            />
          ))}
        </div>
      )}

      <AddArticleDialog open={dialogOpen} onOpenChange={setDialogOpen} onComplete={() => { refetch(); setTab('analysed'); }} />

      <AssignArticleDialog
        article={assignArticle}
        open={!!assignArticle}
        onOpenChange={open => { if (!open) setAssignArticle(null); }}
      />

      {/* Analysis review modal */}
      <Dialog open={!!analysisArticle} onOpenChange={open => { if (!open) setAnalysisArticle(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold leading-snug font-['Playfair_Display',Georgia,serif] line-clamp-2">
              {analysisArticle?.title}
            </DialogTitle>
            {analysisArticle?.source && (
              <p className="text-xs text-muted-foreground">{analysisArticle.source}</p>
            )}
          </DialogHeader>
          {analysisArticle?.analysis && (
            <ArticleAnalysisCard analysis={analysisArticle.analysis} />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Articles;
