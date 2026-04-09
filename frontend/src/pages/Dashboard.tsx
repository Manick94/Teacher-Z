import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { datasetsApi, generateApi, imageUrl } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/ui/Toast'
import Spinner from '../components/ui/Spinner'
import type { Dataset, ImageItem } from '../types/a2ui'

const SUBJECT_COLORS: Record<string, string> = {
  science:   'from-emerald-400 to-teal-500',
  geography: 'from-sky-400 to-blue-500',
  history:   'from-amber-400 to-orange-500',
  math:      'from-violet-400 to-purple-500',
  art:       'from-pink-400 to-rose-500',
  english:   'from-cyan-400 to-blue-400',
}
const SUBJECT_ICONS: Record<string, string> = {
  science: '🔬', geography: '🌍', history: '📜',
  math: '📐', art: '🎨', english: '📝',
}
const SUBJECT_BG: Record<string, string> = {
  science: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  geography: 'bg-sky-50 text-sky-700 border-sky-200',
  history: 'bg-amber-50 text-amber-700 border-amber-200',
  math: 'bg-violet-50 text-violet-700 border-violet-200',
  art: 'bg-pink-50 text-pink-700 border-pink-200',
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

interface RecentLesson {
  uuid: string
  image_filename: string
  lesson_type: string
  subject: string | null
  grade_level: string | null
  model_used: string | null
  generation_time_ms: number | null
  created_at: string
  dataset_id: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [datasetImages, setDatasetImages] = useState<Record<string, ImageItem[]>>({})
  const [recentLessons, setRecentLessons] = useState<RecentLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [dsRes, lessonRes] = await Promise.all([
        datasetsApi.list(),
        generateApi.lessons(8, 0),
      ])
      setDatasets(dsRes.data)
      setRecentLessons(lessonRes.data as unknown as RecentLesson[])

      // Load preview images for first 4 datasets (3 images each)
      const previews: Record<string, ImageItem[]> = {}
      await Promise.all(
        dsRes.data.slice(0, 4).map(async (ds) => {
          try {
            const r = await datasetsApi.images(ds.name)
            previews[ds.name] = r.data.slice(0, 3)
          } catch { /* no images yet */ }
        })
      )
      setDatasetImages(previews)
    } catch {
      toast('Failed to load dashboard', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalImages = datasets.reduce((s, d) => s + d.image_count, 0)
  const avgTime = recentLessons.length
    ? Math.round(recentLessons.reduce((s, l) => s + (l.generation_time_ms || 0), 0) / recentLessons.length / 100) / 10
    : null

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Top header bar */}
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-slate-800 text-base">Dashboard</h1>
          <p className="text-xs text-slate-400 leading-none">Overview of your AI lesson library</p>
        </div>
        <button className="btn-primary text-xs" onClick={() => setShowCreate(true)}>
          + New Dataset
        </button>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Welcome hero */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 70% 50%, white 0%, transparent 60%)',
          }} />
          <div className="relative">
            <p className="text-blue-200 text-sm font-medium">{greeting()},</p>
            <h2 className="text-2xl font-bold mt-0.5">
              {user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Teacher'}
            </h2>
            <p className="text-blue-100 text-sm mt-2 max-w-md">
              Select a dataset below and click any image to generate an interactive AI lesson instantly.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="📁" label="Datasets" value={datasets.length} color="blue" />
          <StatCard icon="🖼️" label="Total Images" value={totalImages} color="emerald" />
          <StatCard icon="✨" label="Lessons Generated" value={recentLessons.length} color="violet" sub="recent" />
          <StatCard
            icon="⚡" label="Avg. Gen Time"
            value={avgTime ? `${avgTime}s` : '—'}
            color="amber"
            sub={avgTime ? 'per lesson' : 'no data yet'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Datasets grid (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Your Datasets</h2>
              <span className="text-xs text-slate-400">{datasets.length} dataset{datasets.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : datasets.length === 0 ? (
              <EmptyDatasets onAdd={() => setShowCreate(true)} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {datasets.map((ds) => (
                  <DatasetCard
                    key={ds.uuid}
                    dataset={ds}
                    previewImages={datasetImages[ds.name] || []}
                    onClick={() => navigate(`/datasets/${ds.name}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recent activity sidebar (1/3 width) */}
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-800">Recent Lessons</h2>
            {loading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : recentLessons.length === 0 ? (
              <div className="card p-5 text-center text-slate-400">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-xs">No lessons yet. Generate your first one!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentLessons.map((lesson) => (
                  <RecentLessonCard key={lesson.uuid} lesson={lesson} datasets={datasets} />
                ))}
              </div>
            )}

            {/* Quick tips */}
            <div className="card p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
              <p className="text-xs font-semibold text-amber-800 mb-2">💡 Tips</p>
              <ul className="space-y-1.5 text-xs text-amber-700">
                <li>• Drop real photos into <code className="bg-amber-100 px-1 rounded">data/datasets/</code></li>
                <li>• Choose <strong>Flashcard</strong> for vocabulary-heavy topics</li>
                <li>• Use <strong>Worksheet</strong> for fill-in-the-blank exercises</li>
                <li>• Cached lessons load instantly on revisit</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateDatasetModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
          toast={toast}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, color, sub,
}: { icon: string; label: string; value: number | string; color: string; sub?: string }) {
  const ring: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100',
    emerald: 'bg-emerald-50 border-emerald-100',
    violet: 'bg-violet-50 border-violet-100',
    amber: 'bg-amber-50 border-amber-100',
  }
  const val: Record<string, string> = {
    blue: 'text-blue-700', emerald: 'text-emerald-700',
    violet: 'text-violet-700', amber: 'text-amber-700',
  }
  return (
    <div className={`card p-4 border ${ring[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${val[color]}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function DatasetCard({ dataset, previewImages, onClick }: {
  dataset: Dataset; previewImages: ImageItem[]; onClick: () => void
}) {
  const key = (dataset.subject || '').toLowerCase()
  const gradient = SUBJECT_COLORS[key] || 'from-slate-400 to-slate-500'
  const bg = SUBJECT_BG[key] || 'bg-slate-50 text-slate-600 border-slate-200'

  return (
    <button
      className="card text-left hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden"
      onClick={onClick}
    >
      {/* Image strip / gradient header */}
      <div className={`h-20 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
        {previewImages.length > 0 ? (
          <div className="flex h-full gap-0.5">
            {previewImages.map((img) => (
              <img
                key={img.filename}
                src={imageUrl(dataset.name, img.filename)}
                alt=""
                className="h-full flex-1 object-cover opacity-80"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center opacity-40">
            <span className="text-4xl">{SUBJECT_ICONS[key] || '📁'}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-2 left-3 text-white">
          <span className="text-lg">{SUBJECT_ICONS[key] || '📁'}</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition-colors leading-tight">
            {dataset.display_name || dataset.name}
          </h3>
          {dataset.subject && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${bg}`}>
              {dataset.subject}
            </span>
          )}
        </div>
        {dataset.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{dataset.description}</p>
        )}
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100">
          <span className="text-xs text-slate-400">{dataset.image_count} images</span>
          {dataset.grade_level && (
            <span className="text-xs text-slate-400">· Grade {dataset.grade_level}</span>
          )}
          <span className="ml-auto text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            Open →
          </span>
        </div>
      </div>
    </button>
  )
}

function RecentLessonCard({ lesson, datasets }: { lesson: RecentLesson; datasets: Dataset[] }) {
  const ds = datasets.find((d) => d.id === lesson.dataset_id)
  const typeIcons: Record<string, string> = {
    lesson: '📖', quiz: '✏️', flashcard: '🃏', worksheet: '📋', vocabulary: '📚',
  }
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <div className="card px-3 py-2.5 hover:border-blue-200 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-base shrink-0">{typeIcons[lesson.lesson_type] || '📄'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-700 truncate">
            {lesson.image_filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')}
          </p>
          <p className="text-xs text-slate-400">
            {ds?.name} · {lesson.lesson_type} · {timeAgo(lesson.created_at)}
          </p>
        </div>
        {lesson.generation_time_ms && (
          <span className="text-xs text-slate-300 shrink-0 font-mono">
            {(lesson.generation_time_ms / 1000).toFixed(1)}s
          </span>
        )}
      </div>
    </div>
  )
}

function EmptyDatasets({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card p-10 text-center border-dashed">
      <div className="text-5xl mb-3">📚</div>
      <h3 className="font-semibold text-slate-700 mb-1">No datasets yet</h3>
      <p className="text-sm text-slate-500 mb-5 max-w-xs mx-auto">
        A dataset is a folder of images. Teacher-Z reads them locally and generates interactive lessons.
      </p>
      <button className="btn-primary" onClick={onAdd}>+ Create your first dataset</button>
    </div>
  )
}

function CreateDatasetModal({
  onClose, onCreated, toast,
}: {
  onClose: () => void
  onCreated: () => void
  toast: (msg: string, type?: any, detail?: string) => void
}) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await datasetsApi.create({
        name: name.toLowerCase().replace(/\s+/g, '_'),
        display_name: displayName || undefined,
        subject: subject || undefined,
        grade_level: grade || undefined,
        description: description || undefined,
      })
      toast('Dataset created!', 'success', `Folder: data/datasets/${name}`)
      onCreated()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create dataset')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm">📁</span>
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">New Dataset</h2>
            <p className="text-xs text-slate-400">Link a folder of images to Teacher-Z</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Folder Name <span className="text-red-400">*</span></label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="science_grade5" pattern="[a-z0-9_-]+" required />
            <p className="text-xs text-slate-400 mt-0.5">
              Maps to <code className="bg-slate-100 px-1 rounded">data/datasets/{name || '…'}/</code>
            </p>
          </div>
          <div>
            <label className="label">Display Name</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Science — Grade 5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Subject</label>
              <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">Select…</option>
                {['science','geography','history','math','art','english'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Grade Level</label>
              <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">Any</option>
                {['K','1','2','3','4','5','6','7','8','9','10','11','12'].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} value={description}
              onChange={(e) => setDescription(e.target.value)} placeholder="Optional description…" />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading && <Spinner size="sm" />} Create Dataset
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
