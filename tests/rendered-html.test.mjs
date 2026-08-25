import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Miniflare } from "miniflare";

test("renders the payroll application shell and social metadata", async () => {
  const worker = new Miniflare({
    name: "joy-payroll-html-test",
    modules: true,
    modulesRules: [{ type: "ESModule", include: ["**/*.js", "**/*.mjs"] }],
    scriptPath: fileURLToPath(new URL("../dist/server/index.js", import.meta.url)),
    compatibilityDate: "2026-05-15",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
  });

  try {
    const response = await worker.dispatchFetch("http://localhost/", {
      headers: { accept: "text/html", "oai-authenticated-user-email": "render-test@example.com" },
    });

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const html = await response.text();
    assert.match(html, /<title>Joy Client Payroll Manager<\/title>/);
    assert.match(html, /Preparing your payroll workspace/);
    assert.match(html, /property="og:image"/);
  } finally {
    await worker.dispose();
  }
});
