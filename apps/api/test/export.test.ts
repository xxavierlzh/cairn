import { strFromU8, unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './helpers';

let server: TestApp;

beforeAll(async () => {
  server = await startTestApp();
});

afterAll(async () => {
  await server?.stop();
});

describe('GET /api/export', () => {
  it('downloads every note as a vault that Obsidian can open', async () => {
    const alice = await server.signUp('alice@example.com');
    const bob = await server.signUp('bob@example.com');
    await alice.note('Welcome', '---\ntags: [start]\n---\nSee [[Plans|my plans]].\n');
    await alice.note('Plans', '- [ ] Ship phase 3 #todo');
    await alice.note('学习', '你好');
    await bob.note('Bob only', 'Not for Alice');

    const res = await alice.exportVault();
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="cairn-vault-\d{4}-\d{2}-\d{2}\.zip"$/,
    );

    const files = unzipSync(new Uint8Array(res.rawPayload));
    expect(Object.keys(files).sort()).toEqual(['Plans.md', 'Welcome.md', '学习.md']);
    expect(strFromU8(files['Welcome.md'] ?? new Uint8Array())).toBe(
      '---\ntags: [start]\n---\nSee [[Plans|my plans]].\n',
    );
  });

  it('needs a session', async () => {
    const res = await server.app.inject({ method: 'GET', url: '/api/export' });
    expect(res.statusCode).toBe(401);
  });

  it('allows only a few exports a minute', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await server.app.inject({ method: 'GET', url: '/api/export' })).statusCode);
    }
    expect(statuses).toContain(429);
  });
});
