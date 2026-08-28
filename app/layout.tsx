import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Joy Client Payroll Manager",
  description:
    "Multi-client attendance, salary processing, accommodation deductions, approvals, payslips and payment exports in one workspace.",
  openGraph: {
    title: "Joy Client Payroll Manager",
    description:
      "Attendance to approved salary, payslip and bank payment in one controlled workflow.",
    type: "website",
    images: [
      {
        url: "https://joy-vendor-payroll.praveen-red-07.chatgpt.site/og.png",
        width: 1200,
        height: 630,
        alt: "Joy Client Payroll Manager",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Joy Client Payroll Manager",
    description:
      "Attendance to approved salary, payslip and bank payment in one controlled workflow.",
    images: ["https://joy-vendor-payroll.praveen-red-07.chatgpt.site/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

const payrollUiFixes = `
  .profile-password-panel {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 14px !important;
    margin-top: 24px !important;
    padding-top: 22px !important;
    border-top: 1px solid #e6ebf2 !important;
  }
  .profile-password-panel h3 {
    margin: 0 0 2px !important;
    font-size: 17px !important;
    line-height: 1.3 !important;
    color: #182235 !important;
  }
  .profile-password-panel label {
    width: 100% !important;
    min-width: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 7px !important;
    margin: 0 !important;
  }
  .profile-password-panel label > span {
    display: block !important;
    width: 100% !important;
    font-size: 13px !important;
    line-height: 1.4 !important;
    font-weight: 700 !important;
    color: #334155 !important;
    text-align: left !important;
  }
  .profile-password-panel label > input,
  .profile-password-panel input[type="password"] {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    position: static !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
    height: 48px !important;
    min-height: 48px !important;
    padding: 0 13px !important;
    margin: 0 !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 9px !important;
    background: #fff !important;
    color: #172236 !important;
    font-size: 14px !important;
    line-height: 48px !important;
    box-sizing: border-box !important;
    outline: none !important;
    appearance: auto !important;
  }
  .profile-password-panel input:focus {
    border-color: #256ff1 !important;
    box-shadow: 0 0 0 3px rgba(37,111,241,.12) !important;
  }
  .profile-password-panel > button {
    width: 100% !important;
    min-height: 46px !important;
    margin-top: 2px !important;
  }
  .profile-password-panel > p {
    margin: 0 !important;
    padding: 10px 12px !important;
    border-radius: 8px !important;
    background: #f7f9fc !important;
    color: #536076 !important;
    font-size: 12px !important;
    line-height: 1.45 !important;
  }

  .employee-id-card-set {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 18px !important;
    align-items: flex-start !important;
    justify-content: center !important;
  }
  .employee-id-card-set .id-card-front,
  .employee-id-card-set .id-card-back {
    display: flex !important;
  }
  .id-card-front footer { display: none !important; }
  .id-card-front .id-card-company b {
    display: block !important;
    max-width: 39mm !important;
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: clip !important;
    font-size: 3.1mm !important;
    line-height: 1.12 !important;
  }
  .id-card-front .id-card-person { text-align: right !important; }
  .id-card-front .id-card-person h2,
  .id-card-front .id-card-person > strong { text-align: right !important; }
  .id-card-front .id-card-person dl {
    display: grid !important;
    gap: 2.2mm !important;
    text-align: right !important;
  }
  .id-card-front .id-card-person dl > div {
    display: grid !important;
    grid-template-columns: 1fr !important;
    justify-items: end !important;
    gap: .35mm !important;
    padding: 0 !important;
    border-bottom: 0 !important;
  }
  .id-card-front .id-card-person dt {
    flex: none !important;
    width: auto !important;
    color: #52657d !important;
    font-weight: 800 !important;
    line-height: 1.1 !important;
  }
  .id-card-front .id-card-person dd {
    margin: 0 !important;
    color: #172236 !important;
    font-weight: 650 !important;
    line-height: 1.15 !important;
    text-align: right !important;
  }
  .id-jpg-button { white-space: nowrap; }

  .hostel-hierarchy-guide {
    margin: 0 0 18px !important;
    padding: 16px 18px !important;
    border: 1px solid #d8e5f7 !important;
    border-radius: 12px !important;
    background: #f8fbff !important;
  }
  .hostel-hierarchy-guide strong { display:block; margin-bottom:10px; color:#172236; }
  .hostel-hierarchy-guide ol { margin:0; padding-left:20px; display:grid; gap:6px; color:#455872; }
  .room-print-toolbar {
    display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:10px;
  }
  .room-print-toolbar select { min-width:160px; }

  @media print {
    @page { size: A4; margin: 10mm; }
    body { background: #fff !important; }
    .payslip-modal .modal-toolbar,
    .advance-voucher-layer .modal-toolbar,
    .room-recovery-print-layer .modal-toolbar { display:none !important; }
    .bulk-payslip-pages { display:block !important; }
    .payslip-sheet,
    .payslip-half-a4 {
      width: 190mm !important;
      min-height: 277mm !important;
      max-height: none !important;
      margin: 0 auto !important;
      padding: 10mm !important;
      box-sizing: border-box !important;
      break-after: page !important;
      page-break-after: always !important;
      transform: none !important;
    }
    .bulk-payslip-pages .payslip-sheet:last-child { break-after:auto !important; page-break-after:auto !important; }
    .advance-voucher,
    .bulk-recovery-vouchers .advance-voucher {
      width: 190mm !important;
      min-height: 277mm !important;
      margin: 0 auto !important;
      padding: 12mm !important;
      box-sizing: border-box !important;
      font-size: 12pt !important;
      break-after: page !important;
      page-break-after: always !important;
    }
    .bulk-recovery-vouchers .advance-voucher:last-child { break-after:auto !important; page-break-after:auto !important; }
    .advance-voucher h2 { font-size: 20pt !important; }
    .advance-voucher h3 { font-size: 15pt !important; }

    .id-card-modal .modal-toolbar { display:none !important; }
    .employee-id-card-set {
      display:block !important;
      padding:0 !important;
    }
    .employee-id-card-set .employee-id-card {
      margin: 0 auto 12mm !important;
      break-after: page !important;
      page-break-after: always !important;
    }
    .employee-id-card-set .employee-id-card:last-child {
      break-after:auto !important;
      page-break-after:auto !important;
    }

    .room-recovery-print-layer {
      position: static !important;
      inset: auto !important;
      background:#fff !important;
      padding:0 !important;
    }
    .room-recovery-print-sheet {
      width: 277mm !important;
      min-height: 190mm !important;
      margin:0 auto !important;
      padding:8mm !important;
      box-sizing:border-box !important;
      break-after:page !important;
      page-break-after:always !important;
    }
    .room-recovery-print-sheet:last-child { break-after:auto !important; page-break-after:auto !important; }
    .room-recovery-print-sheet table { width:100% !important; border-collapse:collapse !important; font-size:10pt !important; }
    .room-recovery-print-sheet th,
    .room-recovery-print-sheet td { border:1px solid #77869a !important; padding:5px 6px !important; text-align:right !important; }
    .room-recovery-print-sheet th:first-child,
    .room-recovery-print-sheet td:first-child,
    .room-recovery-print-sheet th:nth-child(2),
    .room-recovery-print-sheet td:nth-child(2) { text-align:left !important; }
    .room-recovery-print-sheet h1 { font-size:17pt !important; margin:0 0 4px !important; }
    .room-recovery-print-sheet h2 { font-size:13pt !important; margin:0 0 10px !important; }
  }
`;

const idCardEnhancer = `
(() => {
  const safeText = (root, selector, fallback = '') => {
    const node = root.querySelector(selector);
    return (node && node.textContent ? node.textContent.trim() : fallback);
  };
  const loadImage = (src) => new Promise((resolve) => {
    if (!src) return resolve(null);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
  const roundedRect = (ctx, x, y, w, h, r) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };
  const fitText = (ctx, value, maxWidth, initialSize, weight = 700, minSize = 18) => {
    let size = initialSize;
    do {
      ctx.font = weight + ' ' + size + 'px Arial, sans-serif';
      if (ctx.measureText(value).width <= maxWidth) break;
      size -= 1;
    } while (size > minSize);
    return size;
  };
  const wrapText = (ctx, value, x, y, maxWidth, lineHeight, maxLines = 3) => {
    const words = String(value || '').split(/\\s+/);
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width <= maxWidth || !line) line = next;
      else { lines.push(line); line = word; }
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight, maxWidth));
    return Math.min(lines.length, maxLines) * lineHeight;
  };
  const coverImage = (ctx, image, x, y, w, h) => {
    if (!image) return;
    const scale = Math.max(w / image.width, h / image.height);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (image.width - sw) / 2;
    const sy = (image.height - sh) / 2;
    ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
  };
  const saveCanvas = (canvas, filename) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/jpeg', 0.98);
  };

  async function downloadFrontJpg(front) {
    const width = 1050, height = 1665;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#b7c5d6'; ctx.lineWidth = 4;
    roundedRect(ctx, 10, 10, width - 20, height - 20, 38); ctx.stroke();
    ctx.fillStyle = '#145dc7'; roundedRect(ctx, 0, 0, width, 265, 0); ctx.fill();

    const logoNode = front.querySelector('.id-card-company img');
    const photoNode = front.querySelector('.employee-id-photo-image');
    const qrNode = front.querySelector('.id-card-qr');
    const logo = await loadImage(logoNode ? logoNode.src : '');
    const photo = await loadImage(photoNode ? photoNode.src : '');
    const qr = await loadImage(qrNode ? qrNode.src : '');
    if (logo) {
      ctx.fillStyle = '#fff'; ctx.fillRect(45, 38, 170, 170);
      ctx.drawImage(logo, 58, 51, 144, 144);
    }
    const companyName = safeText(front, '.id-card-company b', 'JOY GROUPS');
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    fitText(ctx, companyName, 760, 37, 700, 24);
    wrapText(ctx, companyName, 245, 88, 760, 42, 2);
    ctx.font = '700 22px Arial, sans-serif'; ctx.fillStyle = '#e7efff';
    ctx.fillText('EMPLOYEE IDENTITY CARD', 245, 205, 740);

    const photoX = 62, photoY = 360, photoW = 350, photoH = 420;
    ctx.fillStyle = '#edf4ff'; roundedRect(ctx, photoX, photoY, photoW, photoH, 16); ctx.fill();
    if (photo) {
      ctx.save(); roundedRect(ctx, photoX, photoY, photoW, photoH, 16); ctx.clip();
      coverImage(ctx, photo, photoX, photoY, photoW, photoH); ctx.restore();
    } else {
      const initialsNode = front.querySelector('.employee-id-photo');
      ctx.fillStyle = '#145dc7'; ctx.textAlign = 'center'; ctx.font = '800 100px Arial, sans-serif';
      ctx.fillText(initialsNode ? initialsNode.textContent.trim() : 'JOY', photoX + photoW / 2, photoY + photoH / 2 + 35);
    }
    const name = safeText(front, '.id-card-person h2', 'Employee');
    const department = safeText(front, '.id-card-person > strong', '');
    const detailRows = Array.from(front.querySelectorAll('.id-card-person dl > div')).map((row) => ({
      label: safeText(row, 'dt', ''), value: safeText(row, 'dd', '—'),
    }));
    ctx.textAlign = 'right'; ctx.fillStyle = '#172236';
    fitText(ctx, name, 560, 46, 800, 28); ctx.fillText(name, 985, 390, 560);
    ctx.fillStyle = '#416080'; fitText(ctx, department, 560, 29, 700, 20); ctx.fillText(department, 985, 440, 560);
    let y = 560;
    detailRows.forEach((row) => {
      ctx.fillStyle = '#52657d'; ctx.font = '800 23px Arial, sans-serif'; ctx.fillText(row.label, 985, y);
      ctx.fillStyle = '#172236'; fitText(ctx, row.value, 535, 33, 700, 21); ctx.fillText(row.value, 985, y + 43, 535);
      y += 150;
    });
    const qrX = 68, qrY = 1000, qrSize = 330;
    if (qr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(qr, qrX, qrY, qrSize, qrSize); ctx.imageSmoothingEnabled = true; }
    ctx.textAlign = 'left'; ctx.fillStyle = '#52657d'; ctx.font = '650 22px Arial, sans-serif';
    ctx.fillText('Scan QR to verify employee ID', 65, 1385);
    ctx.strokeStyle = '#dce5ef'; ctx.beginPath(); ctx.moveTo(65, 1460); ctx.lineTo(985, 1460); ctx.stroke();
    ctx.fillStyle = '#5f7088'; ctx.font = '700 20px Arial, sans-serif'; ctx.fillText('JOY GROUPS · Employee identity', 65, 1515);
    const employeeCode = detailRows.find((row) => row.label.toLowerCase().includes('employee id'))?.value || 'employee';
    saveCanvas(canvas, 'joy-id-' + employeeCode.replace(/[^a-zA-Z0-9_-]/g, '-') + '-front.jpg');
  }

  async function downloadBackJpg(back, front) {
    const width = 1050, height = 1665;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height);
    ctx.strokeStyle='#b7c5d6'; ctx.lineWidth=4; roundedRect(ctx,10,10,width-20,height-20,38); ctx.stroke();
    ctx.fillStyle='#145dc7'; ctx.fillRect(0,0,width,210);
    ctx.fillStyle='#fff'; ctx.font='800 34px Arial, sans-serif'; ctx.textAlign='center';
    ctx.fillText('EMERGENCY & ADDRESS DETAILS', width/2, 125, 900);
    const rows = Array.from(back.querySelectorAll('dl > div')).map((row) => ({label:safeText(row,'dt',''), value:safeText(row,'dd','—')}));
    ctx.textAlign='left'; let y=300;
    rows.forEach((row) => {
      ctx.fillStyle='#52657d'; ctx.font='800 23px Arial, sans-serif'; ctx.fillText(row.label,70,y);
      ctx.fillStyle='#172236'; ctx.font='700 29px Arial, sans-serif';
      const used = wrapText(ctx,row.value,70,y+42,910,38,row.label.toLowerCase().includes('address') ? 4 : 2);
      y += Math.max(120, used + 78);
    });
    const company = safeText(back,'section strong',safeText(front,'.id-card-company b','JOY GROUPS'));
    const spans = Array.from(back.querySelectorAll('section span')).map((node)=>node.textContent?.trim()||'');
    ctx.strokeStyle='#dce5ef'; ctx.beginPath(); ctx.moveTo(70,1280); ctx.lineTo(980,1280); ctx.stroke();
    ctx.fillStyle='#172236'; ctx.font='800 28px Arial, sans-serif'; wrapText(ctx,company,70,1340,910,34,2);
    ctx.fillStyle='#52657d'; ctx.font='600 21px Arial, sans-serif';
    let sy=1425; spans.forEach((value)=>{ sy += wrapText(ctx,value,70,sy,910,30,2)+8; });
    ctx.font='600 18px Arial, sans-serif'; ctx.fillStyle='#6b7b90';
    ctx.fillText('If found, please return this card to the company address above.',70,1600,910);
    const employeeCode = safeText(front,'.id-card-person dl > div dd','employee');
    saveCanvas(canvas, 'joy-id-' + employeeCode.replace(/[^a-zA-Z0-9_-]/g, '-') + '-back.jpg');
  }

  function enhanceIdCards() {
    document.querySelectorAll('.id-card-modal').forEach((modal) => {
      if (modal.dataset.enhanced === 'true') return;
      modal.dataset.enhanced = 'true';
      const front = modal.querySelector('.id-card-front');
      const back = modal.querySelector('.id-card-back');
      const toolbar = modal.querySelector('.modal-toolbar > div:last-child');
      if (!front || !toolbar) return;
      const frontButton = document.createElement('button');
      frontButton.type='button'; frontButton.className='secondary-button id-jpg-button'; frontButton.textContent='Download front JPG';
      frontButton.addEventListener('click',()=>void downloadFrontJpg(front));
      toolbar.insertBefore(frontButton,toolbar.firstChild);
      if (back) {
        const backButton=document.createElement('button');
        backButton.type='button'; backButton.className='secondary-button id-jpg-button'; backButton.textContent='Download back JPG';
        backButton.addEventListener('click',()=>void downloadBackJpg(back,front));
        toolbar.insertBefore(backButton,frontButton.nextSibling);
      }
    });
  }

  function enhanceHostelMaster() {
    const headings = Array.from(document.querySelectorAll('h1,h2')).filter((node)=>/hostel master/i.test(node.textContent||''));
    if (!headings.length) return;
    const sectionStack = headings[0].closest('.content')?.querySelector('.section-stack');
    if (sectionStack && !sectionStack.querySelector('.hostel-hierarchy-guide')) {
      const guide=document.createElement('section'); guide.className='hostel-hierarchy-guide';
      guide.innerHTML='<strong>Accommodation / hostel / room hierarchy</strong><ol><li>Select Accommodation Type</li><li>Select or create Hostel / Local Area</li><li>Map that hostel to Client Employer Unit(s)</li><li>Create or map Rooms under the hostel</li><li>Allocate only mapped, room-unallocated employees</li></ol>';
      sectionStack.insertBefore(guide,sectionStack.firstChild);
    }
    document.querySelectorAll('.hostel-selected-record').forEach((record)=>{
      const title=record.querySelector('h2')?.textContent?.trim()||'';
      if (!title) return;
      if (record.dataset.selectedName && record.dataset.selectedName !== title) {
        const form=record.querySelector('form');
        if (form) setTimeout(()=>form.reset(),0);
      }
      record.dataset.selectedName=title;
    });
  }

  function buildRoomPrint() {
    const targetHeading = Array.from(document.querySelectorAll('h2')).find((node)=>/net salary.*recoveries.*final payable/i.test((node.textContent||'').replace(/→/g,' ')));
    if (!targetHeading) return;
    const panel=targetHeading.closest('.panel'); if (!panel || panel.dataset.roomPrintEnhanced==='true') return;
    panel.dataset.roomPrintEnhanced='true';
    const table=panel.querySelector('table'); if (!table) return;
    const rows=Array.from(table.querySelectorAll('tbody tr'));
    const rooms=[...new Set(rows.map((row)=>row.children[1]?.textContent?.trim()).filter((value)=>value && value!=='—'))].sort();
    if (!rooms.length) return;
    const toolbar=document.createElement('div'); toolbar.className='room-print-toolbar';
    const select=document.createElement('select'); rooms.forEach((room)=>{const o=document.createElement('option');o.value=room;o.textContent=room;select.appendChild(o);});
    const one=document.createElement('button'); one.type='button'; one.className='secondary-button'; one.textContent='Print selected room A4 landscape';
    const all=document.createElement('button'); all.type='button'; all.className='primary-button'; all.textContent='Print all rooms A4 landscape';
    const printRooms=(requested)=>{
      document.querySelector('.room-recovery-print-layer')?.remove();
      const layer=document.createElement('div'); layer.className='room-recovery-print-layer modal-layer';
      requested.forEach((room)=>{
        const sheet=document.createElement('section'); sheet.className='room-recovery-print-sheet';
        const company=document.querySelector('.topbar-selectors label:first-child select option:checked')?.textContent?.trim()||'JOY GROUPS';
        const client=document.querySelector('.topbar-selectors label:nth-of-type(2) select option:checked')?.textContent?.trim()||'Client employer';
        sheet.innerHTML='<h1>'+company+'</h1><h2>FINALIZED ROOM-WISE SALARY RECOVERY STATEMENT · '+room+' · '+client+'</h2>';
        const clone=table.cloneNode(true); clone.querySelectorAll('tbody tr').forEach((row)=>{ if ((row.children[1]?.textContent?.trim()||'')!==room) row.remove(); });
        clone.querySelectorAll('th:last-child,td:last-child').forEach((cell)=>cell.remove());
        sheet.appendChild(clone); layer.appendChild(sheet);
      });
      document.body.appendChild(layer); window.print(); setTimeout(()=>layer.remove(),500);
    };
    one.addEventListener('click',()=>printRooms([select.value])); all.addEventListener('click',()=>printRooms(rooms));
    toolbar.append(select,one,all); panel.querySelector('.panel-heading')?.appendChild(toolbar);
  }

  function enhance() {
    enhanceIdCards(); enhanceHostelMaster(); buildRoomPrint();
  }
  const observer=new MutationObserver(enhance); observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',enhance,{once:true}); else enhance();
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <style>{payrollUiFixes}</style>
        {children}
        <script dangerouslySetInnerHTML={{ __html: idCardEnhancer }} />
      </body>
    </html>
  );
}
