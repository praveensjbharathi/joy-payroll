import { applicableFields, applicationSections, documentCategories, isLanguageField, requiredApplicationFields } from "../../../lib/employee-application.ts";
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
  if (entries.length > 200 || entries.some(([key, val]) => (!allowed.has(key) && !isLanguageField(key)) || typeof val !== "string" || val.length > 2000)) throw new Error("Invalid application field or field longer than 2,000 characters.");
  for (const key of requiredApplicationFields) if (!String(input[key] || "").trim()) throw new Error(`Complete the required field: ${key}`);
  if (!["Fresher", "Experienced"].includes(String(input["Employment status"]))) throw new Error("Select Fresher or Experienced.");
  if (!["Unmarried", "Married", "Divorced", "Widowed"].includes(String(input["Marital status"]))) throw new Error("Select a valid marital status.");
  if (!/^\+?[\d ()-]{7,20}$/.test(String(input["Mobile number"]))) throw new Error("Enter a valid mobile number.");
  const dob = String(input["Date of birth"]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !Number.isFinite(Date.parse(dob)) || new Date(dob).toISOString().slice(0, 10) !== dob || dob > new Date().toISOString().slice(0, 10)) throw new Error("Enter a valid date of birth.");
  for (const [key, max] of [["Sibling count", 2], ["Children count", 3], ["Employment records", 2]] as const) if (input[key] !== undefined && !new RegExp(`^[0-${max}]$`).test(String(input[key]))) throw new Error(`Invalid ${key}.`);
  const languages = entries.filter(([key]) => isLanguageField(key));
  if (languages.length > 30 || languages.some(([, val]) => String(val).split(",").some(skill => !["", "Read", "Write", "Speak"].includes(skill.trim())))) throw new Error("Select Read, Write and Speak for each language.");
  if (!String(input["Digital Signature (Type your full name)"] || "").trim() || !String(input.Declaration || "").trim()) throw new Error("Confirm the declaration and type your full name.");
  return applicableFields(Object.fromEntries(entries) as Record<string, string>);
}

export function validatedDocuments(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 13) throw new Error("Select up to 13 supporting documents.");
  const seen = new Set<string>(); let total = 0;
  return value.map(doc => {
    if (!doc || !documentCategories.includes(doc.category) || seen.has(doc.category) || typeof doc.filename !== "string" || !doc.filename.trim() || doc.filename.length > 200 || /[\r\n\x00]/.test(doc.filename) || typeof doc.dataUrl !== "string") throw new Error("Invalid document category or filename.");
    const match = doc.dataUrl.match(/^data:(application\/pdf|image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match || match[2].length > 5592408) throw new Error("Use PDF, PNG or JPEG files up to 4 MB.");
    let bytes: string;
    try { bytes = atob(match[2]); } catch { throw new Error("Unable to decode document."); }
    total += bytes.length;
    if (!bytes.length || bytes.length > 4 * 1024 * 1024 || total > 18 * 1024 * 1024) throw new Error("Files exceed 4 MB each or 18 MB in total.");
    if (match[1] === "application/pdf" ? !bytes.startsWith("%PDF-") : match[1] === "image/png" ? !bytes.startsWith("\x89PNG\r\n\x1a\n") : !bytes.startsWith("\xff\xd8\xff")) throw new Error("Document contents do not match the file type.");
    seen.add(doc.category);
    return { category: doc.category, filename: doc.filename.trim(), dataUrl: doc.dataUrl };
  });
}

// Invitation holders see only the employee names and codes needed to select a referrer.
export async function referenceOptions(admin: any, excludeId?: string) {
  const { data, error } = await admin.from("employees").select("id,employee_code,name").eq("employment_type", "direct").eq("status", "active").order("name").limit(1000);
  if (error) throw error;
  return (data || []).filter((r: any) => r.id !== excludeId).map((r: any) => ({ id: r.id, employeeCode: r.employee_code, name: r.name }));
}
export async function applyReference(admin: any, fields: Record<string, string>, excludeId?: string) {
  const id = fields["Reference 1 - Employee ID"];
  const { data, error } = await admin.from("employees").select("id,employee_code,name").eq("id", id).eq("employment_type", "direct").eq("status", "active").maybeSingle();
  if (error || !data || id === excludeId) throw new Error("Select an active Joy direct employee as Reference 1.");
  return { ...fields, "Reference 1 - Employee Code": data.employee_code, "Reference 1 - Name": data.name };
}

export async function requestText(req: Request, limit = 26_000_000) {
  if (Number(req.headers.get("content-length")) > limit) throw new Error("Application is too large");
  const reader = req.body?.getReader(); if (!reader) return "";
  let text = "", bytes = 0; const decoder = new TextDecoder();
  while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > limit) { await reader.cancel(); throw new Error("Application is too large"); } text += decoder.decode(part.value, { stream: true }); }
  return text + decoder.decode();
}
export async function tokenHash(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), n => n.toString(16).padStart(2, "0")).join("");
}
export function validInvite(metadata: Record<string, unknown>, hash: string, now = Date.now()) {
  return metadata.hash === hash && typeof metadata.expires === "number" && metadata.expires > now && !metadata.submitted;
}
