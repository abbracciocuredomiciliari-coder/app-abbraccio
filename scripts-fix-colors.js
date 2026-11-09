// Sostituzione una tantum: vecchi blu hardcoded → variabili palette centrale
const fs = require('fs'), path = require('path');
const MAP = {
  '#0f1f3d': 'var(--nav-900)', '#1e3a5f': 'var(--nav-900)', '#312e81': 'var(--nav-900)',
  '#1a3a6b': 'var(--brand-800)', '#1e3a8a': 'var(--brand-800)', '#4338ca': 'var(--brand-800)', '#3730a3': 'var(--brand-800)',
  '#1e4d8c': 'var(--brand-700)', '#1e40af': 'var(--brand-700)',
  '#2563eb': 'var(--brand-600)', '#4f46e5': 'var(--brand-600)',
  '#3b82f6': 'var(--brand-500)', '#6366f1': 'var(--brand-500)',
  '#60a5fa': 'var(--brand-300)', '#93c5fd': 'var(--brand-300)',
  '#eff6ff': 'var(--brand-50)', '#dbeafe': 'var(--brand-100)', '#e0e7ff': 'var(--brand-100)', '#bfdbfe': 'var(--brand-200)',
  'rgba(30,77,140': 'rgba(28,113,100', 'rgba(37,99,235': 'rgba(28,113,100', 'rgba(30,58,138': 'rgba(21,90,80',
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let files = 0, subs = 0;
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!/\.(tsx?|css)$/.test(f)) continue;
    let s = fs.readFileSync(p, 'utf8'); const o = s;
    for (const [k, v] of Object.entries(MAP)) {
      const rx = new RegExp(esc(k), 'gi');
      const m = s.match(rx);
      if (m) { subs += m.length; s = s.replace(rx, v); }
    }
    if (s !== o) { fs.writeFileSync(p, s); files++; }
  }
}
walk(path.join(__dirname, 'frontend', 'src'));
console.log('file modificati:', files, '| sostituzioni:', subs);
