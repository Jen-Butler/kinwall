-- A chore can take a break for some days without its person being away (no homework over a
-- holiday week, while the bed still gets made). A paused day is excused like an away day.
-- Additive only: no backfill, no changes to schedules, history or points.
CREATE TABLE chore_pauses (
  id TEXT PRIMARY KEY,
  chore_id TEXT NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_chore_pauses_chore ON chore_pauses(chore_id, start_date, end_date);
