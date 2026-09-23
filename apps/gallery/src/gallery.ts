/**
 * Self-contained gallery page served at GET /p/:token.
 * It fetches the session file list from the Worker and renders the framed
 * photo, the animated GIF, and the original photos (at their raw camera ratio)
 * with download-all and per-photo selection. No external CDNs.
 */
export const renderGallery = (token: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>Your Photo Booth Memories</title>
<style>
  :root { --pink:#ff4bb5; --purple:#7a2b8c; --dark:#1a0b2e; --lime:#d9f85a; }
  * { box-sizing:border-box; }
  body {
    margin:0; min-height:100vh;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(180deg, #2b1055 0%, var(--purple) 62%, var(--pink) 135%);
    color:#fff;
  }
  .wrap { max-width: 820px; margin: 0 auto; padding: 36px 18px 72px; }
  h1 { margin:0; text-align:center; font-weight:900; letter-spacing:-0.05em; font-size:clamp(1.5rem,5vw,2.4rem); line-height:1.1; }
  .sub { text-align:center; opacity:.82; margin:8px 0 0; }
  .card { background:rgba(255,255,255,.08); border:2px solid rgba(255,255,255,.18); border-radius:18px; padding:16px; margin-top:22px; }
  .lbl { font-size:.78rem; text-transform:uppercase; letter-spacing:.22em; opacity:.85; margin:0 0 12px; font-weight:800; }
  .hero { position:relative; }
  .hero img { width:100%; height:auto; border-radius:12px; display:block; background:#fff; }
  .hero-btn { width:100%; padding:0; border:none; background:none; cursor:pointer; display:block; border-radius:12px; }
  .hero-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
  .hero-head .lbl { margin:0; }
  .hero-head .btn { margin-top:0; }
  .eye { position:absolute; top:10px; right:10px; width:34px; height:34px; border-radius:50%; background:rgba(0,0,0,.55); color:#fff; display:flex; align-items:center; justify-content:center; border:2px solid rgba(255,255,255,.35); cursor:pointer; z-index:2; opacity:.85; transition:opacity .15s, transform .15s; }
  .eye:hover { transform:scale(1.1); opacity:1; }
  .eye svg { width:18px; height:18px; display:block; }
  .btn { display:inline-block; margin-top:12px; background:var(--pink); color:#fff; font-weight:900; padding:10px 20px; border-radius:999px; text-decoration:none; font-size:.9rem; border:none; cursor:pointer; }
  .btn.sm { padding:8px 14px; font-size:.8rem; margin-top:0; }
  .btn.ghost { background:rgba(255,255,255,.14); }
  .hidden { display:none !important; }
  /* Photos keep their raw camera ratio — masonry columns, never cropped. */
  .columns { columns:2; column-gap:14px; }
  @media (min-width:600px){ .columns { columns:3; } }
  .tile { position:relative; background:#000; border:4px solid transparent; overflow:hidden; margin-bottom:14px; break-inside:avoid; cursor:pointer; }
  .tile img { width:100%; height:auto; display:block; }
  .tile .badge { position:absolute; top:8px; left:8px; width:26px; height:26px; border-radius:50%; background:var(--pink); color:#fff; display:none; align-items:center; justify-content:center; font-size:13px; font-weight:900; z-index:2; }
  .tile.sel { border-color:var(--pink); }
  .tile.sel .badge { display:flex; }
  .tile.sel img { opacity:.85; }
  .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; align-items:center; }
  .count { font-size:.8rem; font-weight:800; opacity:.9; margin-left:auto; }
  .status { text-align:center; padding:70px 0; opacity:.85; }
  .err { text-align:center; color:#ffd0e8; padding:70px 20px; font-weight:700; }
  @keyframes pulse { 50% { opacity:.35; } }
  .pulse { animation: pulse 1.2s ease-in-out infinite; }
  /* Fullscreen image viewer — tap any result to enlarge, like the QR modal. */
  .viewer { position:fixed; inset:0; z-index:50; background:rgba(10,5,25,.96); display:flex; align-items:center; justify-content:center; padding:24px; }
  .viewer img { max-width:92vw; max-height:78vh; width:auto; height:auto; border-radius:10px; background:#fff; box-shadow:0 12px 40px rgba(0,0,0,.55); }
  .viewer img.square { border-radius:0; }
  .viewer-close { position:absolute; top:16px; right:16px; width:46px; height:46px; border-radius:50%; border:none; background:var(--pink); color:#fff; font-size:1.25rem; font-weight:900; cursor:pointer; box-shadow:0 3px 10px rgba(0,0,0,.35); }
  .viewer-close:hover { transform:scale(1.08); }
  .viewer-bar { position:absolute; left:0; right:0; bottom:0; padding:18px 24px 22px; display:flex; align-items:center; justify-content:center; gap:14px; background:linear-gradient(0deg, rgba(10,5,25,.9), transparent); }
  .viewer-bar .name { font-size:.82rem; font-weight:700; opacity:.9; max-width:50%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .viewer .btn { margin-top:0; }
  footer { text-align:center; margin-top:34px; opacity:.6; font-size:.8rem; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Your Photo Booth Memories</h1>
  <p class="sub">Your shots are ready &mdash; tap a photo to select it, then download.</p>
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
<script>
const TOKEN = ${JSON.stringify(token)};

const store = { files: [], photos: [] };

function section(title, html) {
  return '<div class="card"><p class="lbl">' + title + '</p>' + html + '</div>';
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

function heroView(url, alt, name) {
  return '<div class="hero">' +
    '<button type="button" class="hero-btn" data-url="' + url + '" data-name="' + name + '" title="View larger">' +
    '<img src="' + url + '" alt="' + alt + '"/></button>' +
    '<button type="button" class="eye" data-url="' + url + '" data-name="' + name + '" title="View larger" aria-label="View ' + alt.toLowerCase() + ' larger">' + EYE_SVG + '</button>' +
    '</div>';
}

function heroSection(title, url, alt, downloadName) {
  return '<div class="card">' +
    '<div class="hero-head">' +
      '<p class="lbl">' + title + '</p>' +
      '<a class="btn sm" href="' + url + '" download="' + downloadName + '">Download</a>' +
    '</div>' +
    heroView(url, alt, downloadName) +
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

function wireViewer() {
  document.getElementById('viewer').addEventListener('click', function (e) {
    if (e.target.id === 'viewer') closeViewer();
  });
  document.getElementById('viewerClose').addEventListener('click', closeViewer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeViewer();
  });
  document.querySelectorAll('.hero-btn, .eye').forEach(function (btn) {
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

async function main() {
  const root = document.getElementById('content');
  try {
    const res = await fetch('/api/sessions/' + TOKEN);
    const data = await res.json();
    if (!res.ok || !data.files) throw new Error('empty');
    // Session exists but nothing uploaded yet — photos may still be uploading.
    if (data.exists === false) {
      root.innerHTML = '<div class="err">We could not find this session. It may have expired.</div>';
      return;
    }
    if (data.files.length === 0) {
      root.innerHTML =
        '<div class="status pulse">Your photos are uploading &mdash; check back in a moment&hellip;</div>';
      setTimeout(main, 5000);
      return;
    }
    store.files = data.files.filter(function (f) {
      return !/^/(meta|organize|print-request|print-result)[.]json$/.test('/' + f.name);
    });

    const framed = store.files.filter(function (f) { return /framed[.]png$/i.test(f.name); });
    const liveGif = store.files.filter(function (f) { return /result-live[.]gif$/i.test(f.name); });
    const gif = store.files.filter(function (f) {
      return /[.]gif$/i.test(f.name) && !/result-live[.]gif$/i.test(f.name);
    });
    store.photos = store.files.filter(function (f) {
      return /[.](jpe?g|png)$/i.test(f.name) && !/framed[.]png$/i.test(f.name);
    });

    let html = '';
    if (framed.length) {
      html += heroSection('Framed photo', framed[0].url, 'Framed photo', framed[0].name);
    }
    if (liveGif.length) {
      html += heroSection('Framed live photo', liveGif[0].url, 'Framed live version', liveGif[0].name);
    }
    if (gif.length) {
      html += heroSection('Animated GIF', gif[0].url, 'Animated version', gif[0].name);
    }
    if (store.photos.length) {
      html += section('All photos',
        '<div class="columns">' + store.photos.map(tileHtml).join('') + '</div>' +
        '<div class="actions">' +
          '<button class="btn sm ghost" id="selAll" type="button">Select all</button>' +
          '<button class="btn sm hidden" id="dlSelected" type="button">Download selected</button>' +
          '<button class="btn sm" id="dlAll" type="button">Download all</button>' +
          '<span class="count" id="selCount">0 / ' + store.photos.length + ' selected</span>' +
        '</div>');
    }
    root.innerHTML = html;
    wireViewer();
    if (store.photos.length) wireActions();
  } catch (e) {
    root.innerHTML = '<div class="err">We could not find this session. It may have expired.</div>';
  }
}
main();
</script>
</body>
</html>`;