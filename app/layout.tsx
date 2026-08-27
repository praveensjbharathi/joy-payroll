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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <style>{`.id-card-front footer { display: none !important; }`}</style>
        {children}
      </body>
    </html>
  );
}
