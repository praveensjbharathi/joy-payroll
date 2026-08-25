import assert from "node:assert/strict";
import test from "node:test";
import { verifyCloudflareAccessJwt } from "../lib/cloudflare-access.ts";

const encoder = new TextEncoder();

test("accepts a correctly signed Cloudflare Access identity", async () => {
  const fixture = await accessToken({
    audience: "joy-payroll-audience",
    email: "admin@joyindia.in",
    issuer: "https://joy-test.cloudflareaccess.com",
  });
  const claims = await verifyCloudflareAccessJwt(fixture.token, {
    audience: "joy-payroll-audience",
    fetcher: fixture.fetcher,
    nowSeconds: fixture.now,
    teamDomain: "https://joy-test.cloudflareaccess.com",
  });
  assert.equal(claims.email, "admin@joyindia.in");
});

test("rejects a token issued for another Access application", async () => {
  const fixture = await accessToken({
    audience: "another-application",
    email: "admin@joyindia.in",
    issuer: "https://joy-audience-test.cloudflareaccess.com",
  });
  await assert.rejects(
    verifyCloudflareAccessJwt(fixture.token, {
      audience: "joy-payroll-audience",
      fetcher: fixture.fetcher,
      nowSeconds: fixture.now,
      teamDomain: "https://joy-audience-test.cloudflareaccess.com",
    }),
    /audience does not match/i,
  );
});

test("rejects an expired Access token", async () => {
  const fixture = await accessToken({
    audience: "joy-payroll-audience",
    email: "admin@joyindia.in",
    expiresInSeconds: -120,
    issuer: "https://joy-expiry-test.cloudflareaccess.com",
  });
  await assert.rejects(
    verifyCloudflareAccessJwt(fixture.token, {
      audience: "joy-payroll-audience",
      fetcher: fixture.fetcher,
      nowSeconds: fixture.now,
      teamDomain: "https://joy-expiry-test.cloudflareaccess.com",
    }),
    /expired/i,
  );
});

async function accessToken({
  audience,
  email,
  expiresInSeconds = 900,
  issuer,
}) {
  const now = 1_800_000_000;
  const keyPair = await crypto.subtle.generateKey(
    {
      hash: "SHA-256",
      modulusLength: 2048,
      name: "RSASSA-PKCS1-v1_5",
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ["sign", "verify"],
  );
  const kid = crypto.randomUUID();
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  publicJwk.alg = "RS256";
  publicJwk.kid = kid;
  publicJwk.use = "sig";

  const header = encodeJson({ alg: "RS256", kid, typ: "JWT" });
  const payload = encodeJson({
    aud: [audience],
    email,
    exp: now + expiresInSeconds,
    iat: now - 10,
    iss: issuer,
    name: "Joy Payroll Admin",
    sub: "test-user",
  });
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyPair.privateKey,
    encoder.encode(`${header}.${payload}`),
  );
  return {
    fetcher: async () =>
      new Response(JSON.stringify({ keys: [publicJwk] }), {
        headers: { "content-type": "application/json" },
      }),
    now,
    token: `${header}.${payload}.${encodeBytes(new Uint8Array(signature))}`,
  };
}

function encodeJson(value) {
  return encodeBytes(encoder.encode(JSON.stringify(value)));
}

function encodeBytes(value) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
