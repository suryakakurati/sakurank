import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Real = typeof import('@vercel/blob');

/**
 * In-memory stand-in for Vercel Blob that reproduces the production behaviour seen in the logs:
 *  - put({ ifMatch }) compares against the object's true (strong) ETag from the API.
 *  - get() serves through a CDN that returns a *different* ETag form (weak) for the same object.
 *  - head() returns the API's true ETag and size.
 */
function makeFakeBlob(real: Real, hooks: { beforePut?: () => void; staleGetOnce?: boolean } = {}) {
  const state = { body: null as string | null, n: 0, staleBody: null as string | null };
  const strong = () => `"etag-${state.n}"`;
  const fake = {
    head: vi.fn(async () => {
      if (state.body === null) throw new real.BlobNotFoundError();
      return { etag: strong(), size: Buffer.byteLength(state.body, 'utf8') };
    }),
    get: vi.fn(async () => {
      if (state.body === null) return null;
      let text = state.body;
      if (hooks.staleGetOnce && state.staleBody !== null) { text = state.staleBody; hooks.staleGetOnce = false; }
      return { statusCode: 200, stream: new Response(text).body, headers: new Headers(), blob: { etag: `W/${strong()}` } };
    }),
    put: vi.fn(async (_path: string, body: string, options: { allowOverwrite?: boolean; ifMatch?: string }) => {
      hooks.beforePut?.(); hooks.beforePut = undefined;
      if (options.allowOverwrite === false && state.body !== null) throw new real.BlobError('This blob already exists');
      if (options.ifMatch !== undefined && state.body !== null && options.ifMatch !== strong()) throw new real.BlobPreconditionFailedError();
      state.body = body; state.n += 1;
      return { etag: strong() };
    }),
    del: vi.fn(),
  };
  return { fake, state };
}

describe('collection writes on Vercel Blob when the CDN returns a different ETag form', () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('BLOB_STORE_ID', 'store_test'); });
  afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock('@vercel/blob'); });

  async function load(hooks = {}) {
    const real = await vi.importActual<Real>('@vercel/blob');
    const { fake, state } = makeFakeBlob(real, hooks);
    vi.doMock('@vercel/blob', () => ({ ...real, ...fake }));
    const store = await import('../src/lib/store');
    return { store, fake, state };
  }
  const bump = (doc: { limits: Record<string, { attempts: number; resetsAt: string }> }, key: string) => { doc.limits[key] = { attempts: 1, resetsAt: '2099-01-01T00:00:00.000Z' }; };

  it('first write into an empty store succeeds', async () => {
    const { store } = await load();
    await store.mutate(doc => bump(doc, 'a'));
    expect(Object.keys((await store.readCollection()).limits)).toEqual(['a']);
  });

  it('later writes succeed (this is the ETag mismatch seen in production)', async () => {
    const { store } = await load();
    await store.mutate(doc => bump(doc, 'a'));
    await store.mutate(doc => bump(doc, 'b'));
    await store.mutate(doc => bump(doc, 'c'));
    expect(Object.keys((await store.readCollection()).limits).sort()).toEqual(['a', 'b', 'c']);
  });

  it('twenty sequential writes keep every change', async () => {
    const { store } = await load();
    for (let i = 0; i < 20; i++) await store.mutate(doc => bump(doc, `k${i}`));
    expect(Object.keys((await store.readCollection()).limits)).toHaveLength(20);
  });

  it('a genuine concurrent writer is still detected and retried, never overwritten', async () => {
    let injected = false;
    const hooks = { beforePut: undefined as undefined | (() => void) };
    const { store, state } = await load(hooks);
    await store.mutate(doc => bump(doc, 'first'));
    hooks.beforePut = () => { // another writer lands between our read and our write
      if (injected) return; injected = true;
      const other = JSON.parse(state.body as string); bump(other, 'other-writer'); other.version += 1;
      state.body = JSON.stringify(other); state.n += 1;
    };
    await store.mutate(doc => bump(doc, 'mine'));
    const keys = Object.keys((await store.readCollection()).limits).sort();
    expect(keys).toEqual(['first', 'mine', 'other-writer']);
  });

  it('refuses stale content: a stale read is retried instead of being written back', async () => {
    const hooks = { staleGetOnce: false };
    const { store, state } = await load(hooks);
    await store.mutate(doc => bump(doc, 'a'));
    state.staleBody = state.body; // remember an old version
    await store.mutate(doc => bump(doc, 'b'));
    hooks.staleGetOnce = true;    // next read returns the old content once
    await store.mutate(doc => bump(doc, 'c'));
    expect(Object.keys((await store.readCollection()).limits).sort()).toEqual(['a', 'b', 'c']);
  });
});