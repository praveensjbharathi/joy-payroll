export type PayrollPrintTarget =
  | "payslips"
  | "room"
  | "report"
  | "voucher"
  | "bulk-vouchers";

function waitForFrameAssets(printDocument: Document) {
  const images = Array.from(printDocument.images).map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
  });
  const fonts = "fonts" in printDocument
    ? (printDocument as Document & { fonts: FontFaceSet }).fonts.ready.then(() => undefined)
    : Promise.resolve();
  return Promise.all([fonts, ...images]);
}

function runtimePrintCss(target: PayrollPrintTarget) {
  const landscape = target === "room" || target === "report";
  return `
    @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 5mm; }
    @media print {
      html, body {
        width: auto !important;
        height: auto !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #fff !important;
      }
      body, body * {
        visibility: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #joy-print-root,
      #joy-print-root .room-report-pages,
      #joy-print-root .report-print-area,
      #joy-print-root .bulk-recovery-vouchers,
      #joy-print-root .bulk-payslip-pages {
        page: auto !important;
        display: block !important;
        position: static !important;
        inset: auto !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        transform: none !important;
        box-shadow: none !important;
        background: #fff !important;
      }

      body.joy-print-target-room #joy-print-root .room-report-page,
      body.joy-print-target-report #joy-print-root .room-report-page {
        page: auto !important;
        display: block !important;
        position: relative !important;
        inset: auto !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 3mm !important;
        overflow: visible !important;
        box-sizing: border-box !important;
        border: 0 !important;
        border-radius: 0 !important;
        break-before: auto !important;
        page-break-before: auto !important;
        break-after: auto !important;
        page-break-after: auto !important;
        break-inside: avoid-page !important;
        page-break-inside: avoid !important;
      }
      body.joy-print-target-room #joy-print-root .room-report-page:not(:last-child),
      body.joy-print-target-report #joy-print-root .room-report-page:not(:last-child) {
        break-after: page !important;
        page-break-after: always !important;
      }
      body.joy-print-target-room #joy-print-root .room-report-page table,
      body.joy-print-target-report #joy-print-root .room-report-page table {
        width: 100% !important;
        table-layout: fixed !important;
        border-collapse: collapse !important;
        font-size: 7.4pt !important;
      }
      body.joy-print-target-room #joy-print-root .room-report-page th,
      body.joy-print-target-room #joy-print-root .room-report-page td,
      body.joy-print-target-report #joy-print-root .room-report-page th,
      body.joy-print-target-report #joy-print-root .room-report-page td {
        padding: 1mm .7mm !important;
        line-height: 1.18 !important;
        overflow-wrap: anywhere !important;
      }

      body.joy-print-target-voucher #joy-print-root .advance-voucher,
      body.joy-print-target-bulk-vouchers #joy-print-root .advance-voucher {
        page: auto !important;
        display: block !important;
        position: relative !important;
        inset: auto !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 190mm !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        margin: 0 auto !important;
        padding: 8mm !important;
        overflow: visible !important;
        box-sizing: border-box !important;
        box-shadow: none !important;
        break-before: auto !important;
        page-break-before: auto !important;
        break-after: auto !important;
        page-break-after: auto !important;
        break-inside: avoid-page !important;
        page-break-inside: avoid !important;
      }
      body.joy-print-target-bulk-vouchers #joy-print-root .advance-voucher:not(:last-child) {
        break-after: page !important;
        page-break-after: always !important;
      }
      body.joy-print-target-voucher #joy-print-root .advance-voucher footer,
      body.joy-print-target-bulk-vouchers #joy-print-root .advance-voucher footer {
        margin-top: 18mm !important;
      }

      body.joy-print-target-payslips #joy-print-root .payslip-sheet {
        page: auto !important;
        display: block !important;
        position: relative !important;
        inset: auto !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 8mm !important;
        overflow: visible !important;
        box-sizing: border-box !important;
        border: 0 !important;
        box-shadow: none !important;
        break-before: auto !important;
        page-break-before: auto !important;
        break-after: auto !important;
        page-break-after: auto !important;
        break-inside: avoid-page !important;
        page-break-inside: avoid !important;
        transform: none !important;
      }
      body.joy-print-target-payslips #joy-print-root .payslip-sheet:not(:last-child) {
        break-after: page !important;
        page-break-after: always !important;
      }

      body.joy-print-target-report #joy-print-root .report-print-area {
        page: auto !important;
        position: static !important;
        width: 100% !important;
        max-width: 100% !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        box-shadow: none !important;
      }
      body.joy-print-target-report #joy-print-root .report-print-area .table-scroll {
        overflow: visible !important;
      }
    }
  `;
}

export async function printIsolatedElement(
  source: HTMLElement,
  target: PayrollPrintTarget,
) {
  document.getElementById("joy-print-frame")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "joy-print-frame";
  frame.title = "Joy Payroll print document";
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.border = "0";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  document.body.appendChild(frame);

  const printDocument = frame.contentDocument;
  const printWindow = frame.contentWindow;
  if (!printDocument || !printWindow) {
    frame.remove();
    return;
  }

  printDocument.open();
  printDocument.write("<!doctype html><html><head></head><body></body></html>");
  printDocument.close();
  printDocument.title = document.title;
  printDocument.body.className = `joy-print-target-${target}`;

  const base = printDocument.createElement("base");
  base.href = document.baseURI;
  printDocument.head.appendChild(base);
  document
    .querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style')
    .forEach((stylesheet) => {
      printDocument.head.appendChild(printDocument.importNode(stylesheet, true));
    });

  const runtimeStyle = printDocument.createElement("style");
  runtimeStyle.id = "joy-isolated-print-style";
  runtimeStyle.textContent = runtimePrintCss(target);
  printDocument.head.appendChild(runtimeStyle);

  const printRoot = printDocument.createElement("main");
  printRoot.id = "joy-print-root";
  printRoot.className = `joy-print-root-${target}`;
  printRoot.appendChild(printDocument.importNode(source, true));
  printDocument.body.appendChild(printRoot);

  await Promise.race([
    waitForFrameAssets(printDocument),
    new Promise<void>((resolve) => window.setTimeout(resolve, 1200)),
  ]);
  await new Promise<void>((resolve) =>
    printWindow.requestAnimationFrame(() =>
      printWindow.requestAnimationFrame(() => resolve()),
    ),
  );

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    frame.remove();
  };
  printWindow.addEventListener("afterprint", cleanup, { once: true });
  printWindow.focus();
  printWindow.print();
  window.setTimeout(cleanup, 2000);
}
