// Application-only fields. Payroll values remain in the employee master.
export const applicationSections = [
  { title: "Applicant identity", fields: ["Full name", "Mobile number", "Date of birth", "Gender", "Highest qualification", "Marital status", "Employment status"] },
  { title: "Application details", fields: ["Position Applied For", "Date"] },
  { title: "Personal information", fields: ["Contact person name", "Contact person relationship", "Permanent Address", "Age", "Place of Birth", "Height (cm)", "Weight (kg)", "Do you smoke?", "Identification Marks", "Have you had any major surgery / illness recently, or suffer from chronic disease?", "Mother Tongue", "Sibling count", "Children count", "Employment records"] },
  { title: "Language proficiency", fields: ["Tamil", "English", "Hindi", "Malayalam", "Kannada", "Telugu", "Bengali", "Marathi", "Arabi", "Assame"].map(language => `Other Languages Proficiency [${language}]`) },
  ...["Father", "Mother", "Spouse", "Sibling 1", "Sibling 2", "Child 1", "Child 2", "Child 3"].map(relation => ({ title: `Family - ${relation}`, fields: ["Name", "Age", "Qualification", "Occupation", "Monthly Income"].map(field => `${relation} - ${field}`) })),
  { title: "Education profile", fields: ["10th / SSLC Details", "12th / Higher Secondary Details", "Graduation / Diploma Details"] },
  ...[1, 2].map(index => ({ title: `Previous employment ${index}`, fields: ["Company Name", "Designation", "Period of Service", "Salary", "Reason for Leaving"].map(field => `Employment ${index} - ${field}`) })),
  { title: "House details", fields: ["Do you own House?", "If Yes, in which City / Town?"] },
  { title: "Reference 1 — Joy direct employee", fields: ["Employee ID", "Employee Code", "Name"].map(field => `Reference 1 - ${field}`) },
  { title: "Reference 2 — other reference", fields: ["Name", "Position", "Address", "Phone No"].map(field => `Reference 2 - ${field}`) },
  { title: "Declaration", fields: ["Declaration", "Digital Signature (Type your full name)"] },
  { title: "Supporting document links", fields: ["Aadhar Front side", "Aadhar Back side", "Bank Proofs", ...[1,2,3,4,5].map(i => `Education Qualification certificates ${i}`), ...[1,2,3].map(i => `Previous Employment proofs ${i}`), "Other proofs 1", "Other proofs 2"] },
];

export type ApplicationData = Record<string, string>;
export type ApplicationDocument = { category: string; filename: string; dataUrl: string };
export type ApplicationRequest = (employeeId: string) => Promise<ApplicationDocument[]>;
export type ReferenceOption = { id: string; employeeCode: string; name: string };
export const requiredApplicationFields = ["Full name", "Mobile number", "Date of birth", "Gender", "Highest qualification", "Marital status", "Employment status", "Reference 1 - Employee ID"];
export const documentCategories = applicationSections.find(s => s.title === "Supporting document links")!.fields;
export const isLanguageField = (key: string) => /^Other Languages Proficiency \[[^\[\]\r\n]{1,60}\]$/.test(key);
export const languageFields = (data: ApplicationData) => [...new Set([...applicationSections.find(s => s.title === "Language proficiency")!.fields, ...Object.keys(data).filter(isLanguageField)])];
export function educationLevel(qualification = "") {
  if (/below|no formal|primary|middle/i.test(qualification)) return 0;
  if (/^10|sslc/i.test(qualification)) return 1;
  if (/^12|higher secondary|hsc/i.test(qualification)) return 2;
  return qualification.trim() ? 3 : 0;
}
export function applicableFields(data: ApplicationData): ApplicationData {
  const next = { ...data };
  for (const key of Object.keys(next)) {
    if (/^(religion|caste|category|community|community type)$/i.test(key)) delete next[key];
    if (next["Employment status"] === "Fresher" && (/^Employment [12] -/.test(key) || /^Previous Employment proofs/.test(key))) delete next[key];
    if (/^(unmarried|single)$/i.test(next["Marital status"] || "") && /^(Spouse|Child [1-3]) -/.test(key)) delete next[key];
    for (const [relation, countKey] of [["Sibling", "Sibling count"], ["Child", "Children count"]]) {
      const match = key.match(new RegExp(`^${relation} ([1-3]) -`));
      if (match && next[countKey] !== undefined && Number(match[1]) > Number(next[countKey])) delete next[key];
    }
  }
  if (/^(unmarried|single)$/i.test(next["Marital status"] || "")) next["Children count"] = "0";
  if (next["Highest qualification"]) {
    const level = educationLevel(next["Highest qualification"]);
    applicationSections.find(s => s.title === "Education profile")!.fields.forEach((key, i) => { if (i >= level) delete next[key]; });
  }
  if (next["Do you own House?"] === "No") delete next["If Yes, in which City / Town?"];
  return next;
}
export function readApplication(value?: string | null): ApplicationData {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, val]) => key !== "__proto__" && typeof val === "string")) as ApplicationData;
  } catch { return {}; }
}

export function safeApplicationImage(value?: string | null) {
  return value && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : undefined;
}
