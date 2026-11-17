import { useNavigate } from 'react-router-dom'
import AuthPage from '../components/AuthPage'
import { useState } from 'react'

export default function LandingPage() {
  const [showAuth, setShowAuth] = useState(false)

  if (showAuth) return <AuthPage />

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 48px', borderBottom: '1px solid #1a1a2e' }}>
        <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 22 }}>Agentra</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setShowAuth(true)}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #2a2a4a', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 14 }}>
            Sign In
          </button>
          <button onClick={() => setShowAuth(true)}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Get Started Free
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 20, padding: '6px 16px', fontSize: 13, color: '#a78bfa', marginBottom: 32 }}>
          Visual · Model-agnostic · Free to start
        </div>
        <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1, marginBottom: 24, background: 'linear-gradient(135deg, #f9fafb, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Build AI Agents<br />Without Code
        </h1>
        <p style={{ fontSize: 20, color: '#6b7280', marginBottom: 48, lineHeight: 1.6 }}>
          Draw a workflow, connect tools, deploy in one click.<br />
          No code. No lock-in. No limits.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setShowAuth(true)}
            style={{ padding: '14px 36px', borderRadius: 10, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>
            Start Building Free →
          </button>
          <button
            style={{ padding: '14px 36px', borderRadius: 10, border: '1px solid #2a2a4a', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 16 }}>
            See Examples
          </button>
        </div>
      </div>

      {/* Features */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 100px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        {[
          { icon: '🎨', title: 'Visual Canvas', desc: 'Drag, drop, and connect nodes to build any agent workflow.' },
          { icon: '🔌', title: '10+ Integrations', desc: 'Web search, Gmail, Slack, Telegram, Google Sheets and more.' },
          { icon: '🚀', title: 'One-Click Deploy', desc: 'Deploy as REST API, chat widget, or Telegram bot instantly.' },
          { icon: '🧠', title: 'Model Agnostic', desc: 'Use Groq, Gemini, OpenAI — swap models without rewriting anything.' },
          { icon: '🏪', title: 'Marketplace', desc: 'Share, fork, and monetize agents with the community.' },
          { icon: '🔍', title: 'Full Observability', desc: 'Every run is fully inspectable with token-level traces.' },
        ].map(f => (
          <div key={f.title} style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{f.title}</div>
            <div style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}