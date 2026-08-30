import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { GET, POST } from "./generated/route.ts";
import type { AuthenticatedUser } from "./supabase-runtime.ts";

const projectUrl = Deno.env.get("SUPABASE_URL");
const secretKeyDictionary = Deno.env.get("SUPABASE_SECRET_KEYS");
const modernSecretKey = secretKeyDictionary
  ? (JSON.parse(secretKeyDictionary) as Record<string, string>).default
  : undefined;
const secretKey = modernSecretKey ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!projectUrl || !secretKey) {
  throw new Error("Supabase did not provide the secure server-only API secrets.");
}

const admin = createClient(projectUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const allowedOrigins = new Set([
  "https://payroll.joycorporatesolutions.com",
  "https://joy-payroll.praveen-red-07.workers.dev",
  ...(Deno.env.get("APP_ORIGIN") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

const smtpHost = Deno.env.get("SMTP_HOST") ?? "mail.joycorporatesolutions.com";
const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "465");
const smtpUser = Deno.env.get("SMTP_USER") ?? "noreply@joycorporatesolutions.com";
const smtpPassword = Deno.env.get("SMTP_PASSWORD") ?? "";
const smtpFrom = Deno.env.get("SMTP_FROM") ?? smtpUser;
const smtpFromName = Deno.env.get("SMTP_FROM_NAME") ?? "Joy Payroll";

function responseHeaders(origin: string | null) {
  const firstAllowedOrigin = [...allowedOrigins][0];
  return {
    "access-control-allow-origin":
      origin && allowedOrigins.has(origin) ? origin : firstAllowedOrigin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers":
      "authorization, apikey, content-type, x-client-info, x-retry-count, traceparent, tracestate, baggage",
    "access-control-max-age": "86400",
    "cache-control": "no-store",
    vary: "Origin",
  };
}

function jsonError(message: string, status: number, origin: string | null) {
  return Response.json(
    { error: message },
    { status, headers: responseHeaders(origin) },
  );
}

async function verifyIdentity(request: Request): Promise<AuthenticatedUser | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email || !data.user.email_confirmed_at) return null;

  const metadata = data.user.user_metadata ?? {};
  const candidate = metadata.full_name ?? metadata.name;
  const fullName =
    typeof candidate === "string" && candidate.trim()
      ? candidate.trim()
      : null;
  return {
    email: data.user.email.trim().toLowerCase(),
    fullName,
    displayName: fullName ?? data.user.email,
  };
}

function monthLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function wrapText(text: string, max = 82) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function buildPayslipPdf(data: {
  employee: any;
  item: any;
  run: any;
  unit: any;
  vendor: any;
}) {
  const { employee, item, run, unit, vendor } = data;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = page.getWidth();
  let y = 800;

  const draw = (text: string, x: number, size = 9, isBold = false) => {
    page.drawText(String(text ?? ""), {
      x,
      y,
      size,
      font: isBold ? bold : regular,
      color: rgb(0.08, 0.12, 0.2),
    });
  };
  const next = (amount = 18) => { y -= amount; };
  const row = (left: string, right: string) => {
    draw(left, 48, 9, true);
    draw(right, 190, 9, false);
    next(16);
  };

  page.drawText("EMPLOYEE SALARY SLIP", { x: 170, y, size: 18, font: bold, color: rgb(0.05, 0.2, 0.55) });
  next(24);
  page.drawText(monthLabel(run.pay_period).toUpperCase(), { x: 235, y, size: 10, font: bold, color: rgb(0.05, 0.2, 0.55) });
  next(20);
  page.drawLine({ start: { x: 48, y }, end: { x: width - 48, y }, thickness: 1, color: rgb(0.1, 0.35, 0.75) });
  next(22);
  draw(unit.payslip_title || unit.client_name, 48, 12, true); next(17);
  draw(unit.payslip_subtitle || `${unit.unit_name} · Payroll partner: ${vendor.legal_name}`, 48, 9); next(14);
  for (const line of wrapText(unit.payslip_address || unit.location, 90)) { draw(line, 48, 8); next(12); }
  next(5);

  row("Employee ID", employee.employee_code);
  row("Employee name", employee.name);
  row("Department", employee.department);
  row("Employer / unit", `${unit.client_name} · ${unit.unit_name}`);
  row("Payroll month", monthLabel(run.pay_period));
  row("Attendance", `Working ${run.working_days || 26} · Fixed ${item.fixed_working_days || 0} · W ${item.present_days || 0} · NFH ${item.nfh_days || 0} · CO ${item.comp_off_days || 0} · OD ${item.on_duty_days || 0} · Sundays ${item.sunday_days || 0} · PL ${item.pl_days || 0} · CL ${item.cl_days || 0} · SL ${item.sl_days || 0} · Payable ${item.payable_days || 0} · OT ${item.overtime_hours || 0}`);
  row("UAN / EPF", employee.uan_masked || "—");
  row("ESI number", employee.esi_masked || "—");
  row("Bank", `${employee.bank_name || "—"} · ${employee.bank_branch || "—"}`);
  row("Account / IFSC", `${employee.bank_account_masked || "—"} · ${employee.ifsc_masked || "—"}`);
  next(6);

  draw("EARNINGS", 48, 10, true);
  draw("DEDUCTIONS", 320, 10, true);
  next(17);
  const earnings: Array<[string, number]> = [
    ["Basic", item.basic], ["DA", item.da], ["HRA", item.hra], ["Conveyance", item.conveyance],
    ["Food allowance", item.food_allowance], ["Night allowance", item.night_allowance], ["OT wages", item.overtime_wages],
    ["Attendance bonus", item.attendance_bonus], ["Arrears", item.arrears], ["Holiday wages", item.holiday_wages],
    ["Production incentive", item.production_incentive], ["Medical allowance", item.medical_allowance],
  ];
  const deductions: Array<[string, number]> = [
    ["PF", item.pf_deduction], ["ESI", item.esi_deduction], ["Professional Tax", item.professional_tax], ["LWF", item.lwf],
    ["Canteen", item.canteen], ["Snacks", item.snacks], ["Tent", item.tent], ["Advance", item.advance],
    ["Others", item.other_deduction], ["TDS", item.tds], ["Medical insurance", item.medical_insurance],
    ["Accommodation", item.accommodation_deduction],
  ];
  const rows = Math.max(earnings.length, deductions.length);
  for (let i = 0; i < rows; i++) {
    const e = earnings[i]; const d = deductions[i];
    if (e) { draw(e[0], 48, 8); draw(e[1] ? money(e[1]) : "—", 205, 8, true); }
    if (d) { draw(d[0], 320, 8); draw(d[1] ? money(d[1]) : "—", 470, 8, true); }
    next(14);
  }
  next(6);
  draw("Gross earnings", 48, 9, true); draw(money(item.gross_earnings), 205, 9, true);
  draw("Total deductions", 320, 9, true); draw(money(item.total_deductions), 470, 9, true);
  next(25);
  page.drawRectangle({ x: 48, y: y - 10, width: width - 96, height: 42, color: rgb(0.94, 0.97, 1) });
  draw("NET PAYABLE", 65, 11, true);
  draw(money(item.net_payable), 390, 14, true);
  next(54);
  draw("This is a computer-generated salary slip and does not require a physical signature.", 80, 8);

  return await pdf.save();
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function smtpRead(conn: Deno.TlsConn) {
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const buffer = new Uint8Array(4096);
    const read = await conn.read(buffer);
    if (read === null) break;
    text += decoder.decode(buffer.subarray(0, read));
    const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
    if (lines.length && /^\d{3} /.test(lines[lines.length - 1])) break;
  }
  const code = Number(text.slice(0, 3));
  if (!Number.isFinite(code) || code >= 400) throw new Error(`SMTP server rejected the request (${code || "unknown"}).`);
  return text;
}

async function smtpCommand(conn: Deno.TlsConn, command: string, expected?: number[]) {
  await conn.write(new TextEncoder().encode(command + "\r\n"));
  const response = await smtpRead(conn);
  const code = Number(response.slice(0, 3));
  if (expected?.length && !expected.includes(code)) throw new Error(`SMTP command failed (${code}).`);
  return response;
}

async function sendSmtpMail(input: { to: string; subject: string; html: string; pdf: Uint8Array; filename: string }) {
  if (!smtpPassword) throw new Error("SMTP password is not configured in Supabase project secrets.");
  const conn = await Deno.connectTls({ hostname: smtpHost, port: smtpPort });
  try {
    await smtpRead(conn);
    await smtpCommand(conn, `EHLO joy-payroll`, [250]);
    await smtpCommand(conn, "AUTH LOGIN", [334]);
    await smtpCommand(conn, btoa(smtpUser), [334]);
    await smtpCommand(conn, btoa(smtpPassword), [235]);
    await smtpCommand(conn, `MAIL FROM:<${smtpFrom}>`, [250]);
    await smtpCommand(conn, `RCPT TO:<${input.to}>`, [250, 251]);
    await smtpCommand(conn, "DATA", [354]);

    const boundary = `joy-payroll-${crypto.randomUUID()}`;
    const message = [
      `From: ${smtpFromName} <${smtpFrom}>`,
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 8bit`,
      "",
      input.html,
      "",
      `--${boundary}`,
      `Content-Type: application/pdf; name="${input.filename}"`,
      `Content-Disposition: attachment; filename="${input.filename}"`,
      `Content-Transfer-Encoding: base64`,
      "",
      bytesToBase64(input.pdf).replace(/(.{76})/g, "$1\r\n"),
      "",
      `--${boundary}--`,
      ".",
    ].join("\r\n");
    await conn.write(new TextEncoder().encode(message + "\r\n"));
    const dataResponse = await smtpRead(conn);
    const code = Number(dataResponse.slice(0, 3));
    if (code !== 250) throw new Error(`SMTP delivery failed (${code}).`);
    await smtpCommand(conn, "QUIT", [221]);
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}

async function handlePayslipEmail(request: Request, identity: AuthenticatedUser, origin: string | null) {
  const body = await request.json() as { action?: string; runId?: string; employeeId?: string };
  if (body.action !== "send-payslip-email") return null;
  if (!body.runId || !body.employeeId) return jsonError("Payroll run and employee are required.", 400, origin);

  const [{ data: employee, error: employeeError }, { data: run, error: runError }, { data: item, error: itemError }] = await Promise.all([
    admin.from("employees").select("*").eq("id", body.employeeId).single(),
    admin.from("payroll_runs").select("*").eq("id", body.runId).single(),
    admin.from("payroll_items").select("*").eq("run_id", body.runId).eq("employee_id", body.employeeId).single(),
  ]);
  if (employeeError || runError || itemError || !employee || !run || !item) return jsonError("Salary slip data could not be loaded.", 404, origin);
  if (!employee.email_address) return jsonError("Add the employee email ID in Employee Master before sending.", 400, origin);
  if (run.status !== "approved") return jsonError("Approve the payroll run before emailing salary slips.", 409, origin);

  const [{ data: unit, error: unitError }, { data: vendor, error: vendorError }] = await Promise.all([
    admin.from("client_units").select("*").eq("id", run.client_unit_id).single(),
    admin.from("vendors").select("*").eq("id", run.vendor_id).single(),
  ]);
  if (unitError || vendorError || !unit || !vendor) return jsonError("Employer or group-company details are missing.", 404, origin);

  const pdf = await buildPayslipPdf({ employee, item, run, unit, vendor });
  const label = monthLabel(run.pay_period);
  const filename = `Salary_Slip_${employee.employee_code}_${run.pay_period}.pdf`;
  const subject = `Salary Slip - ${label} - ${employee.name}`;
  const html = `<p>Dear ${employee.name},</p><p>Please find attached your salary slip for <strong>${label}</strong>.</p><p><strong>Employer:</strong> ${unit.client_name} - ${unit.unit_name}<br><strong>Net payable:</strong> ${money(item.net_payable)}</p><p>Regards,<br>${vendor.legal_name}</p>`;
  await sendSmtpMail({ to: employee.email_address, subject, html, pdf, filename });

  try {
    await admin.from("audit_events").insert({
      action: "send-payslip-email",
      entity_type: "employee",
      entity_id: employee.id,
      summary: `Salary slip ${run.pay_period} emailed to ${employee.email_address}`,
      actor_email: identity.email,
    });
  } catch { /* email delivery must not fail because audit schema differs */ }

  return Response.json(
    { ok: true, message: `Salary slip emailed to ${employee.email_address}`, sentAt: new Date().toISOString() },
    { headers: responseHeaders(origin) },
  );
}

export default {
  async fetch(request: Request) {
    const origin = request.headers.get("origin");
    if (origin && !allowedOrigins.has(origin)) {
      return jsonError("This website is not permitted to access Joy Payroll.", 403, null);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: responseHeaders(origin) });
    }
    if (!["GET", "POST"].includes(request.method)) {
      return jsonError("Unsupported request method.", 405, origin);
    }

    try {
      const identity = await verifyIdentity(request);
      if (!identity) {
        return jsonError(
          "A verified Joy Payroll email and password are required.",
          401,
          origin,
        );
      }

      if (request.method === "POST") {
        const emailResponse = await handlePayslipEmail(request.clone(), identity, origin);
        if (emailResponse) return emailResponse;
      }

      const applicationResponse =
        request.method === "GET"
          ? await GET(identity)
          : await POST(request, identity);
      const headers = new Headers(applicationResponse.headers);
      for (const [name, value] of Object.entries(responseHeaders(origin))) {
        headers.set(name, value);
      }
      return new Response(applicationResponse.body, {
        status: applicationResponse.status,
        headers,
      });
    } catch (error) {
      console.error(
        "Joy payroll API request failed:",
        error instanceof Error ? error.message : String(error),
      );
      return jsonError(
        error instanceof Error ? error.message : "Unable to complete the payroll request.",
        500,
        origin,
      );
    }
  },
};
