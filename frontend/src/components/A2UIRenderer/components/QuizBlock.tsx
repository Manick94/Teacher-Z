import { useState } from 'react'
import type { QuizBlockProps } from '../../../types/a2ui'

export default function QuizBlock({ question, options, correct_index, explanation, points = 10 }: QuizBlockProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const isCorrect = selected === correct_index

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3 gap-2">
        <p className="font-medium text-slate-800 text-sm leading-snug flex-1">{question}</p>
        <span className="shrink-0 text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
          {points} pts
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {options.map((opt, i) => {
          let cls = 'w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors '
          if (!submitted) {
            cls += selected === i
              ? 'border-blue-500 bg-blue-50 text-blue-800'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          } else {
            if (i === correct_index) cls += 'border-emerald-500 bg-emerald-50 text-emerald-800'
            else if (i === selected) cls += 'border-red-400 bg-red-50 text-red-700'
            else cls += 'border-slate-200 text-slate-500'
          }
          return (
            <button key={i} className={cls} onClick={() => !submitted && setSelected(i)}>
              <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </button>
          )
        })}
      </div>

      {!submitted ? (
        <button
          className="btn-primary text-xs"
          disabled={selected === null}
          onClick={() => setSubmitted(true)}
        >
          Submit Answer
        </button>
      ) : (
        <div className={`rounded-lg px-3 py-2 text-sm ${isCorrect ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
          <span className="font-semibold">{isCorrect ? '✓ Correct!' : '✗ Incorrect.'}</span>
          {' '}{explanation}
        </div>
      )}

      {submitted && (
        <button
          className="btn-secondary text-xs mt-2"
          onClick={() => { setSelected(null); setSubmitted(false) }}
        >
          Try Again
        </button>
      )}
    </div>
  )
}
