import { describe, expect, it } from "vitest";
import { cloudflareErrorCode, explain } from "../src/diagnose";
import { escapeHtml, renderCheckPage, wantsHtml } from "../src/check-page";
import { parseRoute } from "../src/routes";

describe("/<car>/check", () => {
  it("is a route", () => {
    expect(parseRoute("/rb2/check")).toEqual({ kind: "check", car: "rb2" });
  });

  it("reads Cloudflare's numbered error pages", () => {
    expect(cloudflareErrorCode("<title>Error 1033</title>")).toBe(1033);
    expect(cloudflareErrorCode("error code: 1016")).toBe(1016);
    expect(cloudflareErrorCode("hello")).toBeNull();
  });

  it("names the right fix for each failure", () => {
    expect(explain("dashboard", 302, "https://sfu.cloudflareaccess.com/cdn-cgi/access/login", null).fix).toMatch(/Service Auth/);
    expect(explain("dashboard", 403, null, null).fix).toMatch(/ACCESS_CLIENT_ID/);
    expect(explain("dashboard", 530, null, 1033).meaning).toMatch(/tunnel is not connected/);
    expect(explain("camera", 530, null, 1016).fix).toMatch(/route/);
    expect(explain("bridge", 502, null, null).fix).toMatch(/8765/);
    expect(explain("dashboard websocket", 404, null, null).fix).toMatch(/localhost:8080/);
  });

  it("spots a WAF/bot challenge or block before blaming Access", () => {
    const challenged = explain("dashboard websocket", 403, null, null, "challenge");
    expect(challenged.ok).toBe(false);
    expect(challenged.meaning).toMatch(/challenge/);
    expect(challenged.fix).toMatch(/-origin\.sfuracerbot\.ca/);
    expect(explain("relay websocket", 403, null, null, "challenge").fix).toMatch(/Durable Object/);
    expect(explain("camera", 403, null, 1020).fix).toMatch(/-origin\.sfuracerbot\.ca/);
  });

  it("recognises working answers", () => {
    expect(explain("dashboard websocket", 101, null, null).ok).toBe(true);
    expect(explain("dashboard", 200, null, null).ok).toBe(true);
    expect(explain("bridge", 101, null, null).ok).toBe(true);
    expect(explain("bridge", 400, null, null).ok).toBe(false);
    expect(explain("relay websocket", 101, null, null).ok).toBe(true);
    expect(explain("camera", 404, null, null).ok).toBe(true);
    expect(explain("dashboard", 500, null, null).ok).toBe(false);
  });
});

describe("/<car>/check as a page", () => {
  const report = {
    car: "rb1",
    name: "Car 1",
    summary: "Not working: bridge. See each \"fix\".",
    ok: false,
    checks: [
      { name: "worker secrets", url: "", ok: true, status: null, meaning: "Both set." },
      {
        name: "bridge", url: "https://rb1-bridge-origin.example/", ok: false, status: 502,
        meaning: "Nothing answered <script>alert(1)</script>.", fix: "Run `car/check.sh` on the car.",
      },
    ],
    worker_setting_names: ["ACCESS_CLIENT_ID", "CARS"],
    relay: { car_connected: false, viewers: 2, since: null, error: "car rb1 unreachable" },
    checked_at: "2026-10-11T00:00:00.000Z",
  };

  it("gives browsers HTML and everything else JSON", () => {
    const req = (url: string, accept?: string) => new Request(url, accept ? { headers: { Accept: accept } } : {});
    expect(wantsHtml(req("https://d.example/rb1/check", "text/html,application/xhtml+xml"))).toBe(true);
    expect(wantsHtml(req("https://d.example/rb1/check", "*/*"))).toBe(false);
    expect(wantsHtml(req("https://d.example/rb1/check"))).toBe(false);
    expect(wantsHtml(req("https://d.example/rb1/check?format=json", "text/html"))).toBe(false);
    expect(wantsHtml(req("https://d.example/rb1/check?format=html", "*/*"))).toBe(true);
  });

  it("shows each hop's verdict, meaning and fix", () => {
    const html = renderCheckPage(report);
    expect(html).toContain("Car 1 diagnostics");
    expect(html).toMatch(/data-ok="yes"[\s\S]*worker secrets/);
    expect(html).toMatch(/data-ok="no"[\s\S]*bridge[\s\S]*HTTP 502/);
    expect(html).toContain("<code>car/check.sh</code>");
    expect(html).toContain('href="/rb1/check?format=json"');
    expect(html).toContain("<dt>Watching now</dt><dd>2</dd>");
  });

  it("escapes everything that came from the report", () => {
    const html = renderCheckPage(report);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(escapeHtml(`"<&'>`)).toBe("&quot;&lt;&amp;&#39;&gt;");
  });
});
