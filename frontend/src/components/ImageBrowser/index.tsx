// This component is kept for backward-compat but DatasetExplorer now renders
// GridView / ListView inline for more control. Exported for potential reuse.
import { imageUrl } from '../../lib/api'
import type { ImageItem } from '../../types/a2ui'

interface ImageBrowserProps {
  images: ImageItem[]
  datasetName: string
  selectedFilename: string | null
  onSelect: (filename: string) => void
}

export default function ImageBrowser({ images, datasetName, selectedFilename, onSelect }: ImageBrowserProps) {
  if (!images.length) {
    return (
      <div className="text-center py-16 text-slate-400">
        <div className="text-4xl mb-3">📁</div>
        <p className="text-sm font-medium">No images in this dataset yet.</p>
        <p className="text-xs mt-1">
          Add image files to <code className="bg-slate-100 px-1 rounded">data/datasets/{datasetName}/</code>
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {images.map((img) => (
        <button
          key={img.filename}
          className={`group rounded-xl overflow-hidden border-2 text-left transition-all
            ${img.filename === selectedFilename
              ? 'border-blue-500 ring-2 ring-blue-300 shadow-md'
              : 'border-slate-200 hover:border-blue-300 hover:shadow-md'}`}
          onClick={() => onSelect(img.filename)}
        >
          <div className="aspect-square bg-slate-100 overflow-hidden">
            <img
              src={imageUrl(datasetName, img.filename)}
              alt={img.filename}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src =
                  `https://placehold.co/200x200/e2e8f0/94a3b8?text=${encodeURIComponent(img.filename.split('.')[0] || 'Image')}`
              }}
            />
          </div>
          <div className="px-2 py-1.5 bg-white">
            <p className="text-xs text-slate-600 truncate font-medium" title={img.filename}>
              {img.filename}
            </p>
            <p className="text-xs text-slate-400">{(img.size_bytes / 1024).toFixed(0)} KB</p>
          </div>
        </button>
      ))}
    </div>
  )
}
