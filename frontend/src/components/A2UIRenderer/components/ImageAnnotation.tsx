import { useState } from 'react'
import type { ImageAnnotationProps } from '../../../types/a2ui'

export default function ImageAnnotation({ src, alt, annotations = [] }: ImageAnnotationProps) {
  const [active, setActive] = useState<string | null>(null)

  // Append auth token so the image loads through the authenticated API
  const token = localStorage.getItem('access_token')
  const imgSrc = src.includes('?') ? src : `${src}${token ? `?token=${token}` : ''}`

  return (
    <div className="card overflow-hidden">
      <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 w-full h-full object-contain bg-slate-100"
          onError={(e) => {
            // Fallback to a placeholder if image fails
            ;(e.target as HTMLImageElement).src = `https://placehold.co/800x450/e2e8f0/64748b?text=${encodeURIComponent(alt || 'Image')}`
          }}
        />
        {annotations.map((ann) => (
          <button
            key={ann.id}
            className="absolute flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold shadow-lg border-2 border-white transition-transform hover:scale-110 focus:outline-none"
            style={{
              left: `calc(${ann.x * 100}% - 12px)`,
              top: `calc(${ann.y * 100}% - 12px)`,
              backgroundColor: ann.color,
            }}
            onClick={() => setActive(active === ann.id ? null : ann.id)}
            title={ann.label}
          >
            {annotations.indexOf(ann) + 1}
          </button>
        ))}
        {active && (() => {
          const ann = annotations.find((a) => a.id === active)
          if (!ann) return null
          return (
            <div
              className="absolute bg-white text-slate-800 text-xs px-2 py-1 rounded-lg shadow-lg border border-slate-200 pointer-events-none"
              style={{
                left: `calc(${ann.x * 100}% + 16px)`,
                top: `calc(${ann.y * 100}% - 12px)`,
                maxWidth: 200,
                zIndex: 10,
              }}
            >
              <span className="font-semibold">{ann.label}</span>
            </div>
          )
        })()}
      </div>
      {annotations.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap gap-2">
          {annotations.map((ann, i) => (
            <button
              key={ann.id}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors"
              style={{
                borderColor: ann.color,
                color: active === ann.id ? 'white' : ann.color,
                backgroundColor: active === ann.id ? ann.color : 'transparent',
              }}
              onClick={() => setActive(active === ann.id ? null : ann.id)}
            >
              <span className="font-bold">{i + 1}</span>
              {ann.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
