"use client";
// JOY_FINALIZED_VOUCHER_COMPLETENESS_V1

import { useMemo, useState, type FormEvent } from "react";
import {
  printIsolatedElement,
  type PayrollPrintTarget,
} from "../lib/print-document";
import type {
  AccommodationCharge,
  AppData,
  ClientUnit,
  Employee,
  PayrollItem,
  PayrollRun,
  RecoveryEntry,
  Vendor,
} from "./payroll-app";

type ReportRow = Array<string | number>;

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
function save(filename: string, body: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
function exportCsv(name: string, rows: ReportRow[]) {
  save(
    `${name}.csv`,
    rows.map((row) => row.map(csvCell).join(",")).join("\n"),
    "text/csv;charset=utf-8",
  );
}
function exportExcel(name: string, rows: ReportRow[]) {
  const table = `<table>${rows.map((row, index) => `<tr>${row.map((value) => `<${index ? "td" : "th"}>${String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</${index ? "td" : "th"}>`).join("")}</tr>`).join("")}</table>`;
  save(
    `${name}.xls`,
    `\ufeff<html><head><meta charset="utf-8"></head><body>${table}</body></html>`,
    "application/vnd.ms-excel",
  );
}

function printTarget() {
  const target: PayrollPrintTarget = document.querySelector(".bulk-recovery-vouchers")
    ? "bulk-vouchers"
    : document.querySelector(".room-report-modal .advance-voucher")
      ? "voucher"
      : "report";
  const source = target === "bulk-vouchers"
    ? document.querySelector<HTMLElement>(".bulk-recovery-vouchers")
    : target === "voucher"
      ? document.querySelector<HTMLElement>(".advance-voucher-layer .advance-voucher")
      : document.querySelector<HTMLElement>(".room-report-layer .room-report-pages, .report-print-area");
  if (!source) return;
  void printIsolatedElement(source, target);
}

const recoveryLabels: Record<string, string> = {
  rent: "Room rent",
  bus: "Bus",
  food: "Food",
  advance: "Salary advance",
  idCard: "ID card",
  medical: "Medical",
  ticket: "Ticket",
  shoe: "Shoe",
  aadhaarUpdate: "Aadhaar update",
  bankAccountCharge: "Bank account charge",
  tshirt: "T-shirt",
  oldPending: "Old pending",
  returnAmount: "Return amount",
};

function voucherBrand(vendor?: Vendor, unit?: ClientUnit) {
  const companyName = vendor?.legalName ?? vendor?.name ?? "JOY GROUPS";
  const corporate = companyName.toLowerCase().includes("corporate");
  return {
    companyName,
    clientEmployer: unit
      ? `${unit.clientName}${unit.unitName ? ` · ${unit.unitName}` : ""}`
      : "Client employer",
    address:
      "8/40, 16 Krishna Complex, Thennampalayam, Arasur, Coimbatore - 641407",
    email: corporate
      ? "info@joycorporatesolutions.com"
      : "operations@joyindia.in",
    contact: "+91 90807 76580",
  };
}

export function RecoveryCenter({
  run,
  vendorId,
  employees,
  items,
  charges,
  data,
  canManage,
  canApprove,
  isActing,
  onAction,
}: {
  run: PayrollRun | null;
  vendorId: string;
  employees: Employee[];
  items: PayrollItem[];
  charges: AccommodationCharge[];
  data: AppData;
  canManage: boolean;
  canApprove: boolean;
  isActing: boolean;
  onAction: (
    action: string,
    message: string,
    details?: Record<string, unknown>,
  ) => Promise<boolean>;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [recoveryDate, setRecoveryDate] = useState(
    run?.periodStart ??
      `${run?.payPeriod ?? new Date().toISOString().slice(0, 7)}-01`,
  );
  const [recoveryType, setRecoveryType] = useState("advance");
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [voucherEmployeeId, setVoucherEmployeeId] = useState<string | null>(
    null,
  );
  const [bulkVouchers, setBulkVouchers] = useState(false);
  const [roomPrintRoom, setRoomPrintRoom] = useState("");
  // JOY_HANDWRITTEN_RECOVERY_FIXES_V1_APPLIED
  const runCharges = run
    ? charges.filter((charge) => charge.runId === run.id)
    : [];
  const entries = run
    ? data.recoveryEntries.filter((entry) => entry.runId === run.id)
    : [];
  const finalizations = run
    ? data.recoveryFinalizations.filter((entry) => entry.runId === run.id)
    : [];
  const recoveryVendorRoomIds = new Set(
    data.accommodationRooms
      .filter((room) => room.vendorId === vendorId)
      .map((room) => room.id),
  );
  const recoveryRoomEntries = data.roomExpenses.filter((expense) =>
    recoveryVendorRoomIds.has(expense.roomId),
  );
  const [roomRecoveryDate, setRoomRecoveryDate] = useState("");
  type RecoveryScope = "" | "joy" | "outside";
  const [roomRecoveryScope, setRoomRecoveryScope] = useState<RecoveryScope>("");
  const [roomRecoveryHostelId, setRoomRecoveryHostelId] = useState("");
  const [roomRecoveryArea, setRoomRecoveryArea] = useState("");
  const [roomRecoveryId, setRoomRecoveryId] = useState("");
  const [roomRecoveryMembers, setRoomRecoveryMembers] = useState<string[]>([]);
  const [roomRecoveryConfirmed, setRoomRecoveryConfirmed] = useState(false);
  const [roomRecoveryGas, setRoomRecoveryGas] = useState(0);
  const [roomRecoveryRation, setRoomRecoveryRation] = useState(0);
  const [roomRecoveryProvision, setRoomRecoveryProvision] = useState(0);
  const recoveryPreviewPeriod =
    run?.payPeriod ??
    [...new Set(recoveryRoomEntries.map((expense) => expense.payPeriod))]
      .sort((left, right) => right.localeCompare(left))[0] ??
    new Date().toISOString().slice(0, 7);
  const roomRecoveryPeriod = roomRecoveryDate
    ? roomRecoveryDate.slice(0, 7)
    : recoveryPreviewPeriod;
  function getRecoveryRoomNumber(employee: Employee) {
    return data.accommodationRooms.find((room) => room.id === employee.roomId)?.roomNumber ?? employee.roomNumber ?? "—";
  }
  const employeeRows = employees
    .map((employee) => {
      const charge = runCharges.find(
        (entry) => entry.employeeId === employee.id,
      );
      const item = items.find((entry) => entry.employeeId === employee.id);
      const legacyIndividual = charge
        ? charge.rent +
          charge.bus +
          charge.food +
          charge.advance +
          charge.idCard +
          charge.medical +
          charge.ticket +
          charge.shoe +
          charge.aadhaarUpdate +
          charge.bankAccountCharge +
          charge.tshirt +
          charge.oldPending
        : 0;
      const finalizedGasShare = charge?.gasShare ?? 0;
      const finalizedRationShare = charge?.rationShare ?? 0;
      const finalizedProvisionShare = charge?.provisionShare ?? 0;
      const draftRoomLedger =
        employee.roomId && !charge?.roomExpenseId
          ? recoveryRoomEntries.filter(
              (expense) =>
                expense.roomId === employee.roomId &&
                expense.payPeriod === recoveryPreviewPeriod &&
                expense.status === "draft",
            )
          : [];
      const activeRoommates = employee.roomId
        ? data.employees.filter(
            (candidate) =>
              candidate.status === "active" &&
              candidate.roomId === employee.roomId,
          )
        : [];
      const roomDivisor = Math.max(1, activeRoommates.length);
      const pendingGasShare =
        draftRoomLedger.reduce(
          (sum, expense) => sum + expense.gasAmount,
          0,
        ) / roomDivisor;
      const pendingRationShare =
        draftRoomLedger.reduce(
          (sum, expense) => sum + expense.rationAmount,
          0,
        ) / roomDivisor;
      const pendingProvisionShare =
        draftRoomLedger.reduce(
          (sum, expense) => sum + expense.provisionAmount,
          0,
        ) / roomDivisor;
      const pendingShared =
        pendingGasShare + pendingRationShare + pendingProvisionShare;
      const gasShare = finalizedGasShare + pendingGasShare;
      const rationShare = finalizedRationShare + pendingRationShare;
      const provisionShare =
        finalizedProvisionShare + pendingProvisionShare;
      const shared = gasShare + rationShare + provisionShare;
      const dated = entries.filter((entry) => entry.employeeId === employee.id);
      const datedDeduction = dated
        .filter((entry) => entry.recoveryType !== "returnAmount")
        .reduce((sum, entry) => sum + entry.amount, 0);
      // accommodationCharges is the authoritative merged ledger. Dated
      // entries are its audit detail; replacing the ledger with only dated
      // rows drops room rent and caused ₹10,450 to print as ₹9,250.
      const individual = legacyIndividual;
      return {
        employee,
        charge,
        individual,
        shared,
        pendingShared,
        gasShare,
        rationShare,
        provisionShare,
        total: individual + shared,
        item,
        dated,
      };
    })
    .filter((row) => row.individual > 0 || row.shared > 0);
  const roomRows = recoveryRoomEntries
    .filter((expense) => expense.payPeriod === recoveryPreviewPeriod)
    .map((expense) => ({
      expense,
      room: data.accommodationRooms.find((room) => room.id === expense.roomId),
    }));
  const roomPeriodTotals = roomRows.reduce(
    (totals, { expense }) => ({
      gas: totals.gas + expense.gasAmount,
      ration: totals.ration + expense.rationAmount,
      provision: totals.provision + expense.provisionAmount,
      overall:
        totals.overall +
        expense.gasAmount +
        expense.rationAmount +
        expense.provisionAmount,
      finalized:
        totals.finalized +
        (expense.status === "finalized"
          ? expense.gasAmount + expense.rationAmount + expense.provisionAmount
          : 0),
      draft:
        totals.draft +
        (expense.status === "draft"
          ? expense.gasAmount + expense.rationAmount + expense.provisionAmount
          : 0),
    }),
    { gas: 0, ration: 0, provision: 0, overall: 0, finalized: 0, draft: 0 },
  );
  const roomRecoveryDateTotals = Object.values(
    roomRows.reduce<
      Record<
        string,
        {
          date: string;
          status: string;
          gas: number;
          ration: number;
          provision: number;
          overall: number;
        }
      >
    >((totals, { expense }) => {
      for (const [date, component, amount] of [
        [expense.gasDate ?? `${expense.payPeriod}-01`, "gas", expense.gasAmount],
        [expense.rationDate ?? `${expense.payPeriod}-01`, "ration", expense.rationAmount],
        [expense.provisionDate ?? `${expense.payPeriod}-01`, "provision", expense.provisionAmount],
      ] as const) {
        if (amount <= 0) continue;
        const key = `${date}|${expense.status}`;
        totals[key] ??= {
          date,
          status: expense.status,
          gas: 0,
          ration: 0,
          provision: 0,
          overall: 0,
        };
        totals[key][component] += amount;
        totals[key].overall += amount;
      }
      return totals;
    }, {}),
  ).sort((left, right) =>
    left.date === right.date
      ? left.status.localeCompare(right.status)
      : left.date.localeCompare(right.date),
  );
  const roomPrintRooms = [...new Set([
    ...employeeRows.map(({ employee }) => getRecoveryRoomNumber(employee)),
    ...roomRows
      .filter(({ expense }) => expense.status === "finalized")
      .map(({ room }) => room?.roomNumber ?? "—"),
  ])]
    .filter((room) => room && room !== "—")
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  function printRoomRecovery(selectedRooms: string[]) {
    if (!selectedRooms.length) return;
    const panel = document.querySelector<HTMLElement>(".recovery-final-payable-panel");
    const employeeTable = panel?.querySelector<HTMLTableElement>("table");
    const sharedHeading = Array.from(document.querySelectorAll<HTMLElement>("h2")).find((node) =>
      node.textContent?.includes("Gas, Ration") && node.textContent?.includes("Provision split"),
    );
    const sharedTable = sharedHeading?.closest<HTMLElement>(".panel")?.querySelector<HTMLTableElement>("table");
    if (!employeeTable && !sharedTable) return;

    const employeeHeaders = Array.from(employeeTable?.tHead?.rows[0]?.cells ?? []).map(
      (cell) => cell.textContent?.trim() ?? "",
    );
    const employeeRoomIndex = employeeHeaders.findIndex((label) => label === "Room");
    const employeeSourceRows = Array.from(employeeTable?.tBodies[0]?.rows ?? []);
    const optionalRecoveryPrintHeaders = new Set([
      "Rent",
      "Bus",
      "Food",
      "Advance",
      "ID",
      "Medical",
      "Ticket",
      "Shoe",
      "Aadhaar",
      "Bank A/c",
      "T-shirt",
      "Old pending",
      "Gas",
      "Ration",
      "Provision",
    ]);
    const printedAmount = (value: string) => {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    document.querySelector(".room-recovery-print-layer")?.remove();
    const layer = document.createElement("div");
    layer.className = "room-recovery-print-layer";

    selectedRooms.forEach((roomName) => {
      const roomEmployees = employeeRows.filter(({ employee }) => getRecoveryRoomNumber(employee) === roomName);
      const finalizedRoomRow = roomRows.find(({ expense, room }) =>
        expense.status === "finalized" && room?.roomNumber === roomName,
      );
      const gas = roomEmployees.length
        ? roomEmployees.reduce((sum, row) => sum + (row.charge?.gasShare ?? 0), 0)
        : finalizedRoomRow?.expense.gasAmount ?? 0;
      const ration = roomEmployees.length
        ? roomEmployees.reduce((sum, row) => sum + (row.charge?.rationShare ?? 0), 0)
        : finalizedRoomRow?.expense.rationAmount ?? 0;
      const provision = roomEmployees.length
        ? roomEmployees.reduce((sum, row) => sum + row.provisionShare, 0)
        : finalizedRoomRow?.expense.provisionAmount ?? 0;
      const roomTotalRecovery = roomEmployees.reduce((sum, row) => sum + row.total, 0);
      const matchedRows = employeeRoomIndex >= 0
        ? employeeSourceRows.filter((row) => (row.cells[employeeRoomIndex]?.textContent?.trim() || "—") === roomName)
        : [];

      const sheet = document.createElement("section");
      sheet.className = "room-recovery-print-sheet";
      const h1 = document.createElement("h1");
      h1.textContent = "FINALIZED ROOM-WISE SALARY RECOVERY STATEMENT";
      const h2 = document.createElement("h2");
      h2.textContent = `Room: ${roomName}`;
      const summary = document.createElement("div");
      summary.className = "room-recovery-summary";
      const roommates = matchedRows.length || finalizedRoomRow?.expense.occupantCount || roomEmployees.length;
      summary.innerHTML = `<div><span>Gas</span><strong>₹${gas.toFixed(2)}</strong></div><div><span>Ration</span><strong>₹${ration.toFixed(2)}</strong></div><div><span>Provision</span><strong>₹${provision.toFixed(2)}</strong></div><div><span>Roommates</span><strong>${roommates}</strong></div><div><span>Shared total</span><strong>₹${(gas + ration + provision).toFixed(2)}</strong></div><div><span>Total recovery</span><strong>₹${roomTotalRecovery.toFixed(2)}</strong></div>`;
      sheet.append(h1, h2, summary);

      if (employeeTable && matchedRows.length && employeeRoomIndex >= 0) {
        const clone = employeeTable.cloneNode(true) as HTMLTableElement;
        Array.from(clone.tBodies[0]?.rows ?? []).forEach((row) => {
          const room = row.cells[employeeRoomIndex]?.textContent?.trim() || "—";
          if (room !== roomName) row.remove();
        });
        const header = clone.tHead?.rows[0];
        const removedColumnIndices = employeeHeaders
          .map((label, index) => ({ label, index }))
          .filter(
            ({ label, index }) =>
              label === "Room" ||
              label === "Voucher" ||
              (optionalRecoveryPrintHeaders.has(label) &&
                matchedRows.every(
                  (row) =>
                    Math.abs(
                      printedAmount(row.cells[index]?.textContent?.trim() ?? ""),
                    ) < 0.005,
                )),
          )
          .map(({ index }) => index)
          .sort((left, right) => right - left);
        for (const index of removedColumnIndices) {
          if (header?.cells[index]) header.deleteCell(index);
          Array.from(clone.tBodies[0]?.rows ?? []).forEach((row) => {
            if (row.cells[index]) row.deleteCell(index);
          });
        }
        const printableHeaders = Array.from(header?.cells ?? []).map(
          (cell) => cell.textContent?.trim() ?? "",
        );
        const sourceHeaderIndex = new Map(
          employeeHeaders.map((label, index) => [label, index]),
        );
        const financialHeaders = new Set([
          "Net before recovery",
          ...optionalRecoveryPrintHeaders,
          "Total recovery",
          "Return",
          "Final payable",
        ]);
        const printableEmployeeIndex = printableHeaders.findIndex((label) => label === "Employee");
        if (header && printableEmployeeIndex >= 0)
          header.cells[printableEmployeeIndex].textContent = "Employee / Punching No.";
        const footer = clone.createTFoot();
        const totalRow = footer.insertRow();
        printableHeaders.forEach((label) => {
          const cell = totalRow.insertCell();
          if (label === "#") cell.textContent = "TOTAL";
          else if (label === "Employee") cell.textContent = `ROOM ${roomName} TOTAL`;
          else if (label === "Room") cell.textContent = roomName;
          else if (financialHeaders.has(label)) {
            const sourceIndex = sourceHeaderIndex.get(label);
            const total = sourceIndex === undefined
              ? 0
              : matchedRows.reduce(
                  (sum, row) =>
                    sum + printedAmount(row.cells[sourceIndex]?.textContent?.trim() ?? ""),
                  0,
                );
            cell.textContent = `₹${total.toFixed(2)}`;
          }
        });
        sheet.appendChild(clone);
      } else if (sharedTable) {
        const sharedHeaders = Array.from(sharedTable.tHead?.rows[0]?.cells ?? []).map((cell) => cell.textContent?.trim() ?? "");
        const sharedRoomIndex = sharedHeaders.findIndex((label) => label === "Room");
        const clone = sharedTable.cloneNode(true) as HTMLTableElement;
        Array.from(clone.tBodies[0]?.rows ?? []).forEach((row) => {
          const room = sharedRoomIndex >= 0 ? row.cells[sharedRoomIndex]?.textContent?.trim() || "—" : "—";
          if (room !== roomName) row.remove();
        });
        sheet.appendChild(clone);
      }

      layer.appendChild(sheet);
    });

    if (!layer.children.length) return;
    void printIsolatedElement(layer, "room");
  }

  const recoveryAccommodationTypes = data.accommodationTypes.filter((type) => type.status === "active");
  const selectedRecoveryType = recoveryAccommodationTypes.find((type) => type.id === roomRecoveryScope);
  const isOutsideRecoveryType = selectedRecoveryType?.name.toLowerCase().includes("outside") ?? false;
  const recoveryHostels = data.hostels.filter(
    (hostel) =>
      hostel.status === "active" &&
      hostel.accommodationTypeId === roomRecoveryScope,
  );
  const recoveryRooms = data.accommodationRooms.filter((room) => {
    if (room.status !== "active" || room.accommodationTypeId !== roomRecoveryScope) return false;
    if (!roomRecoveryHostelId) return false;
    return room.hostelId === roomRecoveryHostelId;
  });
  const selectedRecoveryRoom = data.accommodationRooms.find((room) => room.id === roomRecoveryId);
  const existingRecoveryRoomMembers = employees.filter((employee) => employee.roomId === roomRecoveryId);

  function chooseRecoveryRoom(roomId: string) {
    setRoomRecoveryId(roomId);
    setRoomRecoveryConfirmed(false);
    const memberIds = employees.filter((employee) => employee.roomId === roomId).map((employee) => employee.id);
    setRoomRecoveryMembers(memberIds);
    const saved = data.roomExpenses.find((expense) => expense.roomId === roomId && expense.payPeriod === roomRecoveryPeriod);
    setRoomRecoveryGas(saved?.gasAmount ?? 0);
    setRoomRecoveryRation(saved?.rationAmount ?? 0);
    setRoomRecoveryProvision(saved?.provisionAmount ?? 0);
  }

  async function confirmRecoveryRoomMembers() {
    if (!selectedRecoveryRoom) return;
    const current = new Set(existingRecoveryRoomMembers.map((employee) => employee.id));
    const desired = new Set(roomRecoveryMembers);
    for (const employeeId of desired) {
      if (!current.has(employeeId)) {
        const employee = employees.find((row) => row.id === employeeId);
        await onAction("allocate-room", "Employee added to recovery room", {
          roomId: selectedRecoveryRoom.id,
          employeeId,
          roomRentAmount: employee?.roomRentAmount ?? 0,
        });
      }
    }
    for (const employeeId of current) {
      if (!desired.has(employeeId)) {
        await onAction("allocate-room", "Employee removed from recovery room", {
          employeeId,
          roomId: null,
        });
      }
    }
    setRoomRecoveryConfirmed(true);
  }

  async function saveRoomWiseRecovery() {
    if (!roomRecoveryDate || !selectedRecoveryRoom || !roomRecoveryConfirmed) return;
    await onAction("save-room-expense", "Dated room-wise recovery saved", {
      roomId: selectedRecoveryRoom.id,
      payPeriod: roomRecoveryPeriod,
      gasAmount: roomRecoveryGas,
      gasDate: roomRecoveryDate,
      gasCylinderCount: 0,
      gasPaymentReference: "Recovery",
      rationAmount: roomRecoveryRation,
      rationDate: roomRecoveryDate,
      rationPaymentReference: "Recovery",
      provisionAmount: roomRecoveryProvision,
      provisionDate: roomRecoveryDate,
      provisionPaymentReference: "Recovery",
      notes: "Saved from Recovery page after roommate confirmation",
    });
    // Clear the entry form after the append-only ledger write so a second
    // dated recovery cannot accidentally reuse the previous amounts.
    setRoomRecoveryGas(0);
    setRoomRecoveryRation(0);
    setRoomRecoveryProvision(0);
    setRoomRecoveryDate("");
  }

  // Build bulk vouchers from the finalization register itself. This guarantees
  // that every finalized employee is included even when normal recovery-table
  // filters would otherwise hide that employee.
  const finalizedVoucherRows = finalizations.flatMap((finalized) => {
    const employee = employees.find((row) => row.id === finalized.employeeId);
    if (!employee) return [];
    return [{
      employee,
      charge: runCharges.find((row) => row.employeeId === employee.id),
      item: items.find((row) => row.employeeId === employee.id),
    }];
  });
  async function addRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!run) return;
    const ok = await onAction(
      "save-recovery-entry",
      "Date-wise recovery added",
      { employeeId, recoveryDate, recoveryType, amount, reference, notes },
    );
    if (ok) {
      setAmount(0);
      setReference("");
      setNotes("");
    }
  }
  return (
    <div className="section-stack">
      <section className="panel table-panel recovery-overview-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Room-wise recovery overview</span>
            <h2>Gas, Ration &amp; Provision totals · {recoveryPreviewPeriod}</h2>
          </div>
          <span className="muted-label">
            {roomRows.length} dated room entr{roomRows.length === 1 ? "y" : "ies"}
          </span>
        </div>
        <div className="room-recovery-summary room-recovery-period-summary">
          <div><span>Gas overall</span><strong>₹{roomPeriodTotals.gas.toFixed(2)}</strong></div>
          <div><span>Ration overall</span><strong>₹{roomPeriodTotals.ration.toFixed(2)}</strong></div>
          <div><span>Provision overall</span><strong>₹{roomPeriodTotals.provision.toFixed(2)}</strong></div>
          <div><span>Overall room recovery</span><strong>₹{roomPeriodTotals.overall.toFixed(2)}</strong></div>
          <div><span>Finalized</span><strong>₹{roomPeriodTotals.finalized.toFixed(2)}</strong></div>
          <div><span>Draft</span><strong>₹{roomPeriodTotals.draft.toFixed(2)}</strong></div>
        </div>
        {roomRecoveryDateTotals.length ? (
          <div className="table-scroll">
            <table className="data-table room-recovery-date-summary">
              <thead><tr><th>Date</th><th>Status</th><th>Gas</th><th>Ration</th><th>Provision</th><th>Overall</th></tr></thead>
              <tbody>
                {roomRecoveryDateTotals.map((row) => (
                  <tr key={`${row.date}-${row.status}`}>
                    <td><strong>{row.date}</strong></td><td>{row.status}</td>
                    <td>₹{row.gas.toFixed(2)}</td><td>₹{row.ration.toFixed(2)}</td>
                    <td>₹{row.provision.toFixed(2)}</td><td><strong>₹{row.overall.toFixed(2)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="form-note">No room-wise Gas, Ration or Provision is recorded for this salary cycle.</p>
        )}
      </section>
      {(canManage || canApprove) ? (
        <form
          className="panel form-grid"
          onSubmit={(event) => void addRecovery(event)}
        >
          <div className="panel-heading form-span">
            <div>
              <span className="eyebrow">Salary-cycle recovery entry</span>
              <h2>Employee-wise recovery by date</h2>
            </div>
            <span className="muted-label">
              Every entry remains available for day-wise reporting
            </span>
          </div>
          {!run ? (
            <p className="form-note form-span">
              <strong>Create the payroll run to save employee-wise recovery.</strong>{" "}
              The employee selector remains visible so the missing payroll prerequisite is clear.
            </p>
          ) : null}
          <label>
            <span>Employee *</span>
            <select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              required
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeCode} · {employee.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Recovery date *</span>
            <input
              type="date"
              value={recoveryDate}
              onChange={(event) => setRecoveryDate(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Recovery type *</span>
            <select
              value={recoveryType}
              onChange={(event) => setRecoveryType(event.target.value)}
            >
              {Object.entries(recoveryLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Amount (₹) *</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              required
            />
          </label>
          <label>
            <span>Reference / voucher no.</span>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </label>
          <label>
            <span>Remarks</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <button
            className="primary-button form-span"
            type={run && run.status === "approved" ? "button" : "submit"}
            onClick={
              run && run.status === "approved"
                ? () =>
                    void onAction(
                      "reopen-payroll-for-recovery",
                      "Payment batch and payroll reopened. You can now save the recovery.",
                    )
                : undefined
            }
            disabled={
              run && run.status === "approved"
                ? isActing || !canApprove
                : isActing || !run || !employeeId || amount <= 0
            }
          >
            {run && run.status === "approved" ? "Reopen payment batch & payroll" : "Add dated recovery"}
          </button>
        </form>
      ) : null}
      {run && run.status === "approved" ? (
        <section className="panel recovery-lock-guidance">
          <span className="eyebrow">Recovery entry locked by payroll approval</span>
          <h2>Reopen the cleared batch and payroll here</h2>
          <p className="muted-label">
            {data.payrollBatches.filter((batch) => batch.runId === run.id && batch.status === "cleared").length
              ? `The button below will reopen ${data.payrollBatches.filter((batch) => batch.runId === run.id && batch.status === "cleared").length} cleared payment batch(es) and the payroll together. Then add the dated recovery.`
              : "Use the button below to reopen payroll, then add the dated recovery. Saving it will automatically recalculate final payable and bank payable."}
          </p>
        </section>
      ) : null}
      {/* Legacy duplicate room-recovery forms are intentionally hidden. The
          canonical date-first room flow below owns these controls. */}
      {/*
      {(canManage || canApprove) ? (
        <form className="panel form-grid room-recovery-entry" onSubmit={(event) => void saveRoomRecovery(event)}>
          <div className="panel-heading form-span">
            <div><span className="eyebrow">Room-wise shared recovery input</span><h2>Hostel → Room → Gas / Ration / Provision</h2></div>
            <span className="muted-label">Shared total is split equally among active room employees when finalized</span>
          </div>
          <label><span>Hostel *</span><select value={roomRecoveryHostelId} onChange={(event) => { setRoomRecoveryHostelId(event.target.value); setRoomRecoveryRoomId(""); }} required><option value="">Choose hostel</option>{recoveryHostels.map((hostel) => (<option key={hostel.id} value={hostel.id}>{hostel.name}</option>))}</select></label>
          <label><span>Room *</span><select value={roomRecoveryRoomId} onChange={(event) => { const id = event.target.value; setRoomRecoveryRoomId(id); const existing = data.roomExpenses.find((expense) => expense.roomId === id && expense.payPeriod === run.payPeriod); setRoomGas(existing?.gasAmount ?? 0); setRoomRation(existing?.rationAmount ?? 0); setRoomProvision(existing?.provisionAmount ?? 0); }} required><option value="">Choose room</option>{recoveryRooms.map((room) => (<option key={room.id} value={room.id}>{room.roomNumber}</option>))}</select></label>
          <label><span>Gas (₹)</span><input type="number" min="0" step="0.01" value={roomGas} onChange={(event) => setRoomGas(Number(event.target.value))} /></label>
          <label><span>Ration (₹)</span><input type="number" min="0" step="0.01" value={roomRation} onChange={(event) => setRoomRation(Number(event.target.value))} /></label>
          <label><span>Provision (₹)</span><input type="number" min="0" step="0.01" value={roomProvision} onChange={(event) => setRoomProvision(Number(event.target.value))} /></label>
          <div className="form-note"><strong>{roomOccupants.length} roommates</strong><span>{roomOccupants.map((employee) => `${employee.employeeCode} · ${employee.name}`).join(", ") || "Choose a room to view employees"}</span><span>Shared total ₹{(roomGas + roomRation + roomProvision).toFixed(2)} · Per head ₹{((roomGas + roomRation + roomProvision) / Math.max(1, roomOccupants.length)).toFixed(2)}</span></div>
          <div className="record-actions form-span"><button className="secondary-button" type="submit" disabled={isActing || !roomRecoveryRoomId}>Save room recovery</button>{currentRoomExpense?.status === "draft" ? (<button className="primary-button" type="button" disabled={isActing} onClick={() => void onAction("finalize-room-expense", "Room recovery finalized and split to employees", { expenseId: currentRoomExpense.id })}>Finalize & split to roommates</button>) : currentRoomExpense?.status === "finalized" ? (<button className="secondary-button" type="button" disabled={isActing} onClick={() => void onAction("reopen-room-expense", "Room recovery reopened", { expenseId: currentRoomExpense.id })}>Reopen room recovery</button>) : null}</div>
        </form>
      ) : null}
      {(canManage || canApprove) ? (
        <form className="panel form-grid room-recovery-entry" onSubmit={(event) => void saveRoomRecovery(event)}>
          <div className="panel-heading form-span">
            <div><span className="eyebrow">Room-wise shared recovery input</span><h2>Hostel → Room → Gas / Ration / Provision</h2></div>
            <span className="muted-label">Shared total is split equally among active room employees when finalized</span>
          </div>
          <label><span>Hostel *</span><select value={roomRecoveryHostelId} onChange={(event) => { setRoomRecoveryHostelId(event.target.value); setRoomRecoveryRoomId(""); }} required><option value="">Choose hostel</option>{recoveryHostels.map((hostel) => (<option key={hostel.id} value={hostel.id}>{hostel.name}</option>))}</select></label>
          <label><span>Room *</span><select value={roomRecoveryRoomId} onChange={(event) => { const id = event.target.value; setRoomRecoveryRoomId(id); const existing = data.roomExpenses.find((expense) => expense.roomId === id && expense.payPeriod === run.payPeriod); setRoomGas(existing?.gasAmount ?? 0); setRoomRation(existing?.rationAmount ?? 0); setRoomProvision(existing?.provisionAmount ?? 0); }} required><option value="">Choose room</option>{recoveryRooms.map((room) => (<option key={room.id} value={room.id}>{room.roomNumber}</option>))}</select></label>
          <label><span>Gas (₹)</span><input type="number" min="0" step="0.01" value={roomGas} onChange={(event) => setRoomGas(Number(event.target.value))} /></label>
          <label><span>Ration (₹)</span><input type="number" min="0" step="0.01" value={roomRation} onChange={(event) => setRoomRation(Number(event.target.value))} /></label>
          <label><span>Provision (₹)</span><input type="number" min="0" step="0.01" value={roomProvision} onChange={(event) => setRoomProvision(Number(event.target.value))} /></label>
          <div className="form-note"><strong>{roomOccupants.length} roommates</strong><span>{roomOccupants.map((employee) => `${employee.employeeCode} · ${employee.name}`).join(", ") || "Choose a room to view employees"}</span><span>Shared total ₹{(roomGas + roomRation + roomProvision).toFixed(2)} · Per head ₹{((roomGas + roomRation + roomProvision) / Math.max(1, roomOccupants.length)).toFixed(2)}</span></div>
          <div className="record-actions form-span"><button className="secondary-button" type="submit" disabled={isActing || !roomRecoveryRoomId}>Save room recovery</button>{currentRoomExpense?.status === "draft" ? (<button className="primary-button" type="button" disabled={isActing} onClick={() => void onAction("finalize-room-expense", "Room recovery finalized and split to employees", { expenseId: currentRoomExpense.id })}>Finalize & split to roommates</button>) : currentRoomExpense?.status === "finalized" ? (<button className="secondary-button" type="button" disabled={isActing} onClick={() => void onAction("reopen-room-expense", "Room recovery reopened", { expenseId: currentRoomExpense.id })}>Reopen room recovery</button>) : null}</div>
        </form>
      ) : null}
      {(canManage || canApprove) ? (
        <form className="panel form-grid room-recovery-entry" onSubmit={(event) => void saveRoomRecovery(event)}>
          <div className="panel-heading form-span">
            <div><span className="eyebrow">Room-wise shared recovery input</span><h2>Hostel → Room → Gas / Ration / Provision</h2></div>
            <span className="muted-label">Shared total is split equally among active room employees when finalized</span>
          </div>
          <label><span>Hostel *</span><select value={roomRecoveryHostelId} onChange={(event) => { setRoomRecoveryHostelId(event.target.value); setRoomRecoveryRoomId(""); }} required><option value="">Choose hostel</option>{recoveryHostels.map((hostel) => (<option key={hostel.id} value={hostel.id}>{hostel.name}</option>))}</select></label>
          <label><span>Room *</span><select value={roomRecoveryRoomId} onChange={(event) => { const id = event.target.value; setRoomRecoveryRoomId(id); const existing = data.roomExpenses.find((expense) => expense.roomId === id && expense.payPeriod === run.payPeriod); setRoomGas(existing?.gasAmount ?? 0); setRoomRation(existing?.rationAmount ?? 0); setRoomProvision(existing?.provisionAmount ?? 0); }} required><option value="">Choose room</option>{recoveryRooms.map((room) => (<option key={room.id} value={room.id}>{room.roomNumber}</option>))}</select></label>
          <label><span>Gas (₹)</span><input type="number" min="0" step="0.01" value={roomGas} onChange={(event) => setRoomGas(Number(event.target.value))} /></label>
          <label><span>Ration (₹)</span><input type="number" min="0" step="0.01" value={roomRation} onChange={(event) => setRoomRation(Number(event.target.value))} /></label>
          <label><span>Provision (₹)</span><input type="number" min="0" step="0.01" value={roomProvision} onChange={(event) => setRoomProvision(Number(event.target.value))} /></label>
          <div className="form-note"><strong>{roomOccupants.length} roommates</strong><span>{roomOccupants.map((employee) => `${employee.employeeCode} · ${employee.name}`).join(", ") || "Choose a room to view employees"}</span><span>Shared total ₹{(roomGas + roomRation + roomProvision).toFixed(2)} · Per head ₹{((roomGas + roomRation + roomProvision) / Math.max(1, roomOccupants.length)).toFixed(2)}</span></div>
          <div className="record-actions form-span"><button className="secondary-button" type="submit" disabled={isActing || !roomRecoveryRoomId}>Save room recovery</button>{currentRoomExpense?.status === "draft" ? (<button className="primary-button" type="button" disabled={isActing} onClick={() => void onAction("finalize-room-expense", "Room recovery finalized and split to employees", { expenseId: currentRoomExpense.id })}>Finalize & split to roommates</button>) : currentRoomExpense?.status === "finalized" ? (<button className="secondary-button" type="button" disabled={isActing} onClick={() => void onAction("reopen-room-expense", "Room recovery reopened", { expenseId: currentRoomExpense.id })}>Reopen room recovery</button>) : null}</div>
        </form>
      ) : null}
      {(canManage || canApprove) ? (
        <form className="panel form-grid room-recovery-entry" onSubmit={(event) => void saveRoomRecovery(event)}>
          <div className="panel-heading form-span">
            <div><span className="eyebrow">Room-wise shared recovery input</span><h2>Hostel → Room → Gas / Ration / Provision</h2></div>
            <span className="muted-label">Shared total is split equally among active room employees when finalized</span>
          </div>
          <label><span>Hostel *</span><select value={roomRecoveryHostelId} onChange={(event) => { setRoomRecoveryHostelId(event.target.value); setRoomRecoveryRoomId(""); }} required><option value="">Choose hostel</option>{recoveryHostels.map((hostel) => (<option key={hostel.id} value={hostel.id}>{hostel.name}</option>))}</select></label>
          <label><span>Room *</span><select value={roomRecoveryRoomId} onChange={(event) => { const id = event.target.value; setRoomRecoveryRoomId(id); const existing = data.roomExpenses.find((expense) => expense.roomId === id && expense.payPeriod === run.payPeriod); setRoomGas(existing?.gasAmount ?? 0); setRoomRation(existing?.rationAmount ?? 0); setRoomProvision(existing?.provisionAmount ?? 0); }} required><option value="">Choose room</option>{recoveryRooms.map((room) => (<option key={room.id} value={room.id}>{room.roomNumber}</option>))}</select></label>
          <label><span>Gas (₹)</span><input type="number" min="0" step="0.01" value={roomGas} onChange={(event) => setRoomGas(Number(event.target.value))} /></label>
          <label><span>Ration (₹)</span><input type="number" min="0" step="0.01" value={roomRation} onChange={(event) => setRoomRation(Number(event.target.value))} /></label>
          <label><span>Provision (₹)</span><input type="number" min="0" step="0.01" value={roomProvision} onChange={(event) => setRoomProvision(Number(event.target.value))} /></label>
          <div className="form-note"><strong>{roomOccupants.length} roommates</strong><span>{roomOccupants.map((employee) => `${employee.employeeCode} · ${employee.name}`).join(", ") || "Choose a room to view employees"}</span><span>Shared total ₹{(roomGas + roomRation + roomProvision).toFixed(2)} · Per head ₹{((roomGas + roomRation + roomProvision) / Math.max(1, roomOccupants.length)).toFixed(2)}</span></div>
          <div className="record-actions form-span"><button className="secondary-button" type="submit" disabled={isActing || !roomRecoveryRoomId}>Save room recovery</button>{currentRoomExpense?.status === "draft" ? (<button className="primary-button" type="button" disabled={isActing} onClick={() => void onAction("finalize-room-expense", "Room recovery finalized and split to employees", { expenseId: currentRoomExpense.id })}>Finalize & split to roommates</button>) : currentRoomExpense?.status === "finalized" ? (<button className="secondary-button" type="button" disabled={isActing} onClick={() => void onAction("reopen-room-expense", "Room recovery reopened", { expenseId: currentRoomExpense.id })}>Reopen room recovery</button>) : null}</div>
        </form>
      ) : null}
      {(canManage || canApprove) ? (
        <form className="panel form-grid room-recovery-entry" onSubmit={(event) => void saveRoomRecovery(event)}>
          <div className="panel-heading form-span">
            <div><span className="eyebrow">Room-wise shared recovery input</span><h2>Hostel → Room → Gas / Ration / Provision</h2></div>
            <span className="muted-label">Shared total is split equally among active room employees when finalized</span>
          </div>
          <label><span>Hostel *</span><select value={roomRecoveryHostelId} onChange={(event) => { setRoomRecoveryHostelId(event.target.value); setRoomRecoveryRoomId(""); }} required><option value="">Choose hostel</option>{recoveryHostels.map((hostel) => (<option key={hostel.id} value={hostel.id}>{hostel.name}</option>))}</select></label>
          <label><span>Room *</span><select value={roomRecoveryRoomId} onChange={(event) => { const id = event.target.value; setRoomRecoveryRoomId(id); const existing = data.roomExpenses.find((expense) => expense.roomId === id && expense.payPeriod === run.payPeriod); setRoomGas(existing?.gasAmount ?? 0); setRoomRation(existing?.rationAmount ?? 0); setRoomProvision(existing?.provisionAmount ?? 0); }} required><option value="">Choose room</option>{recoveryRooms.map((room) => (<option key={room.id} value={room.id}>{room.roomNumber}</option>))}</select></label>
          <label><span>Gas (₹)</span><input type="number" min="0" step="0.01" value={roomGas} onChange={(event) => setRoomGas(Number(event.target.value))} /></label>
          <label><span>Ration (₹)</span><input type="number" min="0" step="0.01" value={roomRation} onChange={(event) => setRoomRation(Number(event.target.value))} /></label>
          <label><span>Provision (₹)</span><input type="number" min="0" step="0.01" value={roomProvision} onChange={(event) => setRoomProvision(Number(event.target.value))} /></label>
          <div className="form-note"><strong>{roomOccupants.length} roommates</strong><span>{roomOccupants.map((employee) => `${employee.employeeCode} · ${employee.name}`).join(", ") || "Choose a room to view employees"}</span><span>Shared total ₹{(roomGas + roomRation + roomProvision).toFixed(2)} · Per head ₹{((roomGas + roomRation + roomProvision) / Math.max(1, roomOccupants.length)).toFixed(2)}</span></div>
          <div className="record-actions form-span"><button className="secondary-button" type="submit" disabled={isActing || !roomRecoveryRoomId}>Save room recovery</button>{currentRoomExpense?.status === "draft" ? (<button className="primary-button" type="button" disabled={isActing} onClick={() => void onAction("finalize-room-expense", "Room recovery finalized and split to employees", { expenseId: currentRoomExpense.id })}>Finalize & split to roommates</button>) : currentRoomExpense?.status === "finalized" ? (<button className="secondary-button" type="button" disabled={isActing} onClick={() => void onAction("reopen-room-expense", "Room recovery reopened", { expenseId: currentRoomExpense.id })}>Reopen room recovery</button>) : null}</div>
        </form>
      ) : null}
      {(canManage || canApprove) ? (
        <form className="panel form-grid room-recovery-entry" onSubmit={(event) => void saveRoomRecovery(event)}>
          <div className="panel-heading form-span">
            <div><span className="eyebrow">Room-wise shared recovery input</span><h2>Hostel → Room → Gas / Ration / Provision</h2></div>
            <span className="muted-label">Shared total is split equally among active room employees when finalized</span>
          </div>
          <label><span>Hostel *</span><select value={roomRecoveryHostelId} onChange={(event) => { setRoomRecoveryHostelId(event.target.value); setRoomRecoveryRoomId(""); }} required><option value="">Choose hostel</option>{recoveryHostels.map((hostel) => (<option key={hostel.id} value={hostel.id}>{hostel.name}</option>))}</select></label>
          <label><span>Room *</span><select value={roomRecoveryRoomId} onChange={(event) => { const id = event.target.value; setRoomRecoveryRoomId(id); const existing = data.roomExpenses.find((expense) => expense.roomId === id && expense.payPeriod === run.payPeriod); setRoomGas(existing?.gasAmount ?? 0); setRoomRation(existing?.rationAmount ?? 0); setRoomProvision(existing?.provisionAmount ?? 0); }} required><option value="">Choose room</option>{recoveryRooms.map((room) => (<option key={room.id} value={room.id}>{room.roomNumber}</option>))}</select></label>
          <label><span>Gas (₹)</span><input type="number" min="0" step="0.01" value={roomGas} onChange={(event) => setRoomGas(Number(event.target.value))} /></label>
          <label><span>Ration (₹)</span><input type="number" min="0" step="0.01" value={roomRation} onChange={(event) => setRoomRation(Number(event.target.value))} /></label>
          <label><span>Provision (₹)</span><input type="number" min="0" step="0.01" value={roomProvision} onChange={(event) => setRoomProvision(Number(event.target.value))} /></label>
          <div className="form-note"><strong>{roomOccupants.length} roommates</strong><span>{roomOccupants.map((employee) => `${employee.employeeCode} · ${employee.name}`).join(", ") || "Choose a room to view employees"}</span><span>Shared total ₹{(roomGas + roomRation + roomProvision).toFixed(2)} · Per head ₹{((roomGas + roomRation + roomProvision) / Math.max(1, roomOccupants.length)).toFixed(2)}</span></div>
          <div className="record-actions form-span"><button className="secondary-button" type="submit" disabled={isActing || !roomRecoveryRoomId}>Save room recovery</button>{currentRoomExpense?.status === "draft" ? (<button className="primary-button" type="button" disabled={isActing} onClick={() => void onAction("finalize-room-expense", "Room recovery finalized and split to employees", { expenseId: currentRoomExpense.id })}>Finalize & split to roommates</button>) : currentRoomExpense?.status === "finalized" ? (<button className="secondary-button" type="button" disabled={isActing} onClick={() => void onAction("reopen-room-expense", "Room recovery reopened", { expenseId: currentRoomExpense.id })}>Reopen room recovery</button>) : null}</div>
        </form>
      ) : null}
      {(canManage || canApprove) ? (
        <form className="panel form-grid room-recovery-entry" onSubmit={(event) => void saveRoomRecovery(event)}>
          <div className="panel-heading form-span">
            <div><span className="eyebrow">Room-wise shared recovery input</span><h2>Hostel → Room → Gas / Ration / Provision</h2></div>
            <span className="muted-label">Shared total is split equally among active room employees when finalized</span>
          </div>
          <label><span>Hostel *</span><select value={roomRecoveryHostelId} onChange={(event) => { setRoomRecoveryHostelId(event.target.value); setRoomRecoveryRoomId(""); }} required><option value="">Choose hostel</option>{recoveryHostels.map((hostel) => (<option key={hostel.id} value={hostel.id}>{hostel.name}</option>))}</select></label>
          <label><span>Room *</span><select value={roomRecoveryRoomId} onChange={(event) => { const id = event.target.value; setRoomRecoveryRoomId(id); const existing = data.roomExpenses.find((expense) => expense.roomId === id && expense.payPeriod === run.payPeriod); setRoomGas(existing?.gasAmount ?? 0); setRoomRation(existing?.rationAmount ?? 0); setRoomProvision(existing?.provisionAmount ?? 0); }} required><option value="">Choose room</option>{recoveryRooms.map((room) => (<option key={room.id} value={room.id}>{room.roomNumber}</option>))}</select></label>
          <label><span>Gas (₹)</span><input type="number" min="0" step="0.01" value={roomGas} onChange={(event) => setRoomGas(Number(event.target.value))} /></label>
          <label><span>Ration (₹)</span><input type="number" min="0" step="0.01" value={roomRation} onChange={(event) => setRoomRation(Number(event.target.value))} /></label>
          <label><span>Provision (₹)</span><input type="number" min="0" step="0.01" value={roomProvision} onChange={(event) => setRoomProvision(Number(event.target.value))} /></label>
          <div className="form-note"><strong>{roomOccupants.length} roommates</strong><span>{roomOccupants.map((employee) => `${employee.employeeCode} · ${employee.name}`).join(", ") || "Choose a room to view employees"}</span><span>Shared total ₹{(roomGas + roomRation + roomProvision).toFixed(2)} · Per head ₹{((roomGas + roomRation + roomProvision) / Math.max(1, roomOccupants.length)).toFixed(2)}</span></div>
          <div className="record-actions form-span"><button className="secondary-button" type="submit" disabled={isActing || !roomRecoveryRoomId}>Save room recovery</button>{currentRoomExpense?.status === "draft" ? (<button className="primary-button" type="button" disabled={isActing} onClick={() => void onAction("finalize-room-expense", "Room recovery finalized and split to employees", { expenseId: currentRoomExpense.id })}>Finalize & split to roommates</button>) : currentRoomExpense?.status === "finalized" ? (<button className="secondary-button" type="button" disabled={isActing} onClick={() => void onAction("reopen-room-expense", "Room recovery reopened", { expenseId: currentRoomExpense.id })}>Reopen room recovery</button>) : null}</div>
        </form>
      ) : null}
      */}
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Applicable employees only</span>
            <h2>Date-wise individual recovery register</h2>
          </div>
          <span className="muted-label">{entries.length} entries</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Reference / remarks</th>
                <th>Salary before recovery</th>
                <th>Final payable</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const employee = employees.find(
                  (row) => row.id === entry.employeeId,
                );
                const item = items.find(
                  (row) => row.employeeId === entry.employeeId,
                );
                const preRecovery = item
                  ? item.netPayable +
                    item.accommodationDeduction -
                    item.returnAmount
                  : 0;
                return (
                  <tr key={entry.id}>
                    <td>{entry.recoveryDate}</td>
                    <td>
                      <strong>{employee?.name ?? entry.employeeId}</strong>
                      <small>{employee?.employeeCode}</small>
                    </td>
                    <td>
                      {recoveryLabels[entry.recoveryType] ?? entry.recoveryType}
                    </td>
                    <td>
                      <strong>₹{entry.amount.toFixed(2)}</strong>
                    </td>
                    <td>
                      {entry.reference ?? "—"}
                      <small>{entry.notes}</small>
                    </td>
                    <td>₹{preRecovery.toFixed(2)}</td>
                    <td>
                      <strong>₹{(item?.netPayable ?? 0).toFixed(2)}</strong>
                    </td>
                    <td>
                      <div className="record-actions">
                        {canManage ? (
                          <button
                            className="record-action record-delete"
                            disabled={isActing}
                            onClick={() => {
                              if (window.confirm("Delete this recovery entry?"))
                                void onAction(
                                  "delete-recovery-entry",
                                  "Recovery entry deleted",
                                  { recoveryId: entry.id },
                                );
                            }}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!entries.length ? (
          <div className="enhancement-empty">
            No recoveries are recorded for this salary cycle.
          </div>
        ) : null}
      </section>
      <section className="panel table-panel recovery-final-payable-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              Recovery totals by applicable employee
            </span>
            <h2>Net salary → recoveries → final payable</h2>
          </div>
          <div className="room-print-toolbar recovery-left-room-toolbar">
            <select
              aria-label="Select room for recovery statement"
              value={roomPrintRoom}
              onChange={(event) => setRoomPrintRoom(event.target.value)}
            >
              <option value="">Select room</option>
              {roomPrintRooms.map((room) => (
                <option key={room} value={room}>{room}</option>
              ))}
            </select>
            <button
              type="button"
              className="secondary-button"
              disabled={!roomPrintRoom}
              onClick={() => printRoomRecovery([roomPrintRoom])}
            >
              Selected room · A4 landscape
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!roomPrintRooms.length}
              onClick={() => printRoomRecovery(roomPrintRooms)}
            >
              All rooms · A4 landscape
            </button>
          </div>
          {finalizations.some((entry) => employeeRows.some((row) => row.employee.id === entry.employeeId && (row.total > 0 || row.dated.some((datedEntry) => datedEntry.amount > 0)))) ? (
            <button className="primary-button" onClick={() => setBulkVouchers(true)}>Bulk deduction vouchers · Print recovery slip · A4 portrait</button>
          ) : null}
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Employee</th><th>Employer unit</th><th>Room</th><th>Net before recovery</th><th>Rent</th><th>Bus</th><th>Food</th><th>Advance</th><th>ID</th><th>Medical</th><th>Ticket</th><th>Shoe</th><th>Aadhaar</th><th>Bank A/c</th><th>T-shirt</th><th>Old pending</th><th>Gas</th><th>Ration</th><th>Provision</th><th>Total recovery</th><th>Return</th><th>Final payable</th><th>Voucher</th>
              </tr>
            </thead>
            <tbody>
              {employeeRows.map(
                ({ employee, charge, individual, shared, item, gasShare, rationShare, provisionShare, pendingShared }, rowIndex) => {
                  const preRecovery = item
                    ? item.netPayable +
                      item.accommodationDeduction -
                      item.returnAmount
                    : 0;
                  return (
                    <tr key={employee.id}>
                      <td>{rowIndex + 1}</td>
                      <td><strong>{employee.name}</strong><small>{employee.employeeCode}</small></td>
                      <td>{(() => { const u = data.units.find((entry) => entry.id === employee.clientUnitId); return u ? `${u.clientName} · ${u.unitName}` : "—"; })()}</td>
                      <td>{getRecoveryRoomNumber(employee)}</td><td>₹{preRecovery.toFixed(2)}</td>
                      <td>₹{(charge?.rent ?? 0).toFixed(2)}</td><td>₹{(charge?.bus ?? 0).toFixed(2)}</td><td>₹{(charge?.food ?? 0).toFixed(2)}</td><td>₹{(charge?.advance ?? 0).toFixed(2)}</td><td>₹{(charge?.idCard ?? 0).toFixed(2)}</td><td>₹{(charge?.medical ?? 0).toFixed(2)}</td><td>₹{(charge?.ticket ?? 0).toFixed(2)}</td><td>₹{(charge?.shoe ?? 0).toFixed(2)}</td><td>₹{(charge?.aadhaarUpdate ?? 0).toFixed(2)}</td><td>₹{(charge?.bankAccountCharge ?? 0).toFixed(2)}</td><td>₹{(charge?.tshirt ?? 0).toFixed(2)}</td><td>₹{(charge?.oldPending ?? 0).toFixed(2)}</td><td>₹{gasShare.toFixed(2)}{pendingShared > 0 ? <small>Draft room share</small> : null}</td><td>₹{rationShare.toFixed(2)}</td><td>₹{provisionShare.toFixed(2)}</td><td><strong>₹{(individual + shared).toFixed(2)}</strong></td><td>₹{(charge?.returnAmount ?? 0).toFixed(2)}</td><td><strong>₹{Math.max(0, (item?.netPayable ?? 0) - pendingShared).toFixed(2)}</strong></td>
                      <td>
                        {finalizations.some(
                          (finalized) => finalized.employeeId === employee.id,
                        ) ? (
                          <div className="record-actions">
                            <button
                              className="record-action"
                              onClick={() => setVoucherEmployeeId(employee.id)}
                            >
                              Individual deduction voucher
                            </button>
                            {canApprove ? (
                              <button
                                className="record-action"
                                disabled={isActing}
                                onClick={() =>
                                  void onAction(
                                    "reopen-employee-recovery",
                                    "Employee recovery reopened",
                                    { employeeId: employee.id },
                                  )
                                }
                              >
                                Reopen
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <div className="record-actions">
                            <button
                              type="button"
                              className="record-action"
                              disabled
                              title="Available after recovery finalization"
                            >
                              Individual deduction voucher
                            </button>
                            {run && canApprove ? (
                              <button
                                className="primary-button"
                                disabled={isActing}
                                onClick={() =>
                                  void onAction(
                                    "finalize-employee-recovery",
                                    "Recovery finalized and voucher generated",
                                    { employeeId: employee.id },
                                  )
                                }
                              >
                                Finalize recovery
                              </button>
                            ) : (
                              <small>{run ? "Awaiting Super Admin approval" : "Payroll run required before finalization and voucher"}</small>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      </section>
      {(canManage || canApprove) ? (
        <section className="panel form-grid room-recovery-entry-panel">
          <div className="panel-heading form-span">
            <div>
              <span className="eyebrow">Add Recovery for Rooms</span>
              <h2>Room-wise recovery</h2>
            </div>
            <span className="muted-label">Select the recovery date first. Remaining room recovery fields will open after the date is selected.</span>
          </div>
          <label className="form-span">
            <span>Recovery date *</span>
            <input
              type="date"
              value={roomRecoveryDate}
              onChange={(event) => {
                setRoomRecoveryDate(event.target.value);
                chooseRecoveryRoom("");
              }}
              required
            />
          </label>
          <label>
            <span>Accommodation category *</span>
            <select disabled={!roomRecoveryDate} value={roomRecoveryScope} onChange={(event) => {
              setRoomRecoveryScope(event.target.value as "" | "joy" | "outside");
              setRoomRecoveryHostelId("");
              setRoomRecoveryArea("");
              chooseRecoveryRoom("");
            }}>
              <option value="">Select category</option>
              <option value="joy">Joy Room / Joy Hostel</option>
              <option value="outside">Outside Room</option>
            </select>
          </label>
          {roomRecoveryScope ? (
            <label>
              <span>Sub category / {isOutsideRecoveryType ? "Area name" : "Hostel name"} *</span>
              <select value={roomRecoveryHostelId} onChange={(event) => {
                setRoomRecoveryHostelId(event.target.value);
                chooseRecoveryRoom("");
              }}>
                <option value="">Select {isOutsideRecoveryType ? "area" : "hostel"}</option>
                {recoveryHostels.map((hostel) => (
                  <option key={hostel.id} value={hostel.id}>{hostel.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span>Room *</span>
            <select value={roomRecoveryId} onChange={(event) => chooseRecoveryRoom(event.target.value)} disabled={!roomRecoveryDate || !roomRecoveryScope}>
              <option value="">Select room</option>
              {recoveryRooms.map((room) => <option key={room.id} value={room.id}>Room {room.roomNumber}</option>)}
            </select>
          </label>
          {selectedRecoveryRoom ? (
            <div className="form-span panel room-recovery-member-confirmation">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Roommate confirmation</span>
                  <h3>Are these the employees staying in Room {selectedRecoveryRoom.roomNumber}?</h3>
                </div>
                <span className="muted-label">{roomRecoveryMembers.length} selected</span>
              </div>
              <div className="room-recovery-member-grid">
                {employees.filter((employee) => employee.status === "active").map((employee) => (
                  <label key={employee.id} className="room-recovery-member-option">
                    <input
                      type="checkbox"
                      checked={roomRecoveryMembers.includes(employee.id)}
                      onChange={(event) => {
                        setRoomRecoveryConfirmed(false);
                        setRoomRecoveryMembers((current) => event.target.checked
                          ? [...new Set([...current, employee.id])]
                          : current.filter((id) => id !== employee.id));
                      }}
                    />
                    <span><strong>{employee.employeeCode}</strong> · {employee.name}</span>
                  </label>
                ))}
              </div>
              <button type="button" className="secondary-button" disabled={isActing} onClick={() => void confirmRecoveryRoomMembers()}>
                {roomRecoveryConfirmed ? "Roommates confirmed ✓" : "Confirm / update room employees"}
              </button>
            </div>
          ) : null}
          <label>
            <span>Gas amount (₹)</span>
            <input disabled={!roomRecoveryDate || !selectedRecoveryRoom} type="number" min="0" step="0.01" value={roomRecoveryGas} onChange={(event) => setRoomRecoveryGas(Number(event.target.value))} />
          </label>
          <label>
            <span>Ration amount (₹)</span>
            <input disabled={!roomRecoveryDate || !selectedRecoveryRoom} type="number" min="0" step="0.01" value={roomRecoveryRation} onChange={(event) => setRoomRecoveryRation(Number(event.target.value))} />
          </label>
          <label>
            <span>Provision amount (₹)</span>
            <input disabled={!roomRecoveryDate || !selectedRecoveryRoom} type="number" min="0" step="0.01" value={roomRecoveryProvision} onChange={(event) => setRoomRecoveryProvision(Number(event.target.value))} />
          </label>
          <div className="form-span room-expense-calculation">
            <strong>Total ₹{(roomRecoveryGas + roomRecoveryRation + roomRecoveryProvision).toFixed(2)}</strong>
            <span>÷ {roomRecoveryMembers.length} confirmed roommates</span>
            <strong>Per head ₹{(roomRecoveryMembers.length ? (roomRecoveryGas + roomRecoveryRation + roomRecoveryProvision) / roomRecoveryMembers.length : 0).toFixed(2)}</strong>
          </div>
          <button type="button" className="primary-button form-span" disabled={isActing || !roomRecoveryDate || !roomRecoveryId || !roomRecoveryConfirmed || roomRecoveryMembers.length === 0} onClick={() => void saveRoomWiseRecovery()}>
            Save dated room recovery entry for {roomRecoveryPeriod}
          </button>
        </section>
      ) : null}
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Room recovery date-wise ledger</span>
            <h2>Gas, Ration & Provision split</h2>
          </div>
          <span className="muted-label">
            Every dated entry is preserved; monthly total ÷ confirmed room occupants
          </span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Month</th>
                <th>Entry date</th>
                <th>Occupants</th>
                <th>Gas</th>
                <th>Ration</th>
                <th>Provision</th>
                <th>Per head</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {roomRows.map(({ expense, room }) => (
                <tr key={expense.id}>
                  <td>
                    <strong>{room?.roomNumber ?? expense.roomId}</strong>
                  </td>
                  <td>{expense.payPeriod}</td>
                  <td>{expense.gasDate ?? expense.rationDate ?? expense.provisionDate ?? "—"}</td>
                  <td>{expense.occupantCount}</td>
                  <td>₹{expense.gasAmount.toFixed(2)}</td>
                  <td>₹{expense.rationAmount.toFixed(2)}</td>
                  <td>₹{expense.provisionAmount.toFixed(2)}</td>
                  <td>
                    <strong>
                      ₹
                      {(
                        (expense.gasAmount +
                          expense.rationAmount +
                          expense.provisionAmount) /
                        Math.max(1, expense.occupantCount)
                      ).toFixed(2)}
                    </strong>
                  </td>
                  <td>{expense.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {voucherEmployeeId ? (
        <AdvanceVoucher
          employeeId={voucherEmployeeId}
          employee={employees.find(
            (employee) => employee.id === voucherEmployeeId,
          )}
          item={items.find((item) => item.employeeId === voucherEmployeeId)}
          charge={runCharges.find(
            (charge) => charge.employeeId === voucherEmployeeId,
          )}
          entries={entries.filter(
            (entry) => entry.employeeId === voucherEmployeeId,
          )}
          unit={data.units.find(
            (unit) =>
              unit.id ===
              employees.find((employee) => employee.id === voucherEmployeeId)
                ?.clientUnitId,
          )}
          vendor={data.vendors.find(
            (vendor) =>
              vendor.id ===
              employees.find((employee) => employee.id === voucherEmployeeId)
                ?.vendorId,
          )}
          run={run}
          onClose={() => setVoucherEmployeeId(null)}
        />
      ) : null}
      {bulkVouchers ? (
        <BulkRecoveryVouchers
          rows={finalizedVoucherRows}
          entries={entries}
          units={data.units}
          vendors={data.vendors}
          run={run}
          onClose={() => setBulkVouchers(false)}
        />
      ) : null}
    </div>
  );
}

function AdvanceVoucher({
  employeeId,
  employee,
  item,
  charge,
  entries,
  unit,
  vendor,
  run,
  onClose,
}: {
  employeeId: string;
  employee?: Employee;
  item?: PayrollItem;
  charge?: AccommodationCharge;
  entries: RecoveryEntry[];
  unit?: ClientUnit;
  vendor?: Vendor;
  run: PayrollRun | null;
  onClose: () => void;
}) {
  const voucherNo = `DRV-${(run?.payPeriod ?? new Date().toISOString().slice(0, 7)).replace("-", "")}-${employee?.employeeCode ?? employeeId.slice(-6)}`;
  const brand = voucherBrand(vendor, unit);
  const lines = entries
    .filter((row) => row.recoveryType !== "returnAmount")
    .map(
      (row) =>
        [
          recoveryLabels[row.recoveryType] ?? row.recoveryType,
          row.amount,
        ] as const,
    );
  if (charge) {
    for (const [field, label] of [
      ["rent", "Room rent"],
      ["bus", "Bus"],
      ["food", "Food"],
      ["advance", "Salary advance"],
      ["idCard", "ID card"],
      ["medical", "Medical"],
      ["ticket", "Ticket"],
      ["shoe", "Shoe"],
      ["aadhaarUpdate", "Aadhaar update"],
      ["bankAccountCharge", "Bank account charge"],
      ["tshirt", "T-shirt"],
      ["oldPending", "Old pending"],
    ] as const) {
      const value = charge[field];
      if (value && !lines.some(([existing]) => existing === label))
        lines.push([label, value]);
    }
    if (charge.gasShare) lines.push(["Gas share", charge.gasShare]);
    if (charge.rationShare) lines.push(["Ration share", charge.rationShare]);
    if (charge.provisionShare)
      lines.push(["Provision share", charge.provisionShare]);
  }
  const voucherTotal = lines.reduce((sum, [, value]) => sum + value, 0);
  return (
    <div className="modal-layer advance-voucher-layer">
      <button className="modal-scrim" onClick={onClose} />
      <div className="room-report-modal">
        <div className="modal-toolbar">
          <strong>Final recovery voucher</strong>
          <div>
            <button className="secondary-button" onClick={() => printTarget()}>
              Print recovery slip · A4 portrait
            </button>
            <button className="icon-button" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <article className="advance-voucher">
          <header className="voucher-brand-header">
            {vendor?.logoDataUrl ? (
              <img src={vendor.logoDataUrl} alt={`${brand.companyName} logo`} />
            ) : null}
            <div>
              <h2>{brand.companyName}</h2>
              <h3>{brand.clientEmployer}</h3>
              <p>{brand.address}</p>
              <p>{brand.email} · {brand.contact}</p>
            </div>
          </header>
          <h3>FINAL SALARY RECOVERY ACKNOWLEDGEMENT</h3>
          <dl>
            <div>
              <dt>Voucher number</dt>
              <dd>{voucherNo}</dd>
            </div>
            <div>
              <dt>Salary cycle</dt>
              <dd>
                {run?.periodStart} to {run?.periodEnd}
              </dd>
            </div>
            <div>
              <dt>Employee</dt>
              <dd>{employee?.name ?? employeeId}</dd>
            </div>
            <div>
              <dt>Employee ID</dt>
              <dd>{employee?.employeeCode ?? "—"}</dd>
            </div>
            <div>
              <dt>Net before recovery</dt>
              <dd>
                ₹
                {(
                  (item?.netPayable ?? 0) +
                  (item?.accommodationDeduction ?? 0) -
                  (item?.returnAmount ?? 0)
                ).toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>Final payable</dt>
              <dd>₹{(item?.netPayable ?? 0).toFixed(2)}</dd>
            </div>
          </dl>
          <table className="data-table">
            <thead>
              <tr>
                <th>Deduction type</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(([label, value], index) => (
                <tr key={`${label}-${index}`}>
                  <td>{label}</td>
                  <td>₹{value.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th>Total recovery</th><th>₹{voucherTotal.toFixed(2)}</th></tr></tfoot>
          </table>
          <p>
            I acknowledge the above finalized salary deductions and final
            payable amount.
          </p>
          <footer>
            <span>Employee signature</span>
            <span>Authorized signature</span>
          </footer>
        </article>
      </div>
    </div>
  );
}

function BulkRecoveryVouchers({
  rows,
  entries,
  units,
  vendors,
  run,
  onClose,
}: {
  rows: Array<{
    employee: Employee;
    charge?: AccommodationCharge;
    item?: PayrollItem;
  }>;
  entries: RecoveryEntry[];
  units: ClientUnit[];
  vendors: Vendor[];
  run: PayrollRun | null;
  onClose: () => void;
}) {
  return (
    <div className="modal-layer advance-voucher-layer">
      <button className="modal-scrim" onClick={onClose} />
      <div className="room-report-modal">
        <div className="modal-toolbar">
          <div>
            <strong>Bulk finalized recovery vouchers</strong>
            <span>
              {rows.length} employees · individual and room-wise shares included
            </span>
          </div>
          <div>
            <button className="primary-button" onClick={() => printTarget()}>
              Print / Save bulk PDF
            </button>
            <button className="icon-button" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <div className="bulk-recovery-vouchers">
          {rows.map(({ employee, charge, item }) => {
            const unit = units.find((row) => row.id === employee.clientUnitId);
            const vendor = vendors.find((row) => row.id === employee.vendorId);
            const brand = voucherBrand(vendor, unit);
            const voucherNo = `DRV-${(run?.payPeriod ?? "").replace("-", "")}-${employee.employeeCode}`;
            const lines: Array<[string, number]> = entries
              .filter(
                (entry) =>
                  entry.employeeId === employee.id &&
                  entry.recoveryType !== "returnAmount",
              )
              .map((entry) => [
                recoveryLabels[entry.recoveryType] ?? entry.recoveryType,
                entry.amount,
              ]);
            if (charge) {
              for (const [field, label] of [
                ["rent", "Room rent"],
                ["bus", "Bus"],
                ["food", "Food"],
                ["advance", "Salary advance"],
                ["idCard", "ID card"],
                ["medical", "Medical"],
                ["ticket", "Ticket"],
                ["shoe", "Shoe"],
                ["aadhaarUpdate", "Aadhaar update"],
                ["bankAccountCharge", "Bank account charge"],
                ["tshirt", "T-shirt"],
                ["oldPending", "Old pending"],
              ] as const) {
                const value = charge[field];
                if (value && !lines.some(([existing]) => existing === label))
                  lines.push([label, value]);
              }
            }
            if (charge?.gasShare) lines.push(["Gas share", charge.gasShare]);
            if (charge?.rationShare)
              lines.push(["Ration share", charge.rationShare]);
            if (charge?.provisionShare)
              lines.push(["Provision share", charge.provisionShare]);
            const voucherTotal = lines.reduce((sum, [, value]) => sum + value, 0);
            return (
              <article className="advance-voucher" key={employee.id}>
                <header className="voucher-brand-header">
                  {vendor?.logoDataUrl ? (
                    <img src={vendor.logoDataUrl} alt={`${brand.companyName} logo`} />
                  ) : null}
                  <div>
                    <h2>{brand.companyName}</h2>
                    <h3>{brand.clientEmployer}</h3>
                    <p>{brand.address}</p>
                    <p>{brand.email} · {brand.contact}</p>
                  </div>
                </header>
                <h3>FINAL SALARY RECOVERY ACKNOWLEDGEMENT</h3>
                <dl>
                  <div>
                    <dt>Voucher number</dt>
                    <dd>{voucherNo}</dd>
                  </div>
                  <div>
                    <dt>Salary cycle</dt>
                    <dd>
                      {run?.periodStart} to {run?.periodEnd}
                    </dd>
                  </div>
                  <div>
                    <dt>Employee</dt>
                    <dd>{employee.name}</dd>
                  </div>
                  <div>
                    <dt>Employee ID</dt>
                    <dd>{employee.employeeCode}</dd>
                  </div>
                  <div>
                    <dt>Net before recovery</dt>
                    <dd>
                      ₹
                      {(
                        (item?.netPayable ?? 0) +
                        (item?.accommodationDeduction ?? 0) -
                        (item?.returnAmount ?? 0)
                      ).toFixed(2)}
                    </dd>
                  </div>
                  <div>
                    <dt>Final payable</dt>
                    <dd>₹{(item?.netPayable ?? 0).toFixed(2)}</dd>
                  </div>
                </dl>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Deduction type</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(([label, value], index) => (
                      <tr key={`${label}-${index}`}>
                        <td>{label}</td>
                        <td>₹{value.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><th>Total recovery</th><th>₹{voucherTotal.toFixed(2)}</th></tr></tfoot>
                </table>
                <p>
                  I acknowledge the above finalized salary deductions and final
                  payable amount.
                </p>
                <footer>
                  <span>Employee signature</span>
                  <span>Authorized signature</span>
                </footer>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ReportsCenter({
  data,
  run,
  items,
  vendorId,
  unitId,
}: {
  data: AppData;
  run: PayrollRun | null;
  items: PayrollItem[];
  vendorId: string;
  unitId: string;
}) {
  const [report, setReport] = useState("payroll");
  const [scope, setScope] = useState<"overall" | "selected">("overall");
  const reports = useMemo<
    Record<string, { label: string; rows: ReportRow[] }>
  >(() => {
    const employees = data.employees.filter(
      (employee) =>
        scope === "overall" ||
        ((!vendorId || employee.vendorId === vendorId) &&
          (!unitId || employee.clientUnitId === unitId)),
    );
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const attendance = data.attendance.filter((entry) =>
      employeeIds.has(entry.employeeId),
    );
    const roomExpenses = data.roomExpenses.filter(
      (expense) => !run || expense.payPeriod === run.payPeriod,
    );
    return {
      payroll: {
        label: "Payroll register",
        rows: [
          [
            "Employee ID",
            "Employee",
            "Department",
            "Payable days",
            "OT hours",
            "Gross",
            "Total deductions",
            "Net payable",
            "Status",
          ],
          ...items.map((item) => [
            item.employeeCode,
            item.employeeName,
            item.department,
            item.payableDays,
            item.overtimeHours,
            item.grossEarnings,
            item.totalDeductions,
            item.netPayable,
            item.validationStatus,
          ]),
        ],
      },
      // JOY_EMPLOYEE_MASTER_FULL_REPORT_V1: Excel/CSV/print use every employee-master input field.
      employees: {
        label: "Employee master",
        rows: [
          [
            "Group of Company", "Client Name", "Employer Unit", "Client Location",
            "Employee ID", "Employee Name", "Department", "Employment Type",
            "Date of Joining", "Date of Leaving", "Mobile Number", "Email ID", "Emergency Contact Number",
            "Father Name", "Spouse Name", "Marital Status", "Highest Qualification", "Blood Group",
            "Address", "District", "State", "Pincode",
            "UAN / EPF", "ESI Number", "Bank Account", "IFSC", "Bank Name",
            "Accommodation Type", "Room Number", "Room Rent Amount",
            "PF Applicable", "PF Wage Amount", "ESI Applicable", "ESI Wage Amount",
            "PT Applicable", "LWF Applicable", "Payment Mode", "Salary Amount", "Salary Basis",
            "Default Shift", "Shift Pattern", "Applicable Shifts", "Remarks",
            "Compliance Status", "Processing Stage", "Finalized By", "Finalized At", "Status"
          ],
          ...employees.map((employee) => {
            const vendor = data.vendors.find((row) => row.id === employee.vendorId);
            const unit = data.units.find((row) => row.id === employee.clientUnitId);
            return [
              vendor?.legalName ?? vendor?.name ?? "",
              unit?.clientName ?? "", unit?.unitName ?? "", unit?.location ?? "",
              employee.employeeCode, employee.name, employee.department, employee.employmentType,
              employee.dateOfJoining, employee.dateOfLeaving ?? "", employee.mobileNumber ?? "", employee.emailAddress ?? "", employee.emergencyContactNumber ?? "",
              employee.fatherName ?? "", employee.spouseName ?? "", employee.maritalStatus ?? "", employee.highestQualification ?? "", employee.bloodGroup ?? "",
              employee.addressLine ?? "", employee.district ?? "", employee.stateName ?? "", employee.pincode ?? "",
              employee.uanMasked ?? "", employee.esiMasked ?? "", employee.bankAccountMasked ?? "", employee.ifscMasked ?? "", employee.bankName ?? "",
              employee.accommodationType, employee.roomNumber ?? "", employee.roomRentAmount,
              employee.pfApplicable ? "Yes" : "No", employee.pfWageAmount, employee.esiApplicable ? "Yes" : "No", employee.esiWageAmount,
              employee.ptApplicable ? "Yes" : "No", employee.lwfApplicable ? "Yes" : "No", employee.paymentMode, employee.salaryAmount, employee.salaryBasis,
              employee.defaultShift, employee.shiftPattern, employee.applicableShiftsJson, employee.remarks ?? "",
              employee.complianceStatus, employee.processingStage, employee.finalizedBy ?? "", employee.finalizedAt ?? "", employee.status
            ];
          }),
        ],
      },
      attendance: {
        label: "Attendance register",
        rows: [
          [
            "Employee ID",
            "Date",
            "Status",
            "Shift",
            "Punch in",
            "Punch out",
            "OT hours",
          ],
          ...attendance.map((entry) => [
            employees.find((employee) => employee.id === entry.employeeId)
              ?.employeeCode ?? entry.employeeId,
            entry.attendanceDate,
            entry.statusCode,
            entry.shiftCode,
            entry.punchIn ?? "",
            entry.punchOut ?? "",
            entry.overtimeHours,
          ]),
        ],
      },
      overtime: {
        label: "Client OT hours and payment report",
        rows: [
          [
            "Employee ID",
            "Employee",
            "OT hours",
            "OT multiplier",
            "Paid OT hours",
            "OT wages",
          ],
          ...items.map((item) => {
            const employee = employees.find(
              (row) => row.id === item.employeeId,
            );
            const unit = data.units.find(
              (row) => row.id === employee?.clientUnitId,
            );
            const multiplier = unit?.overtimeMultiplier ?? 1;
            return [
              item.employeeCode,
              item.employeeName,
              item.overtimeHours,
              multiplier,
              item.overtimeHours * multiplier,
              item.overtimeWages,
            ];
          }),
        ],
      },
      salaryComponents: {
        label: "Complete earnings and deductions report",
        rows: [
          [
            "Employee ID",
            "Employee",
            "Basic",
            "DA",
            "HRA",
            "Conveyance",
            "Food allowance",
            "Night allowance",
            "OT wages",
            "Bonus",
            "Arrears",
            "PF",
            "ESI",
            "PT",
            "LWF",
            "Canteen",
            "Advance",
            "Other",
            "Accommodation",
            "Gross",
            "Total deductions",
            "Net payable",
          ],
          ...items.map((item) => [
            item.employeeCode,
            item.employeeName,
            item.basic,
            item.da,
            item.hra,
            item.conveyance,
            item.foodAllowance,
            item.nightAllowance,
            item.overtimeWages,
            item.attendanceBonus,
            item.arrears,
            item.pfDeduction,
            item.esiDeduction,
            item.professionalTax,
            item.lwf,
            item.canteen,
            item.advance,
            item.otherDeduction,
            item.accommodationDeduction,
            item.grossEarnings,
            item.totalDeductions,
            item.netPayable,
          ]),
        ],
      },
      joiningLeaving: {
        label: "Joining and left employee report",
        rows: [
          [
            "Employee ID",
            "Employee",
            "Client",
            "Employer unit",
            "Joining date",
            "Left date",
            "Status",
          ],
          ...employees.map((employee) => {
            const unit = data.units.find(
              (row) => row.id === employee.clientUnitId,
            );
            return [
              employee.employeeCode,
              employee.name,
              unit?.clientName ?? "",
              unit?.unitName ?? "",
              employee.dateOfJoining,
              employee.dateOfLeaving ?? "",
              employee.status,
            ];
          }),
        ],
      },
      accommodationAllocation: {
        label: "Accommodation and room allocation report",
        rows: [
          [
            "Employee ID",
            "Employee",
            "Accommodation type",
            "Hostel",
            "Room",
            "Client",
            "Employer unit",
          ],
          ...employees.map((employee) => {
            const room = data.accommodationRooms.find(
              (row) => row.id === employee.roomId,
            );
            const hostel = data.hostels.find(
              (row) => row.id === room?.hostelId,
            );
            const unit = data.units.find(
              (row) => row.id === employee.clientUnitId,
            );
            return [
              employee.employeeCode,
              employee.name,
              employee.accommodationType,
              hostel?.name ?? "Outside room",
              employee.roomNumber ?? "",
              unit?.clientName ?? "",
              unit?.unitName ?? "",
            ];
          }),
        ],
      },
      bankPending: {
        label: "Bank account pending report",
        rows: [
          [
            "Employee ID",
            "Employee",
            "Joining date",
            "Client",
            "Employer unit",
            "Status",
          ],
          ...employees
            .filter(
              (employee) => !employee.bankAccountMasked || !employee.ifscMasked,
            )
            .map((employee) => {
              const unit = data.units.find(
                (row) => row.id === employee.clientUnitId,
              );
              return [
                employee.employeeCode,
                employee.name,
                employee.dateOfJoining,
                unit?.clientName ?? "",
                unit?.unitName ?? "",
                "Pending",
              ];
            }),
        ],
      },
      epfPending: {
        label: "EPF / UAN pending report",
        rows: [
          [
            "Employee ID",
            "Employee",
            "Joining date",
            "Client",
            "Employer unit",
            "Status",
          ],
          ...employees
            .filter((employee) => !employee.uanMasked)
            .map((employee) => {
              const unit = data.units.find(
                (row) => row.id === employee.clientUnitId,
              );
              return [
                employee.employeeCode,
                employee.name,
                employee.dateOfJoining,
                unit?.clientName ?? "",
                unit?.unitName ?? "",
                "Pending",
              ];
            }),
        ],
      },
      esiPending: {
        label: "ESI pending report",
        rows: [
          [
            "Employee ID",
            "Employee",
            "Joining date",
            "Client",
            "Employer unit",
            "Status",
          ],
          ...employees
            .filter((employee) => !employee.esiMasked)
            .map((employee) => {
              const unit = data.units.find(
                (row) => row.id === employee.clientUnitId,
              );
              return [
                employee.employeeCode,
                employee.name,
                employee.dateOfJoining,
                unit?.clientName ?? "",
                unit?.unitName ?? "",
                "Pending",
              ];
            }),
        ],
      },
      compliance: {
        label: "Compliance pending",
        rows: [
          ["Employee ID", "Employee", "Bank", "EPF/UAN", "ESI"],
          ...employees.map((employee) => [
            employee.employeeCode,
            employee.name,
            employee.bankAccountMasked && employee.ifscMasked
              ? "Ready"
              : "Pending",
            employee.uanMasked ? "Ready" : "Pending",
            employee.esiMasked ? "Ready" : "Pending",
          ]),
        ],
      },
      recoveries: {
        label: "Room recovery register",
        rows: [
          [
            "Month",
            "Room",
            "Occupants",
            "Gas",
            "Ration",
            "Provision",
            "Per head",
            "Status",
          ],
          ...roomExpenses.map((expense) => [
            expense.payPeriod,
            data.accommodationRooms.find((room) => room.id === expense.roomId)
              ?.roomNumber ?? expense.roomId,
            expense.occupantCount,
            expense.gasAmount,
            expense.rationAmount,
            expense.provisionAmount,
            (expense.gasAmount +
              expense.rationAmount +
              expense.provisionAmount) /
              Math.max(1, expense.occupantCount),
            expense.status,
          ]),
        ],
      },
      datedRecoveries: {
        label: "Date-wise employee recovery report",
        rows: [
          [
            "Date",
            "Employee ID",
            "Employee",
            "Recovery type",
            "Amount",
            "Reference",
            "Remarks",
            "Entered by",
          ],
          ...data.recoveryEntries
            .filter((entry) => !run || entry.runId === run.id)
            .map((entry) => {
              const employee = employees.find(
                (row) => row.id === entry.employeeId,
              );
              return [
                entry.recoveryDate,
                employee?.employeeCode ?? entry.employeeId,
                employee?.name ?? "",
                recoveryLabels[entry.recoveryType] ?? entry.recoveryType,
                entry.amount,
                entry.reference ?? "",
                entry.notes ?? "",
                entry.createdBy ?? "",
              ];
            }),
        ],
      },
      hostel: {
        label: "Hostel activity & expense report",
        rows: [
          [
            "Hostel",
            "Date",
            "Activity",
            "Reading / Quantity",
            "Amount",
            "Status",
          ],
          ...data.hostelUtilityReadings.map((entry) => [
            data.hostels.find((hostel) => hostel.id === entry.hostelId)?.name ??
              entry.hostelId,
            entry.readingDate,
            entry.activityName ?? entry.utilityType,
            entry.readingValue || entry.tankerQuantity,
            entry.amount,
            entry.status,
          ]),
        ],
      },
      vehicles: {
        label: "Vehicle movement & expense report",
        rows: [
          [
            "Vehicle",
            "Date",
            "Type",
            "From",
            "To",
            "Start KM",
            "End KM",
            "Litres",
            "Amount",
            "Next due",
          ],
          ...data.vehicleRecords.map((entry) => [
            data.vehicles.find((vehicle) => vehicle.id === entry.vehicleId)
              ?.registrationNumber ?? entry.vehicleId,
            entry.recordDate,
            entry.recordType,
            entry.tripFrom ?? "",
            entry.tripTo ?? "",
            entry.startKm ?? "",
            entry.endKm ?? "",
            entry.litres,
            entry.amount,
            entry.nextDueDate ?? "",
          ]),
        ],
      },
    };
  }, [data, items, run, scope, unitId, vendorId]);
  const selected = reports[report];
  const name = `${report}-report-${run?.payPeriod ?? new Date().toISOString().slice(0, 10)}`;
  return (
    <div className="section-stack">
      <section className="panel report-command">
        <div>
          <span className="eyebrow">Download centre</span>
          <h2>Overall & selected-unit reports</h2>
          <p>
            Choose an overall company report or limit it to the currently
            selected group company and client unit.
          </p>
        </div>
        <label>
          <span>Report scope</span>
          <select
            value={scope}
            onChange={(event) =>
              setScope(event.target.value as "overall" | "selected")
            }
          >
            <option value="overall">
              Overall — all group companies and clients
            </option>
            <option value="selected">
              Current selected company / client unit
            </option>
          </select>
        </label>
        <label>
          <span>Report type</span>
          <select
            value={report}
            onChange={(event) => setReport(event.target.value)}
          >
            {Object.entries(reports).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </select>
        </label>
        <div className="record-actions">
          <button
            className="secondary-button"
            onClick={() => exportExcel(name, selected.rows)}
          >
            Excel
          </button>
          <button
            className="secondary-button"
            onClick={() => exportCsv(name, selected.rows)}
          >
            CSV
          </button>
          <button className="primary-button" onClick={() => printTarget()}>
            Print / PDF
          </button>
        </div>
      </section>
      <section className="panel table-panel report-print-area">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              {scope === "overall" ? "Overall report" : "Selected unit report"}
            </span>
            <h2>{selected.label}</h2>
          </div>
          <span className="muted-label">
            {Math.max(0, selected.rows.length - 1)} records
          </span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {selected.rows[0]?.map((cell, index) => (
                  <th key={index}>{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.rows.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => (
                    <td key={index}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
