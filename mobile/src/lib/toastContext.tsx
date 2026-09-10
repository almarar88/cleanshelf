import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Icon } from '../components/Icon'

export type ToastKind = 'info' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function inferKind(message: string): ToastKind {
  if (/فشل|تعذّر|تعذر|خطأ|أُلغي|failed|error|stopped/i.test(message)) return 'error'
  if (/^تم|نجح|حُذف|أُنشئ|حُفظ|استُرجع|freed|saved|moved|deleted|restored|renamed|cleared|shredded/i.test(message)) return 'success'
  return 'info'
}

const KIND_ICON = { info: 'info', success: 'checkCircle', error: 'alert' } as const

export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const showToast = useCallback((message: string, kind?: ToastKind) => {
    const id = nextId.current++
    setToasts((prev) => [...prev.slice(-1), { id, message, kind: kind ?? inferKind(message) }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3400)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((x) => (
            <div key={x.id} className={`toast toast-${x.kind}`}>
              <Icon name={KIND_ICON[x.kind]} size={18} />
              <span>{x.message}</span>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast خارج ToastProvider')
  return ctx
}
