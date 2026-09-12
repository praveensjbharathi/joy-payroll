import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import nodemailer from "npm:nodemailer@6.9.16";
import { canInvite, parseObject, tokenHash, validInvite, validatedFields } from "./validation.ts";

import { handleFresh } from "./fresh.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const origins = new Set(["https://joy-payroll.praveen-red-07.workers.dev", "https://payroll.joycorporatesolutions.com", ...(Deno.env.get("APP_ORIGIN") || "").split(",").map(s => s.trim()).filter(Boolean)]);
const META = "_joyOnboarding";
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = { "access-control-allow-origin": origin && origins.has(origin) ? origin : [...origins][0], "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "cache-control": "no-store", vary: "Origin" };
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (origin && !origins.has(origin)) return json({ error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  try {
    const text = await req.text();
    if (text.length > 250000) return json({ error: "Application is too large" }, 413);
    let body: Record<string, any>;
    try { body = JSON.parse(text); } catch { return json({ error: "Invalid request" }, 400); }
    if (!body || typeof body !== "object" || !["create", "read", "submit", "list"].includes(body.action) || (body.employeeId !== undefined && (typeof body.employeeId !== "string" || body.employeeId.length > 100))) return json({ error: "Invalid request" }, 400);
    let actor: Record<string, any> | null = null;
    if (body.action === "create" || body.action === "list") {
      const jwt = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
      if (!jwt) return json({ error: "Sign in to invite employees" }, 401);
      const { data, error } = await admin.auth.getUser(jwt);
      if (error || !data.user?.email_confirmed_at || !data.user.email) return json({ error: "Verified login required" }, 401);
      const profile = await admin.from("app_users").select("*").eq("email", data.user.email.toLowerCase()).maybeSingle();
      if (profile.error || !profile.data) return json({ error: "Employee management access required" }, 403);
      actor = profile.data;
    } else if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)) return json({ error: "Invalid or expired invitation. Ask HR for a new link." }, 403);
    if (body.newEmployee === true || body.action === "list" || String(body.employeeId || "").startsWith("INV-")) return await handleFresh({ admin, body, actor, origin, origins, json, nodemailer });
    const result = await admin.from("employees").select("id,name,status,vendor_id,client_unit_id,email_address,application_json").eq("id", body.employeeId).maybeSingle();
    if (result.error) throw new Error("Employee lookup failed");
    const employee = result.data;
    if (!employee || employee.status !== "active") return json({ error: "Invitation unavailable. Contact HR." }, 403);
    const application = parseObject(employee.application_json);
    const metadata = parseObject(application[META]);
    // Compare the complete existing value so concurrent HR edits, reissues and duplicate submissions cannot overwrite one another.
    const save = async (next: Record<string, unknown>) => {
      let query = admin.from("employees").update({ application_json: JSON.stringify(next) }).eq("id", employee.id).eq("status", "active");
      query = employee.application_json == null ? query.is("application_json", null) : query.eq("application_json", employee.application_json);
      const saved = await query.select("id");
      if (saved.error) throw new Error("Unable to save application");
      return Boolean(saved.data?.length);
    };
    if (body.action === "create") {
      if (!actor || !canInvite(actor, employee)) return json({ error: "You do not have management access to this employee's company and unit." }, 403);
      if (!origin || !origins.has(origin)) return json({ error: "Open invitations from the payroll application" }, 400);
      if (typeof metadata.created === "number" && Date.now() - metadata.created < 60000) return json({ error: "An invitation was just created. Wait one minute before issuing another." }, 429);
      const sendEmail = body.sendEmail === true;
      const smtpPassword = Deno.env.get("JOY_SMTP_PASSWORD");
      if (sendEmail && !smtpPassword) return json({ error: "The onboarding function needs the existing JOY_SMTP_PASSWORD secret." }, 503);
      if (sendEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email_address || "")) return json({ error: "Add a valid employee email in Employee Master first." }, 400);
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join("");
      const expires = Date.now() + 7 * 86400000;
      const next = { ...application, [META]: { hash: await tokenHash(token), expires, created: Date.now(), createdBy: actor.email } };
      if (!await save(next)) return json({ error: "Employee details changed. Refresh and try again." }, 409);
      // Fragment keeps the secret out of server request URLs and referrers.
      const link = `${origin}/#onboarding=${encodeURIComponent(employee.id)}.${token}`;
      if (sendEmail) {
        const host = Deno.env.get("JOY_SMTP_HOST") || "mail.joycorporatesolutions.com";
        const port = Number(Deno.env.get("JOY_SMTP_PORT") || "465");
        const user = Deno.env.get("JOY_SMTP_USER") || "noreply@joycorporatesolutions.com";
        const transport = nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: port !== 465, auth: { user, pass: smtpPassword }, tls: { servername: host }, connectionTimeout: 15000, socketTimeout: 20000 });
        try {
          const receipt = await transport.sendMail({ from: `Joy Payroll <${user}>`, to: employee.email_address, subject: "Joy Payroll — complete your employee application", text: `Dear ${employee.name},\n\nPlease complete your employee application:\n${link}\n\nThis personal link expires in seven days and can be submitted once. Please do not forward it.\n\nRegards,\nJoy Payroll HR` });
          if (!receipt.accepted?.length) throw new Error("SMTP rejected recipient");
        } catch {
          // Revoke this failed invitation without clobbering a concurrent change.
          await admin.from("employees").update({ application_json: employee.application_json }).eq("id", employee.id).eq("application_json", JSON.stringify(next));
          return json({ error: "SMTP did not confirm sending. Check the mail service and try again." }, 502);
        } finally { transport.close(); }
      }
      await admin.from("audit_events").insert({ action: "employee-onboarding-invited", entity_type: "employee", entity_id: employee.id, actor_email: actor.email, summary: sendEmail ? "Onboarding invitation sent by SMTP" : "Onboarding sharing link created" });
      return json({ link, expires, sent: sendEmail, recipient: sendEmail ? employee.email_address : undefined });
    }
    if (!validInvite(metadata, await tokenHash(body.token))) return json({ error: "Invalid, expired or already submitted invitation. Ask HR for a new link." }, 403);
    if (body.action === "read") return json({ name: employee.name, expires: metadata.expires });
    let fields: Record<string, string>;
    try { fields = validatedFields(body.fields); } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid application" }, 400); }
    // Only application questionnaire fields are accepted; payroll, bank and identity master columns never come from this request.
    if (!await save({ ...application, ...fields, [META]: { ...metadata, hash: null, submitted: new Date().toISOString() } })) return json({ error: "This application changed or was already submitted. Contact HR before retrying." }, 409);
    await admin.from("audit_events").insert({ action: "employee-onboarding-submitted", entity_type: "employee", entity_id: employee.id, actor_email: "onboarding-applicant", summary: "Employee submitted application using a one-time invitation" });
    return json({ submitted: true });
  } catch {
    return json({ error: "Unable to process onboarding. Please contact HR or retry later." }, 500);
  }
});
