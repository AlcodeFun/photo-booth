/**
 * Self-contained gallery page served at GET /p/:token.
 * It fetches the session file list from the Worker and renders the framed
 * photo, the animated GIF, and the original photos in a layout modeled on the
 * admin "Session results" view: a header with QR / title / token / timestamp,
 * then framed outputs on the left and the photo grid on the right, with
 * download-all and per-photo selection. No external CDNs.
 */
export const renderGallery = (params: { token: string; qr: string | null; createdAt: number | null }): string => {
  const tokenJson = JSON.stringify(params.token);
  const createdAtJson = JSON.stringify(params.createdAt);
  const qrJson = JSON.stringify(params.qr);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>Hasil Foto Mu</title>
<style>
  :root { --pink:#ff4bb5; --purple:#a35ef6; --dark:#1a0b2e; --lime:#d9f85a; --panel:#241341; --card:#2b1a4a; }
  * { box-sizing:border-box; }
  html, body { margin:0; }
  body {
    min-height:100vh; color:#fff;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    background:
      radial-gradient(1100px 520px at 50% -10%, rgba(163,94,246,.28), transparent 60%),
      linear-gradient(180deg,#150b2c 0%, #1a0b2e 55%, #2b1055 100%);
  }
  .wrap { max-width:1152px; margin:0 auto; padding:0 18px 72px; }

  /* Header — mirrors the admin results modal header (QR + title + token). */
  .ghead { display:flex; flex-wrap:wrap; align-items:center; gap:16px; padding:20px 0 16px; border-bottom:1px solid rgba(255,255,255,.1); }
  .ghead-left { display:flex; align-items:center; gap:16px; min-width:0; }
  .gqr { width:64px; height:64px; border-radius:12px; background:#fff; padding:4px; flex-shrink:0; border:0; cursor:pointer; }
  .gqr:hover { transform:scale(1.05); }
  .gqr img { width:100%; height:100%; display:block; }
  .gqr.ph { display:grid; place-items:center; }
  .gqr.ph svg { width:30px; height:30px; opacity:.4; color:#fff; }
  .gtitles { min-width:0; }
  .gtitle { margin:0; font-size:1.3rem; font-weight:800; letter-spacing:-0.01em; }
  .gsub { margin:3px 0 0; font-size:.72rem; color:rgba(255,255,255,.55); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gsub .sep { padding:0 7px; }

  /* All-time/download controls (top-right of header, admin-style). */
  .ghead-right { margin-left:auto; display:flex; align-items:center; gap:10px; }

  /* Two-column layout: framed outputs (1/3) + photos (2/3). */
  .grid3 { display:grid; grid-template-columns:1fr; gap:28px; margin-top:26px; align-items:start; }
  @media (min-width:1024px){ .grid3 { grid-template-columns:1fr 2fr; gap:36px; } }
  .col-side { display:grid; gap:28px; align-content:start; min-width:0; }

  .card { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:18px; padding:16px; }
  .card h4 { display:flex; align-items:center; gap:7px; font-size:.78rem; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:rgba(255,255,255,.6); margin:0 0 12px; }
  .card h4 svg { width:16px; height:16px; flex-shrink:0; }
  .res { position:relative; display:block; overflow:hidden; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:var(--card); cursor:pointer; border:0; padding:0; width:100%; }
  .res.sq { aspect-ratio:1/1; background:rgba(0,0,0,.3); padding:10px; }
  .res.sq img { width:100%; height:100%; object-fit:contain; }
  .res img { width:100%; height:100%; display:block; transition:transform .15s ease; }
  .res:hover img { transform:scale(1.03); }
  .res .cap { position:absolute; left:0; right:0; bottom:0; display:flex; align-items:center; gap:6px; background:rgba(0,0,0,.7); padding:6px 9px; font-size:.76rem; font-weight:700; color:rgba(255,255,255,.92); text-align:left; }
  .res .cap svg { width:15px; height:15px; flex-shrink:0; }

  /* Photos column. */
  .col-main { min-width:0; }
  .ph-head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
  .ph-head h4 { display:flex; align-items:center; gap:7px; font-size:.78rem; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:rgba(217,248,90,.9); margin:0; }
  .ph-head h4 svg { width:16px; height:16px; }
  .ph-head .hint { font-size:.72rem; color:rgba(255,255,255,.5); }
  .pgrid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
  @media (min-width:640px){ .pgrid { grid-template-columns:repeat(3,1fr); } }
  @media (min-width:1150px){ .pgrid { grid-template-columns:repeat(4,1fr); } }
  .tile { position:relative; aspect-ratio:1/1; overflow:hidden; border:3px solid transparent; border-radius:12px; background:#000; cursor:pointer; }
  .tile img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .15s ease; }
  .tile:hover img { transform:scale(1.04); }
  .tile.sel { border-color:var(--pink); }
  .tile.sel img { opacity:.85; }
  .tile .badge { position:absolute; top:8px; left:8px; width:24px; height:24px; border-radius:50%; background:var(--pink); color:#fff; display:none; align-items:center; justify-content:center; font-size:12px; font-weight:900; z-index:2; }
  .tile.sel .badge { display:flex; }
  .eye { position:absolute; top:8px; right:8px; width:32px; height:32px; border-radius:50%; background:rgba(0,0,0,.55); color:#fff; display:flex; align-items:center; justify-content:center; border:2px solid rgba(255,255,255,.35); cursor:pointer; z-index:2; opacity:.85; transition:opacity .15s, transform .15s; }
  .eye:hover { transform:scale(1.1); opacity:1; }
  .eye svg { width:18px; height:18px; display:block; }

  .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; align-items:center; }
  .count { font-size:.78rem; font-weight:800; opacity:.9; margin-left:auto; }
  .btn { display:inline-flex; align-items:center; justify-content:center; background:var(--pink); color:#fff; font-weight:900; padding:10px 20px; border-radius:999px; text-decoration:none; font-size:.86rem; border:none; cursor:pointer; }
  .btn.sm { padding:7px 14px; font-size:.76rem; }
  .btn.ghost { background:rgba(255,255,255,.14); }
  .btn:disabled { opacity:.55; cursor:not-allowed; }
  .hidden { display:none !important; }

  /* "Outputs still being generated/uploaded" indicator. */
  .note { margin-top:26px; display:flex; gap:10px; align-items:center; justify-content:center; text-align:center; background:rgba(217,248,90,.12); border:2px solid rgba(217,248,90,.5); border-radius:14px; padding:12px 16px; font-size:.9rem; font-weight:800; color:#eaffc0; }
  .note.err { background:rgba(255,94,135,.12); border-color:rgba(255,94,135,.55); color:#ffd0e8; }
  .note .spin { display:inline-block; width:14px; height:14px; border:2px solid rgba(217,248,90,.4); border-top-color:#d9f85a; border-radius:50%; animation:spin 1s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }

  .status { text-align:center; padding:70px 0; opacity:.85; }
  .err { text-align:center; color:#ffd0e8; padding:70px 20px; font-weight:700; }
  @keyframes pulse { 50% { opacity:.35; } }
  .pulse { animation: pulse 1.2s ease-in-out infinite; }

  /* Fullscreen image viewer — keep the existing tap-to-enlarge modal. */
  .viewer { position:fixed; inset:0; z-index:50; background:rgba(10,5,25,.96); display:flex; align-items:center; justify-content:center; padding:24px; }
  .viewer img { max-width:92vw; max-height:78vh; width:auto; height:auto; border-radius:10px; background:#fff; box-shadow:0 12px 40px rgba(0,0,0,.55); }
  .viewer img.square { border-radius:0; }
  .viewer-close { position:absolute; top:16px; right:16px; width:46px; height:46px; border-radius:50%; border:none; background:var(--pink); color:#fff; font-size:1.25rem; font-weight:900; cursor:pointer; box-shadow:0 3px 10px rgba(0,0,0,.35); }
  .viewer-close:hover { transform:scale(1.08); }
  .viewer-bar { position:absolute; left:0; right:0; bottom:0; padding:18px 24px 22px; display:flex; align-items:center; justify-content:center; gap:14px; background:linear-gradient(0deg, rgba(10,5,25,.9), transparent); }
  .viewer-bar .name { font-size:.82rem; font-weight:700; opacity:.9; max-width:50%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .viewer .btn { margin-top:0; }

  /* Enlarged QR modal. */
  .qrmodal { position:fixed; inset:0; z-index:60; background:rgba(26,11,46,.95); display:none; align-items:center; justify-content:center; padding:20px; }
  .qrmodal.open { display:flex; }
  .qrmodal-box { width:min(360px,92vw); background:#fff; border:4px solid var(--pink); border-radius:18px; padding:22px; display:flex; flex-direction:column; align-items:center; gap:14px; animation:zoom .28s cubic-bezier(.2,.9,.3,1.2) both; }
  .qrmodal-box h2 { margin:0; font-size:.82rem; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:#4d2d85; text-align:center; }
  .qrmodal-box img { width:min(280px,70vw); height:auto; border-radius:12px; }
  .qrmodal-box p { margin:0; max-width:100%; overflow-wrap:anywhere; font-size:.62rem; font-weight:700; color:#4d2d85; text-align:center; }
  .qrmodal-box .btn { margin-top:2px; }
  @keyframes zoom { from { transform:scale(.85); opacity:0; } to { transform:scale(1); opacity:1; } }

  footer { text-align:center; margin-top:40px; opacity:.55; font-size:.8rem; }
</style>
</head>
<body>
<div class="wrap">
  <header class="ghead">
    <div class="ghead-left">
      ${
        params.qr
          ? `<button class="gqr" id="qrBtn" type="button" title="Show QR code" aria-label="Show QR code"><img src="${params.qr}" alt="QR code"/></button>`
          : `<div class="gqr ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>`
      }
      <div class="gtitles">
        <h1 class="gtitle">Hasil Foto Mu</h1>
        <p class="gsub"><span id="tokenText"></span><span class="sep">&middot;</span><span id="timeText"></span></p>
      </div>
    </div>
  </header>
  <div id="note"></div>
  <div id="content"><div class="status pulse">Loading your memories&hellip;</div></div>
  <footer>Photo Booth</footer>
</div>
<div class="viewer hidden" id="viewer" role="dialog" aria-modal="true" aria-label="Enlarged photo">
  <img id="viewerImg" src="" alt="Enlarged photo"/>
  <button class="viewer-close" id="viewerClose" type="button" aria-label="Close viewer">&#10005;</button>
  <div class="viewer-bar">
    <span class="name" id="viewerName"></span>
    <a class="btn" id="viewerDl" href="#" download>Download</a>
  </div>
</div>
<div class="qrmodal" id="qrmodal" role="dialog" aria-modal="true" aria-label="QR code">
  <div class="qrmodal-box" id="qrmodalBox">
    <h2>Scan untuk unduh</h2>
    <img id="qrFull" src="" alt="Large QR code"/>
    <p id="qrUrl"></p>
    <button class="btn" id="qrClose" type="button">Tutup</button>
  </div>
</div>
<script>
const TOKEN = ${tokenJson};
const CREATED_AT = ${createdAtJson};
const QR = ${qrJson};

const store = { files: [], photos: [] };

// Booth progress signals. print-request/print-result.json carry the timed
// flow's "customer arranged, booth is generating outputs" lifecycle; upload
// activity (file-key changes observed while this page is open) covers the
// non-timed flow which streams all outputs up in one shot.
const CONTROL = { printRequest: null, printResult: null };
let changeCount = 0;
let lastChangeAt = 0;

function fetchJson(name) {
  return fetch(location.origin + '/d/' + TOKEN + '/' + name + '?ts=' + Date.now())
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; });
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return day + '/' + month + '/' + year + ' ' + hour + ':' + minute;
}

function downloadUrl(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

const EYE_SVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>';
const ICON_IMAGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
const ICON_GIF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7.5 10h1.5v4H7.5z"/><path d="M11 10v4"/><path d="M11 12h2.5"/></svg>';

// Browsers only honor a limited number of programmatic downloads per gesture,
// so trigger them one at a time with a short gap and show progress on the
// invoking button. Otherwise only the last file (the GIF) would download.
async function downloadMany(items, btnId) {
  const btn = document.getElementById(btnId);
  if (!btn || items.length === 0) return;
  const original = btn.textContent;
  btn.disabled = true;
  try {
    for (let i = 0; i < items.length; i++) {
      if (i > 0) await sleep(400);
      btn.textContent = 'Downloading ' + (i + 1) + ' / ' + items.length;
      downloadUrl(items[i].url, items[i].name);
    }
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}

function tileHtml(item, i) {
  return '<div class="tile" data-i="' + i + '" role="button" tabindex="0" aria-checked="false" aria-label="Select photo ' + (i + 1) + '">' +
    '<span class="badge">&#10003;</span>' +
    '<button class="eye" type="button" data-url="' + item.url + '" data-name="' + item.name + '" title="View larger" aria-label="View photo ' + (i + 1) + ' larger">' + EYE_SVG + '</button>' +
    '<img src="' + item.url + '" alt="Photo ' + (i + 1) + '" loading="lazy"/>' +
    '</div>';
}

// Framed output card (mirrors the admin results modal's ResultLink).
function resCard(icon, title, url, alt, label, square) {
  return '<div class="card">' +
    '<h4>' + icon + title + '</h4>' +
    '<button type="button" class="res' + (square ? ' sq' : '') + '" data-url="' + url + '" data-name="' + label + '" title="View larger">' +
      '<img src="' + url + '" alt="' + alt + '"/>' +
      '<span class="cap">' + icon + label + '</span>' +
    '</button>' +
  '</div>';
}

function syncActions() {
  const tiles = document.querySelectorAll('.tile.sel');
  const btnSel = document.getElementById('dlSelected');
  const btnAll = document.getElementById('selAll');
  const cnt = document.getElementById('selCount');
  if (btnSel) {
    btnSel.classList.toggle('hidden', tiles.length === 0);
    btnSel.textContent = 'Download selected (' + tiles.length + ')';
  }
  if (btnAll) {
    const all = store.photos.length > 0 && tiles.length === store.photos.length;
    btnAll.textContent = all ? 'Clear all' : 'Select all';
  }
  if (cnt) cnt.textContent = tiles.length + ' / ' + store.photos.length + ' selected';
}

function toggleSel(i) {
  const tile = document.querySelectorAll('.tile')[i];
  if (!tile) return;
  tile.classList.toggle('sel');
  tile.setAttribute('aria-checked', tile.classList.contains('sel') ? 'true' : 'false');
  syncActions();
}

function selectAllToggle() {
  const tiles = document.querySelectorAll('.tile');
  const any = document.querySelectorAll('.tile:not(.sel)').length > 0;
  tiles.forEach(function (t) {
    t.classList.toggle('sel', any);
    t.setAttribute('aria-checked', any ? 'true' : 'false');
  });
  syncActions();
}

function downloadAll() {
  downloadMany(store.files, 'dlAll');
}

function downloadSelected() {
  const items = [];
  document.querySelectorAll('.tile.sel').forEach(function (t) {
    const item = store.photos[Number(t.dataset.i)];
    if (item) items.push(item);
  });
  downloadMany(items, 'dlSelected');
}

function closeViewer() {
  document.getElementById('viewer').classList.add('hidden');
}

function openViewer(url, name) {
  const img = document.getElementById('viewerImg');
  img.src = url;
  // Raw captured photos stay square; framed/GIF results keep their rounding.
  img.classList.toggle('square', /photo-[0-9]+[.](jpe?g|png)$/i.test(name));
  document.getElementById('viewerName').textContent = name;
  const dl = document.getElementById('viewerDl');
  dl.href = url;
  dl.setAttribute('download', name);
  document.getElementById('viewer').classList.remove('hidden');
}

// The viewer + QR modal are static markup — wire their listeners once at
// startup so the polling re-renders below never stack duplicate listeners.
document.getElementById('viewer').addEventListener('click', function (e) {
  if (e.target.id === 'viewer') closeViewer();
});
document.getElementById('viewerClose').addEventListener('click', closeViewer);
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeViewer();
    document.getElementById('qrmodal').classList.remove('open');
  }
});
const qrBtn = document.getElementById('qrBtn');
if (qrBtn) {
  qrBtn.addEventListener('click', function () {
    if (!QR) return;
    document.getElementById('qrFull').src = QR;
    document.getElementById('qrUrl').textContent = location.href;
    document.getElementById('qrmodal').classList.add('open');
  });
}
document.getElementById('qrmodal').addEventListener('click', function (e) {
  if (e.target.id === 'qrmodal') document.getElementById('qrmodal').classList.remove('open');
});
document.getElementById('qrClose').addEventListener('click', function () {
  document.getElementById('qrmodal').classList.remove('open');
});

function wireViewer() {
  document.querySelectorAll('.res, .eye').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openViewer(btn.dataset.url, btn.dataset.name);
    });
  });
}

function wireActions() {
  document.getElementById('selAll').addEventListener('click', selectAllToggle);
  document.getElementById('dlAll').addEventListener('click', downloadAll);
  document.getElementById('dlSelected').addEventListener('click', downloadSelected);
  document.querySelectorAll('.tile').forEach(function (t, i) {
    t.addEventListener('click', function (e) {
      if (e.target.closest('.eye')) return;
      toggleSel(i);
    });
    t.addEventListener('keydown', function (e) {
      if (e.target.closest('.eye')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSel(i);
      }
    });
  });
  syncActions();
}

// Live-populating gallery: the timed flow sends the customer straight here
// after arranging, while the booth may still be uploading outputs — keep
// polling so new files (framed.png, GIFs, ...) appear without a refresh.
const POLL_MS = 5000;
let lastKey = '';

/**
 * Whether the session is still producing outputs. Timed flow is driven by
 * print-request/print-result.json (the booth generates framed.png + GIFs only
 * AFTER the customer arranges, so print-result 'ok' is the completion signal);
 * the non-timed flow streams everything up at once, so observed upload
 * activity within the last few seconds is the signal there.
 */
function pendingNote(files) {
  if (files.length === 0) return null;
  var names = files.map(function (f) { return f.name; });
  if (CONTROL.printResult) {
    if (CONTROL.printResult.status === 'ok') return null;
    if (CONTROL.printResult.status === 'error') return 'error';
    return 'busy';
  }
  if (CONTROL.printRequest) {
    if (CONTROL.printRequest.status !== 'handled') return 'busy';
    if (names.indexOf('print-result.json') < 0) return 'busy';
    return null;
  }
  if (changeCount > 1 && Date.now() - lastChangeAt < 12000) return 'busy';
  return null;
}

function render(files) {
  const root = document.getElementById('content');
  const noteBox = document.getElementById('note');
  if (files.length === 0) {
    noteBox.innerHTML = '';
    root.innerHTML =
      '<div class="status pulse">Your photos are uploading &mdash; check back in a moment&hellip;</div>';
    return;
  }

  store.files = files.filter(function (f) {
    return !/^(meta|organize|print-request|print-result|live-clips)[.]json$/i.test(f.name);
  });

  const framed = store.files.filter(function (f) { return /framed[.]png$/i.test(f.name); });
  const liveGif = store.files.filter(function (f) { return /result-live[.]gif$/i.test(f.name); });
  const gif = store.files.filter(function (f) {
    return /[.]gif$/i.test(f.name) && !/result-live[.]gif$/i.test(f.name);
  });
  store.photos = store.files.filter(function (f) {
    return /[.](jpe?g|png)$/i.test(f.name) && !/framed[.]png$/i.test(f.name);
  });

  const note = pendingNote(files);
  if (note === 'busy') {
    noteBox.innerHTML =
      '<div class="note"><span class="spin"></span> Some outputs are still being generated &amp; uploaded &mdash; your photos are already here, more coming&hellip;</div>';
  } else if (note === 'error') {
    noteBox.innerHTML =
      '<div class="note err">Some outputs could not be generated. Please ask the booth attendant.</div>';
  } else {
    noteBox.innerHTML = '';
  }

  let side = '';
  if (framed.length) {
    side += resCard(ICON_IMAGE, 'Framed photo', framed[0].url, 'Framed photo', 'Framed', true);
  }
  if (liveGif.length) {
    side += resCard(ICON_GIF, 'Framed live photo', liveGif[0].url, 'Framed live version', 'Live', true);
  }
  if (gif.length) {
    side += resCard(ICON_GIF, 'Animated GIF', gif[0].url, 'Animated version', 'GIF', true);
  }

  let html = '<div class="grid3">';
  if (side) {
    html += '<div class="col-side">' + side + '</div>';
  }
  if (store.photos.length) {
    html += '<div class="col-main">' +
      '<div class="ph-head">' +
        '<h4>' + ICON_IMAGE + ' Photos (' + store.photos.length + ')</h4>' +
        '<span class="hint">Tap a photo to select, then download.</span>' +
      '</div>' +
      '<div class="pgrid">' + store.photos.map(tileHtml).join('') + '</div>' +
      '<div class="actions">' +
        '<button class="btn sm ghost" id="selAll" type="button">Select all</button>' +
        '<button class="btn sm hidden" id="dlSelected" type="button">Download selected</button>' +
        '<button class="btn sm" id="dlAll" type="button">Download all</button>' +
        '<span class="count" id="selCount">0 / ' + store.photos.length + ' selected</span>' +
      '</div>' +
    '</div>';
  }
  html += '</div>';
  root.innerHTML = html;
  wireViewer();
  if (store.photos.length) wireActions();
}

function initHead() {
  document.getElementById('tokenText').textContent = TOKEN;
  document.getElementById('timeText').textContent = formatTime(CREATED_AT);
}

async function main() {
  const root = document.getElementById('content');
  let res;
  try {
    res = await fetch('/api/sessions/' + TOKEN);
  } catch (_e) {
    // Transient network blip — keep polling instead of giving up.
    setTimeout(main, POLL_MS);
    return;
  }
  let data;
  try {
    data = await res.json();
  } catch (_e) {
    setTimeout(main, POLL_MS);
    return;
  }
  if (!res.ok || !data.files || data.exists === false) {
    root.innerHTML = '<div class="err">We could not find this session. It may have expired.</div>';
    return;
  }

  // Refresh the booth's progress signals alongside the file list so the
  // "still generating" indicator tracks the timed flow's arrange→generate
  // lifecycle even when no file is being added right now.
  const [requestFile, resultFile] = await Promise.all([
    fetchJson('print-request.json'),
    fetchJson('print-result.json'),
  ]);
  CONTROL.printRequest = requestFile;
  CONTROL.printResult = resultFile;

  const key = data.files
    .map(function (f) { return f.name + ':' + f.size; })
    .sort()
    .join(',');
  if (key !== lastKey) {
    lastKey = key;
    changeCount += 1;
    lastChangeAt = Date.now();
    render(data.files);
  }
  setTimeout(main, POLL_MS);
}
initHead();
main();
</script>
</body>
</html>`;
};