import { useState } from 'react'
import type { FillBlankProps } from '../../../types/a2ui'

export default function FillBlankBlock({ template, blanks, hint }: FillBlankProps) {
  const parts = template.split('___')
  const [answers, setAnswers] = useState<string[]>(Array(blanks.length).fill(''))
  const [checked, setChecked] = useState(false)

  const setAnswer = (i: number, val: string) => {
    const next = [...answers]
    next[i] = val
    setAnswers(next)
    setChecked(false)
  }

  const score = answers.filter((a, i) =>
    a.trim().toLowerCase() === blanks[i]?.toLowerCase()
  ).length

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-slate-800 text-sm mb-3">Fill in the Blanks</h3>

      <div className="text-sm text-slate-700 leading-loose">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < blanks.length && (
              <input
                className={`inline-block mx-1 px-2 py-0.5 w-28 text-center rounded border text-sm transition-colors
                  ${checked
                    ? answers[i]?.trim().toLowerCase() === blanks[i]?.toLowerCase()
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                      : 'border-red-400 bg-red-50 text-red-700'
                    : 'border-slate-300 focus:border-blue-400 focus:outline-none'
                  }`}
                value={answers[i]}
                onChange={(e) => setAnswer(i, e.target.value)}
                placeholder="________"
              />
            )}
          </span>
        ))}
      </div>

      {hint && (
        <p className="text-xs text-slate-400 mt-2 italic">Hint: {hint}</p>
      )}

      <div className="flex items-center gap-3 mt-4">
        <button className="btn-primary text-xs" onClick={() => setChecked(true)}>
          Check Answers
        </button>
        <button className="btn-secondary text-xs" onClick={() => { setAnswers(Array(blanks.length).fill('')); setChecked(false) }}>
          Reset
        </button>
        {checked && (
          <span className={`text-xs font-medium ${score === blanks.length ? 'text-emerald-600' : 'text-slate-500'}`}>
            {score}/{blanks.length} correct
          </span>
        )}
      </div>
    </div>
  )
}
