require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');

const host = process.env.ARUBA_HOST;
const port = Number(process.env.ARUBA_PORT || 22);
const username = process.env.ARUBA_USER;
const password = process.env.ARUBA_PASSWORD;
const pm2Name = process.env.ARUBA_PM2_NAME || 'abbraccio-backend';

const conn = new Client();

function connect() {
  return new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({ host, port, username, password, readyTimeout: 30000, keepaliveInterval: 5000 });
  });
}

function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.nvm/versions/node/v18/bin' } }, (err, stream) => {
      if (err) return reject(err);
      let out = '', stderr = '';
      stream.on('close', (code, signal) => resolve({ code, out, stderr }));
      stream.on('data', d => out += d.toString());
      stream.stderr.on('data', d => stderr += d.toString());
    });
  });
}

async function main() {
  if (!host || !username || !password) throw new Error('Credenziali Aruba mancanti in .env.deploy');
  await connect();
  console.log('Connessione SSH stabilita.\n');

  const files = [
    `~/.pm2/logs/${pm2Name}-error-0.log`,
    `~/.pm2/logs/${pm2Name}-out-0.log`,
  ];

  for (const f of files) {
    console.log(`--- ${f} ---`);
    const res = await exec(`tail -n 200 ${f} | grep -E 'Fatturazione POST|Error|errore|Exception' -A5 -B1 || tail -n 50 ${f}`);
    console.log(res.out || res.stderr || '(vuoto)');
    console.log('');
  }

  conn.end();
}

main().catch(e => {
  console.error('Errore fetch logs:', e.message || e);
  try { conn.end(); } catch {}
  process.exit(1);
});
