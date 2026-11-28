// A chore's own break (Chores → a chore → More… → Pause for some days…): not due on those days,
// with nobody away. Pure, so web/test/chorePause.test.ts covers it; the server decides what's due.
import { t } from './i18n.ts'
import { longDay } from './trips.ts'
import type { ChorePause } from './types.ts'

/** "Wed, Mar 3" or "Wed, Mar 3 – Fri, Mar 5". */
export function pauseDays(p: Pick<ChorePause, 'startDate' | 'endDate'>): string {
  return p.startDate === p.endDate ? longDay(p.startDate) : t('{from} – {to}', { from: longDay(p.startDate), to: longDay(p.endDate) })
}

/** The pauses that cover that day. */
export function pausesOn(pauses: ChorePause[], date: string): ChorePause[] {
  return pauses.filter(p => p.startDate <= date && date <= p.endDate)
}

/** What's wrong with the days picked, in words; '' when they're fine. */
export function pauseProblem(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return t('Pick the first and last day.')
  if (endDate < startDate) return t('The last day is before the first.')
  return ''
}
