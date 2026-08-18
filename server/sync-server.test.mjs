/**
 * Tests for the sync server, run against a real listening socket.
 *
 * The point of most of these is not that the happy path works — it is that a
 * profile cannot be read or overwritten by someone who does not hold its token,
 * and that a stale write is refused rather than silently winning.
 *
 * Run with `npm test` inside server/.
 */

import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let passed = 0
let failed = 0
const fails = []
const ok = (name, cond, detail = '') => {
    if (cond) { passed++; console.log(`  PASS  ${name}`) }
    else { failed++; fails.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

const PORT = 8799
const BASE = `http://127.0.0.1:${PORT}`
const dir = await mkdtemp(join(tmpdir(), 'mathlab-sync-'))
const DATA = join(dir, 'profiles.json')

const child = spawn(process.execPath, [new URL('./sync-server.mjs', import.meta.url).pathname], {
    env: { ...process.env, PORT: String(PORT), DATA_FILE: DATA, ALLOW_ORIGIN: '*' },
    stdio: ['ignore', 'pipe', 'pipe']
})
child.stderr.on('data', d => process.stderr.write(`[server] ${d}`))

const waitUp = async () => {
    for (let i = 0; i < 60; i++) {
        try { const r = await fetch(`${BASE}/v1/health`); if (r.ok) return true } catch { /* not yet */ }
        await new Promise(r => setTimeout(r, 100))
    }
    return false
}

const req = async (path, { method = 'GET', token, body } = {}) => {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined
    })
    let json = {}
    try { json = await res.json() } catch { /* no body */ }
    return { status: res.status, ...json, _headers: res.headers }
}

const BLOB = (ct = 'Y2lwaGVydGV4dA==') => ({ salt: 'c2FsdA==', iterations: 210000, iv: 'aXYxMjM0NTY3OA==', ct })

try {
    ok('server starts and answers health', await waitUp())

    /* ---- first write claims the name ---- */
    let r = await req('/v1/profile/ada', { method: 'PUT', token: 'ada-token', body: { baseVersion: 0, blob: BLOB() } })
    ok('a first upload is accepted', r.status === 200 && r.version === 1, JSON.stringify(r))

    r = await req('/v1/profile/ada', { token: 'ada-token' })
    ok('the owner can download it', r.status === 200 && r.blob.ct === 'Y2lwaGVydGV4dA==' && r.version === 1)

    /* ---- the important part: nobody else can read or clobber it ---- */
    r = await req('/v1/profile/ada', { token: 'wrong-token' })
    ok('a wrong token cannot download it', r.status === 404, `status ${r.status}`)
    ok('and it is refused the same way a missing profile is (no username leak)',
        /No profile there/.test(r.error || ''), r.error)

    r = await req('/v1/profile/nobody-here', { token: 'any' })
    ok('an unknown profile gives that identical answer',
        r.status === 404 && /No profile there/.test(r.error || ''))

    r = await req('/v1/profile/ada', { method: 'PUT', token: 'wrong-token', body: { baseVersion: 0, blob: BLOB('bmV3') } })
    ok('a wrong token cannot overwrite it', r.status === 403, `status ${r.status}`)
    r = await req('/v1/profile/ada', { token: 'ada-token' })
    ok('the original blob survived that attempt', r.blob.ct === 'Y2lwaGVydGV4dA==')

    r = await req('/v1/profile/ada', { method: 'DELETE', token: 'wrong-token' })
    ok('a wrong token cannot delete it', r.status === 404)

    r = await req('/v1/profile/ada', { token: '' })
    ok('no token at all is rejected', r.status === 401)

    /* ---- stale writes are refused, not merged away ---- */
    r = await req('/v1/profile/ada', { method: 'PUT', token: 'ada-token', body: { baseVersion: 1, blob: BLOB('djI=') } })
    ok('an up-to-date write moves the version on', r.status === 200 && r.version === 2)

    r = await req('/v1/profile/ada', { method: 'PUT', token: 'ada-token', body: { baseVersion: 1, blob: BLOB('c3RhbGU=') } })
    ok('a stale write is refused with 409', r.status === 409, `status ${r.status}`)
    ok('the 409 reports where the server actually is', r.version === 2)
    r = await req('/v1/profile/ada', { token: 'ada-token' })
    ok('the stale write did not land', r.blob.ct === 'djI=')

    /* ---- validation ---- */
    r = await req('/v1/profile/ada', { method: 'PUT', token: 'ada-token', body: { baseVersion: 2, blob: { nope: 1 } } })
    ok('a malformed blob is rejected', r.status === 400)
    r = await req('/v1/profile/bad%2Fname', { token: 'x' })
    ok('a bad username is rejected', r.status === 400 || r.status === 404)
    r = await req('/v1/nonsense', { token: 'x' })
    ok('an unknown route 404s', r.status === 404)

    /* ---- the server genuinely cannot read anything ---- */
    const { readFile } = await import('node:fs/promises')
    const onDisk = await readFile(DATA, 'utf8')
    ok('no auth token is stored in the clear', !onDisk.includes('ada-token'))
    ok('what is stored is only the ciphertext and a hash',
        onDisk.includes('djI=') && /"authHash"/.test(onDisk))

    /* ---- CORS preflight, since the site is on another origin ---- */
    const pre = await fetch(`${BASE}/v1/profile/ada`, { method: 'OPTIONS', headers: { Origin: 'https://example.com' } })
    ok('preflight is answered', pre.status === 204)
    ok('preflight allows the methods the client uses',
        /PUT/.test(pre.headers.get('access-control-allow-methods') || ''))

    /* ---- delete really removes it ---- */
    r = await req('/v1/profile/ada', { method: 'DELETE', token: 'ada-token' })
    ok('the owner can delete it', r.status === 200 && r.deleted === true)
    r = await req('/v1/profile/ada', { token: 'ada-token' })
    ok('it is gone afterwards', r.status === 404)
} finally {
    child.kill()
    await rm(dir, { recursive: true, force: true })
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) { console.log('\nFailures:'); fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1) }
console.log('Sync server tests passed ✓')
