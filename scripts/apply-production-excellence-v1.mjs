import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function patch(path, transform) {
  const file = join(root, path);
  const source = await readFile(file, "utf8");
  const next = transform(source);
  if (next !== source) await writeFile(file, next, "utf8");
}

await patch("app/payroll-app.tsx", (source) => {
  // Joy Payroll is bank-transfer only. Keep historical calculations readable,
  // but never offer Cash as a selectable employee payment method.
  source = source.replaceAll(
    'defaultValue={employee?.paymentMode ?? "cash"}',
    'defaultValue={employee?.paymentMode === "bank" ? "bank" : "bank"}',
  );
  source = source.replaceAll('<option value="cash">Cash</option>', "");
  source = source.replaceAll("Bank vs cash", "Bank transfer readiness");

  if (!source.includes("JOY_PRODUCTION_EXCELLENCE_V1")) {
    source = source.replace(
      '"use client";',
      '"use client";\n// JOY_PRODUCTION_EXCELLENCE_V1 · bank-only payroll + release quality gates',
    );
  }
  return source;
});

await patch("app/api/app-data/route.ts", (source) => {
  // Production policy: all employees are payable by bank transfer. Existing
  // demo/fallback records must follow the same rule as saveEmployee().
  source = source.replaceAll('paymentMode: "cash"', 'paymentMode: "bank"');
  if (!source.includes("JOY_BANK_ONLY_POLICY_V1")) {
    source = `// JOY_BANK_ONLY_POLICY_V1\n${source}`;
  }
  return source;
});

await patch("app/reports-recovery.tsx", (source) => {
  const needle = `    })\n    .filter((row) => row.charge || row.dated.length || row.shared > 0);\n  const roomRows = data.roomExpenses`;
  if (!source.includes("const finalizedVoucherRows = finalizations.flatMap")) {
    if (!source.includes(needle)) {
      throw new Error("Unable to locate recovery employee rows for finalized voucher hardening");
    }
    source = source.replace(
      needle,
      `    })\n    .filter((row) => row.charge || row.dated.length || row.shared > 0);\n\n  // Build bulk vouchers from the finalization register itself. This guarantees\n  // that every finalized employee is included even when the employee has no\n  // dated recovery line or a zero-value recovery in the current view filter.\n  const finalizedVoucherRows = finalizations.flatMap((finalized) => {\n    const employee = employees.find((row) => row.id === finalized.employeeId);\n    if (!employee) return [];\n    return [{\n      employee,\n      charge: runCharges.find((row) => row.employeeId === employee.id),\n      item: items.find((row) => row.employeeId === employee.id),\n    }];\n  });\n  const roomRows = data.roomExpenses`,
    );
  }

  source = source.replace(
    `              Download all finalized vouchers\n            </button>`,
    `              Download all finalized vouchers ({finalizedVoucherRows.length})\n            </button>`,
  );
  source = source.replace(
    `          rows={employeeRows.filter((row) =>\n            finalizations.some((entry) => entry.employeeId === row.employee.id),\n          )}`,
    `          rows={finalizedVoucherRows}`,
  );

  if (!source.includes("JOY_FINALIZED_VOUCHER_COMPLETENESS_V1")) {
    source = source.replace(
      '"use client";',
      '"use client";\n// JOY_FINALIZED_VOUCHER_COMPLETENESS_V1',
    );
  }
  return source;
});

await patch("app/globals.css", (source) => {
  const rules = `\n/* Joy Payroll production readability baseline. */\n.advance-voucher { font-size: 14px; line-height: 1.45; }\n.advance-voucher .data-table th,\n.advance-voucher .data-table td { font-size: 13px; line-height: 1.4; }\n.bulk-recovery-vouchers .advance-voucher { break-inside: avoid; }\n`;
  if (!source.includes("Joy Payroll production readability baseline")) {
    source += rules;
  }
  return source;
});

console.log("Applied Joy Payroll production excellence v1 safeguards.");
