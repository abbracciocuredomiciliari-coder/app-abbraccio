// Deploy mirato: carica solo i file dist modificati e riavvia PM2.
require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (!files.length) { console.error('Uso: node deploy-files.js <file locali...>'); process.exit(1); }

const remoteBase = `${process.env.ARUBA_REMOTE_PATH}/backend`;
const pm2 = process.env.ARUBA_PM2_NAME || 'abbraccio-backend';
const conn = new Client();

conn.on('ready', () => {
  conn.sftp(async (err, sftp) => {
    if (err) { console.error('SFTP err', err); conn.end(); process.exit(1); }
    for (const f of files) {
      const rel = path.relative(path.resolve('dist'), path.resolve(f)).replace(/\\/g, '/');
      const remote = `${remoteBase}/dist/${rel}`;
      await new Promise((res, rej) => {
        fs.createReadStream(f).pipe(sftp.createWriteStream(remote)).on('close', res).on('error', rej);
      });
      console.log(`OK ${rel}`);
    }
    conn.exec(`pm2 restart ${pm2}`, (e, stream) => {
      if (e) { console.error('restart err', e); conn.end(); process.exit(1); }
      stream.on('close', () => { console.log('PM2 riavviato'); conn.end(); });
    });
  });
}).connect({ host: process.env.ARUBA_HOST, port: process.env.ARUBA_PORT || 22, username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000 });
