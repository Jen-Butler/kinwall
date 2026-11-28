import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pauseDays, pauseProblem, pausesOn } from '../src/chorePause.ts'

const pause = (startDate: string, endDate: string, choreId = 'homework') => ({ id: `${choreId}:${startDate}`, choreId, startDate, endDate, title: 'Homework', emoji: '📚', memberId: 'maya' })

test('pauseDays: one day, or the first and last day', () => {
  assert.equal(pauseDays(pause('2027-03-03', '2027-03-03')), 'Wed, Mar 3')
  assert.equal(pauseDays(pause('2027-03-03', '2027-03-05')), 'Wed, Mar 3 – Fri, Mar 5')
})

test('pausesOn: the pauses that cover a day, first and last day included', () => {
  const all = [pause('2027-03-03', '2027-03-05'), pause('2027-03-10', '2027-03-10'), pause('2027-03-01', '2027-03-03', 'piano')]
  assert.deepEqual(pausesOn(all, '2027-03-03').map(p => p.choreId), ['homework', 'piano'])
  assert.deepEqual(pausesOn(all, '2027-03-05').map(p => p.choreId), ['homework'])
  assert.deepEqual(pausesOn(all, '2027-03-06'), [])
})

test('pauseProblem: both days are needed, in order', () => {
  assert.equal(pauseProblem('2027-03-03', '2027-03-05'), '')
  assert.equal(pauseProblem('2027-03-03', '2027-03-03'), '')
  assert.equal(pauseProblem('', '2027-03-05'), 'Pick the first and last day.')
  assert.equal(pauseProblem('2027-03-05', '2027-03-03'), 'The last day is before the first.')
})
