import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyCloudflareAccessJwt } from "../lib/cloudflare-access";
import {
  chatGPTSignInPath,
  getChatGPTUser,
  type ChatGPTUser,
} from "./chatgpt-auth";

export type AuthenticatedUser = ChatGPTUser;

type RuntimeAuthEnv = {
  AUTH_PROVIDER?: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  JOY_DEV_AUTH_EMAIL?: string;
  JOY_DEV_AUTH_NAME?: string;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const chatGPTUser = await getChatGPTUser();
  if (chatGPTUser) return chatGPTUser;

  const requestHeaders = await headers();
  const runtimeEnv = env as unknown as RuntimeAuthEnv;
  const developmentEmail =
    process.env.NODE_ENV !== "production"
      ? process.env.JOY_DEV_AUTH_EMAIL ?? runtimeEnv.JOY_DEV_AUTH_EMAIL
      : null;
  if (developmentEmail) {
    const displayName =
      process.env.JOY_DEV_AUTH_NAME ??
      runtimeEnv.JOY_DEV_AUTH_NAME ??
      "Local Super Admin";
    return {
      displayName,
      email: developmentEmail.trim().toLowerCase(),
      fullName: displayName,
    };
  }

  const assertion = requestHeaders.get("cf-access-jwt-assertion");
  const isCloudflareAccess =
    runtimeEnv.AUTH_PROVIDER === "cloudflare_access" || Boolean(assertion);
  if (!isCloudflareAccess || !assertion) return null;
  if (!runtimeEnv.CF_ACCESS_TEAM_DOMAIN || !runtimeEnv.CF_ACCESS_AUD) {
    throw new Error(
      "Cloudflare Access is enabled, but CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD is missing.",
    );
  }

  const claims = await verifyCloudflareAccessJwt(assertion, {
    audience: runtimeEnv.CF_ACCESS_AUD,
    teamDomain: runtimeEnv.CF_ACCESS_TEAM_DOMAIN,
  });
  const fullName = typeof claims.name === "string" ? claims.name : null;
  return {
    displayName: fullName ?? claims.email,
    email: claims.email.trim().toLowerCase(),
    fullName,
  };
}

export async function requireAuthenticatedUser(
  returnTo: string,
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (user) return user;

  const runtimeEnv = env as unknown as RuntimeAuthEnv;
  if (runtimeEnv.AUTH_PROVIDER === "cloudflare_access") {
    throw new Error(
      "Secure company sign-in is required. Confirm that this Worker is protected by Cloudflare Access.",
    );
  }
  redirect(chatGPTSignInPath(returnTo));
}
