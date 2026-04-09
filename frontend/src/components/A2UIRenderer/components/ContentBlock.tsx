import type { ContentBlockProps } from '../../../types/a2ui'

function highlight(text: string, terms: string[]) {
  if (!terms.length) return <>{text}</>
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, i) =>
        terms.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export default function ContentBlock({ heading, body, highlight: terms = [] }: ContentBlockProps) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-slate-800 text-base mb-2">{heading}</h3>
      <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
        {highlight(body, terms)}
      </div>
    </div>
  )
}
