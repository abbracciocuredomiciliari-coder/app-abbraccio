// Lista processi PM2 + directory web sul server Aruba.
require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('pm2 list && echo "---WWW---" && ls /var/www/ && echo "---NGINX---" && ls /etc/nginx/sites-enabled/ 2>/dev/null', (err, stream) => {
    if (err) { console.error('exec error', err.message); process.exit(1); }
    stream.on('data', d => process.stdout.write(d)).on('close', () => conn.end());
    stream.stderr.on('data', d => process.stderr.write(d));
  });
}).on('error', e => { console.error('SSH error', e.message); process.exit(1); })
  .connect({ host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT || 22), username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000 });
