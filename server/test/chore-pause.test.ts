import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createApp } from '../src/app.ts';
import { openDb, applyMigrations } from '../src/d1-sqlite.ts';
import type { Env } from '../src/env.ts';

async function setup() {
  const db = openDb(':memory:');
  applyMigrations(db, path.join(import.meta.dirname, '..', 'migrations'));
  const env = { DB: db, ADMIN_API_KEY: 'k', PUBLIC_URL: 'http://localhost', ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' } as unknown as Env;
  const app = createApp();
  const req = async (method: string, url: string, body?: unknown, key = 'k') => {
    const r = await app.request(url, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }, env);
    const text = await r.text();
    return { status: r.status, json: (r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text) as any };
  };
  await req('PATCH', '/api/settings', { timezone: 'UTC', streakGraceDays: 0 });
  const today = (await req('GET', '/api/board')).json.today;
  const day = (n: number) => new Date(Date.parse(`${today}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  const maya = (await req('POST', '/api/members', { name: 'Maya', color: '#e57' })).json;
  const chore = async (title: string) => (await req('POST', '/api/chores', { title, points: 5, memberIds: [maya.id], dueDate: day(-6), rrule: 'FREQ=DAILY' })).json;
  const titlesOn = async (date: string) => ((await req('GET', `/api/chores/day?date=${date}`)).json as any[]).map(c => c.title).sort();
  return { db, req, today, day, maya, chore, titlesOn };
}

test('a paused chore is not due on its paused days, its other days and other chores carry on, and nobody is away', async () => {
  const t = await setup();
  const homework = await t.chore('Homework'), bed = await t.chore('Make bed');
  const made = await t.req('POST', `/api/chores/${homework.id}/pauses`, { startDate: t.day(-2), endDate: t.day(1) });
  assert.equal(made.status, 201);
  assert.deepEqual({ choreId: made.json.choreId, startDate: made.json.startDate, endDate: made.json.endDate }, { choreId: homework.id, startDate: t.day(-2), endDate: t.day(1) });

  for (const d of [t.day(-2), t.today, t.day(1)]) assert.deepEqual(await t.titlesOn(d), ['Make bed'], `paused on ${d}`);
  for (const d of [t.day(-3), t.day(2)]) assert.deepEqual(await t.titlesOn(d), ['Homework', 'Make bed'], `due again on ${d}`);

  // The day counts leave it out, and a paused day never turns up late.
  const counts = (await t.req('GET', `/api/chores/counts?from=${t.day(-2)}&to=${t.day(2)}`)).json as any[];
  assert.deepEqual(counts.filter(c => c.memberId === t.maya.id).map(c => [c.date, c.total]), [[t.day(-2), 1], [t.day(-1), 1], [t.today, 1], [t.day(1), 1], [t.day(2), 2]]);
  await t.req('POST', `/api/chores/${homework.id}/complete`, { date: t.day(-3) });
  const late = ((await t.req('GET', '/api/board')).json.overdueChores as any[]).map(c => c.title);
  assert.deepEqual(late, ['Make bed'], 'only the chore that was really missed is late');

  // It can't be ticked off on a paused day, and the person is not marked away.
  const tick = await t.req('POST', `/api/chores/${homework.id}/complete`, { date: t.today });
  assert.equal(tick.status, 400);
  assert.match(JSON.stringify(tick.json), /paused/);
  assert.equal((await t.req('POST', `/api/chores/${bed.id}/complete`, { date: t.today })).status, 200);
  assert.deepEqual((await t.req('GET', '/api/away')).json, []);
});

test('paused days do not break a streak', async () => {
  const streakWith = async (pause: boolean) => {
    const t = await setup();
    const homework = await t.chore('Homework');
    for (const n of [-6, -5, -4, -3, -2, 0]) await t.req('POST', `/api/chores/${homework.id}/complete`, { date: t.day(n) }); // yesterday is missed
    if (pause) await t.req('POST', `/api/chores/${homework.id}/pauses`, { startDate: t.day(-1), endDate: t.day(-1) });
    return ((await t.req('GET', '/api/leaderboard')).json as any[]).find(e => e.memberId === t.maya.id).streak;
  };
  assert.equal(await streakWith(false), 1, 'a missed day ends the run');
  assert.equal(await streakWith(true), 6, 'a paused day is skipped');
});

test('pauses are listed with their chore, removed by a parent, and gone with the chore', async () => {
  const t = await setup();
  const homework = await t.chore('Homework');
  const a = (await t.req('POST', `/api/chores/${homework.id}/pauses`, { startDate: t.day(0), endDate: t.day(3) })).json;
  await t.req('POST', `/api/chores/${homework.id}/pauses`, { startDate: t.day(10), endDate: t.day(12) });
  const list = async (from: string, to: string) => ((await t.req('GET', `/api/chores/pauses?from=${from}&to=${to}`)).json as any[]).map(p => [p.title, p.memberId, p.startDate, p.endDate]);
  assert.deepEqual(await list(t.today, t.today), [['Homework', t.maya.id, t.day(0), t.day(3)]]);
  assert.deepEqual((await list(t.day(-5), t.day(30))).length, 2);
  assert.deepEqual(await list(t.day(4), t.day(9)), []);

  assert.equal((await t.req('DELETE', `/api/chores/${homework.id}/pauses/${a.id}`)).status, 200);
  assert.deepEqual(await t.titlesOn(t.today), ['Homework'], 'due again once the pause is removed');
  assert.equal((await t.req('DELETE', `/api/chores/${homework.id}/pauses/${a.id}`)).status, 404);

  await t.req('DELETE', `/api/chores/${homework.id}`);
  assert.equal(await t.db.prepare('SELECT COUNT(*) AS n FROM chore_pauses').first<number>('n'), 0);
});

test('pauses are parent-only and date-checked', async () => {
  const t = await setup();
  const homework = await t.chore('Homework');
  const wall = (await t.req('POST', '/api/keys', { name: 'Kitchen wall', scope: 'display' })).json.key;
  const pause = (await t.req('POST', `/api/chores/${homework.id}/pauses`, { startDate: t.today, endDate: t.today })).json;
  assert.equal((await t.req('POST', `/api/chores/${homework.id}/pauses`, { startDate: t.today, endDate: t.today }, wall)).status, 403);
  assert.equal((await t.req('DELETE', `/api/chores/${homework.id}/pauses/${pause.id}`, undefined, wall)).status, 403);
  assert.equal((await t.req('GET', `/api/chores/pauses?from=${t.today}&to=${t.today}`, undefined, wall)).status, 403, 'a wall screen just doesn’t show the chore');
  assert.equal((await t.req('POST', `/api/chores/${homework.id}/pauses`, { startDate: t.day(2), endDate: t.day(1) })).status, 400);
  assert.equal((await t.req('POST', `/api/chores/${homework.id}/pauses`, { startDate: '2026-02-30', endDate: '2026-03-01' })).status, 400);
  assert.equal((await t.req('POST', '/api/chores/missing/pauses', { startDate: t.today, endDate: t.today })).status, 404);
});

test('pauses survive a backup round trip, and an older backup without them is still accepted', async () => {
  const t = await setup();
  const homework = await t.chore('Homework');
  await t.req('POST', `/api/chores/${homework.id}/pauses`, { startDate: t.day(-1), endDate: t.day(2) });
  const backup = (await t.req('GET', '/api/export')).json;
  assert.equal(backup.chorePauses.length, 1);
  const restored = await setup();
  assert.equal((await restored.req('POST', '/api/import', backup)).status, 200);
  assert.deepEqual(((await restored.req('GET', `/api/chores/pauses?from=${t.today}&to=${t.today}`)).json as any[]).map(p => [p.choreId, p.startDate, p.endDate]), [[homework.id, t.day(-1), t.day(2)]]);
  const { chorePauses: _dropped, ...old } = backup;
  assert.equal((await (await setup()).req('POST', '/api/import', old)).status, 200);
});
