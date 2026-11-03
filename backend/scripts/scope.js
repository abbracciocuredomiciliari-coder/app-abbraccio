require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = [
    'cd /var/www/app-abbraccio/backend/dist',
    'echo "=== ROUTES ==="; ls routes/ | grep -iE "iscrivi|famiglia|colloquio|consegne|riunioni|email|veloce|report"',
    'echo "=== INDEX MOUNTS ==="; grep -o "use(\"/api/[a-z-]*\"" index.js | sort -u',
    'echo "=== MODELS ==="; ls models/ | grep -iE "iscrivi|colloquio|consegn|riunioni|email|report"',
    'echo "=== GREP API in chunks ==="; cd ../frontend/dist/assets 2>/dev/null || cd /var/www/app-abbraccio/frontend/dist/assets; for f in IscrizioneIntermediazione-D_Qz27_2.js AreaFamiglia-BXU0uBwc.js ColloquioPubblico-DYUXDL-O.js ConsegneAmministrative-OvA_ZZo8.js PreventivoVeloce-C--essYa.js ReportConsegne-D90KTNSb.js RiunioniColloquio-dEgpAgE6.js ArchivioEmail-C9lblTVv.js; do echo "-- $f"; grep -oE "/api/[a-z0-9/_-]+" "$f" 2>/dev/null | sort -u | head -12; done',
    'echo "=== scrivi chunk ==="; ls | grep -iE "scrivi|consegna"',
  ].join('; ');
  conn.exec(cmd, { env: { PATH: '/usr/bin:/bin' } }, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => { console.log(out); conn.end(); });
    stream.stderr.on('data', d => process.stderr.write(d));
  });
}).on('error', e => { console.error('ERR', e.message); process.exit(1); }).connect({
  host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT || 22),
  username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000,
});
