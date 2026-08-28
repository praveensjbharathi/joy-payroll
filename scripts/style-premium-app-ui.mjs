import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const path = join(root, "app/globals.css");
let source = await readFile(path, "utf8");
const marker = "/* JOY_PREMIUM_UI_20260829 */";
if (!source.includes(marker)) {
  source += `

${marker}
:root{
  --joy-navy:#0a1b32;
  --joy-navy-2:#102a4e;
  --joy-blue:#1769e0;
  --joy-blue-2:#3a8cff;
  --joy-cyan:#13b8c8;
  --joy-gold:#d4a33c;
  --joy-soft:#f5f8fc;
  --joy-border:#dce5f0;
  --joy-card-shadow:0 12px 34px rgba(18,43,78,.08),0 2px 8px rgba(18,43,78,.04);
}
html,body,.app-shell{background:radial-gradient(circle at 90% 0%,rgba(46,130,246,.08),transparent 28%),linear-gradient(180deg,#f8fbff 0%,#f4f7fb 48%,#f7f9fc 100%)!important}
.sidebar{background:linear-gradient(180deg,#071427 0%,#0b1f39 58%,#0a2847 100%)!important;box-shadow:10px 0 40px rgba(4,17,34,.10)!important;border-right:1px solid rgba(255,255,255,.08)!important}
.brand-lockup{height:82px!important;padding:0 20px!important;background:linear-gradient(120deg,rgba(49,127,255,.12),rgba(17,184,200,.05))!important}
.brand-mark,.loading-mark{border-radius:14px!important;background:linear-gradient(145deg,#3c8cff,#145ac8)!important;box-shadow:0 10px 28px rgba(39,117,233,.34),inset 0 1px 0 rgba(255,255,255,.32)!important}
.brand-lockup strong{font-size:18px!important;letter-spacing:.12em!important}.brand-lockup small{color:#91a9c5!important}
.sidebar-context{border-radius:14px!important;padding:14px!important;background:linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.025))!important;border-color:rgba(255,255,255,.10)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)!important}
.nav-item{min-height:46px!important;border-radius:12px!important;padding:0 13px!important;transition:transform .16s ease,background .16s ease,color .16s ease!important}
.nav-item:hover{transform:translateX(2px)!important;background:rgba(255,255,255,.075)!important}.nav-active{background:linear-gradient(90deg,rgba(49,128,255,.34),rgba(25,91,169,.17))!important;box-shadow:inset 3px 0 #64a7ff,0 5px 16px rgba(0,0,0,.10)!important}
.main-column{background:transparent!important}.topbar{height:82px!important;padding:0 34px!important;background:rgba(255,255,255,.86)!important;backdrop-filter:blur(20px) saturate(150%)!important;border-bottom:1px solid rgba(206,218,232,.8)!important;box-shadow:0 6px 24px rgba(17,44,79,.035)!important}
.topbar-selectors label{padding:7px 10px!important;border-radius:10px!important}.topbar-selectors label:focus-within{background:#f3f7fd!important}.topbar-selectors select{color:#112642!important;font-weight:750!important}.user-chip>span{border-radius:12px!important;background:linear-gradient(145deg,#e9f2ff,#dceaff)!important;box-shadow:inset 0 0 0 1px #cfe0f8!important}
.content{padding-top:34px!important}.page-heading{padding:4px 2px 8px!important}.page-heading h1{font-size:clamp(26px,2.5vw,38px)!important;color:#10243e!important;font-weight:780!important;letter-spacing:-.04em!important}.page-heading p{font-size:12.5px!important;color:#687b93!important}.eyebrow{color:#1769e0!important;font-weight:800!important}
.panel{border-radius:18px!important;border:1px solid rgba(215,225,237,.92)!important;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(252,254,255,.98))!important;box-shadow:var(--joy-card-shadow)!important;padding:22px!important}.panel:hover{border-color:#cedceb!important}
.panel-heading{padding-bottom:2px!important}.panel-heading h2{font-size:16px!important;color:#142b49!important;font-weight:780!important}.muted-label{color:#71829a!important}
.metric-card{border-radius:16px!important;border:1px solid #dde6f1!important;background:linear-gradient(145deg,#fff,#f9fbfe)!important;box-shadow:0 8px 24px rgba(20,54,94,.06)!important;padding:17px!important;transition:transform .16s ease,box-shadow .16s ease!important}.metric-card:hover{transform:translateY(-2px)!important;box-shadow:0 14px 32px rgba(20,54,94,.09)!important}.metric-top i{border-radius:10px!important}.metric-card>strong{color:#102a48!important}
.primary-button,.secondary-button{min-height:38px!important;border-radius:10px!important;font-weight:760!important;letter-spacing:.005em!important}.primary-button{background:linear-gradient(180deg,#3a86f7,#1766da)!important;border-color:#1760ce!important;box-shadow:0 6px 16px rgba(31,104,218,.20)!important}.primary-button:hover{background:linear-gradient(180deg,#2f7deb,#145ac5)!important;transform:translateY(-1px)!important}.secondary-button{background:linear-gradient(180deg,#fff,#f7f9fc)!important;border-color:#d5dfeb!important;color:#4c6078!important}.secondary-button:hover{background:#f7fbff!important;border-color:#aebfd4!important;color:#1769e0!important}
input,select,textarea{border-radius:10px!important;border-color:#d8e2ed!important;background:#fff!important;transition:border-color .15s ease,box-shadow .15s ease,background .15s ease!important}input:focus,select:focus,textarea:focus{outline:none!important;border-color:#78aaf0!important;box-shadow:0 0 0 3px rgba(47,125,243,.11)!important;background:#fff!important}
.table-scroll{border-radius:14px!important;border:1px solid #e1e8f1!important;background:#fff!important}.data-table{border-collapse:separate!important;border-spacing:0!important}.data-table thead th{position:sticky;top:0;z-index:1;background:linear-gradient(180deg,#f4f8fd,#edf3f9)!important;color:#40536c!important;font-size:9px!important;font-weight:800!important;letter-spacing:.035em!important;text-transform:uppercase!important;border-bottom:1px solid #dbe5ef!important}.data-table tbody tr:nth-child(even){background:#fbfdff!important}.data-table tbody tr:hover{background:#f3f8ff!important}.data-table td{border-bottom-color:#edf1f6!important;color:#2c3e55!important}.data-table td strong{color:#122a47!important}
.form-grid label>span{color:#52667f!important;font-weight:720!important}.form-note,.rule-callout,.demo-banner,.success-banner,.locked-banner{border-radius:14px!important}.form-note{background:linear-gradient(135deg,#f7faff,#f2f7fd)!important;border:1px solid #dce7f5!important}
.period-chip{border-radius:11px!important;background:linear-gradient(180deg,#fff,#f7f9fc)!important;box-shadow:0 4px 12px rgba(17,45,78,.05)!important}
.modal-layer{backdrop-filter:blur(4px)!important}.modal-toolbar{background:rgba(255,255,255,.96)!important;backdrop-filter:blur(18px)!important;border-bottom:1px solid #e1e8f0!important}.room-report-modal,.id-card-modal{border-radius:20px!important;box-shadow:0 30px 80px rgba(7,27,51,.28)!important;overflow:hidden!important}
.record-action{border-radius:8px!important}.record-delete{background:#fff5f5!important}
@media(max-width:900px){.content{padding:22px 16px 38px!important}.panel{padding:17px!important;border-radius:15px!important}.topbar{padding:0 16px!important}.page-heading h1{font-size:26px!important}}
@media(prefers-reduced-motion:reduce){.nav-item,.metric-card,.primary-button{transition:none!important}}
`;
  await writeFile(path, source, "utf8");
}
console.log("Applied premium Joy Payroll UI styling without changing workflows or data behavior.");
