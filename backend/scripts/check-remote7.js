require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = 'cd /var/www/app-abbraccio/frontend/dist/assets && for f in index-*.js; do if grep -l "area-famiglia" "$f" >/dev/null 2>&1; then echo "HAS-FAMIGLIA: $f"; fi; done; echo "---"; ls -lt index-*.js | head -8';
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
