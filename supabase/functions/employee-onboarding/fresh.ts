import { canInvite, parseObject, tokenHash, validInvite, validatedFields } from "./validation.ts";

// Applicant records stay separate from active employees and payroll until HR reviews them.
export async function handleFresh({ admin, body, actor, origin, origins, json, nodemailer }: any) {
  const table = "employee_invitations";
  if (body.action === "list") {
    if (!actor) return json({ error: "Sign in required" }, 401);
    const scope = { vendor_id: body.vendorId, client_unit_id: body.unitId };
    if (!canInvite(actor, scope)) return json({ error: "Employee management access required for this location" }, 403);
    const { data, error } = await admin.from(table).select("id,email_address,name,vendor_id,client_unit_id,employment_type,application_json,submitted_at,expires_at,created_at").eq("vendor_id", body.vendorId).eq("client_unit_id", body.unitId).order("created_at", { ascending: false });
    if (error) throw error;
    return json({ invitations: data });
  }
  if (body.action === "create") {
    if (!actor || !origin || !origins.has(origin)) return json({ error: "Open invitations from your signed-in payroll application" }, 403);
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    if (email.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) || name.length > 200 || !["client", "direct"].includes(body.employmentType)) return json({ error: "Enter one valid email address and select the employment type" }, 400);
    const scope = { vendor_id: body.vendorId, client_unit_id: body.unitId };
    if (!canInvite(actor, scope)) return json({ error: "You cannot invite employees to this company or location" }, 403);
    const { data: unit, error: unitError } = await admin.from("client_units").select("id,vendor_id,status").eq("id", body.unitId).maybeSingle();
    const { data: vendor, error: vendorError } = await admin.from("vendors").select("id,status").eq("id", body.vendorId).maybeSingle();
    if (unitError || vendorError || !unit || !vendor || unit.vendor_id !== body.vendorId || unit.status !== "active" || vendor.status !== "active") return json({ error: "Select an active Joy company and its location" }, 400);
    const { data: employees, error: employeeError } = await admin.from("employees").select("id").eq("vendor_id", body.vendorId).eq("client_unit_id", body.unitId).ilike("email_address", email.replace(/[%_]/g, c => "\\" + c)).limit(1);
    if (employeeError) throw employeeError;
    if (employees?.length) return json({ error: "This email already belongs to an employee at this location. Use Existing employee." }, 409);
    const smtpPassword = Deno.env.get("JOY_SMTP_PASSWORD");
    if (body.sendEmail && !smtpPassword) return json({ error: "SMTP email service is not configured" }, 503);
    const { data: previous, error: lookupError } = await admin.from(table).select("*").eq("email_address", email).eq("vendor_id", body.vendorId).eq("client_unit_id", body.unitId).maybeSingle();
    if (lookupError) throw lookupError;
    if (previous?.submitted_at) return json({ error: "This applicant has already submitted. Review their application below." }, 409);
    if (previous && Date.now() - Date.parse(previous.created_at) < 60000) return json({ error: "Wait one minute before resending this invitation" }, 429);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join("");
    const id = previous?.id || `INV-${crypto.randomUUID()}`;
    const expires = Date.now() + 7 * 86400000;
    const record = { id, email_address: email, name, ...scope, employment_type: body.employmentType, token_hash: await tokenHash(token), expires_at: new Date(expires).toISOString(), created_at: new Date().toISOString(), created_by: actor.email, application_json: {}, submitted_at: null };
    const saved = previous
      ? await admin.from(table).update(record).eq("id", id).eq("created_at", previous.created_at).is("submitted_at", null).select("id")
      : await admin.from(table).insert(record).select("id");
    if (saved.error || !saved.data?.length) return json({ error: "Invitation changed. Refresh and try again." }, 409);
    const link = `${origin}/#onboarding=${id}.${token}`;
    if (body.sendEmail) {
      const host = Deno.env.get("JOY_SMTP_HOST") || "mail.joycorporatesolutions.com", port = Number(Deno.env.get("JOY_SMTP_PORT") || "465"), user = Deno.env.get("JOY_SMTP_USER") || "noreply@joycorporatesolutions.com";
      const transport = nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: port !== 465, auth: { user, pass: smtpPassword }, tls: { servername: host }, connectionTimeout: 15000, socketTimeout: 20000 });
      try {
        const receipt = await transport.sendMail({ from: `Joy Payroll <${user}>`, to: email, subject: "Joy Payroll — activate your new employee application", text: `Hello${name ? " " + name : ""},\n\nWelcome to Joy. Use this personal activation link to complete your new employee onboarding:\n${link}\n\nThe link expires in seven days and accepts one submission. HR will review your details before adding you to payroll. Please do not forward this link.\n\nJoy Payroll HR` });
        if (!receipt.accepted?.length) throw new Error("Recipient rejected");
      } catch {
        if (previous) await admin.from(table).update(previous).eq("id", id).eq("token_hash", record.token_hash);
        else await admin.from(table).delete().eq("id", id).eq("token_hash", record.token_hash);
        return json({ error: "Email service did not confirm sending. Please retry." }, 502);
      } finally { transport.close(); }
    }
    await admin.from("audit_events").insert({ action: "new-employee-invited", entity_type: "employee_invitation", entity_id: id, actor_email: actor.email, summary: body.sendEmail ? "New employee activation email sent" : "New employee activation link created" });
    return json({ link, expires, sent: Boolean(body.sendEmail), recipient: email });
  }
  const { data: invitation, error } = await admin.from(table).select("*").eq("id", body.employeeId).maybeSingle();
  if (error) throw error;
  const hash = await tokenHash(body.token);
  if (!invitation || !validInvite({ hash: invitation.token_hash, expires: Date.parse(invitation.expires_at), submitted: invitation.submitted_at }, hash)) return json({ error: "Invalid, expired or already submitted invitation. Ask HR for a new link." }, 403);
  if (body.action === "read") return json({ name: invitation.name || "new colleague", expires: Date.parse(invitation.expires_at), newEmployee: true });
  let fields;
  try { fields = validatedFields(body.fields); } catch (e) { return json({ error: e instanceof Error ? e.message : "Invalid application" }, 400); }
  const fullName = String(fields["Full name"] || "").trim();
  if (!fullName) return json({ error: "Enter your full name" }, 400);
  const saved = await admin.from(table).update({ name: fullName, application_json: fields, submitted_at: new Date().toISOString(), token_hash: null }).eq("id", invitation.id).eq("token_hash", hash).is("submitted_at", null).select("id");
  if (saved.error) throw saved.error;
  if (!saved.data?.length) return json({ error: "This application was already submitted or replaced" }, 409);
  await admin.from("audit_events").insert({ action: "new-employee-application-submitted", entity_type: "employee_invitation", entity_id: invitation.id, actor_email: "onboarding-applicant", summary: "New employee application ready for HR review" });
  return json({ submitted: true });
}
