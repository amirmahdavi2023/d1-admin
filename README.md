# D1 Admin

A single-file admin panel for [Cloudflare D1](https://developers.cloudflare.com/d1/). Think phpMyAdmin, but for D1 — no CLI, no build step, no dependencies.

Paste one file into a Worker, bind your database, done.

![screenshot](screenshot.png)

## Why

The Cloudflare dashboard's D1 console is fine for a quick look, but painful for real work: no table browser, clunky query flow, no way to hand access to a teammate. D1 Admin gives you a fast table browser and SQL console that runs *inside your own account* — your data never touches a third-party service.

Built entirely from a phone, because that's how I ship everything.

## Features

- Browse all tables and views, tap to preview (`LIMIT 100`)
- Run any SQL statement — reads and writes — with timing and row counts
- Token auth (constant-time comparison), token stored only in your browser
- Zero dependencies, zero build step, one file, ~450 lines
- Works on mobile

## Setup (2 minutes, no CLI)

1. **Create a Worker.** Cloudflare dashboard → Workers & Pages → Create → Worker → deploy the hello-world, then click **Edit code**.
2. **Paste** the contents of [`worker.js`](worker.js), replacing everything. Deploy.
3. **Bind your database.** Worker → Settings → Bindings → Add → D1 database. Variable name must be `DB`.
4. **Set a token.** Worker → Settings → Variables and Secrets → Add → type **Secret**, name `ADMIN_TOKEN`, value: a long random string.
5. Open your Worker URL and sign in with the token.

## Security notes

- Anyone with the token has **full read/write access** to the database. Use a long random token and treat it like a password.
- The panel executes raw SQL by design — that's the point of an admin tool. Don't share the URL+token combination.
- For extra protection, put the Worker behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) (free for up to 50 users).

## Limitations (v1)

- One SQL statement per run (D1 `prepare().all()` semantics)
- Table preview is capped at 100 rows — use `LIMIT`/`OFFSET` for paging
- No CSV export, no schema editor yet — see issues for the roadmap

## License

MIT
