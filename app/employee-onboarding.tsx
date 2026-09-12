"use client";
import { useEffect, useState, type FormEvent } from "react";
import { applicationSections } from "../lib/employee-application";
import type { Employee } from "./payroll-app";

export async function onboardingRequest(endpoint: string, key: string | undefined, payload: Record<string, unknown>, accessToken?: string) {
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", ...(key ? { apikey: key } : {}), ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify(payload) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Onboarding service unavailable. Ask the administrator to deploy the employee-onboarding function.");
  return result;
}
const overlay = { position: "fixed" as const, inset: 0, zIndex: 10000, overflowY: "auto" as const, background: "rgba(15,23,42,.65)", padding: 16 };
const card = { maxWidth: 720, margin: "20px auto", background: "white", color: "#172b4d", borderRadius: 16, padding: 24, fontSize: 16 };
export function OnboardingInvite({ employees, initialEmployee, endpoint, publishableKey, accessToken, onClose }: { employees: Employee[]; initialEmployee?: Employee; endpoint: string; publishableKey?: string; accessToken?: string; onClose: () => void }) {
  const [employeeId, setEmployeeId] = useState(initialEmployee?.id || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const employee = employees.find(e => e.id === employeeId);
  async function create(sendEmail: boolean) {
    if (!employee || busy) return;
    setBusy(true); setError(""); setMessage(""); setLink("");
    try {
      const result = await onboardingRequest(endpoint, publishableKey, { action: "create", employeeId, sendEmail }, accessToken);
      setLink(result.link);
      setMessage(result.sent ? `Invitation sent through the email service to ${result.recipient}.` : "Your link is ready to share.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create invitation"); } finally { setBusy(false); }
  }
  const shareText = `Hello ${employee?.name}, please complete your Joy Payroll employee application: ${link}`;
  const digits = (employee?.mobileNumber || "").replace(/\D/g, "");
  const mobile = digits.length === 10 ? `91${digits}` : digits;
  async function copy() { try { await navigator.clipboard.writeText(link); setMessage("Invitation link copied."); } catch { setError("Select the link below and copy it manually."); } }
  return <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="invite-title"><section style={card}>
    <h2 id="invite-title">Invite onboarding</h2>
    <p>Select an employee, then send an email or create a link for mobile sharing.</p>
    <label>Employee<select autoFocus value={employeeId} disabled={busy} onChange={e => { setEmployeeId(e.target.value); setLink(""); setMessage(""); setError(""); }} style={{ width: "100%", fontSize: 16, padding: 12 }}><option value="">Select employee</option>{employees.filter(e => e.status === "active").map(e => <option key={e.id} value={e.id}>{e.employeeCode} · {e.name}</option>)}</select></label>
    {employee && <p>Email: {employee.emailAddress || "Missing — add it in Employee Master"}<br />Mobile: {employee.mobileNumber || "Not supplied"}</p>}
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "16px 0" }}>
      <button className="primary-button" disabled={busy || !employee?.emailAddress} onClick={() => void create(true)}>{busy ? "Processing…" : "Send email invitation"}</button>
      <button className="secondary-button" disabled={busy || !employee} onClick={() => void create(false)}>Create sharing link</button>
    </div>
    {link && <><label>Personal invitation link<input readOnly value={link} onFocus={e => e.target.select()} style={{ width: "100%", padding: 12 }} /></label><div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "16px 0" }}>
      <button className="secondary-button" onClick={() => void copy()}>Copy link</button>
      {mobile && <><a className="secondary-button" href={`sms:+${mobile}?body=${encodeURIComponent(shareText)}`}>SMS</a><a className="secondary-button" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${mobile}?text=${encodeURIComponent(shareText)}`}>WhatsApp</a></>}
      <button className="secondary-button" onClick={async () => { if (!navigator.share) return void copy(); try { await navigator.share({ title: "Joy Payroll onboarding", text: shareText }); } catch (e) { if (!(e instanceof Error && e.name === "AbortError")) setError("Unable to share. Please use Copy link."); } }}>Mobile share</button>
    </div><p>Valid for seven days and one submission. Creating another invitation replaces the previous link. SMS and WhatsApp open your messaging app.</p></>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
    <button className="secondary-button" disabled={busy} onClick={onClose}>Close</button>
  </section></div>;
}

export function EmployeeOnboardingForm({ endpoint, publishableKey, invitation }: { endpoint: string; publishableKey: string; invitation: string }) {
  const separator = invitation.lastIndexOf(".");
  const employeeId = invitation.slice(0, separator), token = invitation.slice(separator + 1);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({ Date: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { let active = true; onboardingRequest(endpoint, publishableKey, { action: "read", employeeId, token }).then(r => { if (active) setName(r.name); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [endpoint, publishableKey, employeeId, token]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { await onboardingRequest(endpoint, publishableKey, { action: "submit", employeeId, token, fields }); setDone(true); setFields({}); history.replaceState(null, "", location.pathname); } catch (e) { setError(e instanceof Error ? e.message : "Unable to submit"); } finally { setBusy(false); }
  }
  return <main style={{ minHeight: "100vh", background: "#eef3f8", padding: 16 }}><section style={card}>
    <h1>Joy Payroll · Employee application</h1>
    {done ? <p role="status">Your application has been submitted. HR can now review it in Employee Master. Thank you.</p> : <>
      {name ? <form onSubmit={submit}><h2>Welcome, {name}</h2><p>Complete your application details below. Give supporting documents to HR for upload. Existing salary and banking details are managed by HR.</p>
        {applicationSections.filter(s => s.title !== "Supporting document links" && s.title !== "Declaration").map(section => <details key={section.title} open={section.title === "Application details"} style={{ margin: "18px 0", borderBottom: "1px solid #cad5e2", paddingBottom: 12 }}><summary style={{ cursor: "pointer", fontWeight: 700, padding: "8px 0" }}>{section.title}</summary>{section.fields.map(key => <label key={key} style={{ display: "block", margin: "12px 0" }}>{key}<textarea rows={2} maxLength={2000} value={fields[key] || ""} disabled={busy} onChange={e => setFields({ ...fields, [key]: e.target.value })} style={{ display: "block", width: "100%", padding: 10, fontSize: 16 }} /></label>)}</details>)}
        <label style={{ display: "block", margin: "16px 0" }}><input type="checkbox" required disabled={busy} checked={Boolean(fields.Declaration)} onChange={e => setFields({ ...fields, Declaration: e.target.checked ? "I confirm that the information I supplied is correct to the best of my knowledge." : "" })} /> I confirm that the information I supplied is correct to the best of my knowledge.</label>
        <label>Type your full name as your declaration signature<input required maxLength={200} disabled={busy} value={fields["Digital Signature (Type your full name)"] || ""} onChange={e => setFields({ ...fields, ["Digital Signature (Type your full name)"]: e.target.value })} style={{ display: "block", width: "100%", padding: 12, fontSize: 16, margin: "12px 0" }} /></label>
        <button className="primary-button" disabled={busy}>{busy ? "Submitting…" : "Submit application"}</button>
      </form> : !error && <p role="status">Checking your invitation…</p>}
      {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
    </>}
  </section></main>;
}
