D1 Admin
Manage your Cloudflare D1 databases from any browser — including your phone. No CLI, no build step, no dependencies.
One file. Paste it into a Worker in the Cloudflare dashboard, bind your database, done. If you can open a browser, you can run this — no laptop, no terminal, no wrangler required.
Think phpMyAdmin, but for D1, living entirely inside your own Cloudflare account.
�
Load image
Why
The dashboard's built-in D1 console is fine for a quick look, but painful for real work: no table browser, clunky query flow, nothing usable on a phone.
Every other D1 admin tool assumes you have a terminal and a Node toolchain. This one assumes nothing. I build and ship everything from an Android phone — wrangler was never an option for me, so I made the tool that doesn't need it. If it works from a phone, it works from anywhere.
Your data never touches a third-party service: the panel runs as a Worker inside your account, talking directly to your D1 binding.
Features
Browse all tables and views, tap to preview (LIMIT 100)
Run any SQL statement — reads and writes — with timing and row counts
Mobile-first UI that's actually pleasant on a small screen
Token auth with constant-time comparison; token stored only in your browser
Rejects multi-statement queries (string-literal safe) — one statement at a time, by design
Zero dependencies, zero build step, one file, ~450 lines of readable JavaScript
Setup (2 minutes, entirely in the dashboard)
Create a Worker. Cloudflare dashboard → Workers & Pages → Create → Worker → deploy the hello-world, then click Edit code.
Paste the contents of worker.js, replacing everything. Deploy.
Bind your database. Worker → Settings → Bindings → Add → D1 database. Variable name must be DB.
Set a token. Worker → Settings → Variables and Secrets → Add → type Secret, name ADMIN_TOKEN, value: a long random string.
Open your Worker URL and sign in with the token.
That's the whole install. Steps 1–5 work fine from a phone browser.
Security notes
Anyone with the token has full read/write access to the database. Use a long random token and treat it like a password.
The panel executes raw SQL by design — that's the point of an admin tool. Don't share the URL+token combination.
Multi-statement input (SELECT 1; DROP TABLE …) is rejected server-side; the parser correctly skips semicolons inside string literals, quoted identifiers, and comments.
For extra protection, put the Worker behind Cloudflare Access (free for up to 50 users).
Limitations (v1)
One SQL statement per run (D1 prepare().all() semantics)
Table preview is capped at 100 rows — use LIMIT/OFFSET for paging
No CSV export, no schema editor yet — see issues for the roadmap
License
MIT
