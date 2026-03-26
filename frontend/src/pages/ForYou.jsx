export default function ForYou() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '500px', textAlign: 'center', padding: '60px 32px' }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', fontWeight: 700, color: '#1A1714', marginBottom: '12px' }}>
        Cronkite<span style={{ color: 'rgb(196,30,58)' }}>.</span>
      </div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 700, marginBottom: '10px', color: '#1A1714' }}>For You</h2>
      <p style={{ fontSize: '14px', color: '#7A746E', maxWidth: '320px', marginBottom: '20px', lineHeight: 1.6 }}>
        AI-suggested articles matched to your active modules. Cronkite finds the news so you don't have to.
      </p>
      <span style={{ background: '#1A1714', color: '#F7F3EC', borderRadius: '20px', padding: '4px 14px', fontSize: '12px', fontWeight: 500 }}>Coming soon</span>
    </div>
  )
}
