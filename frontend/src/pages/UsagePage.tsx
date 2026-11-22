import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Profile {
  plan: string
  runs_this_month: number
  runs_reset_at: string
}

export default function UsagePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { navigate('/'); return }
      const { data, error } = await supabase
        .from('profiles')
        .select('plan, runs_this_month, runs_reset_at')
        .eq('id', user.id)
        .single()
      if (error) console.error('Profile fetch error:', error)
      setProfile(data)
      setLoading(false)
    })
  }, [navigate])

  const limit = profile?.plan === 'free' ? 500 : Infinity
  const used = profile?.runs_this_month ?? 0
  const pct = limit === Infinity ? 0 : Math.min(100, (used / limit) * 100)
  const resetDate = profile?.runs_reset_at
    ? new Date(profile.runs_reset_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  return (
    <div style={{ minHeight: '100%', background: '#0a0a14', color: '#f9fafb' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '48px 32px' }}>

        <button onClick={() => navigate('/')}
          style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, marginBottom: 24, padding: 0 }}>
          ← Back to Dashboard
        </button>

        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Usage</h1>
        <p style={{ color: '#4b5563', fontSize: 14, marginBottom: 36 }}>Your plan and run usage for this month</p>

        {loading && <p style={{ color: '#4b5563' }}>Loading…</p>}

        {!loading && profile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Plan tier */}
            <div style={{ background: '#0c0c1e', border: '1px solid #17172e', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 11, color: '#4b5563', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Plan</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: profile.plan === 'free' ? '#a78bfa' : '#f59e0b' }}>
                  {profile.plan === 'free' ? 'Free' : 'Pro'}
                </span>
                {profile.plan === 'free' && (
                  <span style={{ fontSize: 11, background: '#7c3aed22', color: '#a78bfa', border: '1px solid #7c3aed33', borderRadius: 20, padding: '2px 10px' }}>
                    500 runs / month
                  </span>
                )}
              </div>
            </div>

            {/* Runs meter */}
            <div style={{ background: '#0c0c1e', border: '1px solid #17172e', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 11, color: '#4b5563', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Runs This Month</div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: pct >= 90 ? '#ef4444' : '#f9fafb' }}>{used}</span>
                <span style={{ fontSize: 14, color: '#4b5563' }}>/ {limit === Infinity ? '∞' : limit}</span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 8, background: '#17172e', borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  borderRadius: 99,
                  background: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#7c3aed',
                  transition: 'width 0.4s ease',
                }} />
              </div>

              <div style={{ fontSize: 12, color: '#4b5563' }}>
                Resets on <span style={{ color: '#9ca3af' }}>{resetDate}</span>
              </div>
            </div>

            {/* Upgrade CTA — only for free */}
            {profile.plan === 'free' && (
              <div style={{ background: '#17172e', border: '1px solid #7c3aed33', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Need more runs?</div>
                  <div style={{ fontSize: 12, color: '#4b5563' }}>Pro plan — unlimited runs, priority support</div>
                </div>
                <button style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Upgrade →
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}