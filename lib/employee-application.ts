// Application-only fields. Payroll values remain in the employee master.
export const applicationSections = [
  { title: "Application details", fields: ["Position Applied For", "Date"] },
  { title: "Personal information", fields: ["Contact person name", "Contact person relationship", "Permanent Address", "Age", "Place of Birth", "Religion", "Caste", "Category", "Height (cm)", "Weight (kg)", "Do you smoke?", "Identification Marks", "Have you had any major surgery / illness recently, or suffer from chronic disease?", "Mother Tongue"] },
  { title: "Language proficiency", fields: ["Tamil", "English", "Hindi", "Malayalam", "Kannada", "Telugu", "Bengali", "Marathi", "Arabi", "Assame"].map(language => `Other Languages Proficiency [${language}]`) },
  ...["Father", "Mother", "Spouse", "Sibling 1", "Sibling 2", "Child 1", "Child 2", "Child 3"].map(relation => ({ title: `Family - ${relation}`, fields: ["Name", "Age", "Qualification", "Occupation", "Monthly Income"].map(field => `${relation} - ${field}`) })),
  { title: "Education profile", fields: ["10th / SSLC Details", "12th / Higher Secondary Details", "Graduation / Diploma Details"] },
  ...[1, 2].map(index => ({ title: `Previous employment ${index}`, fields: ["Company Name", "Designation", "Period of Service", "Salary", "Reason for Leaving"].map(field => `Employment ${index} - ${field}`) })),
  { title: "House details", fields: ["Do you own House?", "If Yes, in which City / Town?"] },
  ...[1, 2].map(index => ({ title: `Non-relative reference ${index}`, fields: ["Name", "Position", "Address", "Phone No"].map(field => `Reference ${index} - ${field}`) })),
  { title: "Declaration", fields: ["Declaration", "Digital Signature (Type your full name)"] },
  { title: "Supporting document links", fields: ["Aadhar Front side", "Aadhar Back side", "Bank Proofs", ...[1,2,3,4,5].map(i => `Education Qualification certificates ${i}`), ...[1,2,3].map(i => `Previous Employment proofs ${i}`), "Other proofs 1", "Other proofs 2"] },
];

export type ApplicationData = Record<string, string>;
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
