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
  if (/فشل|تعذّر|تعذر|خطأ|غير متاح|أُلغي/.test(message)) return 'error'
  if (/^تم|نجح|حُذف|أُنشئ|حُفظ|تحرير|استُرجع/.test(message)) return 'success'
  return 'info'
}

const KIND_ICON = { info: 'info', success: 'checkCircle', error: 'alert' } as const

export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const showToast = useCallback((message: string, kind?: ToastKind) => {
    const id = nextId.current++
    setToasts((prev) => [...prev.slice(-1), { id, message, kind: kind ?? inferKind(message) }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              <Icon name={KIND_ICON[t.kind]} size={17} />
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast يجب أن يُستخدم داخل ToastProvider')
  return ctx
}
