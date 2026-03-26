import { useEffect, useState } from 'react';
import { FileText, ExternalLink } from 'lucide-react';

type Briefing = {
  id: string;
  date: string;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

export default function Updates() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/daily-briefings')
      .then(r => r.json())
      .then(data => { setBriefings(data.briefings || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: '22px' }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 700, letterSpacing: '-0.3px', marginBottom: '4px', color: '#1A1714' }}>
          Daily Briefing
        </h2>
        <p style={{ fontSize: '13px', color: '#7A746E' }}>
          Every morning's briefing — archived and ready to use in class
        </p>
      </div>

      {loading && (
        <div style={{ fontSize: '13px', color: '#B0A89E', padding: '20px 0' }}>Loading briefings…</div>
      )}

      {!loading && briefings.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: '#1A1714', marginBottom: '6px' }}>No briefings yet</div>
          <div style={{ fontSize: '13px', color: '#B0A89E' }}>Briefings will appear here once the daily scheduler is active.</div>
        </div>
      )}

      {!loading && briefings.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid rgba(26,23,20,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
          {briefings.map((b, i) => (
            <a
              key={b.id}
              href={`/briefing/${b.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 18px',
                borderBottom: i < briefings.length - 1 ? '1px solid rgba(26,23,20,0.05)' : 'none',
                textDecoration: 'none', color: 'inherit',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F7F3EC')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#1A1714', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText style={{ width: '14px', height: '14px', color: '#F7F3EC' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1A1714', marginBottom: '2px' }}>
                  Cronkite Daily Briefing
                </div>
                <div style={{ fontSize: '11px', color: '#7A746E' }}>{formatDate(b.date)}</div>
              </div>
              <ExternalLink style={{ width: '13px', height: '13px', color: '#B0A89E', flexShrink: 0 }} />
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
