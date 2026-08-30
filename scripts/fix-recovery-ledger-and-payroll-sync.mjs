import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function replaceBlock(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker not found`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${label}: end marker not found`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// ---------------------------------------------------------------------------
// 1. Room recovery storage must be an append-only dated ledger, not one row
//    per room/month. Keep a normal lookup index, but remove the uniqueness.
// ---------------------------------------------------------------------------
const schemaPath = join(root, "db/schema.ts");
let schema = await readFile(schemaPath, "utf8");
if (!schema.match(/\bindex,\s*\n/)) {
  schema = schema.replace(
    `import {\n  integer,`,
    `import {\n  index,\n  integer,`,
  );
}
schema = schema.replace(
  `    uniqueIndex("accommodation_room_period_unique").on(\n      table.roomId,\n      table.payPeriod,\n    ),`,
  `    index("accommodation_room_period_idx").on(\n      table.roomId,\n      table.payPeriod,\n    ),`,
);
await writeFile(schemaPath, schema, "utf8");

// ---------------------------------------------------------------------------
// 2. API: every room recovery save creates a new dated transaction. Monthly
//    finalization aggregates every transaction for the room/pay-period and
//    pushes one combined per-head share into payroll calculations.
// ---------------------------------------------------------------------------
const apiPath = join(root, "app/api/app-data/route.ts");
let api = await readFile(apiPath, "utf8");

api = replaceBlock(
  api,
  `    } else if (action === "save-room-expense") {`,
  `    } else if (action === "finalize-room-expense") {`,
  `    } else if (action === "save-room-expense") {
      const roomId = textValue(payload.roomId, "Accommodation room");
      const [room] = await db
        .select()
        .from(accommodationRooms)
        .where(eq(accommodationRooms.id, roomId))
        .limit(1);
      if (!room) throw new RequestError("Accommodation room not found", 404);
      requireClientScope(access, room.vendorId);
      if (room.status !== "active")
        throw new RequestError(
          "Reactivate the room before adding expenses",
          409,
        );
      const payPeriod = periodValue(payload.payPeriod);
      const gasAmount = positiveValue(payload.gasAmount, "Gas expense");
      const rationAmount = positiveValue(payload.rationAmount, "Ration expense");
      const provisionAmount = positiveValue(
        payload.provisionAmount,
        "Provision expense",
      );
      if (gasAmount + rationAmount + provisionAmount <= 0)
        throw new RequestError(
          "Enter at least one Gas, Ration, or Provision recovery amount",
        );
      const values = {
        gasAmount,
        gasDate: payload.gasDate
          ? dateValue(payload.gasDate, "Gas cylinder date")
          : null,
        gasCylinderCount: Math.round(
          positiveValue(payload.gasCylinderCount ?? 0, "Gas cylinder count"),
        ),
        gasPaymentReference: optionalValue(payload.gasPaymentReference),
        rationAmount,
        rationDate: payload.rationDate
          ? dateValue(payload.rationDate, "Ration date")
          : null,
        rationPaymentReference: optionalValue(payload.rationPaymentReference),
        provisionAmount,
        provisionDate: payload.provisionDate
          ? dateValue(payload.provisionDate, "Provision date")
          : null,
        provisionPaymentReference: optionalValue(
          payload.provisionPaymentReference,
        ),
        notes: optionalValue(payload.notes),
        updatedAt: new Date().toISOString(),
      };
      const expenseId = \`ROOMEXP-\${crypto.randomUUID()}\`;
      await db
        .insert(accommodationRoomExpenses)
        .values({ id: expenseId, roomId, payPeriod, ...values });
      const entryDate =
        values.gasDate ?? values.rationDate ?? values.provisionDate ?? payPeriod;
      await writeAudit(
        db,
        "room_expense_saved",
        "room",
        room.id,
        \`Added dated room recovery for \${room.roomNumber} on \${entryDate}: Gas ₹\${gasAmount.toFixed(2)}, Ration ₹\${rationAmount.toFixed(2)}, Provision ₹\${provisionAmount.toFixed(2)}\`,
        actorEmail,
      );
`,
  "save-room-expense ledger",
);

api = replaceBlock(
  api,
  `async function finalizeRoomExpense(\n`,
  `async function updateUnitCount(`,
  `async function finalizeRoomExpense(
  db: Db,
  expenseId: string,
  access: AppAccess,
) {
  const [expense] = await db
    .select()
    .from(accommodationRoomExpenses)
    .where(eq(accommodationRoomExpenses.id, expenseId))
    .limit(1);
  if (!expense) throw new RequestError("Room recovery entry not found", 404);
  const [room] = await db
    .select()
    .from(accommodationRooms)
    .where(eq(accommodationRooms.id, expense.roomId))
    .limit(1);
  if (!room) throw new RequestError("Accommodation room not found", 404);
  requireClientScope(access, room.vendorId);

  const ledger = await db
    .select()
    .from(accommodationRoomExpenses)
    .where(
      and(
        eq(accommodationRoomExpenses.roomId, expense.roomId),
        eq(accommodationRoomExpenses.payPeriod, expense.payPeriod),
      ),
    );
  if (!ledger.length)
    throw new RequestError("No room recovery entries were found", 404);
  if (ledger.every((entry) => entry.status === "finalized"))
    throw new RequestError(
      "This room recovery month has already been finalized",
      409,
    );

  const occupants = await db
    .select()
    .from(employees)
    .where(and(eq(employees.roomId, room.id), eq(employees.status, "active")));
  if (!occupants.length)
    throw new RequestError(
      "Allocate at least one active employee before finalizing room recoveries",
      409,
    );

  const affectedRuns = new Map<string, PayrollRunRow>();
  const runByEmployee = new Map<string, PayrollRunRow>();
  for (const employee of occupants) {
    requireUnitScope(access, employee.clientUnitId, employee.vendorId);
    const [run] = await db
      .select()
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.clientUnitId, employee.clientUnitId),
          eq(payrollRuns.payPeriod, expense.payPeriod),
        ),
      )
      .limit(1);
    if (!run)
      throw new RequestError(
        \`Create \${expense.payPeriod} payroll for \${employee.employeeCode} before finalizing room \${room.roomNumber}\`,
        409,
      );
    if (run.status === "approved")
      throw new RequestError(
        \`Reopen \${employee.employeeCode}'s approved payroll before applying room recoveries\`,
        409,
      );
    const [item] = await db
      .select({ id: payrollItems.id })
      .from(payrollItems)
      .where(
        and(
          eq(payrollItems.runId, run.id),
          eq(payrollItems.employeeId, employee.id),
        ),
      )
      .limit(1);
    if (!item)
      throw new RequestError(
        \`\${employee.employeeCode} is missing from the \${expense.payPeriod} payroll run\`,
        409,
      );
    affectedRuns.set(run.id, run);
    runByEmployee.set(employee.id, run);
  }

  const aggregateExpense = {
    ...expense,
    gasAmount: roundMoney(
      ledger.reduce((sum, entry) => sum + numberValue(entry.gasAmount), 0),
    ),
    rationAmount: roundMoney(
      ledger.reduce((sum, entry) => sum + numberValue(entry.rationAmount), 0),
    ),
    provisionAmount: roundMoney(
      ledger.reduce((sum, entry) => sum + numberValue(entry.provisionAmount), 0),
    ),
  };
  const shares = splitRoomExpenses(
    aggregateExpense,
    occupants.map((employee) => employee.id),
  );
  const anchorExpenseId = expense.id;
  for (const share of shares) {
    const run = runByEmployee.get(share.employeeId);
    if (!run) continue;
    const employee = occupants.find(
      (candidate) => candidate.id === share.employeeId,
    );
    const fullRent = employee
      ? positiveValue(employee.roomRentAmount ?? 0, "Room rent")
      : 0;
    const joinedLate = Boolean(
      employee?.dateOfJoining?.startsWith(\`${expense.payPeriod}-\`) &&
      Number(employee.dateOfJoining.slice(8, 10)) > room.rentCutoffDay,
    );
    const rent = roundMoney(
      fullRent * (joinedLate ? room.lateJoinRentPercent / 100 : 1),
    );
    const values = {
      roomExpenseId: anchorExpenseId,
      roomNumber: room.roomNumber,
      gasShare: share.gasShare,
      rationShare: share.rationShare,
      provisionShare: share.provisionShare,
      rent,
    };
    const [existing] = await db
      .select()
      .from(accommodationCharges)
      .where(
        and(
          eq(accommodationCharges.runId, run.id),
          eq(accommodationCharges.employeeId, share.employeeId),
        ),
      )
      .limit(1);
    if (existing)
      await db
        .update(accommodationCharges)
        .set(values)
        .where(eq(accommodationCharges.id, existing.id));
    else
      await db
        .insert(accommodationCharges)
        .values({ runId: run.id, employeeId: share.employeeId, ...values });
  }

  const finalizedAt = new Date().toISOString();
  await db
    .update(accommodationRoomExpenses)
    .set({
      occupantCount: occupants.length,
      status: "finalized",
      finalizedBy: access.identity.email,
      finalizedAt,
      updatedAt: finalizedAt,
    })
    .where(
      and(
        eq(accommodationRoomExpenses.roomId, expense.roomId),
        eq(accommodationRoomExpenses.payPeriod, expense.payPeriod),
      ),
    );
  for (const run of affectedRuns.values())
    await recalculateRun(db, run.id, false);
  return { expense, room, occupants, ledger };
}

`,
  "finalize room recovery ledger",
);

api = replaceBlock(
  api,
  `    } else if (action === "reopen-room-expense") {`,
  `    } else if (action === "save-shift") {`,
  `    } else if (action === "reopen-room-expense") {
      const expenseId = textValue(payload.expenseId, "Room recovery entry");
      const [expense] = await db
        .select()
        .from(accommodationRoomExpenses)
        .where(eq(accommodationRoomExpenses.id, expenseId))
        .limit(1);
      if (!expense)
        throw new RequestError("Room recovery entry not found", 404);
      const [room] = await db
        .select()
        .from(accommodationRooms)
        .where(eq(accommodationRooms.id, expense.roomId))
        .limit(1);
      if (!room) throw new RequestError("Accommodation room not found", 404);
      requireClientScope(access, room.vendorId);
      const ledger = await db
        .select()
        .from(accommodationRoomExpenses)
        .where(
          and(
            eq(accommodationRoomExpenses.roomId, expense.roomId),
            eq(accommodationRoomExpenses.payPeriod, expense.payPeriod),
          ),
        );
      const ledgerIds = ledger.map((entry) => entry.id);
      const affected = ledgerIds.length
        ? await db
            .select()
            .from(accommodationCharges)
            .where(inArray(accommodationCharges.roomExpenseId, ledgerIds))
        : [];
      const affectedRuns = new Set(affected.map((charge) => charge.runId));
      for (const affectedRunId of affectedRuns) {
        const run = await requireRun(db, affectedRunId, true);
        requireUnitScope(access, run.clientUnitId, run.vendorId);
      }
      if (ledgerIds.length)
        await db
          .update(accommodationCharges)
          .set({
            roomExpenseId: null,
            gasShare: 0,
            rationShare: 0,
            provisionShare: 0,
          })
          .where(inArray(accommodationCharges.roomExpenseId, ledgerIds));
      await db
        .update(accommodationRoomExpenses)
        .set({
          status: "draft",
          occupantCount: 0,
          finalizedBy: null,
          finalizedAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(accommodationRoomExpenses.roomId, expense.roomId),
            eq(accommodationRoomExpenses.payPeriod, expense.payPeriod),
          ),
        );
      for (const affectedRunId of affectedRuns)
        await recalculateRun(db, affectedRunId, false);
      await writeAudit(
        db,
        "room_expense_reopened",
        "room",
        room.id,
        \`Reopened all \${expense.payPeriod} room recovery ledger entries for room \${room.roomNumber}\`,
        actorEmail,
      );
`,
  "reopen room recovery ledger",
);

await writeFile(apiPath, api, "utf8");

// ---------------------------------------------------------------------------
// 3. Recovery UI: do not preload/overwrite the previous room entry. Show a
//    dated ledger and make approved-payroll locking explicit for individuals.
// ---------------------------------------------------------------------------
const recoveryPath = join(root, "app/reports-recovery.tsx");
let recovery = await readFile(recoveryPath, "utf8");

recovery = recovery.replace(
  /\s*const saved = data\.roomExpenses\.find\(\(expense\) => expense\.roomId === roomId && expense\.payPeriod === run\?\.payPeriod\);\n\s*setRoomRecoveryGas\(saved\?\.gasAmount \?\? 0\);\n\s*setRoomRecoveryRation\(saved\?\.rationAmount \?\? 0\);\n\s*setRoomRecoveryProvision\(saved\?\.provisionAmount \?\? 0\);/,
  `\n    // New room recovery entries are append-only. Never preload and overwrite a prior dated entry.\n    setRoomRecoveryGas(0);\n    setRoomRecoveryRation(0);\n    setRoomRecoveryProvision(0);`,
);

if (!recovery.includes("recovery-lock-guidance")) {
  recovery = recovery.replace(
    `      {run && (canManage || canApprove) ? (`,
    `      {run?.status === "approved" ? (\n        <section className="panel recovery-lock-guidance">\n          <span className="eyebrow">Recovery entry locked by payroll approval</span>\n          <h2>Reopen payroll before changing employee recoveries</h2>\n          <p className="muted-label">\n            {data.payrollBatches.filter((batch) => batch.runId === run.id && batch.status === "cleared").length\n              ? \`First reopen \${data.payrollBatches.filter((batch) => batch.runId === run.id && batch.status === "cleared").length} cleared payment batch(es) in Payments & Payslips. Then use Reopen Payroll and add the dated recovery.\`\n              : "Use Reopen Payroll, then add the dated recovery. Saving it will automatically recalculate final payable and bank payable."}\n          </p>\n        </section>\n      ) : null}\n      {run && (canManage || canApprove) ? (`,
  );
}

recovery = recovery.replace(
  `disabled={isActing || !employeeId || amount <= 0}`,
  `disabled={isActing || !employeeId || amount <= 0 || run.status === "approved"}`,
);
recovery = recovery.replace(
  `            Add dated recovery\n          </button>`,
  `            {run.status === "approved" ? "Reopen payroll to add recovery" : "Add dated recovery"}\n          </button>`,
);
recovery = recovery.replaceAll(
  `<span className="eyebrow">Shared room recoveries</span>`,
  `<span className="eyebrow">Room recovery date-wise ledger</span>`,
);
recovery = recovery.replaceAll(
  `Finalized total ÷ room occupant count`,
  `Every dated entry is preserved; monthly total ÷ confirmed room occupants`,
);
recovery = recovery.replace(
  `                <th>Room</th>\n                <th>Month</th>\n                <th>Occupants</th>`,
  `                <th>Room</th>\n                <th>Month</th>\n                <th>Entry date</th>\n                <th>Occupants</th>`,
);
recovery = recovery.replace(
  `                  <td>{expense.payPeriod}</td>\n                  <td>{expense.occupantCount}</td>`,
  `                  <td>{expense.payPeriod}</td>\n                  <td>{expense.gasDate ?? expense.rationDate ?? expense.provisionDate ?? "—"}</td>\n                  <td>{expense.occupantCount}</td>`,
);
recovery = recovery.replaceAll(
  `Save room recovery for {run.payPeriod}`,
  `Save dated room recovery entry for {run.payPeriod}`,
);

await writeFile(recoveryPath, recovery, "utf8");

console.log("Recovery ledger hotfix applied: individual recovery lock guidance, append-only room entries, monthly aggregate finalization and payroll synchronization.");
