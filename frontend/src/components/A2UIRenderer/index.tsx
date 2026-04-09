/**
 * A2UIRenderer — the runtime that takes an A2UIDocument and renders it as
 * interactive React components.  This is the core of the "generative UI" system:
 * the AI backend produces a JSON schema; this component renders it.
 */
import { useState } from 'react'
import type { A2UIDocument, A2UIComponent } from '../../types/a2ui'
import ContentBlock from './components/ContentBlock'
import FillBlankBlock from './components/FillBlankBlock'
import FlashcardBlock from './components/FlashcardBlock'
import ImageAnnotation from './components/ImageAnnotation'
import QuizBlock from './components/QuizBlock'
import WordBank from './components/WordBank'

function ComponentSwitch({ comp }: { comp: A2UIComponent }) {
  switch (comp.type) {
    case 'content_block':
      return <ContentBlock {...comp.props} />
    case 'image_annotation':
      return <ImageAnnotation {...comp.props} />
    case 'quiz_block':
      return <QuizBlock {...comp.props} />
    case 'flashcard_block':
      return <FlashcardBlock {...comp.props} />
    case 'fill_blank':
      return <FillBlankBlock {...comp.props} />
    case 'word_bank':
      return <WordBank {...comp.props} />
    default:
      return null
  }
}

interface A2UIRendererProps {
  document: A2UIDocument
}

export default function A2UIRenderer({ document: doc }: A2UIRendererProps) {
  const gapClass = doc.layout.gap === 'sm' ? 'gap-3' : doc.layout.gap === 'lg' ? 'gap-6' : 'gap-4'

  const inner = doc.components.map((comp) => (
    <ComponentSwitch key={comp.id} comp={comp} />
  ))

  if (doc.layout.type === 'grid') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 ${gapClass}`}>
        {inner}
      </div>
    )
  }

  if (doc.layout.type === 'tabs') {
    // Minimal tabs implementation
    const labels = doc.components.map((c) =>
      c.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    )
    return (
      <TabLayout labels={labels} gap={gapClass}>
        {doc.components.map((comp) => (
          <ComponentSwitch key={comp.id} comp={comp} />
        ))}
      </TabLayout>
    )
  }

  // Default: stack
  return (
    <div className={`flex flex-col ${gapClass}`}>
      {inner}
    </div>
  )
}

function TabLayout({
  labels,
  children,
  gap,
}: {
  labels: string[]
  children: React.ReactNode[]
  gap: string
}) {
  const tabs = labels
  const panels = Array.isArray(children) ? children : [children]
  const [active, setActive] = useState(0)
  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {tabs.map((label, i) => (
          <button
            key={i}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors
              ${active === i
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            onClick={() => setActive(i)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={`flex flex-col ${gap}`}>{panels[active]}</div>
    </div>
  )
}

