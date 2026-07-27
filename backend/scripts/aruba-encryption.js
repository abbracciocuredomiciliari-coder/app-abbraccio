require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.deploy') });
const { Client } = require('ssh2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const host = process.env.ARUBA_HOST;
const port = Number(process.env.ARUBA_PORT || 22);
const username = process.env.ARUBA_USER;
const password = process.env.ARUBA_PASSWORD;
const suggested = process.env.ARUBA_REMOTE_PATH;

const conn = new Client();

function connect() {
  return new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({ host, port, username, password, readyTimeout: 30000 });
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

function getSftp() {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      resolve(sftp);
    });
  });
}

function stat(sftp, p) {
  return new Promise(resolve => {
    sftp.stat(p, (err, stats) => resolve({ err, stats }));
  });
}

function fastPut(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, err => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function findRemoteDir(sftp) {
  const candidates = [];
  const domains = [process.env.ARUBA_DOMAIN || 'app.abbracciocuredomiciliari.it', 'app-abbraccio', 'abbraccio'];
  for (const domain of domains) {
    candidates.push(`/var/www/${domain}`, `/var/www/vhosts/${domain}/httpdocs`, `/var/www/vhosts/${domain}/app`, `/var/www/html/${domain}`);
  }
  candidates.push('/var/www/html', '/var/www/app-abbraccio', '/root/app-abbraccio', '/opt/app-abbraccio', suggested);
  for (const c of candidates) {
    if (!c) continue;
    const { err } = await stat(sftp, `${c}/package.json`);
    if (!err) {
      console.log('Trovata directory remota:', c);
      return c;
    }
  }
  throw new Error('Directory remota non trovata. Specifica ARUBA_REMOTE_PATH.');
}

async function main() {
  if (!host || !username || !password) throw new Error('Credenziali Aruba mancanti in .env.deploy');
  await connect();
  console.log('Connessione SSH stabilita.');
  const sftp = await getSftp();
  const remoteDir = await findRemoteDir(sftp);
  conn.end();
  await new Promise(r => setTimeout(r, 300));
  await connect();

  const envPath = `${remoteDir}/.env`;
  const localEnvPath = path.resolve(__dirname, '..', '.env.production');
  if (fs.existsSync(localEnvPath)) {
    console.log('Caricamento .env.production sul server...');
    const sftp2 = await getSftp();
    await fastPut(sftp2, localEnvPath, envPath);
    console.log('.env.production caricato su Aruba.');
  }
  const keyCheck = await exec(`if grep -q '^ENCRYPTION_KEY=' ${envPath} 2>/dev/null; then echo exists; else echo missing; fi`);
  let key = null;
  if (keyCheck.out.trim() === 'exists') {
    const out = await exec(`grep '^ENCRYPTION_KEY=' ${envPath} | cut -d '=' -f2-`);
    key = out.out.trim();
    console.log('ENCRYPTION_KEY già presente.');
  } else {
    key = crypto.randomBytes(32).toString('hex');
    const append = await exec(`printf 'ENCRYPTION_KEY=${key}\n' >> ${envPath}`);
    if (append.code !== 0) throw new Error('Impossibile scrivere ENCRYPTION_KEY nel .env remoto');
    console.log('ENCRYPTION_KEY generata e aggiunta al .env remoto.');
  }

  console.log('Arresto app per la migrazione...');
  await exec(`cd ${remoteDir} && pkill -f "node dist/index.js" || true`);

  const envCheck = await exec(`grep -q '^MONGODB_URI=' ${envPath} && echo present || echo missing`);
  if (envCheck.out.trim() !== 'present') {
    throw new Error('MONGODB_URI non trovato nel .env remoto');
  }

  console.log('Esecuzione migrazione field-level encryption...');
  const migration = await exec(`cd ${remoteDir} && set -a && source .env && node dist/scripts/migrateEncryption.js`);
  console.log('--- output migrazione ---');
  console.log(migration.out);
  if (migration.stderr) console.error(migration.stderr);
  if (migration.code !== 0) throw new Error('Migrazione fallita');

  console.log('Riavvio app...');
  const restart = await exec(`cd ${remoteDir} && nohup npm start > app.log 2>&1 & echo "PID:$!"`);
  console.log('Riavvio:', restart.out);

  conn.end();
  console.log('Setup encryption completato.');
}

main().catch(e => {
  console.error('Errore setup encryption:', e.message || e);
  try { conn.end(); } catch {}
  process.exit(1);
});
