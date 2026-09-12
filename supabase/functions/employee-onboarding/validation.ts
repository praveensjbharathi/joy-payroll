import { applicationSections } from "../../../lib/employee-application.ts";
import { normalizePermissions, normalizeRole } from "../../../lib/access-control.ts";

export function parseObject(value: unknown): Record<string, unknown> {
  try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; }
}
export function canInvite(profile: Record<string, any>, employee: Record<string, any>) {
  if (profile.status !== "active") return false;
  if (profile.role === "super_admin") return true;
  if (!["hr_team", "field_hr", "payroll_team"].includes(profile.role)) return false;
  const permissions = normalizePermissions(normalizeRole(profile.role), parseObject(profile.permissions_json));
  const scope = (value: unknown, id: string) => { try { const list = JSON.parse(String(value)); return Array.isArray(list) && list.includes(id); } catch { return false; } };
  return permissions.employees === "manage" && scope(profile.client_scope_json, employee.vendor_id)
    && (!["hr_team", "field_hr"].includes(profile.role) || scope(profile.unit_scope_json, employee.client_unit_id));
}
export function validatedFields(value: unknown) {
  const input = parseObject(value);
  const allowed = new Set(applicationSections.filter(s => s.title !== "Supporting document links").flatMap(s => s.fields));
  const entries = Object.entries(input);
  if (entries.some(([key, val]) => !allowed.has(key) || typeof val !== "string" || val.length > 2000)) throw new Error("Invalid application field or field longer than 2,000 characters.");
  if (!String(input["Digital Signature (Type your full name)"] || "").trim() || !String(input.Declaration || "").trim()) throw new Error("Confirm the declaration and type your full name.");
  return Object.fromEntries(entries) as Record<string, string>;
}
export async function tokenHash(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), n => n.toString(16).padStart(2, "0")).join("");
}
export function validInvite(metadata: Record<string, unknown>, hash: string, now = Date.now()) {
  return metadata.hash === hash && typeof metadata.expires === "number" && metadata.expires > now && !metadata.submitted;
}
