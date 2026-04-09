import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'
interface Toast { id: number; message: string; type: ToastType; detail?: string }
interface ToastCtx { toast: (msg: string, type?: ToastType, detail?: string) => void }

const Ctx = createContext<ToastCtx>({ toast: () => {} })
let _id = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info', detail?: string) => {
    const id = ++_id
    setToasts((prev) => [...prev, { id, message, type, detail }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  )
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 200, fill: 'forwards' })
  }, [])

  const styles: Record<ToastType, string> = {
    success: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    error:   'bg-red-50 border-red-300 text-red-800',
    warning: 'bg-amber-50 border-amber-300 text-amber-800',
    info:    'bg-blue-50 border-blue-300 text-blue-800',
  }
  const icons: Record<ToastType, string> = {
    success: '✓', error: '✕', warning: '⚠', info: 'ℹ',
  }

  return (
    <div ref={ref} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg ${styles[t.type]}`}>
      <span className="font-bold mt-0.5 shrink-0">{icons[t.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{t.message}</p>
        {t.detail && <p className="text-xs opacity-75 mt-0.5 truncate">{t.detail}</p>}
      </div>
      <button className="shrink-0 opacity-50 hover:opacity-100 text-sm" onClick={onDismiss}>✕</button>
    </div>
  )
}

export function useToast() { return useContext(Ctx) }
