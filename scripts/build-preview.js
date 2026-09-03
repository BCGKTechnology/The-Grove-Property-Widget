// Builds preview.html by inlining public/widget.js into a standalone demo
// page with fetch() mocked, so it can be opened directly in a browser with
// no backend running.
//
// IMPORTANT: any literal "</script" sequence inside the inlined JS (even
// inside a comment or string) must be escaped, because the browser's HTML
// tokenizer looks for that raw byte sequence to end a <script> element —
// it does not parse the JS to know it's "just a comment". Un-escaped, it
// truncates the script tag early and everything after renders as plain text.
const fs = require('fs');
const path = require('path');

const widgetPath = path.join(__dirname, '..', 'public', 'widget.js');
const outPath = path.join(__dirname, '..', 'preview.html');
// Also written as index.html so the preview opens by default from a
// double-click, a "open folder" file browser, or `npx serve .` — no need to
// know the exact filename in advance.
const indexOutPath = path.join(__dirname, '..', 'index.html');

const widgetSrc = fs.readFileSync(widgetPath, 'utf-8');
const safeWidgetSrc = widgetSrc.replace(/<\/script/gi, '<\\/script');

const parts = [];
parts.push('<!doctype html>');
parts.push('<html lang="en">');
parts.push('<head>');
parts.push('<meta charset="utf-8" />');
// Without this, mobile browsers render the page as a 980px-wide desktop
// layout and auto-zoom it to fit the screen — which makes every mobile
// CSS fix in widget.js look shrunk on a real phone even though it's
// correct in the code. widget.js also injects this itself if a host page
// is missing it, but the preview page gets it directly since that's the
// realistic case (a real property page should already have this tag).
parts.push('<meta name="viewport" content="width=device-width, initial-scale=1" />');
parts.push('<title>Grove Widget Preview</title>');
parts.push('<style>');
parts.push('  body { margin:0; font-family: -apple-system, sans-serif; background:#f2efe9; }');
parts.push(
  "  .hero { height: 60vh; background: linear-gradient(rgba(0,0,0,0.15),rgba(0,0,0,0.15)), url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1600&auto=format&fit=crop') center/cover; display:flex; align-items:flex-end; padding:32px; box-sizing:border-box; }"
);
parts.push('  .hero h1 { color:#fff; font-size: 28px; margin:0; text-shadow: 0 2px 8px rgba(0,0,0,0.4); }');
parts.push('  .content { max-width: 700px; margin: 40px auto; padding: 0 24px; color:#2a332c; line-height:1.6; }');
parts.push(
  '  .banner { background:#fff8e6; border:1px solid #f0d98a; color:#6b5510; padding:12px 16px; border-radius:8px; font-size:13px; max-width:700px; margin:20px auto 0; }'
);
parts.push('</style>');
parts.push('</head>');
parts.push('<body>');
parts.push(
  '  <div class="banner"><strong>Preview note:</strong> this is a visual/interaction demo only. Form submissions here are mocked (no real email/CRM/API calls) since the backend isn\'t deployed yet. Placeholder brand color, dropdown options, and icon are marked TODO in the real code pending BCGK\'s brand assets.</div>'
);
parts.push('  <div class="hero"><h1>The Grove — a place to call home</h1></div>');
parts.push('  <div class="content">');
parts.push(
  '    <p>This stand-in page simulates what a RentCafe property page looks like behind the widget, so you can click around the floating action button exactly as a visitor would.</p>'
);
parts.push(
  '    <p>Try: opening on load (it auto-opens once when this page finishes loading), closing and reopening via the green button, tabbing through a form to check the focus trap, and pressing Escape to close.</p>'
);
parts.push('  </div>');
parts.push('  <script>');
parts.push('    // Mock fetch for /api/* calls so the demo works without a real backend.');
parts.push('    var realFetch = window.fetch.bind(window);');
parts.push('    window.fetch = function (url, opts) {');
parts.push("      if (typeof url === 'string' && url.indexOf('/api/') !== -1) {");
parts.push('        return new Promise(function (resolve) {');
parts.push('          setTimeout(function () {');
parts.push('            resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } });');
parts.push('          }, 700);');
parts.push('        });');
parts.push('      }');
parts.push('      return realFetch(url, opts);');
parts.push('    };');
parts.push('  </script>');
parts.push('  <script>');
parts.push(safeWidgetSrc);
parts.push('  </script>');
parts.push('</body>');
parts.push('</html>');
parts.push('');

const html = parts.join('\n');
fs.writeFileSync(outPath, html);
fs.writeFileSync(indexOutPath, html);
console.log('Wrote', outPath, '(' + fs.statSync(outPath).size + ' bytes)');
console.log('Wrote', indexOutPath, '(same content, so it opens by default)');
