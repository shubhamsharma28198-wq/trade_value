import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual worker callback with in-memory service boundaries.
// This does not substitute for PostgreSQL/Redis integration tests.
async function loadWorker(user, mock = true) {
  const source = (await readFile(new URL('../apps/worker/src/index.ts', import.meta.url), 'utf8'))
    .replace(/^import .*$/gm, '');
  const updates = [];
  let processor;
  const db = {
    user: { findUnique: async () => user, update: async () => ({}) },
    syncRun: { update: async ({ data }) => { updates.push(data); return data; } },
    $transaction: async operations => Promise.all(operations),
    $connect: () => new Promise(() => {}),
  };
  class Queue { on() {} }
  class Worker {
    constructor(name, callback) { processor = callback; }
    on() {}
  }
  vm.runInNewContext(source, {
    config: { mockExternalProvider: mock, syncIntervalMinutes: 30 },
    PrismaClient: class { constructor() { return db; } },
    redisConnection: () => ({}), Queue, Worker, console,
    setInterval: () => 1, clearInterval() {}, process: { on() {} },
  });
  return { run: () => processor({ data: { userId: 'member', syncRunId: 'run' } }), updates };
}

test('inactive or deleted accounts finish their sync run as failed', async () => {
  for (const user of [null, { status: 'INACTIVE' }]) {
    const worker = await loadWorker(user);
    await assert.rejects(worker.run(), /Account is not active/);
    assert.equal(worker.updates.at(-1).status, 'FAILED');
    assert.equal(worker.updates.at(-1).errorMessage, 'Account is not active');
    assert.ok(worker.updates.at(-1).completedAt);
  }
});

test('sync retries clear prior completion and record success or adapter failure', async () => {
  for (const mock of [true, false]) {
    const worker = await loadWorker({ status: 'ACTIVE' }, mock);
    if (mock) {
      const result = await worker.run();
      assert.equal(result.recordsProcessed, 0);
    } else await assert.rejects(worker.run(), /authorized provider API/);
    assert.equal(worker.updates[0].status, 'RUNNING');
    assert.equal(worker.updates[0].completedAt, null);
    assert.equal(worker.updates.at(-1).status, mock ? 'SUCCESS' : 'FAILED');
  }
});
