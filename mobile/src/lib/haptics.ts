import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/** اهتزاز لمسي خفيف — يفشل بصمت في المتصفح أو على أجهزة بلا محرّك اهتزاز */
export const tap = (): void => {
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)
}
export const thud = (): void => {
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined)
}
export const success = (): void => {
  Haptics.notification({ type: NotificationType.Success }).catch(() => undefined)
}
export const warn = (): void => {
  Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined)
}
