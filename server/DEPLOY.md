# Host the sync server once, then sign in anywhere

You want your latest progress on any device without needing the device you last
used. That needs the sync server running somewhere always-on and reachable over
**https**. You set this up once; after that you never touch it — just sign in on
any device and the newest copy comes down.

Hosting it in the cloud is the smooth path: the server gets its own https address,
so there's no localhost or mixed-content trouble.

---

## Option A — Render (free, no command line)  ← easiest

1. Push this repo to GitHub (it already is).
2. Go to <https://render.com>, sign up (free), and verify your email.
3. **New +  →  Blueprint**, and pick this repository. Render reads `render.yaml`
   and sets up a free web service called **mathlab-sync**.
4. Click **Apply / Create**. Wait for it to go live (~1–2 min). You'll get a URL
   like `https://mathlab-sync-xxxx.onrender.com`.
5. Open that URL with `/v1/health` on the end — e.g.
   `https://mathlab-sync-xxxx.onrender.com/v1/health`. You should see
   `{"ok":true,...}`. That means it's running.

Now connect MathLab (see **Point MathLab at it** below).

Notes on the free tier:
- It **sleeps after ~15 min** of no use and wakes on the next request (~30s), so
  the first sync after a break is slow. That's normal.
- Its disk is **ephemeral** — a redeploy resets the stored blobs. That's fine
  here: every device keeps its own encrypted copy and re-uploads on the next
  sign-in, so the server re-seeds itself. For permanent storage, add a Render
  disk (paid) mounted at `/data` and set `DATA_FILE=/data/profiles.json`.

## Option B — Fly.io (free allowance, keeps data, uses the CLI)

1. Install the CLI: <https://fly.io/docs/hands-on/install-flyctl/>, then `fly auth signup`.
2. From `server/`: `fly launch --dockerfile Dockerfile` (say no to a database).
3. Add a volume so data survives restarts:
   `fly volumes create mathlab_data --size 1`, then in `fly.toml` mount it:
   ```toml
   [mounts]
     source = "mathlab_data"
     destination = "/app/data"
   ```
4. `fly deploy`. Your URL is `https://<app-name>.fly.dev`; check `/v1/health`.

## Option C — anything that runs Docker

`server/Dockerfile` builds a tiny image. Deploy it anywhere (Railway, a VPS…),
expose the port over https, and mount a volume at `/app/data` for durable storage.

---

## Point MathLab at it

1. Open MathLab → **Profile**, sign in.
2. In **Sync across devices**, set the server address to your URL (e.g.
   `https://mathlab-sync-xxxx.onrender.com`) and click **Test connection** — it
   should say "reachable".
3. Click **Turn sync on**, enter your password, and **Upload this device** once.

That's it. From now on, on **any** device: open MathLab, sign in with the same
username and password, and your newest profile is pulled down automatically — no
old device required. Make progress, sign in elsewhere later, and it follows you.

Security is unchanged: the server only ever stores the encrypted profile and a
hash of a token derived from your password. It cannot read your data, and neither
can whoever runs the host.
