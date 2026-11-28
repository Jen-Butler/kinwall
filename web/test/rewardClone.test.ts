import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cloneTitle } from '../src/rewardClone.ts'

test('cloneTitle: says it is a copy, and still fits a reward name', () => {
  assert.equal(cloneTitle('Movie night pick'), 'Movie night pick copy')
  assert.equal(cloneTitle('  Ice cream  '), 'Ice cream copy')
  const long = cloneTitle('x'.repeat(80))
  assert.equal(long.length, 80)
  assert.ok(long.endsWith(' copy'))
})
