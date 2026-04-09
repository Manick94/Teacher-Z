import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { datasetsApi, generateApi, imageUrl } from '../lib/api'
import { useToast } from '../components/ui/Toast'
import AIProgress from '../components/ui/AIProgress'
import Spinner from '../components/ui/Spinner'
import A2UIRenderer from '../components/A2UIRenderer'
import type { A2UIDocument, Dataset, ImageItem } from '../types/a2ui'

type LessonType = 'lesson' | 'quiz' | 'flashcard' | 'worksheet' | 'vocabulary'
type ViewMode = 'grid' | 'list'

const LESSON_TYPES: { type: LessonType; icon: string; label: string; desc: string }[] = [
  { type: 'lesson',     icon: '📖', label: 'Full Lesson',  desc: 'Objectives, vocab, quiz, discussion' },
  { type: 'quiz',       icon: '✏️', label: 'Quiz',         desc: 'Multiple choice questions' },
  { type: 'flashcard',  icon: '🃏', label: 'Flashcards',   desc: 'Flip-card vocabulary deck' },
  { type: 'worksheet',  icon: '📋', label: 'Worksheet',    desc: 'Fill-in-the-blank exercises' },
  { type: 'vocabulary', icon: '📚', label: 'Vocabulary',   desc: 'Word bank + matching' },
]

interface GenMeta {
  caption: string; captionMethod: string; model: string
  timeMs: number; cached: boolean; lessonId: string
}

export default function DatasetExplorer() {
  const { name } = useParams<{ name: string }>()
  const { toast } = useToast()

  // Dataset state
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [images, setImages] = useState<ImageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // Generation state
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [lessonType, setLessonType] = useState<LessonType>('lesson')
  const [gradeLevel, setGradeLevel] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [genMeta, setGenMeta] = useState<GenMeta | null>(null)
  const [a2uiDoc, setA2uiDoc] = useState<A2UIDocument | null>(null)

  const lessonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!name) return
    datasetsApi.get(name)
      .then((r) => {
        setDataset(r.data)
        setImages(r.data.images || [])
        setGradeLevel(r.data.grade_level || '')
      })
      .catch(() => toast('Failed to load dataset', 'error'))
      .finally(() => setLoading(false))
  }, [name])

  const filteredImages = images.filter((img) =>
    img.filename.toLowerCase().includes(search.toLowerCase())
  )

  const generate = async (regenerate = false) => {
    if (!selectedImage || !name) return
    setGenerating(true)
    setGenError('')
    setA2uiDoc(null)
    setGenMeta(null)
    try {
      const { data } = await generateApi.generate({
        dataset_name: name,
        image_filename: selectedImage,
        lesson_type: lessonType,
        grade_level: gradeLevel || undefined,
        subject: dataset?.subject || undefined,
        regenerate,
      })
      setA2uiDoc(data.a2ui_schema)
      setGenMeta({
        caption: data.caption,
        captionMethod: data.caption_method,
        model: data.model_used,
        timeMs: data.generation_time_ms,
        cached: data.cached,
        lessonId: data.lesson_id,
      })
      toast(
        data.cached ? 'Loaded from cache' : 'Lesson generated!',
        'success',
        `${data.generation_time_ms}ms · ${data.model_used}`
      )
      setTimeout(() => lessonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Generation failed'
      setGenError(msg)
      toast(msg, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handlePrint = () => window.print()

  const copyLessonId = () => {
    if (genMeta?.lessonId) {
      navigator.clipboard.writeText(genMeta.lessonId)
      toast('Lesson ID copied', 'info')
    }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading dataset…</p>
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Sticky header */}
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center gap-3 shrink-0 sticky top-0 z-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-slate-800 text-base truncate">
              {dataset?.display_name || name}
            </h1>
            {dataset?.subject && (
              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 font-medium shrink-0">
                {dataset.subject}
              </span>
            )}
            {dataset?.grade_level && (
              <span className="text-xs text-slate-400 shrink-0">Grade {dataset.grade_level}</span>
            )}
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          <input
            className="input pl-7 w-48 text-xs h-8"
            placeholder="Search images…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* View toggle */}
        <div className="flex border border-slate-200 rounded-lg overflow-hidden">
          {(['grid','list'] as ViewMode[]).map((m) => (
            <button key={m}
              className={`px-2.5 py-1.5 text-xs transition-colors ${viewMode === m ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              onClick={() => setViewMode(m)}>
              {m === 'grid' ? '⊞' : '≡'}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 shrink-0">
          {filteredImages.length}/{images.length} images
        </span>
      </header>

      {/* Body: two-panel layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left panel: image browser + generation controls */}
        <div className="flex flex-col w-full xl:w-[55%] min-h-0 overflow-hidden border-r border-slate-200">
          {/* Image gallery */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredImages.length === 0 ? (
              <EmptyGallery search={search} datasetName={name!} />
            ) : viewMode === 'grid' ? (
              <GridView images={filteredImages} selected={selectedImage} onSelect={setSelectedImage} datasetName={name || ''} />
            ) : (
              <ListView images={filteredImages} selected={selectedImage} onSelect={setSelectedImage} datasetName={name || ''} />
            )}
          </div>

          {/* Generation controls (sticky bottom) */}
          {selectedImage && (
            <div className="shrink-0 border-t border-slate-200 bg-white p-4">
              <ControlsPanel
                selectedImage={selectedImage}
                lessonType={lessonType}
                setLessonType={setLessonType}
                gradeLevel={gradeLevel}
                setGradeLevel={setGradeLevel}
                generating={generating}
                hasResult={!!a2uiDoc}
                onGenerate={() => generate(false)}
                onRegenerate={() => generate(true)}
              />
            </div>
          )}
        </div>

        {/* Right panel: AI progress + lesson output */}
        <div ref={lessonRef} className="hidden xl:flex flex-col flex-1 min-h-0 overflow-y-auto bg-slate-50">
          {/* AI progress (shown while generating) */}
          {(generating || genError) && (
            <div className="p-4">
              <AIProgress
                active={generating}
                error={genError || undefined}
                modelName={dataset?.subject ? `ollama::tinyllama` : undefined}
              />
            </div>
          )}

          {/* Lesson output */}
          {!generating && a2uiDoc && (
            <div className="p-4 space-y-4">
              {/* Lesson banner */}
              <LessonBanner
                doc={a2uiDoc}
                meta={genMeta}
                onPrint={handlePrint}
                onCopyId={copyLessonId}
                onRegenerate={() => generate(true)}
              />
              {/* A2UI rendered lesson */}
              <div className="print-area">
                <A2UIRenderer document={a2uiDoc} />
              </div>
            </div>
          )}

          {/* Empty states */}
          {!generating && !a2uiDoc && !genError && (
            <div className="flex-1 flex items-center justify-center p-8">
              {selectedImage ? (
                <EmptyLesson />
              ) : (
                <SelectImagePrompt />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: lesson panel below (shown after generation) */}
      {(generating || a2uiDoc || genError) && (
        <div className="xl:hidden border-t border-slate-200 bg-slate-50 overflow-y-auto max-h-[60vh]">
          {generating && <div className="p-4"><AIProgress active={generating} error={genError || undefined} /></div>}
          {!generating && a2uiDoc && (
            <div className="p-4 space-y-4">
              <LessonBanner doc={a2uiDoc} meta={genMeta} onPrint={handlePrint} onCopyId={copyLessonId} onRegenerate={() => generate(true)} />
              <A2UIRenderer document={a2uiDoc} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GridView({ images, selected, onSelect, datasetName }: { images: ImageItem[]; selected: string | null; onSelect: (f: string) => void; datasetName: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {images.map((img) => (
        <button
          key={img.filename}
          onClick={() => onSelect(img.filename)}
          className={`group rounded-xl overflow-hidden border-2 text-left transition-all duration-150
            ${selected === img.filename
              ? 'border-blue-500 ring-2 ring-blue-200 shadow-md scale-[1.02]'
              : 'border-slate-200 hover:border-blue-300 hover:shadow-md'}`}
        >
          <div className="aspect-square bg-slate-100 overflow-hidden relative">
            <img
              src={imageUrl(datasetName, img.filename)}
              alt={img.filename}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src =
                  `https://placehold.co/200x200/e2e8f0/94a3b8?text=${encodeURIComponent(img.filename.split('.')[0])}`
              }}
            />
            {selected === img.filename && (
              <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              </div>
            )}
          </div>
          <div className="px-2 py-1.5 bg-white">
            <p className="text-xs text-slate-600 truncate font-medium" title={img.filename}>
              {img.filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')}
            </p>
            <p className="text-xs text-slate-400">{(img.size_bytes / 1024).toFixed(0)} KB</p>
          </div>
        </button>
      ))}
    </div>
  )
}

function ListView({ images, selected, onSelect, datasetName }: { images: ImageItem[]; selected: string | null; onSelect: (f: string) => void; datasetName: string }) {
  return (
    <div className="space-y-1">
      {images.map((img) => (
        <button
          key={img.filename}
          onClick={() => onSelect(img.filename)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all
            ${selected === img.filename
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'}`}
        >
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
            <img src={imageUrl(datasetName, img.filename)} alt="" className="w-full h-full object-cover"
              onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">
              {img.filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')}
            </p>
            <p className="text-xs text-slate-400">{img.filename} · {(img.size_bytes / 1024).toFixed(0)} KB</p>
          </div>
          {selected === img.filename && (
            <span className="shrink-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">✓</span>
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function ControlsPanel({
  selectedImage, lessonType, setLessonType, gradeLevel, setGradeLevel,
  generating, hasResult, onGenerate, onRegenerate,
}: {
  selectedImage: string; lessonType: LessonType; setLessonType: (t: LessonType) => void
  gradeLevel: string; setGradeLevel: (g: string) => void
  generating: boolean; hasResult: boolean; onGenerate: () => void; onRegenerate: () => void
}) {
  return (
    <div className="space-y-3">
      {/* Selected image chip */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 font-medium">Selected:</span>
        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono truncate max-w-52">
          {selectedImage}
        </span>
      </div>

      <div className="flex gap-3">
        {/* Lesson type chips */}
        <div className="flex-1">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Lesson Type</p>
          <div className="flex flex-wrap gap-1.5">
            {LESSON_TYPES.map((lt) => (
              <button
                key={lt.type}
                onClick={() => setLessonType(lt.type)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-all
                  ${lessonType === lt.type
                    ? 'border-blue-500 bg-blue-600 text-white font-medium shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'}`}
                title={lt.desc}
              >
                <span>{lt.icon}</span>{lt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grade select */}
        <div className="shrink-0">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Grade</p>
          <select className="input text-xs w-28" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
            <option value="">Auto</option>
            {['K','1','2','3','4','5','6','7','8','9','10','11','12'].map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          className="btn-primary flex-1 justify-center py-2.5"
          onClick={onGenerate}
          disabled={generating}
        >
          {generating ? (
            <><Spinner size="sm" /> Generating…</>
          ) : (
            '✨ Generate Lesson'
          )}
        </button>
        {hasResult && !generating && (
          <button className="btn-secondary text-xs px-3" onClick={onRegenerate} title="Regenerate with fresh content">
            ↺ Redo
          </button>
        )}
      </div>
    </div>
  )
}

function LessonBanner({
  doc, meta, onPrint, onCopyId, onRegenerate,
}: {
  doc: A2UIDocument
  meta: GenMeta | null
  onPrint: () => void
  onCopyId: () => void
  onRegenerate: () => void
}) {
  const typeIcon: Record<string, string> = {
    lesson: '📖', quiz: '✏️', flashcard: '🃏', worksheet: '📋', vocabulary: '📚',
  }

  return (
    <div className="card p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span>{typeIcon[doc.metadata.lesson_type] || '📄'}</span>
            <span className="text-xs text-blue-200 uppercase tracking-wide font-medium">
              {doc.metadata.lesson_type}
            </span>
            {meta?.cached && (
              <span className="text-xs px-1.5 py-0.5 bg-white/20 rounded-full">cached</span>
            )}
          </div>
          <h2 className="font-bold text-lg leading-tight truncate">{doc.metadata.title}</h2>
          <p className="text-blue-200 text-xs mt-1 italic line-clamp-1">"{meta?.caption}"</p>
        </div>
        {/* Actions */}
        <div className="flex gap-1.5 shrink-0">
          <button
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white text-xs"
            onClick={onRegenerate} title="Regenerate">↺</button>
          <button
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white text-xs"
            onClick={onCopyId} title="Copy lesson ID">🔗</button>
          <button
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white text-xs"
            onClick={onPrint} title="Print lesson">🖨</button>
        </div>
      </div>
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-white/20 text-xs text-blue-200">
        <span>Grade {doc.metadata.grade_level || 'Any'}</span>
        <span>·</span>
        <span>{doc.metadata.subject}</span>
        <span>·</span>
        <span className="font-mono">{meta?.model?.split('::').pop()}</span>
        {meta?.timeMs && <><span>·</span><span>{(meta.timeMs / 1000).toFixed(1)}s</span></>}
        <span>·</span>
        <span>{doc.components.length} components</span>
      </div>
    </div>
  )
}

function EmptyLesson() {
  return (
    <div className="text-center text-slate-400 max-w-xs">
      <div className="text-5xl mb-4">✨</div>
      <p className="font-medium text-slate-600">Ready to generate</p>
      <p className="text-sm mt-1">
        Choose a lesson type in the controls panel, then click <strong>Generate Lesson</strong>.
      </p>
    </div>
  )
}

function SelectImagePrompt() {
  return (
    <div className="text-center text-slate-400 max-w-xs">
      <div className="text-5xl mb-4">👈</div>
      <p className="font-medium text-slate-600">Select an image</p>
      <p className="text-sm mt-1">Click any image from the gallery to get started.</p>
    </div>
  )
}

function EmptyGallery({ search, datasetName }: { search: string; datasetName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
      <div className="text-5xl mb-4">{search ? '🔍' : '📁'}</div>
      <p className="font-medium text-slate-600">
        {search ? `No images matching "${search}"` : 'No images yet'}
      </p>
      {!search && (
        <p className="text-sm mt-1 text-center max-w-xs">
          Drop image files into{' '}
          <code className="bg-slate-100 text-slate-600 px-1 rounded">
            data/datasets/{datasetName}/
          </code>
          {' '}and refresh.
        </p>
      )}
    </div>
  )
}
