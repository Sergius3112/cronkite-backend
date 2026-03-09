import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface KeyClaim {
  claim: string;
  verified: boolean;
  source: string;
}

interface WordFlag {
  word: string;
  flag_type: 'loaded' | 'misleading' | 'emotional';
  explanation: string;
}

export interface AnalysisData {
  title?: string;
  source?: string;
  summary?: string;
  content_type?: string;
  credibility_score?: number;
  overall_credibility_score?: number;
  bias_direction?: number;
  bias_intensity?: number;
  persuasion_techniques?: string[];
  key_claims?: KeyClaim[];
  word_analysis?: WordFlag[];
  focus_areas?: string[];
  age_appropriateness?: string;
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
};

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

export function ArticleAnalysisCard({ analysis }: { analysis: AnalysisData }) {
  const score = analysis.credibility_score ?? analysis.overall_credibility_score ?? 0;
  const bias = analysis.bias_direction ?? 0;

  return (
    <div className="space-y-5 text-sm">
      {analysis.summary && (
        <p className="text-muted-foreground text-xs leading-relaxed">{analysis.summary}</p>
      )}

      <div className="space-y-3">
        <CredibilityBar score={score} />
        <BiasBar direction={bias} />
      </div>

      {analysis.persuasion_techniques && analysis.persuasion_techniques.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2">Persuasion Techniques</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.persuasion_techniques.map((t, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
            ))}
          </div>
        </div>
      )}

      {analysis.key_claims && analysis.key_claims.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2">Key Claims</p>
          <div className="space-y-2">
            {analysis.key_claims.map((c, i) => (
              <div key={i} className="flex gap-2 items-start">
                {c.verified
                  ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                }
                <div className="min-w-0">
                  <p className="text-xs">{c.claim}</p>
                  {c.source && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Source: {c.source}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {analysis.age_appropriateness && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Age Group:</span>
          <Badge variant="secondary" className="text-[10px] uppercase">
            {analysis.age_appropriateness}
          </Badge>
        </div>
      )}
    </div>
  );
}
