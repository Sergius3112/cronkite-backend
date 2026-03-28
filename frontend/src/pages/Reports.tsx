import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, CheckCircle, Clock, Eye, AlertTriangle, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useModules } from '@/hooks/useModules';
import { useReportsData } from '@/hooks/useReportsData';

const PIE_COLORS = ['hsl(160, 60%, 40%)', 'hsl(210, 70%, 50%)', 'hsl(30, 80%, 50%)', 'hsl(350, 73%, 40%)'];

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: '#1A1714', borderRadius: '10px', padding: '14px 16px' }}>
      <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9E9488', marginBottom: '5px' }}>{label}</p>
      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 700, color: '#F7F3EC', letterSpacing: '-1px', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '10px', color: '#9E9488', marginTop: '2px' }}>{sub}</p>}
    </div>
  )
}

const Reports = () => {
  const { modules } = useModules();
  const [moduleFilter, setModuleFilter] = useState('all');

  const moduleIds = useMemo(() => modules.map(m => m.id), [modules]);
  const { assignments, results, loading } = useReportsData(moduleIds);

  // Apply module filter
  const filtered = useMemo(() => {
    if (moduleFilter === 'all') return assignments;
    return assignments.filter(a => a.module_id === moduleFilter);
  }, [assignments, moduleFilter]);

  // Stats
  const totalAssignments = filtered.length;
  const completedIds = new Set(results.map(r => r.assignment_id));
  const completedCount = filtered.filter(a => completedIds.has(a.id) || a.status === 'completed' || a.status === 'reviewed').length;
  const completionRate = totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0;
  const pendingReview = filtered.filter(a => a.status === 'completed').length;
  const reviewed = filtered.filter(a => a.status === 'reviewed').length;
  const uniqueStudents = useMemo(() => new Set(filtered.map(a => a.student_email).filter(Boolean)).size, [filtered]);

  // Bar chart: assignments per module
  const barData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(a => { counts[a.module_id] = (counts[a.module_id] || 0) + 1; });
    return Object.entries(counts).map(([moduleId, count]) => {
      const mod = modules.find(m => m.id === moduleId);
      return { name: mod?.name?.slice(0, 18) ?? moduleId, assignments: count };
    });
  }, [filtered, modules]);

  // Pie chart: status breakdown
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });
    return Object.entries(counts).map(([status, value]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
      value,
    }));
  }, [filtered]);

  // Most assigned articles
  const topArticles = useMemo(() => {
    const counts: Record<string, { title: string; count: number }> = {};
    filtered.forEach(a => {
      const key = a.article_id || a.article_url;
      if (!key) return;
      if (!counts[key]) counts[key] = { title: a.article_title || a.article_url, count: 0 };
      counts[key].count++;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filtered]);

  // Average bias direction
  const avgBias = useMemo(() => {
    const biases = filtered.map(a => a.bias_direction).filter((b): b is number => b != null);
    if (biases.length === 0) return null;
    return Math.round(biases.reduce((s, v) => s + v, 0) / biases.length);
  }, [filtered]);

  // Needs attention: students with 0 completions or overdue
  const needsAttention = useMemo(() => {
    const now = new Date();
    const studentAssignments: Record<string, { total: number; completed: number; overdue: string[] }> = {};
    filtered.forEach(a => {
      if (!studentAssignments[a.student_email]) {
        studentAssignments[a.student_email] = { total: 0, completed: 0, overdue: [] };
      }
      const s = studentAssignments[a.student_email];
      s.total++;
      if (completedIds.has(a.id) || a.status === 'completed' || a.status === 'reviewed') {
        s.completed++;
      }
      if (a.due_date && new Date(a.due_date) < now && a.status === 'pending') {
        const mod = modules.find(m => m.id === a.module_id);
        s.overdue.push(mod?.name ?? 'Unknown module');
      }
    });

    return Object.entries(studentAssignments)
      .filter(([, s]) => s.completed === 0 || s.overdue.length > 0)
      .map(([email, s]) => ({
        email,
        reason: s.completed === 0 ? 'No completions' : `${s.overdue.length} overdue`,
        overdueModules: s.overdue,
        total: s.total,
        completed: s.completed,
      }));
  }, [filtered, completedIds, modules]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-72 rounded-lg bg-muted animate-pulse" />
          <div className="h-72 rounded-lg bg-muted animate-pulse" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Title + filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="font-serif text-3xl font-bold tracking-tight">Class Reports</h2>
            <p className="text-muted-foreground mt-1">Track assignment progress and student engagement</p>
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="All Modules" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          <StatCard icon={ClipboardList} label="Total Assignments" value={totalAssignments} />
          <StatCard icon={CheckCircle} label="Completion Rate" value={`${completionRate}%`} sub={`${completedCount} of ${totalAssignments}`} />
          <StatCard icon={Users} label="Students" value={uniqueStudents} />
          <StatCard icon={Clock} label="Pending Review" value={pendingReview} />
          <StatCard icon={Eye} label="Reviewed" value={reviewed} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
          {/* Bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Module Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              {barData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="assignments" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Pie chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Assignment Status</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name} (${value})`}
                      labelLine={false}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend verticalAlign="bottom" height={36} iconSize={10} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Most assigned articles + bias */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Most Assigned Articles</CardTitle>
            </CardHeader>
            <CardContent>
              {topArticles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
              ) : (
                <div className="divide-y divide-border">
                  {topArticles.map((a, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 gap-3">
                      <p className="text-sm truncate flex-1">{a.title || '(untitled)'}</p>
                      <span className="shrink-0 text-xs font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">
                        {a.count} {a.count === 1 ? 'class' : 'classes'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Average Bias Exposure</CardTitle>
            </CardHeader>
            <CardContent>
              {avgBias == null ? (
                <p className="text-sm text-muted-foreground text-center py-8">No bias data yet</p>
              ) : (
                <div className="py-4 space-y-3">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Left</span>
                    <span className="font-semibold text-foreground">
                      {avgBias < -10 ? 'Left-leaning' : avgBias > 10 ? 'Right-leaning' : 'Centre'}
                    </span>
                    <span>Right</span>
                  </div>
                  <div className="relative h-3 bg-gradient-to-r from-blue-400 via-muted to-red-400 rounded-full">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-foreground rounded-full border-2 border-background shadow"
                      style={{ left: `calc(${((avgBias + 100) / 200) * 100}% - 8px)` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Average bias score: <span className="font-semibold text-foreground">{avgBias > 0 ? '+' : ''}{avgBias}</span> across {filtered.filter(a => a.bias_direction != null).length} articles
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Needs attention */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {needsAttention.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">All students are on track — nice work!</p>
            ) : (
              <div className="divide-y divide-border">
                {needsAttention.map(s => (
                  <div key={s.email} className="flex items-center justify-between py-3 gap-4">
                    <div>
                      <p className="text-sm font-medium">{s.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.completed}/{s.total} completed
                        {s.overdueModules.length > 0 && ` · Overdue: ${s.overdueModules.join(', ')}`}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      s.completed === 0
                        ? 'bg-red-500/15 text-red-700'
                        : 'bg-amber-500/15 text-amber-700'
                    }`}>
                      {s.reason}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
    </main>
  );
};

export default Reports;
