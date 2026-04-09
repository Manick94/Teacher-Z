import { useState } from 'react'
import type { WordBankProps } from '../../../types/a2ui'

export default function WordBank({ words, instructions, targets }: WordBankProps) {
  const [placed, setPlaced] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)

  const usedWords = new Set(Object.values(placed))

  const place = (targetId: string, word: string) => {
    setPlaced((prev) => ({ ...prev, [targetId]: word }))
    setChecked(false)
  }

  const remove = (targetId: string) => {
    setPlaced((prev) => {
      const next = { ...prev }
      delete next[targetId]
      return next
    })
    setChecked(false)
  }

  const score = targets.filter((t) => placed[t.id]?.toLowerCase() === t.answer.toLowerCase()).length

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-slate-800 text-sm mb-1">Word Bank</h3>
      <p className="text-xs text-slate-500 mb-4">{instructions}</p>

      {/* Word bank chips */}
      <div className="flex flex-wrap gap-2 mb-5 p-3 bg-slate-50 rounded-lg border border-slate-200">
        {words.map((word) => (
          <span
            key={word}
            className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer select-none transition-all
              ${usedWords.has(word)
                ? 'border-slate-200 text-slate-300 bg-slate-100 line-through'
                : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100'
              }`}
          >
            {word}
          </span>
        ))}
      </div>

      {/* Drop targets */}
      <div className="space-y-3">
        {targets.map((target) => (
          <div key={target.id} className="flex items-start gap-3">
            <div className="flex-1 text-sm text-slate-600 leading-snug pt-1">
              {target.definition}
            </div>
            <div className="shrink-0">
              {placed[target.id] ? (
                <button
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
                    ${checked
                      ? placed[target.id]?.toLowerCase() === target.answer.toLowerCase()
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-red-400 bg-red-50 text-red-700'
                      : 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    }`}
                  onClick={() => remove(target.id)}
                  title="Click to remove"
                >
                  {placed[target.id]} ×
                </button>
              ) : (
                <select
                  className="text-xs border border-dashed border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-500 focus:outline-none focus:border-blue-400"
                  value=""
                  onChange={(e) => place(target.id, e.target.value)}
                >
                  <option value="" disabled>Select word…</option>
                  {words.filter((w) => !usedWords.has(w)).map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button className="btn-primary text-xs" onClick={() => setChecked(true)}>
          Check Answers
        </button>
        <button className="btn-secondary text-xs" onClick={() => { setPlaced({}); setChecked(false) }}>
          Reset
        </button>
        {checked && (
          <span className={`text-xs font-medium ${score === targets.length ? 'text-emerald-600' : 'text-slate-500'}`}>
            {score}/{targets.length} correct
          </span>
        )}
      </div>
    </div>
  )
}
