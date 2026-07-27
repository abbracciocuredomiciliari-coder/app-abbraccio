require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.deploy') });
const { Client } = require('ssh2');

const host = process.env.ARUBA_HOST;
const port = Number(process.env.ARUBA_PORT || 22);
const username = process.env.ARUBA_USER;
const password = process.env.ARUBA_PASSWORD;
const remoteDir = process.env.ARUBA_REMOTE_PATH || '/var/www/app-abbraccio';
const backendDir = `${remoteDir}/backend`;

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

  const fixCmd = `
    echo "=== Copia .env in backend ===" && \
    cp ${remoteDir}/.env ${backendDir}/.env && \
    if ! grep -q '^NODE_ENV=' ${backendDir}/.env; then echo 'NODE_ENV=production' >> ${backendDir}/.env; fi && \
    echo "=== Aggiorno backend/dist ===" && \
    rm -rf ${backendDir}/dist && \
    cp -r ${remoteDir}/dist ${backendDir}/dist && \
    echo "=== Riavvio PM2 ===" && \
    pm2 restart abbraccio-backend && \
    sleep 6 && \
    echo "HEALTH:$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health)" && \
    echo "LOGIN:$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/api/auth/login)" && \
    echo "UNREAD:$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/messages/unread-count)"
  `;

  const result = await exec(fixCmd);
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
