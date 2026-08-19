# MathLab profile sync server

A small, dependency-free service that lets one MathLab profile follow you to
another device. It is a **zero-knowledge blob store**: it holds an encrypted
profile it cannot read.

## What it does and does not know

| It stores | It never sees |
|---|---|
| your username | your password |
| the encrypted profile (ciphertext, salt, IV) | the key that decrypts it |
| a SHA-256 of an auth token | anything inside your profile |

Profiles are encrypted **in the browser** with AES-GCM under a key stretched
from your password by PBKDF2. That key never leaves the device. The auth token
sent to the server is a *separate* PBKDF2 output from the same password, salted
with your username, so it proves ownership without revealing the password or the
encryption key.

The practical consequences:

- Whoever runs the server — including you — cannot read anyone's progress.
- Taking the disk gets you ciphertext and nothing else.
- **A forgotten password cannot be reset.** There is nothing on the server that
  could recover the data. This is the cost of the server not being able to read it.

## Run it

```bash
npm run sync              # from the project root — http://localhost:8787
# or:  cd server && npm start
```

Then, in MathLab → Profile → **Sync across devices**, set the server address to
`http://localhost:8787` and turn sync on.

**"Could not reach the sync server"?** Two usual causes:
- The server isn't running — start it with `npm run sync`.
- A secure (https) MathLab can't call a plain `http://` server on the network.
  Use `http://localhost:8787` on the same machine, or give the server an https
  address (a reverse proxy with a certificate). A public https page reaching a
  local server also needs Private Network Access, which this server now grants.

Configuration is all environment variables:

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8787` | |
| `DATA_FILE` | `./data/profiles.json` | Written atomically (temp file + rename) |
| `ALLOW_ORIGIN` | `*` | **Set this in production** to your site's origin, comma-separated for several |

```bash
PORT=8787 \
DATA_FILE=/var/lib/mathlab/profiles.json \
ALLOW_ORIGIN=https://priyaanh.github.io \
node sync-server.mjs
```

## Point the site at it

In MathLab: **Profile → Sync across devices**, enter the server address, press
*Test connection*, then *Turn sync on*. Upload from the device that has your
data, then create the same username and password on the other device and press
*Download from server*.

To bake in a default so it is pre-filled, build the site with:

```bash
VITE_SYNC_URL=https://your-sync-server.example npm run build
```

A person can still override it in the UI.

## Deploying

It is one file with no dependencies, so anywhere that runs Node 18+ works.

- **Render / Railway / Fly.io** — point at `server/`, start command `node sync-server.mjs`.
  Attach a persistent disk and set `DATA_FILE` onto it, or the store is wiped on redeploy.
- **A VPS** — run it behind nginx or Caddy with TLS, under systemd or pm2.
- **Docker** — `FROM node:20-alpine`, copy `server/`, `CMD ["node","sync-server.mjs"]`.

**Serve it over HTTPS.** Browsers block requests from an HTTPS page to a plain
HTTP address, so a site on GitHub Pages cannot talk to an `http://` server.
`http://localhost` is the exception, which is why local testing works.

The JSON file store is deliberate — it suits a handful of profiles and is easy
to back up (copy the file). For anything larger, replace `load`/`save` in
`sync-server.mjs` with a real database; nothing else has to change.

## API

All routes take `Authorization: Bearer <auth token>`.

| Route | Purpose |
|---|---|
| `GET /v1/health` | liveness, and how many profiles are stored |
| `GET /v1/profile/:user` | fetch `{ blob, version, updatedAt }` |
| `PUT /v1/profile/:user` | store `{ baseVersion, blob }` |
| `DELETE /v1/profile/:user` | remove it |

`PUT` carries the version the client last saw. If the server has moved on it
answers **409** with its current version instead of overwriting, so two devices
editing at once cannot silently lose one side's work — MathLab surfaces that as
a conflict and asks which copy wins.

A wrong token gets **404**, exactly as a missing profile does, so the API cannot
be used to discover which usernames exist. Requests are rate-limited to 60 per
IP per minute.

## Tests

```bash
cd server && npm test
```

23 checks against a real listening socket, covering the parts that matter: that
a wrong token can neither read, overwrite nor delete a profile; that a stale
write is refused rather than clobbering; and that nothing readable is on disk.
