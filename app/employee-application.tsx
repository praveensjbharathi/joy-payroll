"use client";

import { useEffect, useRef, useState } from "react";
import { applicableFields, applicationSections, languageFields, readApplication, safeApplicationImage, type ApplicationData, type ApplicationDocument, type ApplicationRequest, type ReferenceOption } from "../lib/employee-application";
import { ApplicationQuestionnaire, ApplicationUploads } from "./application-questionnaire";
import { printIsolatedElement } from "../lib/print-document";
import type { Employee, Vendor } from "./payroll-app";

export function EmployeeApplicationFields({ value, onChange, employeeId, loadDocuments, uploads, onUploadsChange, references }: { references: ReferenceOption[]; value: ApplicationData; onChange: (data: ApplicationData) => void; employeeId?: string; loadDocuments: ApplicationRequest; uploads: ApplicationDocument[]; onUploadsChange: (docs: ApplicationDocument[]) => void }) {
  const [saved, setSaved] = useState<ApplicationDocument[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; if (employeeId) loadDocuments(employeeId).then(d => { if (active) setSaved(d); }).catch(e => { if(active) setError(e.message); }); return () => { active=false; }; }, [employeeId]);
  const update = (key: string, next: string) => onChange({ ...value, [key]: next });
  return <details className="form-span" style={{ margin: "16px 0" }}>
    <summary style={{ fontWeight: 700, cursor: "pointer" }}>Company e-Job Application - additional details</summary>
    <p>Personal, joining, banking and photo details entered above are reused in the application. Additional details are optional. Enter only information supplied by the applicant.</p>
    <ApplicationQuestionnaire value={value} onChange={onChange} references={references} />
    {error && <p role="alert">{error}</p>}
    <ApplicationUploads documents={uploads} onChange={onUploadsChange} saved={saved} fresher={value["Employment status"] === "Fresher"} />
    <label><span>Upload employee signature photo (PNG / JPEG / WebP, maximum 150 KB)</span>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 150000) { window.alert("Choose a PNG, JPEG or WebP signature smaller than 150 KB."); return; }
        const reader = new FileReader();
        reader.onload = () => update("Signature image", String(reader.result || ""));
        reader.onerror = () => window.alert("Unable to read signature image. Please select it again.");
        reader.readAsDataURL(file);
      }} />
    </label>
    {safeApplicationImage(value["Signature image"]) && <div><img src={value["Signature image"]} alt="Applicant signature" style={{ width: 150, height: 60, objectFit: "contain" }} /><button type="button" className="secondary-button" onClick={() => update("Signature image", "")}>Remove signature</button></div>}
  </details>;
}

const applicationCss = `
 .joy-application-document { box-sizing:border-box; width:190mm; max-width:100%; margin:0 auto; padding:8mm; background:white; color:#111827; font:11pt/1.4 Arial,sans-serif; }
 .joy-application-document * { box-sizing:border-box; }
 .joy-application-document h1 { font-size:16pt; margin:0 0 4mm; }
 .joy-application-document h2 { font-size:12pt; margin:5mm 0 2mm; border-bottom:1px solid #94a3b8; padding-bottom:2mm; break-after:avoid; }
 .joy-application-document p { margin:2mm 0; white-space:pre-wrap; overflow-wrap:anywhere; }
 .joy-application-document table { width:100%; table-layout:fixed; border-collapse:collapse; font-size:10pt; }
 .joy-application-document td { border:1px solid #cbd5e1; padding:2mm; vertical-align:top; white-space:pre-wrap; overflow-wrap:anywhere; }
 .joy-application-document td:first-child { width:40%; font-weight:600; background:#f8fafc; }
 .joy-application-document tr { break-inside:avoid; }
 .joy-application-document .application-brand { display:flex; gap:5mm; align-items:center; border-bottom:2px solid #1e3a5f; padding-bottom:4mm; }
 .joy-application-document .application-brand img { width:20mm; height:20mm; object-fit:contain; }
 .joy-application-document .application-personal { display:flex; align-items:flex-start; gap:5mm; }
 .joy-application-document .application-personal table { flex:1; min-width:0; }
 .joy-application-document .application-photo { flex:0 0 35mm; text-align:center; font-size:9pt; }
 .joy-application-document .application-photo img { width:32mm; height:40mm; object-fit:contain; }
 .joy-application-document .application-signature { width:35mm; height:15mm; object-fit:contain; }
 .joy-application-document .application-photo .application-signature { width:32mm; height:15mm; }
 .joy-application-document .application-declaration { break-inside:avoid; }
 @media print { .joy-application-document { width:190mm!important; max-width:100%!important; padding:5mm!important; margin:0 auto!important; box-shadow:none!important; } }
`;

export function EmployeeApplicationDocument({ employee, vendor }: { employee?: Employee; vendor?: Vendor }) {
  const raw = readApplication(employee?.applicationJson);
  const data = applicableFields({ ...raw, "Marital status": raw["Marital status"] || employee?.maritalStatus || "", "Highest qualification": raw["Highest qualification"] || employee?.highestQualification || "" });
  const rows = (entries: [string, string | null | undefined][], important = false) => {
    const visible = entries.filter(([, value]) => !employee || important || Boolean(value?.trim()));
    return visible.length ? <table><tbody>{visible.map(([label, value]) => <tr key={label}><td>{label}</td><td>{value || "________________"}</td></tr>)}</tbody></table> : null;
  };
  const section = (title: string, entries: [string, string | null | undefined][]) => {
    const table = rows(entries); return table ? <section key={title}><h2>{title}</h2>{table}</section> : null;
  };
  const signature = safeApplicationImage(data["Signature image"]);
  const personal: [string, string | null | undefined][] = [
    ["Contact Number", employee?.mobileNumber || data["Mobile number"]], ["Family Mobile", employee?.emergencyContactNumber],
    ["Present Address", [employee?.addressLine, employee?.district, employee?.stateName, employee?.pincode].filter(Boolean).join(", ")],
    ["Date of Birth", employee?.dateOfBirth || data["Date of birth"]], ["Gender", data.Gender], ["Marital Status", data["Marital status"]], ["Blood Group", employee?.bloodGroup],
    ...applicationSections.find(s => s.title === "Personal information")!.fields.filter(k => !["Sibling count", "Children count", "Employment records"].includes(k)).map(key => [key, data[key]] as [string, string]),
  ];
  return <article className="joy-application-document">
    <style>{applicationCss}</style>
    <header className="application-brand">{safeApplicationImage(vendor?.logoDataUrl) && <img src={vendor!.logoDataUrl!} alt="Company logo" />}<div><h1>{vendor?.legalName || vendor?.name || "JOY CORPORATE SOLUTIONS PRIVATE LIMITED"}</h1><p>e-Job Application Form | www.joyindia.in</p></div></header>
    <h2>{employee?.name || data["Full name"] || "Applicant name: __________________________"}</h2>
    {rows([["Position Applied For", data["Position Applied For"]], ["Application Date", data.Date], ["Employee Code", employee?.employeeCode], ["Date of Joining", employee?.dateOfJoining]], true)}
    <h2>Personal information</h2><div className="application-personal">{rows(personal)}<aside className="application-photo">{safeApplicationImage(employee?.photoDataUrl) ? <img src={employee!.photoDataUrl!} alt="Passport photo" /> : !employee && <p>Passport size photo</p>}{signature && <><p>Employee signature</p><img className="application-signature" src={signature} alt="Employee signature" /></>}</aside></div>
    {section("Language proficiency", languageFields(data).map(key => [key.match(/\[(.*)\]/)?.[1] || key, data[key]]))}
    {applicationSections.filter(s => s.title.startsWith("Family -")).map(s => {
      if (employee && /^(unmarried|single)$/i.test(data["Marital status"]) && /Spouse|Child/.test(s.title)) return null;
      return section(s.title, s.fields.map(key => [key.split(" - ")[1], data[key] || (key === "Father - Name" ? employee?.fatherName : key === "Spouse - Name" ? employee?.spouseName : "")]));
    })}
    {section("Education profile", [["Highest qualification", data["Highest qualification"]], ...applicationSections.find(s => s.title === "Education profile")!.fields.map(key => [key, data[key]] as [string, string])])}
    {data["Employment status"] && section("Employment status", [["Experience", data["Employment status"]]])}
    {applicationSections.filter(s => s.title.startsWith("Previous employment")).map(s => section(s.title, s.fields.map(key => [key, data[key]])))}
    {section("Statutory details", [["ESI Number", employee?.esiMasked], ["PF / UAN Number", employee?.uanMasked]])}
    {section("Banking details", [["Bank Name", employee?.bankName], ["Account Number", employee?.bankAccountMasked], ["IFSC Code", employee?.ifscMasked], ["Branch Name", employee?.bankBranch]])}
    {section("House details", [["Own House?", data["Do you own House?"]], ["City / Town", data["If Yes, in which City / Town?"]]])}
    {applicationSections.filter(s => s.title.startsWith("Reference ")).map(s => section(s.title, s.fields.filter(k => k !== "Reference 1 - Employee ID").map(key => [key, data[key]])))}
    <section className="application-declaration"><h2>Declaration &amp; signature</h2><p>{data.Declaration || "Declaration: __________________________________________________"}</p><p>Declaration date: {data.Date || "________________"}</p>{data["Digital Signature (Type your full name)"] && <p>Signed by: {data["Digital Signature (Type your full name)"]}</p>}{signature && <img className="application-signature" src={signature} alt="Declaration signature" />}</section>
    {applicationSections.filter(s => s.title === "Supporting document links").map(s => section(s.title, s.fields.map(key => [key, data[key]])))}
  </article>;
}

export default function EmployeeApplicationPreview({ employee, vendor, onClose, loadDocuments }: { employee?: Employee; vendor?: Vendor; onClose: () => void; loadDocuments: ApplicationRequest }) {
  const source = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const [documents,setDocuments]=useState<ApplicationDocument[]>([]);
  const [loading,setLoading]=useState(Boolean(employee));
  const [error,setError]=useState("");
  useEffect(()=>{let active=true; if(employee) loadDocuments(employee.id).then(d=>{if(active)setDocuments(d);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);}); return ()=>{active=false;};},[employee?.id]);
  return <div role="dialog" aria-modal="true" aria-label="Company application preview" style={{ position:"fixed", inset:0, zIndex:10000, background:"rgba(15,23,42,.65)", padding:16, overflowY:"auto" }}>
    <div style={{ maxWidth:900, margin:"0 auto", background:"#fff", borderRadius:12 }}>
      <div style={{ position:"sticky", top:-16, background:"#fff", padding:16, display:"flex", gap:12, flexWrap:"wrap", zIndex:1 }}>
        <button className="primary-button" disabled={printing || loading || Boolean(error)} onClick={async()=>{
          if(!source.current)return; setPrinting(true);
          try{const {downloadApplicationPdf}=await import("../lib/application-pdf"); await downloadApplicationPdf(source.current,documents,employee?.employeeCode || "blank");}
          catch(e){setError(e instanceof Error ? e.message : "Unable to create PDF");}finally{setPrinting(false);}
        }}>Download application + documents PDF</button>
        <button className="primary-button" disabled={printing} onClick={async () => {
          if (!source.current) return;
          setPrinting(true);
          try { await printIsolatedElement(source.current, "application"); } catch { window.alert("Unable to open print preview. Please try again."); } finally { setPrinting(false); }
        }}>{printing ? "Opening…" : "Print / Save as PDF"}</button>
        <button className="secondary-button" onClick={onClose}>Close</button>
        <small>Choose “Save as PDF” in the print dialog to download.</small>
      </div>
      <p role="status" style={{padding:"0 16px"}}>{loading ? "Loading attachments…" : error || `${documents.length} uploaded documents will follow the application in the downloaded PDF.`}</p>
      <div style={{ overflowX:"auto" }}><div ref={source}><EmployeeApplicationDocument employee={employee} vendor={vendor} /></div></div>
    </div>
  </div>;
}
