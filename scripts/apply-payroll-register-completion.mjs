import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
async function patch(path, transform) {
  const full = join(root, path);
  const source = await readFile(full, "utf8");
  const updated = transform(source);
  if (updated !== source) await writeFile(full, updated, "utf8");
}
function once(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`Unable to apply ${label}`);
  return source.replace(search, replacement);
}

const schemaAttendanceFields = `  fixedWorkingDays: real("fixed_working_days").notNull().default(0),\n  nfhDays: real("nfh_days").notNull().default(0),\n  compOffDays: real("comp_off_days").notNull().default(0),\n  onDutyDays: real("on_duty_days").notNull().default(0),\n  sundayDays: real("sunday_days").notNull().default(0),\n  plDays: real("pl_days").notNull().default(0),\n  clDays: real("cl_days").notNull().default(0),\n  slDays: real("sl_days").notNull().default(0),\n  importedGrossEarnings: real("imported_gross_earnings"),\n  importedTotalDeductions: real("imported_total_deductions"),\n  importedNetPayable: real("imported_net_payable"),\n`;

await patch("db/schema.ts", (source) => {
  if (!source.includes('fixedWorkingDays: real("fixed_working_days")')) {
    source = once(source,
      '  overtimeHours: real("overtime_hours").notNull().default(0),\n  basic: real("basic").notNull().default(0),',
      `  overtimeHours: real("overtime_hours").notNull().default(0),\n${schemaAttendanceFields}  basic: real("basic").notNull().default(0),`,
      "payroll register schema fields");
  }
  return source;
});

await patch("app/api/app-data/route.ts", (source) => {
  const selected = `        overtimeHours: payrollItems.overtimeHours,\n        fixedWorkingDays: payrollItems.fixedWorkingDays,\n        nfhDays: payrollItems.nfhDays,\n        compOffDays: payrollItems.compOffDays,\n        onDutyDays: payrollItems.onDutyDays,\n        sundayDays: payrollItems.sundayDays,\n        plDays: payrollItems.plDays,\n        clDays: payrollItems.clDays,\n        slDays: payrollItems.slDays,\n        importedGrossEarnings: payrollItems.importedGrossEarnings,\n        importedTotalDeductions: payrollItems.importedTotalDeductions,\n        importedNetPayable: payrollItems.importedNetPayable,\n        basic: payrollItems.basic,`;
  if (!source.includes("fixedWorkingDays: payrollItems.fixedWorkingDays")) {
    source = once(source,
      '        overtimeHours: payrollItems.overtimeHours,\n        basic: payrollItems.basic,',
      selected,
      "payroll register GET fields");
  }

  const importBlock = `      for (const field of [\n        "presentDays",\n        "payableDays",\n        "overtimeHours",\n        "fixedWorkingDays",\n        "nfhDays",\n        "compOffDays",\n        "onDutyDays",\n        "sundayDays",\n        "plDays",\n        "clDays",\n        "slDays",\n      ] as const)\n        if (Object.hasOwn(imported, field))\n          update[field] = positiveValue(imported[field], field);\n      const importedTotals = {\n        importedGrossEarnings: Object.hasOwn(imported, "sourceGrossEarnings")\n          ? positiveValue(imported.sourceGrossEarnings, "Gross Earnings")\n          : item.importedGrossEarnings,\n        importedTotalDeductions: Object.hasOwn(imported, "sourceTotalDeductions")\n          ? positiveValue(imported.sourceTotalDeductions, "Total Deductions")\n          : item.importedTotalDeductions,\n        importedNetPayable: Object.hasOwn(imported, "sourceNetPayable")\n          ? positiveValue(imported.sourceNetPayable, "Net Payable")\n          : item.importedNetPayable,\n      };`;
  if (!source.includes('"fixedWorkingDays",\n        "nfhDays"')) {
    source = once(source,
      `      for (const field of [\n        "presentDays",\n        "payableDays",\n        "overtimeHours",\n      ] as const)\n        if (Object.hasOwn(imported, field))\n          update[field] = positiveValue(imported[field], field);`,
      importBlock,
      "salary register import attendance fields");
    source = once(source,
      `        .set({\n          ...update,\n          grossEarnings: totals.grossEarnings,\n          totalDeductions: totals.totalDeductions,\n          netPayable: totals.netPayable,\n        })`,
      `        .set({\n          ...update,\n          ...importedTotals,\n          grossEarnings: totals.grossEarnings,\n          totalDeductions: totals.totalDeductions,\n          netPayable: totals.netPayable,\n        })`,
      "salary register imported total audit fields");
  }

  const manualFields = `      for (const field of [\n        "presentDays",\n        "payableDays",\n        "overtimeHours",\n        "fixedWorkingDays",\n        "nfhDays",\n        "compOffDays",\n        "onDutyDays",\n        "sundayDays",\n        "plDays",\n        "clDays",\n        "slDays",\n      ] as const)\n        if (Object.hasOwn(fields, field))\n          update[field] = positiveValue(fields[field], field);\n`;
  if (!source.includes("Object.hasOwn(fields, \"fixedWorkingDays\")")) {
    const marker = `      for (const field of [...earningFields, ...deductionFields])\n        if (Object.hasOwn(fields, field))\n          update[field] = positiveValue(fields[field], field);\n      const totals = payrollTotals({ ...item, ...update });`;
    source = once(source, marker,
      `      for (const field of [...earningFields, ...deductionFields])\n        if (Object.hasOwn(fields, field))\n          update[field] = positiveValue(fields[field], field);\n${manualFields}      const totals = payrollTotals({ ...item, ...update });`,
      "single salary entry attendance fields");
  }
  return source;
});

await patch("app/payroll-app.tsx", (source) => {
  const typeFields = `  fixedWorkingDays: number;\n  nfhDays: number;\n  compOffDays: number;\n  onDutyDays: number;\n  sundayDays: number;\n  plDays: number;\n  clDays: number;\n  slDays: number;\n  importedGrossEarnings: number | null;\n  importedTotalDeductions: number | null;\n  importedNetPayable: number | null;\n`;
  if (!source.includes("  fixedWorkingDays: number;")) {
    source = once(source,
      "  overtimeHours: number;\n  punchIn: string | null;",
      `  overtimeHours: number;\n${typeFields}  punchIn: string | null;`,
      "PayrollItem register type fields");
  }

  if (!source.includes("Fixed W Days")) {
    source = once(source,
      `        "Present",\n        "Absent",\n        "Leave",\n        "WO/H",\n        "Holiday Present",\n        "Payable Days",\n        "OT Hours",`,
      `        "W Days",\n        "Absent",\n        "Leave",\n        "WO/H",\n        "Holiday Present",\n        "Fixed W Days",\n        "NFH",\n        "CO",\n        "OD",\n        "Sundays",\n        "PL",\n        "CL",\n        "SL",\n        "Payable Days",\n        "OT Hours",`,
      "payroll CSV register headers");
    source = once(source,
      `        item.presentDays,\n        item.absentDays,\n        item.leaveDays,\n        item.weekOffDays,\n        item.holidayPresentDays,\n        item.payableDays,\n        item.overtimeHours,`,
      `        item.presentDays,\n        item.absentDays,\n        item.leaveDays,\n        item.weekOffDays,\n        item.holidayPresentDays,\n        item.fixedWorkingDays,\n        item.nfhDays,\n        item.compOffDays,\n        item.onDutyDays,\n        item.sundayDays,\n        item.plDays,\n        item.clDays,\n        item.slDays,\n        item.payableDays,\n        item.overtimeHours,`,
      "payroll CSV register rows");
  }

  const payslipBreakdown = `        <div><span>Fixed W days</span><strong>{item.fixedWorkingDays}</strong></div>\n        <div><span>W days</span><strong>{item.presentDays}</strong></div>\n        <div><span>NFH</span><strong>{item.nfhDays}</strong></div>\n        <div><span>CO</span><strong>{item.compOffDays}</strong></div>\n        <div><span>OD</span><strong>{item.onDutyDays}</strong></div>\n        <div><span>Sundays</span><strong>{item.sundayDays}</strong></div>\n        <div><span>PL</span><strong>{item.plDays}</strong></div>\n        <div><span>CL</span><strong>{item.clDays}</strong></div>\n        <div><span>SL</span><strong>{item.slDays}</strong></div>\n`;
  if (!source.includes("<span>Fixed W days</span>")) {
    source = once(source,
      `        <div>\n          <span>Payable days</span>\n          <strong>{item.payableDays}</strong>\n        </div>`,
      `${payslipBreakdown}        <div>\n          <span>Payable days</span>\n          <strong>{item.payableDays}</strong>\n        </div>`,
      "payslip full attendance register");
  }

  const salaryInputs = `              <section className="salary-attendance-inputs">\n                <h3>Attendance / payable inputs</h3>\n                <div className="form-grid">\n                  {[\n                    ["fixedWorkingDays", "Fixed W Days"],\n                    ["presentDays", "W Days"],\n                    ["nfhDays", "NFH"],\n                    ["compOffDays", "CO"],\n                    ["onDutyDays", "OD"],\n                    ["sundayDays", "Sundays"],\n                    ["plDays", "PL"],\n                    ["clDays", "CL"],\n                    ["slDays", "SL"],\n                    ["payableDays", "Payable Days"],\n                    ["overtimeHours", "OT Hrs"],\n                  ].map(([field, label]) => (\n                    <label key={field}>\n                      <span>{label}</span>\n                      <input name={field} type="number" min="0" step="0.5" defaultValue={Number(modal.item[field as keyof PayrollItem] ?? 0)} />\n                    </label>\n                  ))}\n                </div>\n              </section>\n`;
  if (!source.includes('className="salary-attendance-inputs"')) {
    source = once(source,
      `          {modal.kind === "salary" ? (\n            <div className="salary-form-columns">\n              <section>`,
      `          {modal.kind === "salary" ? (\n            <div className="salary-form-columns">\n${salaryInputs}              <section>`,
      "single salary attendance inputs");
  }

  if (!source.includes("Imported register check")) {
    source = once(source,
      `      <div className="payslip-net">`,
      `      {item.importedGrossEarnings !== null || item.importedNetPayable !== null ? (\n        <div className="form-note payslip-import-check">\n          <strong>Imported register check</strong>\n          <span>Source Gross: {money(item.importedGrossEarnings ?? item.grossEarnings)} · Source Deductions: {money(item.importedTotalDeductions ?? item.totalDeductions)} · Source Net: {money(item.importedNetPayable ?? item.netPayable)}</span>\n        </div>\n      ) : null}\n      <div className="payslip-net">`,
      "payslip imported totals audit");
  }

  if (
    !source.includes("No calculated bank rows are available") &&
    !source.includes("JOY_CASH_FALLBACK_EXPORT_V1")
  ) {
    source = once(source,
      `        <div className="record-actions">\n          <button\n            className="secondary-button"\n            onClick={exportIndianBank}`,
      `        {!bankItems.length ? <p className="form-note"><strong>No calculated bank rows are available.</strong> Open Payroll Run and recalculate/refresh totals. Bank files are enabled automatically once salary rows exist and your Payments permission is Full access.</p> : null}\n        <div className="record-actions">\n          <button\n            className="secondary-button"\n            onClick={exportIndianBank}`,
      "bank export readiness message");
  }
  return source;
});

await patch("app/globals.css", (source) => {
  if (source.includes("JOY_PAYROLL_REGISTER_COMPLETION_20260828")) return source;
  return source + `\n/* JOY_PAYROLL_REGISTER_COMPLETION_20260828 */\n.salary-form-columns{grid-template-columns:1fr 1fr!important}.salary-attendance-inputs{grid-column:1/-1;padding-bottom:16px;border-bottom:1px solid var(--line,#e4e9f1)}.salary-attendance-inputs .form-grid{grid-template-columns:repeat(4,minmax(120px,1fr))}.payslip-import-check{margin:8px 0}.profile-password-panel input{box-sizing:border-box}.id-card-company b{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}@media(max-width:900px){.salary-attendance-inputs .form-grid{grid-template-columns:repeat(2,minmax(120px,1fr))}}\n@media print{body[data-print-target="id-card-both"] .employee-id-card-set,body[data-print-target="id-card-both"] .employee-id-card-set *{visibility:visible!important}body[data-print-target="id-card-both"] .employee-id-card-set{position:absolute!important;inset:0!important;display:block!important;width:100%!important}.employee-id-card-set .id-card-front,.employee-id-card-set .id-card-back{width:54mm!important;height:85.6mm!important;margin:10mm!important;box-shadow:none!important;break-after:page!important;page-break-after:always!important}.employee-id-card-set .id-card-back{page-break-after:auto!important}}\n`;
});

console.log("Completed Joy Payroll 41-column register persistence, single-entry inputs, payslip audit fields, exports, bank readiness guidance, and two-sided print support.");
