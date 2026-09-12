"use client";
import { useState } from "react";
import { applicableFields, applicationSections, documentCategories, educationLevel, languageFields, requiredApplicationFields, type ApplicationData, type ApplicationDocument, type ReferenceOption } from "../lib/employee-application";

export function ApplicationQuestionnaire({ value, onChange, references, disabled = false, required = false }: { value: ApplicationData; onChange: (data: ApplicationData) => void; references: ReferenceOption[]; disabled?: boolean; required?: boolean }) {
  const [otherLanguage, setOtherLanguage] = useState("");
  const [search, setSearch] = useState("");
  const update = (key: string, text: string) => onChange(applicableFields({ ...value, [key]: text }));
  const familyCount = (relation: string, count: string, max: number) => value[count] ?? String(Array.from({ length: max }, (_, i) => i + 1).filter(i => Object.keys(value).some(k => k.startsWith(`${relation} ${i} -`) && value[k])).at(-1) || 0);
  const choices: Record<string, string[]> = {
    Gender: ["Male", "Female", "Other", "Prefer not to say"],
    "Marital status": ["Unmarried", "Married", "Divorced", "Widowed"],
    "Employment status": ["Fresher", "Experienced"],
    "Highest qualification": ["Below 10th", "10th / SSLC", "12th / Higher Secondary", "ITI", "Diploma", "Graduate", "Postgraduate", "Other"],
    "Sibling count": ["0", "1", "2"], "Children count": ["0", "1", "2", "3"], "Employment records": ["1", "2"],
    "Do you own House?": ["Yes", "No"], "Do you smoke?": ["Yes", "No", "Prefer not to say"],
  };
  function field(key: string) {
    let options = choices[key];
    let text = value[key] || "";
    if (key === "Sibling count") text = familyCount("Sibling", key, 2);
    if (key === "Children count") text = familyCount("Child", key, 3);
    if (key === "Employment records") text = value[key] || (value["Employment 2 - Company Name"] ? "2" : "1");
    if (options && text && !options.includes(text)) options = [text, ...options];
    const essential = required && requiredApplicationFields.includes(key);
    const title = key === "Employment records" ? "Number of previous employers" : key;
    return <label key={key}><span>{title}{essential ? " *" : ""}</span>{options ? <select aria-label={title} disabled={disabled} required={essential} value={text} onChange={e => update(key, e.target.value)}><option value="">Select</option>{options.map(o => <option key={o}>{o}</option>)}</select> : /Address|Details|Identification Marks|illness|Reason for Leaving/.test(key) ? <textarea disabled={disabled} rows={2} maxLength={2000} required={essential} value={text} onChange={e => update(key, e.target.value)} /> : <input disabled={disabled} maxLength={2000} required={essential} type={/^(Date|Date of birth)$/.test(key) ? "date" : /Mobile|Phone No/.test(key) ? "tel" : "text"} value={text} onChange={e => update(key, e.target.value)} />}</label>;
  }
  const chosen = references.find(r => r.id === value["Reference 1 - Employee ID"]);
  const filtered = references.filter(r => r.id === chosen?.id || `${r.name} ${r.employeeCode}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="joy-questionnaire">{applicationSections.filter(section => !["Supporting document links", "Declaration"].includes(section.title)).map((section, index) => {
    if (section.title.startsWith("Family - Spouse") && value["Marital status"] !== "Married") return null;
    const sibling = section.title.match(/Family - Sibling (\d)/);
    if (sibling && +sibling[1] > +familyCount("Sibling", "Sibling count", 2)) return null;
    const child = section.title.match(/Family - Child (\d)/);
    if (child && (/^(Unmarried|Single)?$/i.test(value["Marital status"] || "") || +child[1] > +familyCount("Child", "Children count", 3))) return null;
    const job = section.title.match(/Previous employment (\d)/);
    if (job && (value["Employment status"] !== "Experienced" || +job[1] > +(value["Employment records"] || (value["Employment 2 - Company Name"] ? 2 : 1)))) return null;
    if (section.title === "Education profile" && !educationLevel(value["Highest qualification"])) return null;
    let keys = section.fields;
    if (section.title === "Education profile") keys = keys.slice(0, educationLevel(value["Highest qualification"]));
    keys = keys.filter(k => (k !== "Children count" || Boolean(value["Marital status"]) && !/^(Unmarried|Single)$/i.test(value["Marital status"])) && (k !== "Employment records" || value["Employment status"] === "Experienced") && (k !== "If Yes, in which City / Town?" || value["Do you own House?"] === "Yes"));
    return <fieldset key={section.title} className={`joy-form-section joy-form-tone-${index % 4}`}><legend>{section.title}</legend>
      {section.title === "Language proficiency" ? <><div className="joy-table-scroll"><table className="joy-input-table"><thead><tr><th>Language</th>{["Read", "Write", "Speak"].map(s => <th key={s}>{s}</th>)}</tr></thead><tbody>{languageFields(value).map(key => <tr key={key}><th scope="row">{key.slice(29, -1)}</th>{["Read", "Write", "Speak"].map(skill => <td key={skill}><input type="checkbox" aria-label={`${key.match(/\[(.*)\]/)?.[1]} ${skill}`} disabled={disabled} checked={(value[key] || "").split(/[,/]+/).map(t => t.trim().toLowerCase()).includes(skill.toLowerCase())} onChange={e => { const skills = new Set((value[key] || "").split(/[,/]+/).map(s => s.trim()).filter(Boolean)); e.target.checked ? skills.add(skill) : skills.delete(skill); update(key, ["Read", "Write", "Speak"].filter(s => skills.has(s)).join(", ")); }} /></td>)}</tr>)}</tbody></table></div><div className="joy-add-language"><label>Other language<input maxLength={60} disabled={disabled} value={otherLanguage} onChange={e => setOtherLanguage(e.target.value)} placeholder="Enter language name" /></label><button type="button" className="secondary-button" disabled={disabled || !otherLanguage.trim()} onClick={() => { const name = otherLanguage.trim().replace(/[\[\]\r\n]/g, ""); if (name && languageFields(value).length < 30 && !languageFields(value).some(k => k.toLowerCase() === `other languages proficiency [${name.toLowerCase()}]`)) update(`Other Languages Proficiency [${name}]`, ""); setOtherLanguage(""); }}>Add language</button></div></> : section.title.startsWith("Reference 1") ? <><p>Select the Joy direct employee who referred you. Required for the team referral report.</p><label>Search direct employees<input disabled={disabled} value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or employee code" /></label><label>Reference 1 — direct employee{required ? " *" : ""}<select aria-label="Reference 1 — direct employee" required={required} disabled={disabled} value={value["Reference 1 - Employee ID"] || ""} onChange={e => { const ref = references.find(r => r.id === e.target.value); onChange({ ...value, "Reference 1 - Employee ID": ref?.id || "", "Reference 1 - Employee Code": ref?.employeeCode || "", "Reference 1 - Name": ref?.name || "" }); }}><option value="">Select direct employee</option>{!chosen && value["Reference 1 - Employee ID"] && <option value={value["Reference 1 - Employee ID"]}>{value["Reference 1 - Employee Code"]} · {value["Reference 1 - Name"]} (previous selection)</option>}{filtered.map(r => <option key={r.id} value={r.id}>{r.employeeCode} · {r.name}</option>)}</select></label>{!references.length && <p>No active direct employees available. HR must add an active Joy direct employee before this application can be submitted.</p>}</> : <div className="joy-question-grid">{keys.map(field)}</div>}
    </fieldset>;
  })}</div>;
}

export function ApplicationUploads({ documents, onChange, disabled = false, saved = [], fresher = false, onBusyChange }: { documents: ApplicationDocument[]; onChange: (docs: ApplicationDocument[]) => void; disabled?: boolean; saved?: ApplicationDocument[]; fresher?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return <fieldset className="joy-form-section joy-form-tone-2"><legend>Upload supporting documents</legend><p>PDF, PNG or JPEG. Maximum 4 MB per file and 18 MB in total. Files are saved with your application.</p>{error && <p role="alert">{error}</p>}{loading && <p role="status">Checking document…</p>}<div className="joy-table-scroll"><table className="joy-input-table"><thead><tr><th>Document</th><th>Upload / selected file</th></tr></thead><tbody>{documentCategories.filter(c => !fresher || !c.startsWith("Previous Employment proofs")).map(category => { const file = documents.find(d => d.category === category) || saved.find(d => d.category === category); return <tr key={category}><th scope="row">{category}</th><td><input type="file" aria-label={`Upload ${category}`} disabled={disabled || loading} accept="application/pdf,image/png,image/jpeg" onChange={async e => {
    const chosen = e.target.files?.[0]; e.target.value = ""; if (!chosen) return; setError(""); setLoading(true); onBusyChange?.(true);
    try {
      if (!["application/pdf", "image/png", "image/jpeg"].includes(chosen.type) || chosen.size > 4 * 1024 * 1024 || !chosen.size) throw Error("Choose a PDF, PNG or JPEG from 1 byte to 4 MB.");
      if (chosen.type === "application/pdf") { const { PDFDocument } = await import("pdf-lib"); await PDFDocument.load(await chosen.arrayBuffer()); } else { const bitmap = await createImageBitmap(chosen); bitmap.close(); }
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(Error("Unable to read document")); reader.readAsDataURL(chosen); });
      const next = [...documents.filter(d => d.category !== category), { category, filename: chosen.name.slice(0, 200), dataUrl }];
      const bytes = next.reduce((sum, d) => sum + Math.floor(d.dataUrl.split(",")[1].length * 3 / 4), 0);
      if (bytes > 18 * 1024 * 1024) throw Error("The selected files exceed 18 MB. Choose smaller files.");
      onChange(next);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to read document"); } finally { setLoading(false); onBusyChange?.(false); }
  }} />{file && <p>{file.filename}{documents.some(d => d.category === category) && <button className="secondary-button" type="button" disabled={disabled || loading} onClick={() => onChange(documents.filter(d => d.category !== category))}>Remove selected file</button>}</p>}</td></tr>; })}</tbody></table></div></fieldset>;
}
