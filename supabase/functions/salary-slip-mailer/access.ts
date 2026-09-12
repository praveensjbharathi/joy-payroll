import { normalizePermissions, normalizeRole } from "../../../lib/access-control.ts";
export function canSendPayslips(actor: any, run: any) {
  if (!actor || actor.status !== "active") return false;
  if (actor.role === "super_admin") return true;
  if (!["payroll_team", "hr_team", "field_hr"].includes(actor.role)) return false;
  try {
    const permissions = normalizePermissions(normalizeRole(actor.role), JSON.parse(actor.permissions_json || "{}"));
    return permissions.payments === "manage" && JSON.parse(actor.client_scope_json || "[]").includes(run.vendor_id) && (actor.role === "payroll_team" || JSON.parse(actor.unit_scope_json || "[]").includes(run.client_unit_id));
  } catch { return false; }
}
export function recipientAddress(value: unknown) {
  if (value === undefined) return undefined;
  const email = String(value).trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) throw new Error("Enter one valid recipient email address");
  return email;
}
