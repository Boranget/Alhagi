export { default as Icon } from './Icon.vue'

export const iconNames = [
  'file',
  'folder',
  'folder-open',
  'search',
  'save',
  'close',
  'trash',
  'edit',
  'typewriter',
  'target',
  'image',
  'globe',
  'palette',
  'tool',
  'list',
  'copy',
  'menu',
  'plus',
  'minus',
  'chevron-right',
  'chevron-down',
  'settings',
  'wysiwyg',
  'code',
  'split',
  'maximize',
  'minimize',
  'zoom-in',
  'zoom-out',
  'rotate-ccw',
  'alert-circle'
] as const

export type IconName = typeof iconNames[number]
