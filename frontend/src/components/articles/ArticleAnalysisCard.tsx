import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface PersuasionTechnique {
  technique: string;
  example: string;
  explanation: string;
}

interface KeyClaim {
  claim: string;
  verdict?: 'verified' | 'unverified' | 'misleading' | 'false';
  verified?: boolean; // legacy
  evidence?: string;
  source: string;
}

interface WordFlag {
  word: string;
  flag_type: 'loaded' | 'misleading' | 'emotional' | 'euphemism' | 'dysphemism' | 'marked';
  explanation: string;
}

interface CreatorProfile {
  name: string;
  history: string;
  political_leaning: string;
  credibility_impact: string;
}

interface SourceProfile {
  name: string;
  ownership: string;
  editorial_stance: string;
  track_record: string;
  credibility_impact: string;
}

export interface AnalysisData {
  title?: string;
  source?: string;
  author?: string;
  summary?: string;
  content_type?: string;
  credibility_score?: number;
  overall_credibility_score?: number;
  credibility_reasoning?: string;
  goal?: string;
  technique?: string;
  conclusion?: string;
  bias_direction?: number;
  bias_intensity?: number;
  bias_reasoning?: string;
  creator_profile?: CreatorProfile;
  source_profile?: SourceProfile;
  persuasion_techniques?: (PersuasionTechnique | string)[];
  key_claims?: KeyClaim[];
  word_analysis?: WordFlag[];
  narrative_framing?: string;
  classroom_discussion_questions?: string[];
  focus_areas?: string[];
  age_appropriateness?: string;
  reading_level?: string;
  report_summary?: string;
  [key: string]: unknown;
}

const FOCUS_LABELS: Record<string, string> = {
  evaluating_content: 'Evaluating Content',
  persuasion_techniques: 'Persuasion Techniques',
  online_behaviour: 'Online Behaviour',
  identifying_risks: 'Identifying Risks',
  managing_information: 'Managing Information',
};

const FLAG_COLORS: Record<string, string> = {
  loaded: 'bg-red-100 text-red-700 border-red-200',
  misleading: 'bg-orange-100 text-orange-700 border-orange-200',
  emotional: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  euphemism: 'bg-purple-100 text-purple-700 border-purple-200',
  dysphemism: 'bg-pink-100 text-pink-700 border-pink-200',
  marked: 'bg-blue-100 text-blue-700 border-blue-200',
};

const VERDICT_CONFIG = {
  verified:   { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', Icon: CheckCircle,  iconClass: 'text-emerald-500', label: 'Verified' },
  unverified: { color: 'bg-amber-100 text-amber-700 border-amber-200',       Icon: AlertCircle,  iconClass: 'text-amber-500',   label: 'Unverified' },
  misleading: { color: 'bg-orange-100 text-orange-700 border-orange-200',    Icon: AlertCircle,  iconClass: 'text-orange-500',  label: 'Misleading' },
  false:      { color: 'bg-red-100 text-red-700 border-red-200',             Icon: XCircle,      iconClass: 'text-red-500',     label: 'False' },
} as const;

function getVerdictConfig(claim: KeyClaim) {
  if (claim.verdict && claim.verdict in VERDICT_CONFIG) return VERDICT_CONFIG[claim.verdict];
  if (claim.verified === true) return VERDICT_CONFIG.verified;
  if (claim.verified === false) return VERDICT_CONFIG.false;
  return VERDICT_CONFIG.unverified;
}

function CredibilityBar({ score }: { score: number }) {
  const barColor = score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = score >= 75 ? 'text-emerald-700' : score >= 50 ? 'text-amber-700' : 'text-red-700';
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">Credibility Score</span>
        <span className={`text-sm font-bold ${textColor}`}>{score}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function BiasBar({ direction }: { direction: number }) {
  const pct = ((direction + 100) / 200) * 100;
  const label = direction < -30 ? 'Left-leaning' : direction > 30 ? 'Right-leaning' : 'Centre';
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">Political Bias</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="relative h-2 bg-gradient-to-r from-blue-400 via-muted to-red-400 rounded-full">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-foreground rounded-full border-2 border-background shadow"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Left</span>
        <span>Right</span>
      </div>
    </div>
  );
}

function ExpandablePanel({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted text-xs font-semibold text-left transition-colors"
      >
        {title}
        {open
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>
      {open && <div className="px-3 py-2.5 space-y-2.5">{children}</div>}
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-xs leading-relaxed">{value}</p>
    </div>
  );
}

export function ArticleAnalysisCard({ analysis }: { analysis: AnalysisData }) {
  const score = analysis.credibility_score ?? analysis.overall_credibility_score ?? 0;
  const bias = analysis.bias_direction ?? 0;

  return (
    <div className="space-y-5 text-sm">

      {/* Credibility & Bias — top */}
      <div className="space-y-3">
        <CredibilityBar score={score} />
        {analysis.credibility_reasoning && (
          <p className="text-[10px] text-muted-foreground leading-relaxed italic">{analysis.credibility_reasoning}</p>
        )}
        <BiasBar direction={bias} />
        {analysis.bias_reasoning && (
          <p className="text-[10px] text-muted-foreground leading-relaxed italic">{analysis.bias_reasoning}</p>
        )}
      </div>

      {/* Editorial Summary */}
      {analysis.report_summary && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3.5 py-3">
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Editorial Summary</p>
          <p className="text-xs text-amber-900 leading-relaxed">{analysis.report_summary}</p>
        </div>
      )}

      {/* Analytical Summary */}
      {analysis.summary && (
        <p className="text-muted-foreground text-xs leading-relaxed">{analysis.summary}</p>
      )}

      {/* Critical Analysis — Goal / Technique / Conclusion */}
      {(analysis.goal || analysis.technique || analysis.conclusion) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold">Critical Analysis</p>
          {analysis.goal && (
            <div className="bg-muted/40 rounded px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Goal</p>
              <p className="text-xs leading-relaxed">{analysis.goal}</p>
            </div>
          )}
          {analysis.technique && (
            <div className="bg-muted/40 rounded px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Technique</p>
              <p className="text-xs leading-relaxed">{analysis.technique}</p>
            </div>
          )}
          {analysis.conclusion && (
            <div className="bg-muted/40 rounded px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Conclusion</p>
              <p className="text-xs leading-relaxed">{analysis.conclusion}</p>
            </div>
          )}
        </div>
      )}

      {/* Creator Profile */}
      {analysis.creator_profile && (
        <ExpandablePanel title={`Creator: ${analysis.creator_profile.name || 'Unknown'}`}>
          {analysis.creator_profile.history && (
            <ProfileField label="Background" value={analysis.creator_profile.history} />
          )}
          {analysis.creator_profile.political_leaning && (
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Leaning:</p>
              <Badge variant="secondary" className="text-[10px] capitalize">{analysis.creator_profile.political_leaning}</Badge>
            </div>
          )}
          {analysis.creator_profile.credibility_impact && (
            <ProfileField label="Credibility Impact" value={analysis.creator_profile.credibility_impact} />
          )}
        </ExpandablePanel>
      )}

      {/* Source Profile */}
      {analysis.source_profile && (
        <ExpandablePanel title={`Source: ${analysis.source_profile.name || analysis.source || 'Unknown'}`}>
          {analysis.source_profile.ownership && (
            <ProfileField label="Ownership" value={analysis.source_profile.ownership} />
          )}
          {analysis.source_profile.editorial_stance && (
            <ProfileField label="Editorial Stance" value={analysis.source_profile.editorial_stance} />
          )}
          {analysis.source_profile.track_record && (
            <ProfileField label="Track Record" value={analysis.source_profile.track_record} />
          )}
          {analysis.source_profile.credibility_impact && (
            <ProfileField label="Credibility Impact" value={analysis.source_profile.credibility_impact} />
          )}
        </ExpandablePanel>
      )}

      {/* Persuasion Techniques */}
      {analysis.persuasion_techniques && analysis.persuasion_techniques.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2">Persuasion Techniques</p>
          <div className="space-y-2">
            {analysis.persuasion_techniques.map((t, i) =>
              typeof t === 'string' ? (
                <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
              ) : (
                <div key={i} className="border border-border rounded px-3 py-2 space-y-1">
                  <p className="text-[10px] font-semibold">{t.technique}</p>
                  {t.example && <p className="text-[10px] text-muted-foreground italic">"{t.example}"</p>}
                  {t.explanation && <p className="text-[10px] leading-relaxed">{t.explanation}</p>}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Key Claims */}
      {analysis.key_claims && analysis.key_claims.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2">Key Claims</p>
          <div className="space-y-2">
            {analysis.key_claims.map((c, i) => {
              const vc = getVerdictConfig(c);
              const { Icon } = vc;
              return (
                <div key={i} className="border border-border rounded px-3 py-2 space-y-1">
                  <div className="flex gap-2 items-start">
                    <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${vc.iconClass}`} />
                    <div className="min-w-0 flex-1">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border mb-1 ${vc.color}`}>
                        {vc.label}
                      </span>
                      <p className="text-xs">{c.claim}</p>
                    </div>
                  </div>
                  {c.evidence && (
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      <span className="font-semibold">Evidence:</span> {c.evidence}
                    </p>
                  )}
                  {c.source && (
                    <p className="text-[10px] text-muted-foreground">
                      <span className="font-semibold">Source:</span> {c.source}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Flagged Language */}
      {analysis.word_analysis && analysis.word_analysis.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2">Flagged Language</p>
          <div className="space-y-1.5">
            {analysis.word_analysis.map((w, i) => (
              <div key={i} className="flex gap-2 items-start">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border mr-1.5 ${FLAG_COLORS[w.flag_type] ?? 'bg-muted text-muted-foreground'}`}>
                    {w.word}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{w.explanation}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative Framing */}
      {analysis.narrative_framing && (
        <div>
          <p className="text-xs font-semibold mb-1.5">Narrative Framing</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{analysis.narrative_framing}</p>
        </div>
      )}

      {/* Classroom Discussion Questions */}
      {analysis.classroom_discussion_questions && analysis.classroom_discussion_questions.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1.5">Classroom Discussion Questions</p>
          <ol className="space-y-1.5 list-none">
            {analysis.classroom_discussion_questions.map((q, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
                <p className="text-xs leading-relaxed">{q}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Focus Areas */}
      {analysis.focus_areas && analysis.focus_areas.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1.5">Focus Areas</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.focus_areas.map(fa => (
              <Badge key={fa} variant="outline" className="text-[10px]">
                {FOCUS_LABELS[fa] ?? fa}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Age & Reading Level */}
      <div className="flex items-center gap-3 flex-wrap">
        {analysis.age_appropriateness && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Age Group:</span>
            <Badge variant="secondary" className="text-[10px] uppercase">{analysis.age_appropriateness}</Badge>
          </div>
        )}
        {analysis.reading_level && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Reading Level:</span>
            <Badge variant="secondary" className="text-[10px] capitalize">{analysis.reading_level}</Badge>
          </div>
        )}
      </div>

    </div>
  );
}
