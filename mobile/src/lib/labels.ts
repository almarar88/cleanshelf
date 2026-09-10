import type { IconName } from '../components/Icon'
import { t } from './i18n'

const ICONS: Record<string, IconName> = {
  temp_files: 'file',
  log_files: 'fileText',
  thumbnails: 'image',
  empty_folders: 'folder',
  own_cache: 'sparkles',
  apk_files: 'package',
  cache_folders: 'layers',
  residual_folders: 'trash'
}

const TONES: Record<string, string> = {
  temp_files: 'tone-blue',
  log_files: 'tone-teal',
  thumbnails: 'tone-violet',
  empty_folders: 'tone-yellow',
  own_cache: 'tone-green',
  apk_files: 'tone-orange',
  cache_folders: 'tone-orange',
  residual_folders: 'tone-red'
}

export function junkLabel(id: string): { title: string; desc: string; icon: IconName; tone: string } {
  return {
    title: t(`junk.${id}`),
    desc: t(`junk.${id}.d`),
    icon: ICONS[id] ?? 'file',
    tone: TONES[id] ?? 'tone-ink'
  }
}

export function socialLabel(id: string): string {
  return t(`social.cat.${id}`)
}
