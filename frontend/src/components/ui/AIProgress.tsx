import { useEffect, useState } from 'react'

export interface AIStep {
  id: string
  label: string
  detail: string
  durationMs: number   // how long before auto-advancing (simulated)
}

type StepStatus = 'pending' | 'active' | 'done' | 'error'

interface Props {
  active: boolean
  error?: string
  modelName?: string
  onComplete?: () => void
}

const STEPS: AIStep[] = [
  { id: 'load',    label: 'Loading image',         detail: 'Reading from dataset folder',           durationMs: 400  },
  { id: 'caption', label: 'Identifying image',      detail: 'Extracting caption from filename',      durationMs: 800  },
  { id: 'llm',     label: 'Generating content',     detail: 'Local LLM crafting educational content', durationMs: 99999 },
  { id: 'a2ui',    label: 'Building lesson UI',     detail: 'Assembling A2UI schema',                durationMs: 300  },
  { id: 'render',  label: 'Rendering components',   detail: 'Applying interactive widgets',          durationMs: 200  },
]

export default function AIProgress({ active, error, modelName }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(STEPS.map(() => 'pending'))
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useState(() => Date.now())[0]

  // Tick elapsed timer
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setElapsedMs(Date.now() - startRef), 200)
    return () => clearInterval(t)
  }, [active, startRef])

  // Step progression
  useEffect(() => {
    if (!active) return
    setCurrentStep(0)
    setStepStatuses(STEPS.map(() => 'pending'))

    let step = 0
    const advance = () => {
      if (step >= STEPS.length) return
      setStepStatuses((prev) => {
        const next = [...prev]
        if (step > 0) next[step - 1] = 'done'
        next[step] = 'active'
        return next
      })
      setCurrentStep(step)
      const dur = STEPS[step].durationMs
      if (dur < 99999) {
        setTimeout(() => { step++; advance() }, dur)
      }
    }
    advance()
  }, [active])

  // When active turns false (complete), mark remaining steps done
  useEffect(() => {
    if (active) return
    setStepStatuses(STEPS.map(() => error ? 'pending' : 'done'))
  }, [active, error])

  if (!active && !error) return null

  return (
    <div className="card p-5 border-blue-100 bg-gradient-to-b from-blue-50/60 to-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs">✦</span>
          </div>
          <span className="font-semibold text-slate-800 text-sm">AI Processing</span>
        </div>
        <div className="flex items-center gap-2">
          {modelName && (
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-mono">
              {modelName.split('::').pop()}
            </span>
          )}
          {active && (
            <span className="text-xs text-slate-400 font-mono">
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((step, i) => {
          const status = stepStatuses[i]
          return (
            <div key={step.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300
              ${status === 'active' ? 'bg-blue-100/70' : status === 'done' ? 'bg-emerald-50/50' : 'opacity-40'}`}>
              {/* Icon */}
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0
                ${status === 'done'   ? 'bg-emerald-500 text-white'
                : status === 'active' ? 'bg-blue-500 text-white'
                : status === 'error'  ? 'bg-red-400 text-white'
                : 'bg-slate-200'}`}>
                {status === 'done'   ? <span className="text-xs font-bold">✓</span>
               : status === 'active' ? <PulsingDot />
               : status === 'error'  ? <span className="text-xs font-bold">✕</span>
               : <span className="text-xs text-slate-400">{i + 1}</span>}
              </div>
              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium leading-tight
                  ${status === 'done' ? 'text-emerald-700' : status === 'active' ? 'text-blue-700' : 'text-slate-500'}`}>
                  {step.label}
                </p>
                {status === 'active' && (
                  <p className="text-xs text-slate-400 mt-0.5">{step.detail}</p>
                )}
              </div>
              {status === 'active' && (
                <div className="shrink-0 flex gap-0.5">
                  {[0,1,2].map((d) => (
                    <span key={d} className="w-1 h-1 rounded-full bg-blue-400 animate-bounce"
                      style={{ animationDelay: `${d * 150}ms` }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}

function PulsingDot() {
  return <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
}
