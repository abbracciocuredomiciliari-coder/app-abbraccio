require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const host = process.env.ARUBA_HOST;
const port = Number(process.env.ARUBA_PORT || 22);
const username = process.env.ARUBA_USER;
const password = process.env.ARUBA_PASSWORD;
const suggested = process.env.ARUBA_REMOTE_PATH;
const localBase = path.resolve(__dirname, '..');
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

function mkdir(sftp, p) {
  return new Promise(resolve => {
    sftp.mkdir(p, err => {
      if (err && err.code !== 2 && !err.message?.includes('exists')) return resolve(false);
      resolve(true);
    });
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

async function uploadDir(sftp, localDir, remoteDir) {
  await mkdir(sftp, remoteDir);
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    const remotePath = `${remoteDir}/${entry.name}`;
    if (entry.isDirectory()) {
      await uploadDir(sftp, localPath, remotePath);
    } else {
      await fastPut(sftp, localPath, remotePath);
    }
  }
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
    const { err: errPkg } = await stat(sftp, `${c}/package.json`);
    const { err: errIdx } = await stat(sftp, `${c}/dist/index.js`);
    if (!errPkg || !errIdx) {
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

  // L'app reale gira nella sottocartella backend su Aruba
  const { err: backendPkgErr } = await stat(sftp, `${remoteDir}/backend/package.json`);
  const deployDir = backendPkgErr ? remoteDir : `${remoteDir}/backend`;
  console.log('Deploy directory:', deployDir);

  console.log('Caricamento dist/...');
  await uploadDir(sftp, path.join(localBase, 'dist'), `${deployDir}/dist`);
  console.log('Caricamento public/...');
  await uploadDir(sftp, path.join(localBase, 'public'), `${deployDir}/public`);
  console.log('Caricamento frontend/dist per Nginx...');
  const frontendDist = `${remoteDir}/frontend/dist`;
  await mkdir(sftp, frontendDist);
  await uploadDir(sftp, path.resolve(localBase, '..', 'frontend', 'dist'), frontendDist);

  console.log('Caricamento package.json e package-lock.json...');
  await fastPut(sftp, path.join(localBase, 'package.json'), `${deployDir}/package.json`);
  const lockLocal = path.join(localBase, 'package-lock.json');
  if (fs.existsSync(lockLocal)) {
    await fastPut(sftp, lockLocal, `${deployDir}/package-lock.json`);
  }

  conn.end();

  await new Promise(resolve => setTimeout(resolve, 500));
  await connect();

  console.log('Installazione dipendenze remote...');
  const install = await exec(`cd ${deployDir} && npm install --production`);
  if (install.code !== 0) {
    console.error('npm install fallito:', install.stderr, install.out);
    throw new Error('npm install remoto fallito');
  }
  console.log('npm install completato.');

  console.log('Riavvio applicazione...');
  const restartScript = '/tmp/restart-abbraccio.sh';
  const restartScriptContent = `cat > ${restartScript} <<'EOF'\n#!/bin/bash\ncd ${deployDir}\n(command -v pm2 && timeout 60 pm2 restart ${pm2Name} --silent) || pkill -f "node ${deployDir}/dist/index.js" || true\nsleep 5\necho "Riavvio completato"\nEOF`;
  const writeRestart = await exec(restartScriptContent);
  if (writeRestart.code !== 0) {
    console.error('Errore scrittura script di riavvio:', writeRestart.stderr, writeRestart.out);
    throw new Error('Scrittura script di riavvio fallita');
  }
  const restart = await exec(`bash ${restartScript}`);
  console.log('Riavvio output:', restart.out, restart.stderr);

  console.log('Reload eventuale Nginx/Apache per svuotare cache...');
  const reload = await exec('(command -v nginx && nginx -s reload) || (command -v apache2 && apache2ctl graceful) || (command -v httpd && httpd -k graceful) || true');
  console.log('Reload output:', reload.out, reload.stderr);

  conn.end();
  console.log('Deploy completato su', deployDir);
}

main().catch(e => {
  console.error('Errore deploy:', e.message || e);
  try { conn.end(); } catch {}
  process.exit(1);
});
