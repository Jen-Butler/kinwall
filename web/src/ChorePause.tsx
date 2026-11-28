// Pause one chore for some days (Chores → ✏️ Edit chores → a chore → More… → Pause for some days…,
// or Change on a paused chore's note). Parent devices only. Unlike away days, nobody is away: just
// this chore isn't due on those days.
import { useEffect, useId, useState } from 'react'
import { api } from './api.ts'
import { useApp } from './AppContext.tsx'
import { useDialog } from './dialog.tsx'
import Sheet from './Sheet.tsx'
import { addDays } from './upkeep-rules.ts'
import { pauseDays, pauseProblem } from './chorePause.ts'
import { errText } from './tripShared.tsx'
import { t } from './i18n.ts'
import type { ChorePause } from './types.ts'

export function ChorePauseSheet({ chore, day, today, onClose, onChanged }: {
  chore: { id: string; title: string; emoji?: string | null }
  day: string // the day the Chores tab shows: where a new pause starts
  today: string
  onClose: () => void
  onChanged: () => void
}) {
  const { toast } = useApp()
  const dialog = useDialog()
  const id = useId()
  const [startDate, setStartDate] = useState(day)
  const [endDate, setEndDate] = useState(day)
  const [pauses, setPauses] = useState<ChorePause[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  // This chore's pauses that aren't long over. The server lists pauses by date range.
  useEffect(() => {
    let canceled = false
    api.getChorePauses(addDays(today, -7), addDays(today, 3660)).then(all => { if (!canceled) setPauses(all.filter(p => p.choreId === chore.id)) })
      .catch(e => { if (!canceled) { setPauses([]); setError(errText(e, t('Could not load this chore’s pauses.'))) } })
    return () => { canceled = true }
  }, [chore.id, today, tick])
  const problem = pauseProblem(startDate, endDate)
  const add = async () => {
    if (problem) { setError(problem); return }
    setBusy(true); setError('')
    try {
      const p = await api.addChorePause(chore.id, { startDate, endDate })
      toast(t('Paused: {title}, {days}', { title: chore.title, days: pauseDays(p) }))
      onChanged()
      onClose()
    } catch (e) { setError(errText(e, t('Could not pause this chore.'))) } finally { setBusy(false) }
  }
  const remove = async (p: ChorePause) => {
    if (!await dialog.confirm({ title: t('Remove this pause?'), body: t('{title} is due again on {days}. Days already past can show up late.', { title: chore.title, days: pauseDays(p) }), confirmLabel: t('Remove pause'), danger: true })) return
    setBusy(true); setError('')
    try { await api.removeChorePause(chore.id, p.id); toast(t('Pause removed: {title}', { title: chore.title })); onChanged(); setTick(n => n + 1) }
    catch (e) { setError(errText(e, t('Could not remove this pause.'))) } finally { setBusy(false) }
  }
  return <Sheet title={t('Pause for some days')} onClose={onClose}
    actions={<>
      <button className="btn btn-secondary" disabled={busy} onClick={onClose}>{t('Cancel')}</button>
      <button className="btn btn-primary" disabled={busy} onClick={() => void add()}>{busy ? t('Saving…') : t('Pause')}</button>
    </>}>
    <p className="settings-row-sub" style={{ margin: '0 0 12px' }}>{chore.emoji || '✅'} {chore.title}</p>
    <div className="meal-form-row">
      <div className="field"><label htmlFor={`${id}-from`}>{t('First day')}</label><input id={`${id}-from`} type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (e.target.value && endDate < e.target.value) setEndDate(e.target.value); setError('') }} /></div>
      <div className="field"><label htmlFor={`${id}-until`}>{t('Last day')}</label><input id={`${id}-until`} type="date" min={startDate} value={endDate} onChange={e => { setEndDate(e.target.value); setError('') }} /></div>
    </div>
    <p className="field-hint">{t('Not due on those days, and it won’t show up late for them. Streaks skip them. Everything else carries on, and nobody is marked away.')}</p>
    {error && <p className="field-error" role="alert">{error}</p>}
    {pauses && pauses.length > 0 && <section aria-labelledby={`${id}-list`} style={{ marginTop: 16 }}>
      <h3 id={`${id}-list`}>{t('Already paused')}</h3>
      {pauses.map(p => <div key={p.id} className="settings-row">
        <span>⏸ {pauseDays(p)}</span>
        <button type="button" className="link-btn" disabled={busy} onClick={() => void remove(p)}>{t('Remove')}</button>
      </div>)}
    </section>}
  </Sheet>
}
