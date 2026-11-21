<?php
require_once __DIR__ . '/../src/bootstrap.php';
appAuthenticate();
if (session_status() !== PHP_SESSION_ACTIVE) session_start(['cookie_httponly'=>true,'cookie_samesite'=>'Strict','use_strict_mode'=>true]);
$_SESSION['csrf'] ??= bin2hex(random_bytes(24));
try { $data = fetchDataset(); }
catch (Throwable $error) { http_response_code(503);header('Content-Type: text/plain; charset=utf-8');exit('Dashboard unavailable: ' . $error->getMessage()); }
$json = json_encode($data, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR);
header('Cache-Control: private, no-store');
?>
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>LCP | Pathology Census Explorer</title>
<style>
:root{color-scheme:light;--ink:#1c303b;--muted:#6d7c86;--line:#e3e9eb;--canvas:#f6f8f8;--panel:#fff;--teal:#047a70;--teal-dark:#07574f;--teal-soft:#e7f5f1;--amber:#ad6c12;--amber-soft:#fff7e8;--shadow:0 3px 16px rgba(25,55,63,.028)}*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--canvas);font-size:14px}button,input,select{font:inherit}button{cursor:pointer}a{color:inherit;text-decoration:none}body{min-width:315px}.shell{display:grid;grid-template-columns:237px minmax(0,1fr);min-height:100vh}.side{background:#fff;border-right:1px solid var(--line);padding:27px 14px;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;z-index:3}.logo{display:flex;align-items:center;gap:11px;padding:0 12px 31px}.logo-mark{display:grid;place-items:center;flex-shrink:0;width:35px;height:35px;background:#087e75;color:white;border-radius:11px;box-shadow:0 4px 10px #087e7522}.logo b{font-size:14px;letter-spacing:-.35px}.logo small{display:block;font-size:10px;color:#809098;margin-top:3px}.nav-kicker{font-size:10px;font-weight:700;letter-spacing:.10em;color:#9aa5aa;padding:0 13px;margin-bottom:11px}.nav{border:0;background:transparent;width:100%;text-align:left;display:flex;align-items:center;gap:12px;padding:11px 13px;margin:3px 0;color:#657983;font-weight:600;border-radius:9px;font-size:12px;white-space:nowrap}.nav:hover{background:#f2f6f6}.nav.active{background:#eaf6f2;color:#086c63}.nav svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}.spacer{flex:1}.source-status{margin:15px 4px 0;border:1px solid #e3eae8;border-radius:11px;padding:13px;background:#fbfcfc}.status-dot{width:7px;height:7px;border-radius:50%;background:#c28f3d;display:inline-block;margin-right:6px}.source-status b{font-size:11px}.source-status p{color:#70828a;font-size:11px;line-height:1.5;margin:7px 0 0}.main{max-width:1500px;width:100%;margin:0 auto;padding:31px 34px 60px}.topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:31px}.breadcrumb{font-size:11px;color:#83919a;display:flex;align-items:center;gap:9px}.breadcrumb strong{color:#34505b;font-weight:650}.top-actions{display:flex;align-items:center;gap:11px}.period{border:1px solid #dfebe7;background:#fff;color:#46626a;border-radius:8px;padding:9px 12px;white-space:nowrap;font-size:11px;font-weight:650}.sourcebtn{background:#fff;border:1px solid #dae5e6;border-radius:8px;padding:9px 12px;color:#116f68;font-weight:700;font-size:11px;white-space:nowrap}.eyebrow{color:#0b7d72;font-size:10px;letter-spacing:.12em;font-weight:780;text-transform:uppercase;margin:0 0 10px}.page-title{letter-spacing:-1.1px;font-size:31px;font-weight:750;line-height:1.15;margin:0 0 8px}.lead{color:#75858c;margin:0 0 23px;font-size:12px;line-height:1.6}.warning{background:#fffaed;border:1px solid #f3e2bd;border-left:3px solid #d69b44;border-radius:10px;padding:13px 17px;display:flex;align-items:flex-start;gap:12px;margin-bottom:18px}.warning strong{display:block;font-size:12px;color:#78511d;margin-bottom:3px}.warning p{margin:0;color:#907447;font-size:11px;line-height:1.55}.warn-ico{color:#a3741d;font-weight:900;padding-top:1px}.kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin:18px 0 15px}.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:20px;min-width:0}.kpi{min-height:136px}.kpi-label{font-size:11px;color:#73838a;font-weight:600}.kpi-value{font-size:29px;letter-spacing:-1.1px;font-weight:770;margin:14px 0 6px;line-height:1;white-space:nowrap}.kpi-meta{color:#819198;font-size:10.5px;line-height:1.4}.kpi-featured{background:#0b625c;border-color:#0b625c;color:white}.kpi-featured .kpi-label,.kpi-featured .kpi-meta{color:#b6e1d9}.grid2{display:grid;grid-template-columns:minmax(0,1.24fr) minmax(310px,.85fr);gap:15px;margin-top:15px}.col-stack{display:flex;flex-direction:column;gap:15px}.card-header{display:flex;justify-content:space-between;gap:12px;align-items:start;margin-bottom:20px}.card h3{font-size:14px;letter-spacing:-.3px;margin:0 0 5px;font-weight:745}.card .minor{font-size:11px;color:#89969d;line-height:1.5}.switcher{display:inline-flex;border:1px solid #e4e9eb;background:#f9fbfb;border-radius:7px;padding:3px;gap:2px}.switcher button{border:0;background:transparent;padding:6px 10px;border-radius:5px;color:#839099;font-size:10px;font-weight:700}.switcher button.active{background:white;color:#116a64;box-shadow:0 1px 3px #1234}.bar-row{display:grid;grid-template-columns:138px minmax(0,1fr) 68px;gap:10px;align-items:center;margin:14px 0}.bar-name{font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bar-bg{height:9px;background:#eef2f3;border-radius:3px;overflow:hidden}.bar-fill{height:100%;background:#a6ccc5;border-radius:3px;min-width:0}.bar-row:first-child .bar-fill{background:#087f74}.bar-val{text-align:right;font-size:11px;font-weight:680;font-variant-numeric:tabular-nums}.segmented{display:flex;gap:3px;height:14px;margin:19px 0 21px;border-radius:5px;overflow:hidden;background:#eef1f3}.segmented div{height:100%;min-width:0}.mix-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px 14px}.mix-item{display:flex;gap:8px;align-items:center;font-size:10.5px;color:#697b84}.swatch{width:8px;height:8px;border-radius:3px;flex-shrink:0}.mix-num{color:#183f43;font-weight:760;margin-left:auto;font-variant-numeric:tabular-nums}.insight{border-top:1px solid #eaf0f0;margin-top:20px;padding-top:14px;font-size:11px;line-height:1.65;color:#597179}.insight strong{color:#087f74}.flag-list{margin-top:12px}.flag{display:flex;align-items:center;gap:10px;justify-content:space-between;border-top:1px solid #edf0f1;padding:11px 0;font-size:11px}.flag:first-child{border-top:0}.flag b{font-weight:690}.flag small{display:inline-block;color:#9b681b;background:#fff4db;border-radius:5px;padding:3px 6px;font-size:9px;font-weight:650}.flag small.neutral{color:#537b80;background:#edf5f4}.section-heading{font-size:13px;font-weight:740;margin:27px 0 13px}.table-wrap{overflow-x:auto}.t{border-collapse:collapse;width:100%;font-size:11px;font-variant-numeric:tabular-nums}.t th{text-align:left;color:#83929b;padding:11px 10px;font-size:10px;font-weight:650;border-bottom:1px solid #e5ebed;white-space:nowrap}.t td{padding:11px 10px;border-bottom:1px solid #f0f3f3;color:#37515a}.t td strong{color:#203941}.t tbody tr:last-child td{border-bottom:0}.t tbody tr:hover{background:#f7faf9}.t .right{text-align:right}.t .rowlink{border:0;background:transparent;color:#147c72;font-size:11px;font-weight:650;padding:0;text-align:left;cursor:pointer}.t .rowlink:hover{text-decoration:underline}.pill{display:inline-block;color:#176f64;background:#e7f5f1;border:1px solid #d1e9e3;border-radius:5px;padding:3px 7px;font-weight:650;font-size:10px}.controlbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px}.search{border:1px solid #dfe6e8;border-radius:8px;background:#fff;min-width:210px;flex:1;padding:10px 12px;outline-color:#179081;font-size:12px}.select{border:1px solid #dfe6e8;border-radius:8px;background:#fff;padding:10px 12px;min-width:130px;font-size:11px;color:#34535b;outline-color:#179081}.smalltag{font-size:10px;color:#7d8c92;background:#f3f7f7;border:1px solid #e3eaea;padding:7px 8px;border-radius:6px}.quality-card{padding:17px 20px;margin-bottom:12px;display:grid;grid-template-columns:5px 1fr;gap:15px}.severity{width:5px;border-radius:4px;background:#d6a04d}.severity.med{background:#d6a04d}.severity.low{background:#7caea6}.quality-card b{font-size:13px}.quality-card p{font-size:12px;color:#687c84;line-height:1.6;margin:7px 0 0}.quality-card code{background:#f3f6f6;padding:2px 4px;border-radius:3px;color:#365c62}.source-foot{margin-top:24px;border-top:1px solid #e2e8ea;color:#84949a;padding-top:18px;font-size:10px;line-height:1.8}.detail-backdrop{position:fixed;inset:0;background:#12272c75;z-index:8;display:none}.drawer{position:fixed;top:0;right:0;width:min(520px,100vw);height:100dvh;overflow-y:auto;background:white;z-index:9;padding:28px;box-shadow:-15px 0 45px #183e3e2b;transform:translateX(110%);transition:transform .19s ease}.drawer.show{transform:translateX(0)}.detail-backdrop.show{display:block}.close{border:1px solid #dde7e8;background:#fff;border-radius:7px;padding:7px 11px;float:right;color:#61747e}.mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.mini{background:#f8faf9;padding:15px;border:1px solid #ebefef;border-radius:9px}.mini small{color:#819199;font-size:10px}.mini b{font-size:21px;display:block;margin-top:7px}.empty{padding:23px;text-align:center;color:#7e8b93;font-size:12px}.fine{font-size:11px;color:#82939b;line-height:1.6}.alertline{color:#8c621d;background:#fff8eb;padding:12px;border-radius:8px;border:1px solid #f6e8ca;font-size:11px;line-height:1.5}.onlymobile{display:none}
@media(max-width:1160px){.shell{grid-template-columns:204px 1fr}.main{padding:26px 24px 50px}.grid2{grid-template-columns:minmax(0,1fr) minmax(270px,.82fr)}.bar-row{grid-template-columns:105px minmax(0,1fr) 61px}.kpi-value{font-size:25px}}
@media(max-width:900px){.side{position:relative;height:auto;display:block;padding:10px 14px;border-right:0;border-bottom:1px solid var(--line)}.shell{display:block}.logo{padding:9px 8px}.nav-kicker,.source-status,.spacer{display:none}.menu{display:flex;gap:5px;overflow-x:auto}.nav{width:auto;white-space:nowrap;padding:10px;flex-shrink:0}.main{padding:21px 17px}.topbar{margin-bottom:23px}.onlymobile{display:block}.grid2{grid-template-columns:1fr}}
@media(max-width:600px){.main{padding:17px 12px 35px}.topbar{align-items:flex-start}.breadcrumb{display:none}.top-actions{width:100%;justify-content:space-between}.kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.kpi{min-height:116px;padding:15px}.kpi-value{font-size:24px}.page-title{font-size:26px}.card{padding:16px}.mix-grid{gap:12px 7px}.sourcebtn,.period{padding:8px 9px}.bar-row{grid-template-columns:100px minmax(0,1fr) 59px;gap:8px}.mini-grid{grid-template-columns:1fr 1fr}.drawer{padding:22px 17px}}

.period-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:18px 0 14px}
.interval-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:17px 0}
.interval-card{border:1px solid var(--line);background:#fff;border-radius:12px;padding:16px 15px;text-align:left;width:100%;color:inherit;cursor:pointer}
.interval-card.is-selected{outline:2px solid #168c80;outline-offset:0;border-color:#168c80;background:#f0faf7}
.interval-title{font-size:12px;font-weight:750;color:#344c55}
.interval-value{font-size:27px;font-weight:780;letter-spacing:-.8px;margin-top:9px;font-variant-numeric:tabular-nums}
.interval-caption{font-size:11px;color:#728590;margin-top:5px}
.interval-pill{font-size:10px;border-radius:5px;background:#f4f5f7;padding:4px 6px;display:inline-block;margin-top:9px;color:#5d6c75}
.interval-pill.review{background:#fff5e6;color:#93620e}
.period-view{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:11px 0}
.period-view button{border:1px solid #d9e4e4;border-radius:8px;padding:8px 12px;background:white;color:#42616a;font-size:12px}
.period-view button.active{background:#086f67;color:white;border-color:#086f67}
.period-note{border-left:3px solid #e6b05c;padding:10px 12px;background:#fffbf2;font-size:12px;line-height:1.65;color:#5f6458;margin:16px 0}
.period-table td.period-on{font-weight:750;background:#eff9f6;color:#0e6b64}
.period-table th{white-space:nowrap}
@media(max-width:1000px){.interval-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.interval-grid{gap:8px}.interval-card{padding:12px}.interval-value{font-size:23px}}

.logo{gap:7px;padding:0 5px 25px}.logo-mark{width:62px;height:48px;background:#fff;box-shadow:none;border-radius:6px}
.logo-mark img{width:100%;height:100%;object-fit:contain}.logo b{font-size:12px;line-height:1.2;letter-spacing:-.1px}
.logo small{font-size:9px;color:#60768b;line-height:1.3}
.lcp-brand-band{display:flex;align-items:center;justify-content:space-between;gap:16px;background:linear-gradient(120deg,#f5fbff,#eaf4fb 55%,white);border:1px solid #d9e6f0;border-top:3px solid #226ca2;border-radius:10px;margin-bottom:20px;padding:15px 19px}
.lcp-institution{font-size:12px;font-weight:800;letter-spacing:.065em;color:#174b7f}
.lcp-department{font-size:12px;font-weight:700;color:#305773;margin-top:4px}
.lcp-location{font-size:10px;color:#6b8495;margin-top:3px}
.lcp-module-label{font-size:9px;color:#1d5a89;font-weight:750;letter-spacing:.06em;white-space:nowrap;background:#e1eef8;border:1px solid #cbdfee;border-radius:7px;padding:7px 10px}
.report-form{max-width:770px;padding:23px}.report-form form{display:flex;flex-direction:column;align-items:flex-start;gap:12px;margin-top:18px}
.report-form label{font-size:12px;font-weight:700;color:#3e6173}.report-form select{min-width:min(100%,430px);width:100%;max-width:490px}
.report-appendix{display:flex;align-items:center;gap:9px;line-height:1.5}.report-appendix input{width:16px;height:16px;accent-color:#155e91}
.report-preview-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;width:100%;margin:5px 0}
.report-preview-grid>div{background:#f3f8fa;border:1px solid #e0ebf1;border-radius:8px;padding:14px 12px}
.report-preview-grid span{display:block;font-size:10px;color:#688291}.report-preview-grid b{display:block;font-size:20px;margin-top:5px;color:#1d527a}
.report-primary{background:#185f91;border:1px solid #185f91;color:white;border-radius:8px;padding:12px 18px;font-weight:750}
@media(max-width:700px){.lcp-brand-band{flex-direction:column;align-items:flex-start;gap:9px}.report-preview-grid{grid-template-columns:1fr 1fr}.top-actions{flex-wrap:wrap}.top-actions .sourcebtn{flex:1 1 auto;text-align:center}}

.batchbar{display:flex;flex-wrap:wrap;align-items:center;gap:9px;background:#f0f7fc;border:1px solid #cadae6;border-left:4px solid #1f6d9f;border-radius:9px;padding:12px 14px;margin-bottom:18px}
.batchbar>div{flex:1 1 230px;display:flex;flex-direction:column;gap:5px}.batchbar strong{font-size:12px;color:#215878}.batchbar span{font-size:11px;color:#638198;line-height:1.45}
.batch-save{background:#155d92;border:0;color:white;padding:11px 14px;border-radius:8px;font-size:11px;font-weight:750}
.batch-save:disabled,.sourcebtn:disabled{opacity:.45;cursor:not-allowed}
.t tr.is-staged{background:#eef8ff}.staged-marker{display:block;font-size:9px;color:#186a97;font-weight:750;padding-top:3px}
.php-edit-form{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:18px}
.php-edit-form label{display:flex;flex-direction:column;gap:5px;color:#4b6876;font-size:11px;font-weight:750}
.php-edit-form input,.php-edit-form select{background:white;border:1px solid #d4e0e5;border-radius:7px;padding:10px;color:#233f4f;min-width:0}
.php-edit-form .full{grid-column:1/-1}.row-buttons{display:flex;justify-content:flex-end;gap:8px}
.record-total{background:#f2f8fa;padding:12px;border-radius:7px;color:#516e7c;font-size:12px}
.record-total strong{color:#174d72}.batch-review{margin:12px 0;border-bottom:1px solid #e6edef;padding:12px 0;font-size:11px;line-height:1.6}
.batch-review div{display:flex;flex-direction:column;gap:3px;margin:6px 0}.batch-review span{color:#526e7d}
@media(max-width:560px){.php-edit-form{grid-template-columns:1fr}.batchbar .batch-save{flex:1 1 100%}}
</style></head>
<body><div class="shell"><aside class="side"><div class="logo"><div class="logo-mark"><img src="data:image/webp;base64,UklGRuoEAABXRUJQVlA4IN4EAABwGQCdASpoADgAPsFQoUwnpKMiLJF+GPAYCWYAyBim0JSgbH3Og+v4lIT2/fO6t6r/Vct8fi/tPNj9PPGHam3y/RvBlvgtVNWBNG8p2bMxc1t8MLne3d7n+9pLitmylHF8GqrgZMwJtJLlC4gEWqLJ4Cx+M5BkshX4aCJqAr4TwBjZe3aDQWI3BFgHPC9YJxEtpG8NG9aOzxcisEOTEMLvZtctBSFQ4F0OLuESm/uj7l4TBk9QikDknh4MVkQnpAQeNxPWNnWPXZIn+YwJooeOWMh/AAD+/pOMW/UnViKtrj4EbjQ4Api7b1GUMtFRPFhSymgjiu6CzxRp5ehShohK4v4Q+/e/3o+ekL2cLA868WxEjDTB9dZbHkLT2CeJisDSdLNqcnh7Oob4zOwhiNnKLT5Q1+7O8l/FKlIZMVynlbJ6ng/fYmFF/qf23S/HUcjq4WQVFLpsc/u0xaZLuT7k4CuowIDrDok4GOF0x2rI9GmYg1wTtl2Vq16LduJGYZG+na53DuzGtxaFTz3qdqYk9PcweJOjRrIqbFFbwRMq/j5zMCTAI+YapITdypDb56POSLXUSLentRAXd/Sa1R2rdBQFxeZ6oGxbM3HdtBvAtYjpeOqx3w+Vxb4Tkr7jbC/v8VV0kYi9rSOu8TwM8z8htB+hXQq+O673SrE5DLicuGfYXzaTM38KFLMQBNB+dcdPIa+HPUMh9ZsawgJ53vi8tBHjGsuH+zvrP9RjGciMrv00mfXEF3i8P3TEzdJtKGOdGkjZpbKVddWouLLSrvMiAUkPP/g5a3ymJLe8606gNJR/Sk+HtIinYexbUADg4P1gEoQG4AL2btSAHwuFZ/OroF8yMyf/pJ4ptqvwKFu+KohUlOzXGOvdAbtzokVMTe4KBuXO5Bj1aBZZFuGTGsu8PHk38DWvxR6aD+V4WIfSJ0x1YlCkDrWSHYLEmBta4bBPNOOJ3leSaL//3t9NAUbhU2P8tKSkEFv79Tq+kq6TMW4jkJBfZRaPi5E7G/NJyDTQh+P5KUmhnE0zmBaeImU0kJyMN3ZKgbXdLftn8OT5vagunspq+VqwdmUP+ZdXwfssh985tT1XxEA5bq/CanOqt8NQx8JY+B6WL5kErOP6UoPTzbkQumec2EGK9i1oXhJu79943aiPtpBAUq8y3CCA/eO62jnQlVlLqIp8tzjX4LK9o+kaWXPq3sh3xbFnHC0zHvTUnT1aKWux0OJMe3/V++wpHWN4arHzxkhgCEj25h20g1dhPwswUwZlMt1r9ZYA52fKh91mvw/eIxvmfGd7oFX8vxVXFvz4cbZWJTinJy3VA/34FD2ptey6TTJRNtedq41LRRBh5BHWP5A50aIjvN1uGYpn4RaGqP+SoX0XMErkm8v8wUHae/aON4R6090dRIVooCVfxtapLDbET71NycG4t513fl/4Cufa3BbbuLwWBnFSnqo0TcyWpO5lgZvVjafvyzB+g3/cu4inGIeq1j53DmE/vqNuCkNOkiRzJ+wB8l+AD/Og1bCKrLnpImdeyOpY75/5zB828EZj/ifOaOJYwWNKW1JAe9j40C1uWdmlMD5wozRQYqASy0agYV+P7yoW6SLTX93qfnS6kLetLQ/0A2yn6PnQwNK8lO2gc8j28MBIgt2v+OwBsQAA" alt="Lung Center of the Philippines emblem"></div><div><b>Pathology Census Explorer</b><small>Lung Center of the Philippines</small></div></div><div class="nav-kicker">WORKSPACE</div><div class="menu" id="navigation"><button class="nav active" data-nav="overview"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Overview</button><button class="nav" data-nav="periods"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 2v4m10-4v4M3 10h18"/></svg>Reporting intervals</button><button class="nav" data-nav="examinations"><svg viewBox="0 0 24 24"><path d="M5 5h14M5 10h14M5 15h14M5 20h9"/></svg>Examinations</button><button class="nav" data-nav="breakdown"><svg viewBox="0 0 24 24"><path d="M4 20V12m6 8V5m5 15v-9m5 9V8"/></svg>Workload &amp; income</button><button class="nav" data-nav="records"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 10h16M9 5v14"/></svg>Source records</button><button class="nav" data-nav="reports"><svg viewBox="0 0 24 24"><path d="M7 3h8l4 4v14H5V3zM14 3v5h5M8 12h8M8 16h8"/></svg>Formal reports</button><button class="nav" data-nav="quality"><svg viewBox="0 0 24 24"><path d="m12 2 9 4v6c0 6-4 9-9 10-5-1-9-4-9-10V6l9-4Z"/><path d="m8 12 2.5 2.5L16 9"/></svg>Data quality</button></div><div class="spacer"></div><div class="source-status"><div><span class="status-dot"></span><b><?php echo currentMode()==='live'?'Google Sheets connected':'Local sample preview'; ?></b></div><p><?php echo currentMode()==='live'?'Connected working-copy dataset':'Local fixture for testing report layouts'; ?></p></div></aside><main class="main"><div class="lcp-brand-band"><div><div class="lcp-institution">LUNG CENTER OF THE PHILIPPINES</div><div class="lcp-department">Pathology and Laboratory Medicine Department</div><div class="lcp-location">Quezon Avenue Extension, Quezon City, Philippines 1100</div></div><span class="lcp-module-label">IMMUNOLOGY CENSUS</span></div><div class="topbar"><div class="breadcrumb">LCP <span>/</span> Pathology and Laboratory Medicine <span>/</span> <strong>Immunology census</strong></div><div class="top-actions"><span class="period">December 2023</span><a class="sourcebtn" href="report.php?period=all">Generate A4 report</a><a class="sourcebtn" target="_blank" rel="noopener noreferrer" href="<?php echo htmlspecialchars($data['source']['google_sheets_url'], ENT_QUOTES); ?>">Open demo Sheet ↗</a> <button type="button" class="sourcebtn" onclick="location.reload()">Refresh data</button></div></div><div id="content"></div><div class="source-foot">Lung Center of the Philippines · Pathology and Laboratory Medicine Department · Immunology census.
<?php if(currentMode()!=='live'): ?><strong>Local sample-data preview.</strong> Connect the authorized Google Sheets working copy for current values.<?php else: ?>Connected to a separate working-copy spreadsheet. Original workbook remains unchanged.<?php endif; ?> <span style="color:#126a64">PHP implementation · controlled access</span></div></main></div><div class="detail-backdrop" id="backdrop"></div><div class="drawer" id="drawer"></div>
<script>
const DATA=<?php echo $json; ?>;
const WRITES_ENABLED=<?php echo currentMode()==='live' && getenv('APP_WRITE_ENABLED')==='1' ? 'true':'false'; ?>;
const CSRF=<?php echo json_encode($_SESSION['csrf']); ?>;
const S=DATA.summary_stats, EXAMS=DATA.exams, ENTRIES=DATA.entries, RECORDS=DATA.records||[];
const stagedChanges=new Map();
let recordSearch='',recordPeriod='all',recordGroup='all',recordPage=0,batchSaving=false,batchUnconfirmed=false,batchNotice='';
const pageSize=35;
const fmtInt=n=>Number(n).toLocaleString('en-PH'),fmtMoney=n=>'₱'+Number(n).toLocaleString('en-PH',{minimumFractionDigits:0,maximumFractionDigits:2});
const escapeHtml=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let activePage='overview',chartMetric='volume',tableQuery='',tableSort='volume',tableSortDir='desc';
const breakouts=[
 {label:'Inpatient · CHA',sec:'inpatient',prefix:'CHA',c:'#087f74'},
 {label:'Inpatient · PAY',sec:'inpatient',prefix:'PAY',c:'#49a89f'},
 {label:'Outpatient · CHA',sec:'outpatient',prefix:'CHA',c:'#88c5bb'},
 {label:'Outpatient · PAY',sec:'outpatient',prefix:'PAY',c:'#92a9b7'},
 {label:'QFS · employee section',sec:'operational',prefix:'QFS',c:'#c9ac75'}
].map(a=>({...a,rows:ENTRIES.filter(e=>e.section===a.sec && e.channel.startsWith(a.prefix)),get volume(){return this.rows.reduce((x,r)=>x+r.volume,0)},get income(){return this.rows.reduce((x,r)=>x+r.reported_income,0)}}));
function showPage(page){activePage=page;document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===page));render();window.scrollTo({top:0,behavior:'smooth'});}
document.getElementById('navigation').addEventListener('click',e=>{const b=e.target.closest('[data-nav]');if(b)showPage(b.dataset.nav)});
function pageIntro(eyebrow,title,subtitle){return `<div><p class="eyebrow">${eyebrow}</p><h1 class="page-title">${title}</h1><p class="lead">${subtitle}</p></div>`}
function card(title,inner){return `<section class="card"><div class="card-header"><div><h3>${title}</h3></div></div>${inner}</section>`}
function metricCard(label,val,note,primary=false){return `<section class="card kpi ${primary?'kpi-featured':''}"><div class="kpi-label">${label}</div><div class="kpi-value">${val}</div><div class="kpi-meta">${note}</div></section>`}
function barList(list,metric='volume',maxRows=7){let max=Math.max(...list.map(e=>e[metric]),1);return list.slice(0,maxRows).map((r,i)=>`<div class="bar-row"><div class="bar-name" title="${escapeHtml(r.test||r.label)}">${escapeHtml(r.test||r.label)}</div><div class="bar-bg"><div class="bar-fill" style="width:${r[metric]/max*100}%;background:${i===0?'#087f74':'#a7ccc5'}"></div></div><div class="bar-val">${metric==='volume'?fmtInt(r[metric]):fmtMoney(r[metric]).replace(/\.\d+$/,'')}</div></div>`).join('')}
function mixCard(){const t=breakouts.reduce((a,b)=>a+b.volume,0);return `<section class="card"><div class="card-header"><div><h3>Workload distribution</h3><div class="minor">Inpatient, outpatient and operational activity</div></div></div><div class="segmented">${breakouts.map(b=>`<div style="width:${100*b.volume/t}%;background:${b.c}" title="${b.label}: ${b.volume}"></div>`).join('')}</div><div class="mix-grid">${breakouts.map(b=>`<div class="mix-item"><span class="swatch" style="background:${b.c}"></span><span>${b.label.replace(' · employee section','')}</span><strong class="mix-num">${b.volume}</strong></div>`).join('')}</div><div class="insight">Patient-section examinations: <strong>${S.patient_volume}</strong>. Operational QFS: <strong>${S.qfs_volume}</strong>. The latter is kept separate from patient workload.</div></section>`}
function rankings(){const sorted=[...EXAMS].sort((a,b)=>b[chartMetric]-a[chartMetric]);const top=[...EXAMS].sort((a,b)=>b.volume-a.volume)[0];const n=top?top.volume:0;const p=S.total_volume>0?100*n/S.total_volume:0;const q=S.reported_income>0?100*(top?.reported_income||0)/S.reported_income:0;return `<section class="card"><div class="card-header"><div><h3>Highest-volume examinations</h3><div class="minor">${EXAMS.length} test categories · ranked by ${chartMetric==='volume'?'workload':'illustrative amount'}</div></div><div class="switcher"><button type="button" data-chart="volume" class="${chartMetric==='volume'?'active':''}">Volume</button><button type="button" data-chart="reported_income" class="${chartMetric==='reported_income'?'active':''}">Amount</button></div></div>${barList(sorted,chartMetric,7)}<div class="insight">${top?escapeHtml(top.test):'No tests'}: <strong>${fmtInt(n)} / ${fmtInt(S.total_volume)} examinations (${p.toFixed(1)}%)</strong>, accounting for <strong>${fmtMoney(top?.reported_income||0)} (${q.toFixed(1)}%)</strong> of the illustrative amount.</div></section>`}
function issuePreview(){return `<section class="card"><div class="card-header"><div><h3>Data checks</h3><div class="minor">Demonstration data policy</div></div><button class="sourcebtn" data-go="quality">Review all →</button></div><div class="flag-list"><div class="flag"><b>All records are synthetic</b><small>Demo</small></div><div class="flag"><b>Four reporting intervals supported</b><small class="neutral">Ready</small></div><div class="flag"><b>Original laboratory worksheets are excluded</b><small class="neutral">Isolated</small></div><div class="flag"><b>Amounts are illustrative only</b><small>Demo</small></div></div></section>`}
function overview(){const patient=ENTRIES.filter(e=>e.section!=='operational');const ip=patient.filter(e=>e.section==='inpatient').reduce((a,e)=>a+e.volume,0);const op=patient.filter(e=>e.section==='outpatient').reduce((a,e)=>a+e.volume,0);const statShare=S.patient_volume?S.stat_volume/S.patient_volume*100:0;return `${pageIntro('Immunology / synthetic demonstration','Immunology census overview','Demo-only examination activity and illustrative amounts, computed from the four reporting intervals.')}
<div class="warning"><span class="warn-ico">!</span><div><strong>Synthetic data — demonstration only</strong><p>This dataset is artificially generated. It must never be used as a clinical, billing, or laboratory activity report. In live mode, the source is the separate Google Sheets demo tab.</p></div></div>
<div class="kpi-grid">${metricCard('Total demo workload',fmtInt(S.total_volume),`${fmtInt(S.patient_volume)} patient-section + ${fmtInt(S.qfs_volume)} QFS`,true)}${metricCard('Patient-section examinations',fmtInt(S.patient_volume),`Inpatient ${fmtInt(ip)} · Outpatient ${fmtInt(op)}`)}${metricCard('Illustrative amount',fmtMoney(S.reported_income),'Not actual revenue')}${metricCard('STAT share of patient work',statShare.toFixed(1)+'%',`${fmtInt(S.stat_volume)} STAT · ${fmtInt(S.routine_volume)} routine`)}</div>
<div class="period-head"><div><strong>December 2023 demo reporting ranges</strong><div class="minor">Lab-defined periods, not separate months</div></div><button class="sourcebtn" data-go="periods">Explore intervals</button></div>${intervalPanel()}<div class="grid2">${rankings()}<div class="col-stack">${mixCard()}${issuePreview()}</div></div>
<div class="section-heading">Service breakdown</div><div class="card table-wrap">${mixTable()}</div>`}
function mixTable(){let rows=breakouts.map(b=>`<tr><td><strong>${escapeHtml(b.label)}</strong></td><td class="right">${fmtInt(b.volume)}</td><td class="right">${S.total_volume?(b.volume/S.total_volume*100).toFixed(1):'0.0'}%</td><td class="right">${fmtMoney(b.income)}</td></tr>`).join('');return `<table class="t"><thead><tr><th>Source category</th><th class="right">Examinations</th><th class="right">% of total</th><th class="right">Illustrative amount</th></tr></thead><tbody>${rows}<tr style="background:#f6faf8"><td><strong>Total</strong></td><td class="right"><strong>${fmtInt(S.total_volume)}</strong></td><td class="right"><strong>100.0%</strong></td><td class="right"><strong>${fmtMoney(S.reported_income)}</strong></td></tr></tbody></table>`}
function filteredExams(){let a=[...EXAMS].filter(x=>x.test.toLowerCase().includes(tableQuery.toLowerCase()));let key=tableSort;return a.sort((a,b)=>tableSortDir==='desc'?(b[key]-a[key]):(a[key]-b[key]));}
function examTable(){let x=filteredExams();return `<div class="card"><div class="controlbar"><input class="search" id="examSearch" placeholder="Search examination (e.g. CRP, CD4, HBsAg)" aria-label="Search examination" value="${escapeHtml(tableQuery)}"><select class="select" id="sortExams"><option value="volume" ${tableSort==='volume'?'selected':''}>Sort: workload</option><option value="reported_income" ${tableSort==='reported_income'?'selected':''}>Sort: income</option><option value="patient_volume" ${tableSort==='patient_volume'?'selected':''}>Sort: patient activity</option></select><span class="smalltag">${x.length} examinations</span></div><div class="table-wrap"><table class="t"><thead><tr><th>Examination</th><th class="right">All activity</th><th class="right">IP/OP</th><th class="right">STAT</th><th class="right">Routine</th><th class="right">QFS</th><th class="right">Illustrative amount</th></tr></thead><tbody>${x.map(a=>`<tr><td><button class="rowlink" data-exam="${escapeHtml(a.test)}">${escapeHtml(a.test)}</button></td><td class="right"><strong>${a.volume}</strong></td><td class="right">${a.patient_volume}</td><td class="right">${a.stat_volume}</td><td class="right">${a.routine_volume}</td><td class="right">${a.qfs_volume}</td><td class="right">${fmtMoney(a.reported_income)}</td></tr>`).join('')||`<tr><td colspan="7" class="empty">No matching examinations.</td></tr>`}</tbody></table></div><div class="fine" style="margin-top:17px">Select an examination to view synthetic category and priority breakdowns.</div></div>`}
function examinations(){return `${pageIntro('Examination register / '+EXAMS.length+' test categories','Examination explorer','Search, rank and drill into the demo examination data. These are simulated records.')}${examTable()}`}
function segmentCard(title,items,metric){let total=items.reduce((a,r)=>a+r[metric],0);return `<section class="card"><div class="card-header"><div><h3>${title}</h3><div class="minor">${metric==='volume'?'Examination counts':'Source-illustrative amount'}</div></div></div>${barList(items,metric,8)}<div class="insight">Total: <strong>${metric==='volume'?fmtInt(total):fmtMoney(total)}</strong></div></section>`}
function breakdown(){let services=breakouts.map(b=>({label:b.label,volume:b.volume,reported_income:b.income}));let urgent=[{label:'STAT',volume:S.stat_volume},{label:'Routine',volume:S.routine_volume}];let pay=['CHA','PAY','QFS'].map(x=>{let es=ENTRIES.filter(e=>e.payer===x);return {label:x,volume:es.reduce((a,e)=>a+e.volume,0),reported_income:es.reduce((a,e)=>a+e.reported_income,0)}});const ip=ENTRIES.filter(e=>e.section==='inpatient').reduce((a,e)=>a+e.volume,0),op=ENTRIES.filter(e=>e.section==='outpatient').reduce((a,e)=>a+e.volume,0);return `${pageIntro('Service analysis / synthetic December 2023','Workload and illustrative amounts','Inpatient/outpatient, billing and priority composition for demo data.')}
<div class="kpi-grid">${metricCard('Inpatient activity',fmtInt(ip),`${(ip/Math.max(1,S.total_volume)*100).toFixed(1)}% of demo tests`,true)}${metricCard('Outpatient activity',fmtInt(op),`${(op/Math.max(1,S.total_volume)*100).toFixed(1)}% of demo tests`)}${metricCard('STAT patient tests',fmtInt(S.stat_volume),`${(S.stat_volume/Math.max(1,S.patient_volume)*100).toFixed(1)}% of patient tests`)}${metricCard('Routine patient tests',fmtInt(S.routine_volume),`${(S.routine_volume/Math.max(1,S.patient_volume)*100).toFixed(1)}% of patient tests`)}</div>
<div class="grid2">${segmentCard('Workload by category',services,'volume')}${segmentCard('Illustrative amount by category',services,'reported_income')}</div><div class="grid2">${segmentCard('Patient examination priority',urgent,'volume')}${segmentCard('Billing categories (demo codes)',pay,'volume')}</div><div class="section-heading">Detailed category totals</div><div class="card table-wrap">${mixTable()}</div>`}
function quality(){return `${pageIntro('Governance / synthetic data','Data quality review','Synthetic records are deliberately isolated from real census worksheets.')}
<div class="kpi-grid">${metricCard('Demo count reconciliation','Pass',`${fmtInt(S.total_volume)} generated tests`,true)}${metricCard('Source isolation','Enabled','DEMO - Weekly Census tab only')}${metricCard('Test categories',fmtInt(EXAMS.length),'Simulated examinations')}${metricCard('Reporting periods','4','December 2023 demo')}</div>
<div class="warning"><span class="warn-ico">!</span><div><strong>Never interpret demo values as real pathology census data.</strong><p>Test counts and monetary amounts are artificial. Source connection requires Google API credentials on a private PHP server.</p></div></div>
<div class="card"><h3>Category totals</h3><div class="table-wrap">${mixTable()}</div></div>`}
function showExam(name){const t=EXAMS.find(x=>x.test===name);if(!t)return;const es=ENTRIES.filter(e=>e.test===name && e.volume>0);document.getElementById('drawer').innerHTML=`<button class="close" id="closeDrawer">Close ×</button><p class="eyebrow">Synthetic examination detail</p><h2 style="font-size:25px;letter-spacing:-.7px;margin:0 0 11px">${escapeHtml(name)}</h2><p class="fine">December 2023 demo · test counts, not unique patients</p><div class="mini-grid" style="margin:18px 0">${[['All activity',t.volume],['Patient-section',t.patient_volume],['STAT',t.stat_volume],['Illustrative amount',fmtMoney(t.reported_income)]].map(k=>`<div class="mini"><small>${k[0]}</small><b>${k[1]}</b></div>`).join('')}</div><h3 style="font-size:13px;margin:21px 0 10px">Demo category detail</h3><div class="table-wrap"><table class="t"><thead><tr><th>Section · billing · priority</th><th class="right">Count</th><th class="right">Amount</th>${WRITES_ENABLED?'<th>Edit</th>':''}</tr></thead><tbody>${es.map(e=>`<tr><td>${e.section==='inpatient'?'IP':e.section==='outpatient'?'OP':'Other'} · ${escapeHtml(e.channel)}</td><td class="right">${e.volume}</td><td class="right">${fmtMoney(e.reported_income)}</td>${WRITES_ENABLED?`<td><button class="sourcebtn editdemo" data-edit-row="${e.source_rows[selectedInterval]||''}" data-period="${INTERVALS[selectedInterval].label}" data-test="${escapeHtml(e.test)}" data-old="${e.weeks[selectedInterval]}">Edit selected interval</button></td>`:''}</tr>`).join('')||'<tr><td colspan="4">No demo examinations</td></tr>'}</tbody></table></div><p class="fine" style="margin-top:18px">Synthetic demo data only. Edit buttons, when enabled, update only the demo worksheet.</p>`;
document.getElementById('backdrop').classList.add('show');document.getElementById('drawer').classList.add('show');document.getElementById('closeDrawer').onclick=closeDrawer;
if(WRITES_ENABLED)document.querySelectorAll('.editdemo').forEach(b=>b.onclick=async()=>{if(!b.dataset.editRow)return;const n=prompt('New demo count for '+b.dataset.period+' (currently '+b.dataset.old+'):',b.dataset.old);if(n===null)return;const v=Number(n);if(!Number.isInteger(v)||v<0||v>100000){alert('Enter a non-negative whole number.');return;}try{const resp=await fetch('api/update.php',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({sheetRow:Number(b.dataset.editRow),count:v,expectedCount:Number(b.dataset.old),period:b.dataset.period,test:b.dataset.test,csrf:CSRF})});const result=await resp.json();if(!resp.ok||!result.success)throw new Error(result.error||'Update failed');location.reload();}catch(e){alert(e.message);}});
}
function closeDrawer(){document.getElementById('backdrop').classList.remove('show');document.getElementById('drawer').classList.remove('show')}
document.getElementById('backdrop').addEventListener('click',closeDrawer);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer()});

const INTERVALS=[{label:'Dec 1–7',date:'2023-12-01',n:0},{label:'Dec 8–14',date:'2023-12-08',n:1},{label:'Dec 15–21',date:'2023-12-15',n:2},{label:'Dec 22–31',date:'2023-12-22',n:3}];
let selectedInterval=0, periodSection='all';
function periodEntries(){return ENTRIES.filter(e=>periodSection==='all' || e.section===periodSection)}
function periodSums(rows){return INTERVALS.map((it,i)=>rows.reduce((n,e)=>n+(Number(e.weeks[i])||0),0))}
function periodTestRows(rows){let a=EXAMS.map(x=>({test:x.test, weeks:INTERVALS.map((it,i)=>rows.filter(e=>e.test===x.test).reduce((n,e)=>n+(Number(e.weeks[i])||0),0))}));return a.filter(x=>x.weeks.some(n=>n>0)).sort((a,b)=>b.weeks.reduce((s,n)=>s+n,0)-a.weeks.reduce((s,n)=>s+n,0))}
function intervalPanel(){const sums=periodSums(periodEntries());return `<div class="interval-grid">${INTERVALS.map((it,i)=>`<button class="interval-card ${i===selectedInterval?'is-selected':''}" data-interval="${i}" aria-pressed="${i===selectedInterval}"><div class="interval-title">${it.label}, 2023</div><div class="interval-value">${fmtInt(sums[i])}</div><div class="interval-caption">demo examinations</div><div class="interval-pill">Synthetic · not clinical</div></button>`).join('')}</div>`}
function periods(){const rows=periodEntries(),totals=periodSums(rows),tests=periodTestRows(rows),total=totals.reduce((a,b)=>a+b,0),selected=INTERVALS[selectedInterval];return `${pageIntro('Synthetic census / December 2023 demo','Reporting intervals','Four lab-defined date ranges; synthetic values are for interaction testing, not a verified trend.')}
<div class="period-note"><b>Synthetic test dataset:</b> All four December reporting intervals contain artificial records. The final range covers ten days, so raw counts are not normalized for duration.</div>
<div class="period-head"><div><strong>December 2023 · demo census periods</strong><div class="minor">Select an interval to inspect examination detail</div></div><span class="smalltag">Synthetic month</span></div>
<div class="period-view"><span class="minor">Activity source:</span>${[{id:'all',txt:'All categories'},{id:'inpatient',txt:'Inpatient'},{id:'outpatient',txt:'Outpatient'},{id:'operational',txt:'Employee / QC'}].map(o=>`<button data-period-section="${o.id}" class="${periodSection===o.id?'active':''}">${o.txt}</button>`).join('')}</div>
${intervalPanel()}
<div class="grid2"><section class="card"><div class="card-header"><div><h3>${selected.label} · examination detail</h3><div class="minor">${fmtInt(totals[selectedInterval])} demo examinations in current category</div></div></div><div class="insight">This interval contains artificial test counts for the dashboard demonstration.</div><div class="table-wrap"><table class="t"><thead><tr><th>Examination</th><th class="right">Selected interval</th><th class="right">December total</th></tr></thead><tbody>${tests.map(t=>`<tr><td><button class="rowlink" data-exam="${escapeHtml(t.test)}">${escapeHtml(t.test)}</button></td><td class="right ${t.weeks[selectedInterval]?'period-on':''}">${fmtInt(t.weeks[selectedInterval])}</td><td class="right">${fmtInt(t.weeks.reduce((a,b)=>a+b,0))}</td></tr>`).join('')||'<tr><td colspan="3">No test entries</td></tr>'}</tbody></table></div></section>
<section class="card"><div class="card-header"><div><h3>Demo reporting matrix</h3><div class="minor">All four lab-defined date ranges</div></div></div><div class="table-wrap"><table class="t period-table"><thead><tr><th>Period</th><th class="right">Count</th><th>Status</th></tr></thead><tbody>${INTERVALS.map((it,i)=>`<tr><td>${it.label}</td><td class="right">${fmtInt(totals[i])}</td><td>Synthetic</td></tr>`).join('')}<tr><td><b>December total</b></td><td class="right"><b>${fmtInt(total)}</b></td><td>Calculated</td></tr></tbody></table></div><div class="period-note">The periods are not equal length. For meaningful trend analysis, use verified real source data and normalize by day.</div></section></div>`}


const editFields=['test','patientGroup','billing','priority','count','rate'];
function recordInputs(record){return Object.fromEntries(editFields.map(f=>[f,record[f]]));}
function checkedRecord(values){
  return /^[A-Za-z0-9][A-Za-z0-9 .()+/_-]{0,79}$/.test(values.test) &&
    Number.isInteger(values.count)&&values.count>=0&&values.count<=100000 &&
    Number.isFinite(values.rate)&&values.rate>=0&&values.rate<=1000000 &&
    Math.abs(values.rate*100-Math.round(values.rate*100))<1e-6 &&
    ((['Inpatient','Outpatient'].includes(values.patientGroup)&&['CHA','PAY'].includes(values.billing)&&['STAT','ROUTINE'].includes(values.priority)) ||
     (values.patientGroup==='Employee'&&values.billing==='QFS'&&values.priority==='QFS'));
}
function recordOptions(options,selected){
  return options.map(x=>`<option value="${escapeHtml(x)}" ${x===selected?'selected':''}>${escapeHtml(x)}</option>`).join('');
}
function records(){
  const term=recordSearch.trim().toLowerCase();
  const matches=RECORDS.filter(r=>(recordPeriod==='all'||r.period===recordPeriod)&&
    (recordGroup==='all'||r.patientGroup===recordGroup)&&
    (!term||[r.test,r.billing,r.patientGroup,r.priority,String(r.sheetRow)].some(x=>String(x).toLowerCase().includes(term))));
  const pages=Math.max(1,Math.ceil(matches.length/pageSize));
  recordPage=Math.min(recordPage,pages-1);
  const visible=matches.slice(recordPage*pageSize,(recordPage+1)*pageSize);
  return `${pageIntro('Data management / Google Sheets','Source record editor','Edit existing examination records directly in the Explorer. Stage multiple changes, then save them together.')}
    <div class="warning"><span class="warn-ico">i</span><div><strong>What can be changed</strong>
      <p>Examination, patient group, billing, priority, count and rate (D:I). Reporting dates, formulas and metadata remain read-only. The original workbook is not modified.</p></div></div>
    ${!WRITES_ENABLED?'<div class="alertline">Preview mode: saving to Google Sheets is disabled. Enable authenticated live editing to modify records.</div>':''}
    <section class="card"><div class="controlbar">
      <input id="recordSearch" class="search" placeholder="Search examination, billing or row" value="${escapeHtml(recordSearch)}">
      <select id="recordPeriod" class="select">${recordOptions(['all',...INTERVALS.map(i=>i.label)],recordPeriod)}</select>
      <select id="recordGroup" class="select">${recordOptions(['all','Inpatient','Outpatient','Employee'],recordGroup)}</select>
      <span class="smalltag">${matches.length} source records</span></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Period / row</th><th>Examination</th><th>Group</th>
      <th>Billing · priority</th><th class="right">Count</th><th class="right">Rate</th><th class="right">Amount</th><th>Modify</th></tr></thead><tbody>
      ${visible.map(r=>{const staged=stagedChanges.get(r.sheetRow);const v=staged?{...r,...staged.values}:r;
        return `<tr class="${staged?'is-staged':''}"><td><strong>${escapeHtml(r.period)}</strong><div class="fine">Row ${r.sheetRow}</div></td>
         <td>${escapeHtml(v.test)}${staged?'<span class="staged-marker">UNSAVED</span>':''}</td>
         <td>${escapeHtml(v.patientGroup)}</td><td>${escapeHtml(v.billing)} · ${escapeHtml(v.priority)}</td>
         <td class="right">${fmtInt(v.count)}</td><td class="right">${fmtMoney(v.rate)}</td>
         <td class="right">${fmtMoney(v.count*v.rate)}</td>
         <td><button type="button" class="sourcebtn" data-edit-source="${r.sheetRow}" ${WRITES_ENABLED?'':'disabled'}>${staged?'Edit staged':'Edit'}</button></td></tr>`;
      }).join('')||'<tr><td colspan="8" class="empty">No matching records.</td></tr>'}
    </tbody></table></div><div class="period-head"><span class="fine">Page ${recordPage+1} of ${pages} · 35 records per page</span>
      <div><button class="sourcebtn" data-record-page="-1" ${recordPage===0?'disabled':''}>Previous</button>
      <button class="sourcebtn" data-record-page="1" ${recordPage>=pages-1?'disabled':''}>Next</button></div>
    </div></section>`;
}
function batchBar(){
  const n=stagedChanges.size;
  if(!n&&!batchNotice)return '';
  return `<div class="batchbar" role="status"><div><strong>${n} staged record${n===1?'':'s'}</strong>
    <span>${escapeHtml(batchNotice||'Pending changes are local until you select Save all.')}</span></div>
    ${n?`<button type="button" class="sourcebtn" data-review-batch>Review</button>
      <button type="button" class="sourcebtn" data-clear-batch ${batchSaving?'disabled':''}>Discard</button>
      <button type="button" class="batch-save" data-save-batch ${batchSaving||batchUnconfirmed?'disabled':''}>
        ${batchSaving?'Saving…':'Save all ('+n+')'}</button>`:''}
    ${batchUnconfirmed?'<button type="button" class="sourcebtn" data-reconcile-batch>Refresh to reconcile</button>':''}
  </div>`;
}
function editSourceRecord(rowNumber){
  if(!WRITES_ENABLED||batchSaving||batchUnconfirmed)return;
  const record=RECORDS.find(r=>r.sheetRow===rowNumber);
  if(!record)return;
  const starting={...(stagedChanges.get(rowNumber)?.values||recordInputs(record))};
  const combos={Inpatient:['CHA','PAY'],Outpatient:['CHA','PAY'],Employee:['QFS']};
  const drawer=document.getElementById('drawer');
  drawer.innerHTML=`<button type="button" class="close" id="closeDrawer">Close ×</button>
    <p class="eyebrow">Source record · staged editing</p>
    <h2 style="font-size:24px;margin:0 0 5px">${escapeHtml(record.test)}</h2>
    <p class="fine">${escapeHtml(record.period)}, 2023 · Sheet row ${record.sheetRow}</p>
    <form id="phpEditForm" class="php-edit-form">
      <label class="full">Examination <input name="test" maxlength="80" required value="${escapeHtml(starting.test)}"></label>
      <label>Patient group <select name="patientGroup">${recordOptions(['Inpatient','Outpatient','Employee'],starting.patientGroup)}</select></label>
      <label>Billing <select name="billing">${recordOptions(combos[starting.patientGroup],starting.billing)}</select></label>
      <label>Priority <select name="priority">${recordOptions(starting.patientGroup==='Employee'?['QFS']:['STAT','ROUTINE'],starting.priority)}</select></label>
      <label>Test count <input name="count" type="number" min="0" max="100000" step="1" required value="${starting.count}"></label>
      <label>Unit rate (₱) <input name="rate" type="number" min="0" max="1000000" step=".01" required value="${starting.rate}"></label>
      <div class="full record-total">Calculated amount: <strong id="phpCalculated">${fmtMoney(starting.count*starting.rate)}</strong></div>
      <div class="full row-buttons"><button type="button" class="sourcebtn" id="cancelRecord">Cancel</button>
        <button type="submit" class="batch-save">Stage change</button></div>
      <div id="phpEditError" class="fine full" role="alert"></div>
    </form>`;
  drawer.classList.add('show');document.getElementById('backdrop').classList.add('show');
  drawer.querySelector('#closeDrawer').addEventListener('click',closeDrawer);
  drawer.querySelector('#cancelRecord').addEventListener('click',closeDrawer);
  const form=drawer.querySelector('#phpEditForm');
  const field=name=>form.elements.namedItem(name);
  const values=()=>({
    test:field('test').value.trim(),patientGroup:field('patientGroup').value,
    billing:field('billing').value,priority:field('priority').value,
    count:Number(field('count').value),rate:Number(field('rate').value)
  });
  field('patientGroup').addEventListener('change',()=>{
    const group=field('patientGroup').value;
    field('billing').innerHTML=recordOptions(combos[group],combos[group][0]);
    field('priority').innerHTML=recordOptions(group==='Employee'?['QFS']:['STAT','ROUTINE'],
      group==='Employee'?'QFS':'STAT');
  });
  form.addEventListener('input',()=>{
    const v=values();drawer.querySelector('#phpCalculated').textContent=fmtMoney(v.count*v.rate);
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const v=values();
    if(!checkedRecord(v)){drawer.querySelector('#phpEditError').textContent='Invalid input or category combination.';return;}
    if(stagedChanges.size>=100&&!stagedChanges.has(rowNumber)){
      drawer.querySelector('#phpEditError').textContent='Maximum 100 source rows per batch.';return;
    }
    const original=recordInputs(record);
    if(editFields.every(f=>v[f]===original[f]))stagedChanges.delete(rowNumber);
    else stagedChanges.set(rowNumber,{sheetRow:rowNumber,period:record.period,expected:original,values:v});
    closeDrawer();batchNotice='Edit staged. Continue selecting records or Save all.';
    render();
  });
}
function reviewPHPBatch(){
  if(!stagedChanges.size)return;
  const drawer=document.getElementById('drawer');
  const changes=[...stagedChanges.values()].sort((a,b)=>a.sheetRow-b.sheetRow);
  drawer.innerHTML=`<button id="closeDrawer" class="close">Close ×</button>
    <p class="eyebrow">Review pending changes</p><h2>${changes.length} records</h2>
    <p class="fine">All changes will be submitted in one authenticated request. No cells are changed until Save all.</p>
    ${changes.map(c=>`<div class="batch-review"><strong>${escapeHtml(c.values.test)}</strong> · ${escapeHtml(c.period)} · Row ${c.sheetRow}
      <div>${editFields.filter(f=>c.expected[f]!==c.values[f]).map(f=>`<span>${escapeHtml(f)}: ${escapeHtml(c.expected[f])} → <b>${escapeHtml(c.values[f])}</b></span>`).join('')}</div>
      <button class="sourcebtn" data-drop-staged="${c.sheetRow}">Remove</button></div>`).join('')}
    <button class="batch-save" id="submitReviewedBatch">Save all ${changes.length} records</button>`;
  drawer.classList.add('show');document.getElementById('backdrop').classList.add('show');
  drawer.querySelector('#closeDrawer').addEventListener('click',closeDrawer);
  drawer.querySelectorAll('[data-drop-staged]').forEach(b=>b.addEventListener('click',()=>{
    stagedChanges.delete(Number(b.dataset.dropStaged));closeDrawer();render();if(stagedChanges.size)reviewPHPBatch();
  }));
  drawer.querySelector('#submitReviewedBatch').addEventListener('click',()=>{closeDrawer();savePHPBatch();});
}
async function savePHPBatch(){
  if(!WRITES_ENABLED||!stagedChanges.size||batchSaving||batchUnconfirmed)return;
  if(!confirm('Save all '+stagedChanges.size+' pending changes to Google Sheets?'))return;
  batchSaving=true;batchNotice='Validating source values and submitting the batch…';render();
  try{
    const response=await fetch('api/batch-update.php',{
      method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({csrf:CSRF,changes:[...stagedChanges.values()]})
    });
    const result=await response.json();
    if(!response.ok||!result.success||result.updatedCount!==stagedChanges.size)
      throw new Error(result.error||'Save could not be confirmed.');
    stagedChanges.clear();batchSaving=false;batchNotice='';
    location.reload();
  }catch(error){
    batchSaving=false;batchUnconfirmed=true;
    batchNotice='Save result uncertain or rejected: '+String(error?.message||error)+
      '. Refresh the dataset and verify affected rows before trying again.';
    render();
  }
}

let reportPeriod='all',reportDetail=false;
function reports(){
  const periodMeta=[{label:'Full coverage — Dec 1–31, 2023',id:'all'},
    ...INTERVALS.map((p,i)=>({label:p.label+', 2023',id:String(i)}))];
  const chosen=reportPeriod==='all'?null:INTERVALS[Number(reportPeriod)]?.label;
  const rows=RECORDS.filter(r=>chosen===null||r.period===chosen);
  const count=rows.reduce((total,r)=>total+Number(r.count||0),0);
  const amount=rows.reduce((total,r)=>total+Number(r.amount||0),0);
  const hasPending=stagedChanges.size>0||batchUnconfirmed||batchSaving;
  return `${pageIntro('Reporting / printable documentation','A4 formal census report',
    'Create a formal, print-ready report for one reporting interval or the complete December 2023 coverage.')}
    <div class="card report-form">
      ${hasPending?'<div class="alertline" role="alert">Staged or uncertain edits must be saved and reconciled before creating a new report. Generated reports include only saved source values.</div>':''}
      <p class="fine">Reports are generated from the current dataset with full examination-level totals, patient-group, priority and billing breakdowns. A detailed category appendix is optional.</p>
      <form method="get" action="report.php">
        <label for="reportPeriod">Reporting coverage</label>
        <select name="period" class="select" id="reportPeriod">
          ${periodMeta.map(p=>`<option value="${p.id}" ${reportPeriod===p.id?'selected':''}>${escapeHtml(p.label)}</option>`).join('')}
        </select>
        <label class="report-appendix"><input type="checkbox" name="detail" value="1" id="reportDetail" ${reportDetail?'checked':''}>
          Include full category-detail appendix (more A4 pages)</label>
        <div class="report-preview-grid">
          <div><span>Records in coverage</span><b>${fmtInt(rows.length)}</b></div>
          <div><span>Examinations</span><b>${fmtInt(count)}</b></div>
          <div><span>Calculated amount</span><b>${fmtMoney(amount)}</b></div>
        </div>
        <button type="submit" class="report-primary" ${hasPending?'disabled':''}>Generate A4 report</button>
      </form>
      <p class="fine">The report opens as an authenticated, printable A4 page. Select Print / Save PDF to create a PDF on your device. Sign-off fields are intentionally blank until verified.</p>
    </div>`;
}
function render(){document.getElementById('content').innerHTML=batchBar()+({overview,periods,examinations,breakdown,records,reports,quality})[activePage]();}
document.getElementById('content').addEventListener('click',e=>{
const row=e.target.closest('[data-edit-source]');if(row){editSourceRecord(Number(row.dataset.editSource));return;}
const pg=e.target.closest('[data-record-page]');if(pg){recordPage=Math.max(0,recordPage+Number(pg.dataset.recordPage));render();return;}
if(e.target.closest('[data-review-batch]')){reviewPHPBatch();return;}
if(e.target.closest('[data-save-batch]')){savePHPBatch();return;}
if(e.target.closest('[data-clear-batch]')){
  if(confirm('Discard all staged edits without saving?')){stagedChanges.clear();batchNotice='Unsaved edits discarded.';render();}return;
}
if(e.target.closest('[data-reconcile-batch]')){location.reload();return;}
const pi=e.target.closest('[data-interval]');if(pi){selectedInterval=Number(pi.dataset.interval);render();return;}const ps=e.target.closest('[data-period-section]');if(ps){periodSection=ps.dataset.periodSection;render();return;}const metric=e.target.closest('[data-chart]');if(metric){chartMetric=metric.dataset.chart;render();return;}const go=e.target.closest('[data-go]');if(go){showPage(go.dataset.go);return;}const exam=e.target.closest('[data-exam]');if(exam){showExam(exam.dataset.exam);return;}});
document.getElementById('content').addEventListener('input',e=>{if(e.target.id==='recordSearch'){
 const value=e.target.value,pos=e.target.selectionStart;recordSearch=value;recordPage=0;render();
 const input=document.getElementById('recordSearch');if(input){input.focus();input.setSelectionRange(pos,pos);}return;}
if(e.target.id==='examSearch'){tableQuery=e.target.value;const pos=e.target.selectionStart;document.getElementById('content').querySelector('tbody').innerHTML=filteredExams().map(a=>`<tr><td><button class="rowlink" data-exam="${escapeHtml(a.test)}">${escapeHtml(a.test)}</button></td><td class="right"><strong>${a.volume}</strong></td><td class="right">${a.patient_volume}</td><td class="right">${a.stat_volume}</td><td class="right">${a.routine_volume}</td><td class="right">${a.qfs_volume}</td><td class="right">${fmtMoney(a.reported_income)}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">No matching examinations.</td></tr>';}}
);
document.getElementById('content').addEventListener('change',e=>{
if(e.target.id==='recordPeriod'){recordPeriod=e.target.value;recordPage=0;render();return;}
if(e.target.id==='recordGroup'){recordGroup=e.target.value;recordPage=0;render();return;}
if(e.target.id==='reportPeriod'){reportPeriod=e.target.value;render();return;}
if(e.target.id==='reportDetail'){reportDetail=e.target.checked;render();return;}
if(e.target.id==='sortExams'){tableSort=e.target.value;render()}
});render();
window.addEventListener('beforeunload',event=>{
 if(stagedChanges.size>0||batchSaving){event.preventDefault();event.returnValue='';}
});
</script></body></html>
