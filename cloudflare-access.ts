type JsonObject = Record<string, unknown>;

export type CloudflareAccessClaims = JsonObject & {
  aud: string | string[];
  email: string;
  exp: number;
  iss: string;
  name?: string;
  nbf?: number;
  sub?: string;
};

type JsonWebKeyWithId = JsonWebKey & {
  alg?: string;
  kid?: string;
  use?: string;
};

type CachedJwks = {
  expiresAt: number;
  keys: JsonWebKeyWithId[];
};

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
const CLOCK_TOLERANCE_SECONDS = 60;
const jwksCache = new Map<string, CachedJwks>();

export async function verifyCloudflareAccessJwt(
  token: string,
  options: {
    audience: string;
    fetcher?: typeof fetch;
    nowSeconds?: number;
    teamDomain: string;
  },
): Promise<CloudflareAccessClaims> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new Error("Malformed Cloudflare Access token");
  }

  const header = decodeJsonSegment(parts[0]);
  const claims = decodeJsonSegment(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("Unsupported Cloudflare Access token algorithm");
  }

  const teamDomain = normalizeTeamDomain(options.teamDomain);
  const jwksUrl = `${teamDomain}/cdn-cgi/access/certs`;
  const fetcher = options.fetcher ?? fetch;
  let keys = await getJwks(jwksUrl, fetcher, false);
  let jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) {
    keys = await getJwks(jwksUrl, fetcher, true);
    jwk = keys.find((candidate) => candidate.kid === header.kid);
  }
  if (!jwk || jwk.kty !== "RSA") {
    throw new Error("Cloudflare Access signing key was not found");
  }

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throw new Error("Invalid Cloudflare Access token signature");

  validateClaims(claims, {
    audience: options.audience,
    issuer: teamDomain,
    nowSeconds: options.nowSeconds ?? Math.floor(Date.now() / 1000),
  });
  return claims as CloudflareAccessClaims;
}

function validateClaims(
  claims: JsonObject,
  options: { audience: string; issuer: string; nowSeconds: number },
) {
  if (normalizeTeamDomain(String(claims.iss ?? "")) !== options.issuer) {
    throw new Error("Cloudflare Access token issuer does not match");
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.some((value) => value === options.audience)) {
    throw new Error("Cloudflare Access token audience does not match");
  }
  if (typeof claims.exp !== "number") {
    throw new Error("Cloudflare Access token has no expiry");
  }
  if (claims.exp + CLOCK_TOLERANCE_SECONDS < options.nowSeconds) {
    throw new Error("Cloudflare Access token has expired");
  }
  if (
    typeof claims.nbf === "number" &&
    claims.nbf - CLOCK_TOLERANCE_SECONDS > options.nowSeconds
  ) {
    throw new Error("Cloudflare Access token is not active yet");
  }
  if (typeof claims.email !== "string" || !claims.email.includes("@")) {
    throw new Error("Cloudflare Access token has no valid email identity");
  }
}

async function getJwks(
  url: string,
  fetcher: typeof fetch,
  forceRefresh: boolean,
): Promise<JsonWebKeyWithId[]> {
  const cached = jwksCache.get(url);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }

  const response = await fetcher(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Unable to load Cloudflare Access signing keys (${response.status})`);
  }
  const body = (await response.json()) as { keys?: JsonWebKeyWithId[] };
  if (!Array.isArray(body.keys) || !body.keys.length) {
    throw new Error("Cloudflare Access signing keys are unavailable");
  }
  jwksCache.set(url, {
    expiresAt: Date.now() + JWKS_CACHE_TTL_MS,
    keys: body.keys,
  });
  return body.keys;
}

function decodeJsonSegment(segment: string): JsonObject {
  try {
    const decoded = new TextDecoder().decode(decodeBase64Url(segment));
    const value = JSON.parse(decoded) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("JWT segment is not an object");
    }
    return value as JsonObject;
  } catch {
    throw new Error("Malformed Cloudflare Access token payload");
  }
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

function normalizeTeamDomain(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Cloudflare Access team domain is invalid");
  }
  if (url.protocol !== "https:" || url.pathname !== "/") {
    throw new Error("Cloudflare Access team domain must be an HTTPS origin");
  }
  return url.origin;
}
