import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimelineController } from './timeline-controller.mjs';

const early = new Date('2026-10-02T19:51:27-07:00');
const middle = new Date('2026-10-20T12:00:00-07:00');
const latest = new Date('2026-11-16T12:00:00-08:00');

test('scroll callbacks cannot overwrite a slider choice', () => {
  const calls = [];
  const timeline = createTimelineController((...args) => calls.push(args));
  timeline.enterStep(early, 'early');
  timeline.select(middle);
  // Queued observer callbacks and later scrolling used to overwrite the slider.
  timeline.enterStep(early, 'early');
  timeline.enterStep(latest, 'latest');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.at(-1), [middle, null, false]);
  timeline.follow(true);
  assert.deepEqual(calls.at(-1), [latest, 'latest', true]);
  timeline.enterStep(early, 'early');
  assert.deepEqual(calls.at(-1), [early, 'early', true]);
});

test('show-all and keyboard narrative selection persist during scroll', () => {
  const calls = [];
  const timeline = createTimelineController((...args) => calls.push(args));
  timeline.select(latest);
  timeline.enterStep(early, 'early');
  assert.deepEqual(calls, [[latest, null, false]]);
  timeline.select(middle, 'middle');
  timeline.enterStep(latest, 'latest');
  assert.deepEqual(calls.at(-1), [middle, 'middle', false]);
});

test('following can be disabled before any observer callback arrives', () => {
  const calls = [];
  const timeline = createTimelineController((...args) => calls.push(args));
  timeline.follow(false);
  timeline.enterStep(early, 'early');
  assert.equal(calls.length, 0);
  timeline.follow(true);
  assert.deepEqual(calls, [[early, 'early', true]]);
});
