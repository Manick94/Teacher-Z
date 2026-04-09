import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { datasetsApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import type { Dataset } from '../../types/a2ui'

const SUBJECT_ICONS: Record<string, string> = {
  science: '🔬', geography: '🌍', history: '📜',
  math: '📐', art: '🎨', english: '📝',
}

interface AIStatus {
  provider: string
  model: string
  ok: boolean
  latencyMs?: number
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Load datasets for sidebar nav
  useEffect(() => {
    datasetsApi.list().then((r) => setDatasets(r.data)).catch(() => {})
  }, [])

  // Poll AI status every 15s
  useEffect(() => {
    const check = async () => {
      try {
        const t0 = Date.now()
        const r = await fetch('/health')
        const d = await r.json()
        setAiStatus({
          provider: d.llm_provider,
          model: d.llm_provider === 'ollama' ? 'Ollama' : d.llm_provider === 'local_transformers' ? 'TinyLlama' : 'Stub',
          ok: d.status === 'ok',
          latencyMs: Date.now() - t0,
        })
      } catch {
        setAiStatus({ provider: 'unknown', model: '—', ok: false })
      }
    }
    check()
    const t = setInterval(check, 15000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`flex flex-col bg-white border-r border-slate-200 transition-all duration-300 shrink-0
        ${sidebarOpen ? 'w-56' : 'w-14'}`}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 h-14 border-b border-slate-100">
          <button
            className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 hover:bg-blue-700 transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <span className="text-white font-bold text-sm">Z</span>
          </button>
          {sidebarOpen && (
            <div>
              <p className="font-bold text-slate-800 leading-none text-sm">Teacher-Z</p>
              <p className="text-xs text-slate-400 leading-none mt-0.5">AI Lesson Studio</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <SidebarLink to="/" icon="🏠" label="Dashboard" open={sidebarOpen} end />

          {datasets.length > 0 && (
            <>
              {sidebarOpen && (
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2 pt-4 pb-1">
                  Datasets
                </p>
              )}
              {datasets.map((ds) => (
                <SidebarLink
                  key={ds.uuid}
                  to={`/datasets/${ds.name}`}
                  icon={SUBJECT_ICONS[ds.subject?.toLowerCase() || ''] || '📁'}
                  label={ds.display_name || ds.name}
                  badge={String(ds.image_count)}
                  open={sidebarOpen}
                />
              ))}
            </>
          )}
        </nav>

        {/* AI Status */}
        <div className={`border-t border-slate-100 px-3 py-3 ${sidebarOpen ? '' : 'flex justify-center'}`}>
          {sidebarOpen ? (
            <div className="bg-slate-50 rounded-lg p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${aiStatus?.ok ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />
                <span className="text-xs font-medium text-slate-600">AI Engine</span>
              </div>
              <p className="text-xs text-slate-500">
                {aiStatus?.provider ?? '…'} · {aiStatus?.model ?? '…'}
              </p>
              {aiStatus?.latencyMs && (
                <p className="text-xs text-slate-400 mt-0.5">{aiStatus.latencyMs}ms latency</p>
              )}
            </div>
          ) : (
            <span title={`AI: ${aiStatus?.ok ? 'OK' : 'Error'}`}
              className={`w-2.5 h-2.5 rounded-full mt-1 ${aiStatus?.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
          )}
        </div>

        {/* User */}
        <div className={`border-t border-slate-100 px-3 py-3 flex items-center gap-2 ${!sidebarOpen && 'justify-center'}`}>
          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs">
            {(user?.full_name || user?.email || '?')[0].toUpperCase()}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{user?.full_name || user?.email}</p>
              <button className="text-xs text-slate-400 hover:text-red-500 transition-colors" onClick={logout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function SidebarLink({
  to, icon, label, badge, open, end = false,
}: {
  to: string; icon: string; label: string; badge?: string; open: boolean; end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors group relative
        ${isActive
          ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
        } ${!open && 'justify-center'}`
      }
      title={!open ? label : undefined}
    >
      <span className="text-base shrink-0">{icon}</span>
      {open && (
        <>
          <span className="flex-1 truncate text-xs">{label}</span>
          {badge && (
            <span className="text-xs bg-slate-200 text-slate-500 rounded-full px-1.5 py-0.5 font-mono leading-none">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}
