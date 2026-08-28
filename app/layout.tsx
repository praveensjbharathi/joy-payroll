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
    grid-template-columns: 1fr !important;
    gap: 16px !important;
    margin-top: 24px !important;
    padding-top: 22px !important;
  }
  .profile-password-panel h3 {
    margin: 0 0 2px !important;
    font-size: 17px !important;
    line-height: 1.3 !important;
    color: #182235 !important;
  }
  .profile-password-panel label {
    width: 100% !important;
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 7px !important;
  }
  .profile-password-panel label > span {
    display: block !important;
    font-size: 13px !important;
    line-height: 1.4 !important;
    font-weight: 700 !important;
    color: #334155 !important;
    text-align: left !important;
  }
  .profile-password-panel input {
    display: block !important;
    width: 100% !important;
    min-width: 0 !important;
    height: 46px !important;
    padding: 0 13px !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 9px !important;
    background: #fff !important;
    color: #172236 !important;
    font-size: 14px !important;
    outline: none !important;
  }
  .profile-password-panel input:focus {
    border-color: #256ff1 !important;
    box-shadow: 0 0 0 3px rgba(37,111,241,.12) !important;
  }
  .profile-password-panel > button {
    width: 100% !important;
    min-height: 44px !important;
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
    justify-content: center !important;
  }
  .employee-id-card-set .id-card-back {
    display: none !important;
  }
  .id-card-front footer {
    display: none !important;
  }
  .id-card-front .id-card-person {
    text-align: right !important;
  }
  .id-card-front .id-card-person h2,
  .id-card-front .id-card-person > strong {
    text-align: right !important;
  }
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

  @media print {
    .employee-id-card-set { display: block !important; padding: 0 !important; }
    .employee-id-card-set .id-card-back { display: none !important; }
    .employee-id-card-set .id-card-front {
      display: flex !important;
      margin: 0 !important;
      break-after: auto !important;
      page-break-after: auto !important;
    }
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
  const coverImage = (ctx, image, x, y, w, h) => {
    if (!image) return;
    const scale = Math.max(w / image.width, h / image.height);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (image.width - sw) / 2;
    const sy = (image.height - sh) / 2;
    ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
  };
  async function downloadIdJpg(front) {
    const width = 1050;
    const height = 1665;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#b7c5d6';
    ctx.lineWidth = 4;
    roundedRect(ctx, 10, 10, width - 20, height - 20, 38);
    ctx.stroke();

    ctx.fillStyle = '#145dc7';
    roundedRect(ctx, 55, 55, width - 110, 245, 28);
    ctx.fill();

    const logoNode = front.querySelector('.id-card-company img');
    const photoNode = front.querySelector('.employee-id-photo-image');
    const qrNode = front.querySelector('.id-card-qr');
    const logo = await loadImage(logoNode ? logoNode.src : '');
    const photo = await loadImage(photoNode ? photoNode.src : '');
    const qr = await loadImage(qrNode ? qrNode.src : '');

    if (logo) {
      ctx.fillStyle = '#ffffff';
      roundedRect(ctx, 82, 89, 170, 120, 14);
      ctx.fill();
      ctx.drawImage(logo, 94, 101, 146, 96);
    }

    const companyName = safeText(front, '.id-card-company b', 'JOY GROUPS');
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = '700 34px Arial, sans-serif';
    ctx.fillText(companyName, logo ? 285 : 90, 145, logo ? 650 : 850);
    ctx.font = '600 20px Arial, sans-serif';
    ctx.fillStyle = '#dce9ff';
    ctx.fillText('EMPLOYEE IDENTITY CARD', logo ? 285 : 90, 190);

    const photoX = 70, photoY = 390, photoW = 360, photoH = 455;
    ctx.fillStyle = '#edf4ff';
    roundedRect(ctx, photoX, photoY, photoW, photoH, 24);
    ctx.fill();
    if (photo) {
      ctx.save();
      roundedRect(ctx, photoX, photoY, photoW, photoH, 24);
      ctx.clip();
      coverImage(ctx, photo, photoX, photoY, photoW, photoH);
      ctx.restore();
    } else {
      const initialsNode = front.querySelector('.employee-id-photo');
      ctx.fillStyle = '#145dc7';
      ctx.textAlign = 'center';
      ctx.font = '800 100px Arial, sans-serif';
      ctx.fillText(initialsNode ? initialsNode.textContent.trim() : 'JOY', photoX + photoW / 2, photoY + photoH / 2 + 35);
    }

    const name = safeText(front, '.id-card-person h2', 'Employee');
    const department = safeText(front, '.id-card-person > strong', '');
    const detailRows = Array.from(front.querySelectorAll('.id-card-person dl > div')).map((row) => ({
      label: safeText(row, 'dt', ''),
      value: safeText(row, 'dd', '—'),
    }));

    ctx.textAlign = 'right';
    ctx.fillStyle = '#172236';
    ctx.font = '800 46px Arial, sans-serif';
    ctx.fillText(name, 970, 420, 500);
    ctx.fillStyle = '#416080';
    ctx.font = '700 28px Arial, sans-serif';
    ctx.fillText(department, 970, 470, 500);

    let y = 575;
    detailRows.forEach((row) => {
      ctx.fillStyle = '#52657d';
      ctx.font = '800 23px Arial, sans-serif';
      ctx.fillText(row.label, 970, y);
      ctx.fillStyle = '#172236';
      ctx.font = '650 31px Arial, sans-serif';
      ctx.fillText(row.value, 970, y + 42, 500);
      y += 135;
    });

    const qrX = 115, qrY = 985, qrSize = 280;
    if (qr) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);
      ctx.imageSmoothingEnabled = true;
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#172236';
    ctx.font = '800 28px Arial, sans-serif';
    ctx.fillText(name, 495, 1060, 470);
    ctx.fillStyle = '#52657d';
    ctx.font = '650 22px Arial, sans-serif';
    ctx.fillText(department, 495, 1105, 470);

    ctx.strokeStyle = '#dce5ef';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, 1360);
    ctx.lineTo(980, 1360);
    ctx.stroke();
    ctx.fillStyle = '#6b7b90';
    ctx.textAlign = 'center';
    ctx.font = '600 20px Arial, sans-serif';
    ctx.fillText('Scan QR for employee identity verification', width / 2, 1410);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const employeeCode = detailRows.find((row) => row.label.toLowerCase().includes('employee id'))?.value || 'employee';
      anchor.download = 'joy-id-' + employeeCode.replace(/[^a-zA-Z0-9_-]/g, '-') + '-high-res.jpg';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/jpeg', 0.98);
  }

  function enhance() {
    document.querySelectorAll('.id-card-modal').forEach((modal) => {
      if (modal.dataset.enhanced === 'true') return;
      modal.dataset.enhanced = 'true';
      const front = modal.querySelector('.id-card-front');
      const toolbar = modal.querySelector('.modal-toolbar > div:last-child');
      if (!front || !toolbar) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary-button id-jpg-button';
      button.textContent = 'Download high-quality JPG';
      button.addEventListener('click', () => void downloadIdJpg(front));
      toolbar.insertBefore(button, toolbar.firstChild);
    });
  }

  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance, { once: true });
  } else {
    enhance();
  }
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
