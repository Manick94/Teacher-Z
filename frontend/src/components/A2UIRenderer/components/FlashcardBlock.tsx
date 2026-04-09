import { useState } from 'react'
import type { FlashcardBlockProps } from '../../../types/a2ui'

export default function FlashcardBlock({ cards }: FlashcardBlockProps) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (!cards.length) return null
  const card = cards[index]

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 text-sm">Flashcards</h3>
        <span className="text-xs text-slate-400">{index + 1} / {cards.length}</span>
      </div>

      {/* Card flip area */}
      <button
        className="w-full min-h-32 rounded-xl border-2 border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6 text-center cursor-pointer hover:border-blue-300 transition-colors"
        onClick={() => setFlipped(!flipped)}
      >
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
            {flipped ? 'Definition' : 'Term'}
          </p>
          <p className="text-slate-800 font-medium text-base leading-snug">
            {flipped ? card.back : card.front}
          </p>
          <p className="text-xs text-slate-400 mt-3">Click to flip</p>
        </div>
      </button>

      <div className="flex items-center justify-between mt-3 gap-2">
        <button
          className="btn-secondary text-xs"
          disabled={index === 0}
          onClick={() => { setIndex(index - 1); setFlipped(false) }}
        >
          ← Previous
        </button>
        <button
          className="btn-secondary text-xs"
          onClick={() => setFlipped(!flipped)}
        >
          Flip
        </button>
        <button
          className="btn-secondary text-xs"
          disabled={index === cards.length - 1}
          onClick={() => { setIndex(index + 1); setFlipped(false) }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
