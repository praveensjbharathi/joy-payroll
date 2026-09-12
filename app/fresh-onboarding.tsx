"use client";
import { useEffect, useState } from "react";
import { onboardingRequest } from "./employee-onboarding";
import type { ClientUnit, Employee, Vendor } from "./payroll-app";

export type NewApplicant = { id: string; name: string; email_address: string; vendor_id: string; client_unit_id: string; employment_type: string; application_json: Record<string, string>; submitted_at: string | null; expires_at: string };
export function FreshOnboarding({ vendors, units, vendorId: initialVendor, unitId: initialUnit, endpoint, publishableKey, accessToken, onReview }: { vendors: Vendor[]; units: ClientUnit[]; vendorId: string; unitId: string; endpoint: string; publishableKey?: string; accessToken?: string; onReview: (applicant: NewApplicant) => void }) {
  const [vendorId, setVendor] = useState(initialVendor), [unitId, setUnit] = useState(initialUnit);
  const [employmentType, setType] = useState("client"), [email, setEmail] = useState(""), [name, setName] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [applications, setApplications] = useState<NewApplicant[]>([]), [revision, setRevision] = useState(0), [review, setReview] = useState<NewApplicant | null>(null);
  useEffect(() => {
    let active = true; setApplications([]); setReview(null); setError("");
    if (vendorId && unitId) onboardingRequest(endpoint, publishableKey, { action: "list", vendorId, unitId }, accessToken).then(r => { if (active) setApplications(r.invitations); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [vendorId, unitId, revision, endpoint, publishableKey, accessToken]);
  const input = { display: "block", width: "100%", padding: 12, fontSize: 16, margin: "8px 0 16px" };
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setMessage("");
    try { const r = await onboardingRequest(endpoint, publishableKey, { action: "create", newEmployee: true, email, name, vendorId, unitId, employmentType, sendEmail: true }, accessToken); setMessage(`Activation email sent to ${r.recipient}. Valid for seven days. The employee can enter their details without a payroll login.`); setRevision(v => v + 1); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to send invitation"); } finally { setBusy(false); }
  }
  return <section><p>Invite someone who is not yet in Employee Master. Only their email and assignment are required now.</p>
    <form onSubmit={send}>
      <label>Joy group company<select style={input} required disabled={busy} value={vendorId} onChange={e => { setVendor(e.target.value); setUnit(""); setMessage(""); }}><option value="">Select company</option>{vendors.filter(v => v.status === "active").map(v => <option key={v.id} value={v.id}>{v.legalName || v.name}</option>)}</select></label>
      <label>Employment type<select style={input} disabled={busy} value={employmentType} onChange={e => setType(e.target.value)}><option value="client">Client location employee</option><option value="direct">Joy Direct employee</option></select></label>
      <label>{employmentType === "direct" ? "Joy office / work location" : "Client / employer location"}<select style={input} required disabled={busy} value={unitId} onChange={e => { setUnit(e.target.value); setMessage(""); }}><option value="">Select location</option>{units.filter(u => u.vendorId === vendorId && u.status === "active").map(u => <option key={u.id} value={u.id}>{u.clientName} · {u.unitName} · {u.location}</option>)}</select></label>
      <label>New employee email ID<input style={input} type="email" required maxLength={254} disabled={busy} value={email} onChange={e => setEmail(e.target.value)} placeholder="newemployee@example.com" /></label>
      <label>Name (optional)<input style={input} maxLength={200} disabled={busy} value={name} onChange={e => setName(e.target.value)} /></label>
      <button className="primary-button" disabled={busy || !unitId}>{busy ? "Sending…" : "Send fresh activation link"}</button>
    </form>
    {message && <p role="status">{message}</p>}{error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
    <h3>Applications at this location</h3><button className="secondary-button" disabled={busy} onClick={() => setRevision(v => v + 1)}>Refresh applications</button>
    {!applications.length && <p>No invitations at this location yet.</p>}
    {applications.map(a => <div key={a.id} style={{ borderBottom: "1px solid #ddd", padding: "16px 0" }}><strong>{a.name || a.email_address}</strong><p>{a.email_address} · {a.employment_type === "direct" ? "Joy Direct" : "Client location"} · {a.submitted_at ? "Submitted — HR review" : Date.parse(a.expires_at) < Date.now() ? "Expired — enter email above to resend" : "Awaiting employee"}</p>{a.submitted_at && <button className="secondary-button" onClick={() => setReview(a)}>Review application</button>}</div>)}
    {review && <section><h3>{review.name} — submitted details</h3>{Object.entries(review.application_json).filter(([,v]) => v).map(([key, value]) => <p key={key}><strong>{key}:</strong> {value}</p>)}<p>Review these details, then complete the employee code, joining date, salary, bank and statutory fields before saving.</p><button className="primary-button" onClick={() => onReview(review)}>Open Employee Master with these details</button></section>}
  </section>;
}
