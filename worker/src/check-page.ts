// The readable form of /<car>/check, for people opening it in a browser.
//
// Same report as the JSON (diagnose.ts builds it), drawn in the landing
// page's style: the navy bar, a race plate, one row per hop with its
// verdict, what it means and how to fix it. Pure string building, so it is
// unit-tested; every value from the report is HTML-escaped.

import type { CheckReport } from "./diagnose";

/** HTML for a browser; JSON for ?format=json, curl and scripts. */
export function wantsHtml(request: Request): boolean {
  const format = new URL(request.url).searchParams.get("format");
  if (format === "json") return false;
  if (format === "html") return true;
  return (request.headers.get("Accept") ?? "").includes("text/html");
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped text, with the report's `backtick` spans shown as code. */
function prose(value: string): string {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function relayRows(relay: unknown): string {
  if (!relay || typeof relay !== "object") return "";
  const r = relay as Record<string, unknown>;
  const rows: [string, string][] = [];
  if ("car_connected" in r) rows.push(["Car connection", r.car_connected ? "held" : "not held"]);
  if ("viewers" in r) rows.push(["Watching now", String(r.viewers)]);
  if (typeof r.since === "number") rows.push(["Connected since", new Date(r.since).toISOString()]);
  if (r.error) rows.push(["Last error", String(r.error)]);
  return rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("");
}

export function renderCheckPage(report: CheckReport): string {
  const rows = report.checks.map((c) => `
      <li class="hop" data-ok="${c.ok ? "yes" : "no"}">
        <span class="verdict">${c.ok ? "OK" : "Fail"}</span>
        <div class="hop-body">
          <h2>${escapeHtml(c.name)}</h2>
          ${c.url ? `<p class="url">${escapeHtml(c.url)}${c.status !== null ? ` &middot; HTTP ${escapeHtml(c.status)}` : ""}</p>` : ""}
          <p>${prose(c.meaning)}</p>
          ${c.fix ? `<p class="fix"><b>Fix</b> ${prose(c.fix)}</p>` : ""}
        </div>
      </li>`).join("");
  const relay = relayRows(report.relay);
  const id = escapeHtml(report.car);
  return `<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<title>${escapeHtml(report.name)} diagnostics</title>
<link rel="icon" href="/img/icon-blue.png" type="image/png" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@700;800&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" />
<style>
  :root {
    --paper: #ffffff; --wash: #f3f5f9; --navy: #0c1e3a; --ink: #16233d; --muted: #4c5a76; --faint: #7a89a6;
    --heading: #0c1e3a; --mist: #aebfd9; --blue: #1d5f9e; --blue-hi: #7fb2e5; --plate: #1d5f9e;
    --line: #dbe1ec; --on: #157a3f; --off: #b42318;
    --display: 'Saira Condensed', 'Arial Narrow', sans-serif;
    --body: 'Public Sans', system-ui, sans-serif;
    --mono: 'IBM Plex Mono', ui-monospace, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #0b1626; --wash: #101f36; --navy: #16294c; --ink: #dde5f2; --muted: #9fb0cc; --faint: #71829f;
      --heading: #f3f7fc; --blue: #2f6690; --plate: #7fb2e5; --line: rgba(154, 183, 220, 0.18);
      --on: #3ecf7a; --off: #ff6b6b;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--body); background: var(--paper); color: var(--ink); line-height: 1.55; min-height: 100vh; display: flex; flex-direction: column; -webkit-font-smoothing: antialiased; }
  a { color: inherit; text-decoration: none; }
  .wrap { width: 100%; max-width: 960px; margin: 0 auto; padding: 0 1.5rem; }
  header { position: relative; background: var(--navy); padding-bottom: 8px; }
  header::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 8px; background: repeating-conic-gradient(#ffffff 0 25%, transparent 0 50%) 0 0/16px 16px; }
  header .wrap { display: flex; align-items: center; justify-content: space-between; height: 60px; gap: 1rem; }
  .logo { display: flex; align-items: center; gap: 0.55rem; font-family: var(--display); font-weight: 800; font-size: 1.2rem; letter-spacing: 0.03em; text-transform: uppercase; color: #ffffff; white-space: nowrap; }
  .logo img { width: 38px; height: 38px; }
  .logo em { font-style: normal; color: var(--blue-hi); }
  nav { display: flex; gap: 1.25rem; }
  nav a { font-family: var(--mono); font-size: 0.74rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--mist); }
  nav a:hover { color: #ffffff; }
  main.wrap { flex: 1; padding: 2.25rem 1.5rem 3rem; }
  .title { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; }
  .plate { font-family: var(--mono); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--plate); border: 1px solid currentColor; padding: 0.1rem 0.6rem 0.1rem 0.75rem; clip-path: polygon(0 0, 100% 0, 100% 100%, 7px 100%); }
  h1 { font-family: var(--display); font-weight: 700; text-transform: uppercase; font-size: clamp(2rem, 5vw, 2.8rem); line-height: 1; color: var(--heading); }
  .summary { margin: 1rem 0 0.4rem; padding: 0.8rem 1rem; border-left: 4px solid var(--off); background: var(--wash); font-weight: 500; }
  .summary[data-ok="yes"] { border-left-color: var(--on); }
  .meta { font-family: var(--mono); font-size: 0.72rem; color: var(--faint); display: flex; flex-wrap: wrap; gap: 0.4rem 1.25rem; align-items: center; }
  .meta a:not(.btn) { color: var(--muted); border-bottom: 1px solid var(--line); }
  .hops { list-style: none; margin-top: 1.75rem; border-top: 1px solid var(--line); }
  .hop { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--line); }
  .verdict { align-self: start; font-family: var(--mono); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; text-align: center; padding: 0.2rem 0; color: #ffffff; background: var(--off); }
  .hop[data-ok="yes"] .verdict { background: var(--on); }
  .hop h2 { font-family: var(--display); font-weight: 700; text-transform: uppercase; font-size: 1.25rem; line-height: 1.2; color: var(--heading); }
  .hop p { font-size: 0.92rem; color: var(--muted); margin-top: 0.25rem; overflow-wrap: anywhere; }
  .hop .url { font-family: var(--mono); font-size: 0.72rem; color: var(--faint); }
  .hop .fix { color: var(--ink); background: var(--wash); padding: 0.55rem 0.75rem; margin-top: 0.5rem; }
  .hop .fix b { font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; margin-right: 0.4rem; color: var(--off); }
  code { font-family: var(--mono); font-size: 0.85em; background: var(--wash); padding: 0 0.25rem; }
  .fix code { background: var(--paper); }
  .extra { margin-top: 2rem; display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); }
  .extra h3 { font-family: var(--mono); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--plate); margin-bottom: 0.5rem; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 1rem; font-size: 0.85rem; }
  dt { color: var(--faint); } dd { color: var(--ink); overflow-wrap: anywhere; }
  .names { font-family: var(--mono); font-size: 0.75rem; color: var(--muted); overflow-wrap: anywhere; }
  .btn { display: inline-block; font-family: var(--display); font-weight: 700; font-size: 0.95rem; letter-spacing: 0.05em; text-transform: uppercase; padding: 0.55rem 1.25rem; background: var(--blue); color: #ffffff; clip-path: polygon(0 0, 100% 0, 100% 100%, 10px 100%); }
  @media (max-width: 600px) {
    .wrap { padding: 0 1rem; }
    main.wrap { padding: 1.5rem 1rem 2.5rem; }
    .hop { grid-template-columns: 1fr; gap: 0.5rem; }
    .verdict { justify-self: start; padding: 0.2rem 0.6rem; }
  }
</style>
</head>
<body>
<header>
  <div class="wrap">
    <a class="logo" href="/"><img src="/img/icon.png" alt="" /><span>SFU <em>Racerbot</em></span></a>
    <nav aria-label="Site"><a href="/">All cars</a><a href="/${id}/simple/">Simple</a></nav>
  </div>
</header>
<main class="wrap">
  <div class="title"><span class="plate">${id}</span><h1>${escapeHtml(report.name)} diagnostics</h1></div>
  <p class="summary" data-ok="${report.ok ? "yes" : "no"}">${prose(report.summary)}</p>
  <div class="meta">
    <span>Checked ${escapeHtml(report.checked_at)}</span>
    <a class="btn" href="/${id}/check">Run again</a>
    <a href="/${id}/check?format=json">Raw JSON</a>
  </div>
  <ul class="hops">${rows}
  </ul>
  <div class="extra">
    ${relay ? `<section><h3>Relay right now</h3><dl>${relay}</dl></section>` : ""}
    <section><h3>Worker settings (names only)</h3><p class="names">${report.worker_setting_names.map(escapeHtml).join(", ")}</p></section>
  </div>
</main>
</body>
</html>`;
}
