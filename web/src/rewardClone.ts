// Cloning a reward (Manage rewards → a reward → Clone): a new reward that starts as a copy.
import { t } from './i18n.ts'

const MAX_TITLE = 80 // the reward name field's limit

/** "Movie night pick copy", cut so it still fits the name field. */
export function cloneTitle(title: string): string {
  const added = t('{title} copy', { title: '' }).length // room the words around the name need
  return t('{title} copy', { title: title.trim().slice(0, MAX_TITLE - added) })
}
