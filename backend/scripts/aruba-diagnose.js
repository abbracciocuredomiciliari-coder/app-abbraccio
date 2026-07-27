require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.deploy') });
const { Client } = require('ssh2');

const host = process.env.ARUBA_HOST;
const port = Number(process.env.ARUBA_PORT || 22);
const username = process.env.ARUBA_USER;
const password = process.env.ARUBA_PASSWORD;
const remoteDir = process.env.ARUBA_REMOTE_PATH || '/var/www/app-abbraccio';

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
      stream.on('close', (code) => resolve({ code, out, stderr }));
      stream.on('data', d => out += d.toString());
      stream.stderr.on('data', d => stderr += d.toString());
    });
  });
}

async function main() {
  if (!host || !username || !password) throw new Error('Credenziali Aruba mancanti');
  await connect();
  console.log('Connessione SSH stabilita.');
  const cmd = `echo "=== NODE PROCESSES ==="; ps aux | grep -i node | grep -v grep; echo "=== LISTENING PORTS ==="; ss -tlnp | grep node || netstat -tlnp 2>/dev/null | grep node; echo "=== DIRECTORY STRUCTURE ==="; ls -la ${remoteDir}; ls -la ${remoteDir}/backend 2>/dev/null || echo "no backend dir"; echo "=== PM2 STATUS ==="; pm2 list 2>/dev/null || echo "pm2 non disponibile"; echo "=== APP ENV ROOT ==="; grep -E '^(PORT|MONGODB_URI|ENCRYPTION_KEY|JWT_SECRET|NODE_ENV)=' ${remoteDir}/.env 2>/dev/null || echo "root .env non trovato"; echo "=== APP ENV BACKEND ==="; grep -E '^(PORT|MONGODB_URI|ENCRYPTION_KEY|JWT_SECRET|NODE_ENV)=' ${remoteDir}/backend/.env 2>/dev/null || echo "backend .env non trovato"`;
  const result = await exec(cmd);
  console.log(result.out);
  if (result.stderr) console.error('STDERR:', result.stderr);
  console.log('Exit code:', result.code);
  conn.end();
}

main().catch(e => {
  console.error('Errore:', e.message || e);
  try { conn.end(); } catch {}
  process.exit(1);
});
