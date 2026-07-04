/**
 * D1 Admin — a single-file admin panel for Cloudflare D1.
 *
 * Paste this into a Cloudflare Worker, bind your D1 database as `DB`,
 * set a secret named `ADMIN_TOKEN`, and open the Worker URL.
 *
 * https://github.com/amirmahdavi2023/d1-admin
 * License: MIT
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---- UI ----
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(HTML, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // ---- API ----
    if (url.pathname.startsWith("/api/")) {
      // Configuration checks
      if (!env.ADMIN_TOKEN) {
        return json({ error: "Setup incomplete: add a secret named ADMIN_TOKEN in Settings → Variables." }, 500);
      }
      if (!env.DB) {
        return json({ error: "Setup incomplete: bind a D1 database as DB in Settings → Bindings." }, 500);
      }

      // Auth
      const auth = request.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!token || !timingSafeEqual(token, env.ADMIN_TOKEN)) {
        return json({ error: "Unauthorized" }, 401);
      }

      try {
        if (url.pathname === "/api/tables" && request.method === "GET") {
          const { results } = await env.DB.prepare(
            "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
          ).all();
          return json({ tables: results });
        }

        if (url.pathname === "/api/schema" && request.method === "GET") {
          const table = url.searchParams.get("table") || "";
          const { results } = await env.DB.prepare(
            `PRAGMA table_info(${quoteIdent(table)})`
          ).all();
          return json({ columns: results });
        }

        if (url.pathname === "/api/query" && request.method === "POST") {
          const body = await request.json().catch(() => ({}));
          const sql = (body.sql || "").trim();
          if (!sql) return json({ error: "Empty query." }, 400);
          if (hasMultipleStatements(sql)) {
            return json({ error: "Multiple statements are not supported — run one at a time." }, 400);
          }

          const started = Date.now();
          const res = await env.DB.prepare(sql).all();
          const elapsed = Date.now() - started;

          return json({
            results: res.results || [],
            meta: {
              duration_ms: elapsed,
              rows_read: res.meta?.rows_read ?? null,
              rows_written: res.meta?.rows_written ?? null,
              changes: res.meta?.changes ?? null,
              last_row_id: res.meta?.last_row_id ?? null,
            },
          });
        }

        return json({ error: "Not found" }, 404);
      } catch (err) {
        return json({ error: String(err.message || err) }, 400);
      }
    }

    return new Response("Not found", { status: 404 });
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// True if sql contains more than one statement.
// Semicolons inside string literals ('..'), quoted identifiers (".."),
// line comments (--) and block comments (/* */) don't count.
// A trailing semicolon is allowed, even when followed by comments
// or whitespace (`SELECT 1; -- done` is one statement).
function hasMultipleStatements(sql) {
  const s = sql;
  let mode = null;   // null | 'sq' | 'dq' | 'line' | 'block'
  let ended = false; // saw a statement-terminating semicolon
  for (let i = 0; i < s.length; i++) {
    const c = s[i], d = s[i + 1];
    if (mode === "sq") {
      if (c === "'") { if (d === "'") i++; else mode = null; }
    } else if (mode === "dq") {
      if (c === '"') { if (d === '"') i++; else mode = null; }
    } else if (mode === "line") {
      if (c === "\n") mode = null;
    } else if (mode === "block") {
      if (c === "*" && d === "/") { i++; mode = null; }
    } else if (c === "-" && d === "-") {
      mode = "line"; i++;
    } else if (c === "/" && d === "*") {
      mode = "block"; i++;
    } else if (c === ";") {
      ended = true;
    } else if (!/\s/.test(c)) {
      if (ended) return true; // real content after a completed statement
      if (c === "'") mode = "sq";
      else if (c === '"') mode = "dq";
    }
  }
  return false;
}

// Exported for tests (see test.mjs); has no effect on the Worker runtime.
export { hasMultipleStatements };

// Quote an SQLite identifier safely: "name" with internal quotes doubled.
function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

// Constant-time-ish string comparison to avoid trivial timing attacks.
function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Embedded UI
// ---------------------------------------------------------------------------

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>D1 Admin</title>
<style>
  :root {
    --bg: #16181d;
    --panel: #1d2026;
    --border: #2b2f38;
    --text: #e7e9ec;
    --muted: #8b929d;
    --accent: #f6821f;      /* Cloudflare orange */
    --accent-dim: #b35f17;
    --danger: #f0716b;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    font-size: 14px;
    border-top: 2px solid var(--accent);
  }
  button {
    font: inherit; cursor: pointer; border: 1px solid var(--border);
    background: var(--panel); color: var(--text); border-radius: 6px; padding: 7px 14px;
  }
  button.primary { background: var(--accent); border-color: var(--accent); color: #16181d; font-weight: 600; }
  button.primary:hover { background: #ff9436; }
  button:focus-visible, input:focus-visible, textarea:focus-visible, .tbl:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 1px;
  }
  input, textarea {
    font: inherit; background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; width: 100%;
  }
  textarea { font-family: var(--mono); font-size: 13px; resize: vertical; min-height: 96px; line-height: 1.5; }

  /* Login */
  #login {
    display: flex; align-items: center; justify-content: center; height: 100vh;
  }
  #login .card {
    width: min(360px, 90vw); background: var(--panel); border: 1px solid var(--border);
    border-radius: 10px; padding: 28px;
  }
  #login h1 { font-family: var(--mono); font-size: 18px; margin-bottom: 4px; }
  #login h1 span { color: var(--accent); }
  #login p { color: var(--muted); margin-bottom: 18px; font-size: 13px; }
  #login form > * + * { margin-top: 10px; }
  #login .err { color: var(--danger); font-size: 13px; min-height: 18px; margin-top: 10px; }

  /* App layout */
  #app { display: none; height: 100vh; }
  #app.on { display: flex; }
  aside {
    width: 220px; flex: none; border-right: 1px solid var(--border);
    background: var(--panel); display: flex; flex-direction: column;
  }
  aside header {
    padding: 14px 16px; border-bottom: 1px solid var(--border);
    font-family: var(--mono); font-size: 15px;
  }
  aside header span { color: var(--accent); }
  #tables { overflow-y: auto; flex: 1; padding: 8px; }
  .tbl {
    display: block; width: 100%; text-align: left; padding: 7px 10px;
    background: none; border: none; border-radius: 6px; color: var(--text);
    font-family: var(--mono); font-size: 13px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tbl:hover { background: var(--bg); }
  .tbl.active { background: var(--bg); color: var(--accent); }
  .tbl .type { color: var(--muted); font-size: 11px; margin-left: 6px; }
  aside footer { padding: 10px; border-top: 1px solid var(--border); }
  aside footer button { width: 100%; font-size: 13px; }

  main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  #editor { padding: 14px 16px; border-bottom: 1px solid var(--border); }
  #editor .row { display: flex; gap: 10px; margin-top: 10px; align-items: center; }
  #editor .hint { color: var(--muted); font-size: 12px; }

  #status { padding: 8px 16px; font-family: var(--mono); font-size: 12px; color: var(--muted); border-bottom: 1px solid var(--border); min-height: 33px; }
  #status.error { color: var(--danger); }

  #results { flex: 1; overflow: auto; }
  table { border-collapse: collapse; font-family: var(--mono); font-size: 12.5px; min-width: 100%; }
  th, td { padding: 6px 12px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; max-width: 420px; overflow: hidden; text-overflow: ellipsis; }
  th { position: sticky; top: 0; background: var(--panel); color: var(--muted); font-weight: 600; z-index: 1; }
  tr:hover td { background: #1b1e24; }
  td.null { color: var(--muted); font-style: italic; }
  .empty { padding: 40px; color: var(--muted); text-align: center; }

  /* Mobile */
  @media (max-width: 720px) {
    #app.on { flex-direction: column; }
    aside { width: 100%; max-height: 34vh; border-right: none; border-bottom: 1px solid var(--border); }
  }
  @media (prefers-reduced-motion: no-preference) {
    button.primary { transition: background .15s ease; }
  }
</style>
</head>
<body>

<div id="login">
  <div class="card">
    <h1>D1 <span>Admin</span></h1>
    <p>Enter the admin token you set for this Worker.</p>
    <form id="loginForm">
      <input id="tokenInput" type="password" placeholder="Admin token" autocomplete="current-password" autofocus>
      <button class="primary" type="submit" style="width:100%">Sign in</button>
    </form>
    <div class="err" id="loginErr"></div>
  </div>
</div>

<div id="app">
  <aside>
    <header>D1 <span>Admin</span></header>
    <nav id="tables" aria-label="Tables"></nav>
    <footer><button id="signOut">Sign out</button></footer>
  </aside>
  <main>
    <section id="editor">
      <textarea id="sql" spellcheck="false" placeholder="SELECT * FROM users LIMIT 50;"></textarea>
      <div class="row">
        <button class="primary" id="run">Run query</button>
        <span class="hint">Ctrl+Enter to run &middot; one statement at a time</span>
      </div>
    </section>
    <div id="status">Ready.</div>
    <section id="results"><div class="empty">Pick a table or run a query.</div></section>
  </main>
</div>

<script>
(function () {
  var token = localStorage.getItem("d1_admin_token") || "";
  var $ = function (id) { return document.getElementById(id); };

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers, {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
    });
    return fetch(path, opts).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.error || ("HTTP " + r.status));
        return data;
      });
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function setStatus(msg, isError) {
    var el = $("status");
    el.textContent = msg;
    el.className = isError ? "error" : "";
  }

  function renderResults(data) {
    var box = $("results");
    var rows = data.results;
    var m = data.meta;
    var parts = [];
    if (rows.length) parts.push(rows.length + " row" + (rows.length === 1 ? "" : "s"));
    if (m.changes) parts.push(m.changes + " changed");
    if (m.rows_read != null) parts.push(m.rows_read + " read");
    parts.push(m.duration_ms + " ms");
    setStatus(parts.join(" \\u00b7 "));

    if (!rows.length) {
      box.innerHTML = '<div class="empty">No rows returned.</div>';
      return;
    }
    var cols = Object.keys(rows[0]);
    var html = "<table><thead><tr>";
    cols.forEach(function (c) { html += "<th>" + esc(c) + "</th>"; });
    html += "</tr></thead><tbody>";
    rows.forEach(function (r) {
      html += "<tr>";
      cols.forEach(function (c) {
        var v = r[c];
        html += v === null
          ? '<td class="null">NULL</td>'
          : "<td>" + esc(v) + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    box.innerHTML = html;
  }

  function runQuery(sql) {
    setStatus("Running\\u2026");
    api("/api/query", { method: "POST", body: JSON.stringify({ sql: sql }) })
      .then(renderResults)
      .catch(function (e) {
        $("results").innerHTML = '<div class="empty">Query failed.</div>';
        setStatus(e.message, true);
      });
  }

  function loadTables() {
    return api("/api/tables").then(function (data) {
      var nav = $("tables");
      nav.innerHTML = "";
      if (!data.tables.length) {
        nav.innerHTML = '<div class="empty" style="padding:20px">No tables yet.</div>';
        return;
      }
      data.tables.forEach(function (t) {
        var b = document.createElement("button");
        b.className = "tbl";
        b.innerHTML = esc(t.name) + (t.type === "view" ? '<span class="type">view</span>' : "");
        b.onclick = function () {
          nav.querySelectorAll(".tbl").forEach(function (x) { x.classList.remove("active"); });
          b.classList.add("active");
          var q = 'SELECT * FROM "' + t.name.replace(/"/g, '""') + '" LIMIT 100;';
          $("sql").value = q;
          runQuery(q);
        };
        nav.appendChild(b);
      });
    });
  }

  function enterApp() {
    $("login").style.display = "none";
    $("app").classList.add("on");
    loadTables().catch(function (e) { setStatus(e.message, true); });
  }

  // Login
  $("loginForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    token = $("tokenInput").value.trim();
    $("loginErr").textContent = "";
    api("/api/tables")
      .then(function () {
        localStorage.setItem("d1_admin_token", token);
        enterApp();
      })
      .catch(function (e) { $("loginErr").textContent = e.message; });
  });

  $("signOut").onclick = function () {
    localStorage.removeItem("d1_admin_token");
    location.reload();
  };

  $("run").onclick = function () { runQuery($("sql").value.trim()); };
  $("sql").addEventListener("keydown", function (ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
      ev.preventDefault();
      runQuery($("sql").value.trim());
    }
  });

  // Auto-login if a stored token still works
  if (token) {
    api("/api/tables").then(enterApp).catch(function () {
      localStorage.removeItem("d1_admin_token");
    });
  }
})();
</script>
</body>
</html>`;
