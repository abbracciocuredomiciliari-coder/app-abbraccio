// Carica ed esegue crea-indici.js su Aruba.
require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const localScript = path.resolve(__dirname, 'crea-indici.js');
const remoteBase = process.env.ARUBA_REMOTE_PATH;
const remotePath = `${remoteBase}/scripts/crea-indici.js`;

conn.on('ready', () => {
  conn.exec(`mkdir -p ${remoteBase}/scripts`, () => {
    conn.sftp((err, sftp) => {
      if (err) { console.error('SFTP err', err); conn.end(); process.exit(1); }
      fs.createReadStream(localScript).pipe(sftp.createWriteStream(remotePath)).on('close', () => {
        conn.exec(`cd ${remoteBase} && node scripts/crea-indici.js`, { env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.nvm/versions/node/v18/bin' } }, (err, stream) => {
          if (err) { console.error('exec err', err); conn.end(); process.exit(1); }
          stream.on('data', (d) => process.stdout.write(d));
          stream.stderr.on('data', (d) => process.stdout.write(d));
          stream.on('close', () => conn.exec(`rm -f ${remotePath}`, () => conn.end()));
        });
      });
    });
  });
}).connect({ host: process.env.ARUBA_HOST, port: process.env.ARUBA_PORT || 22, username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000 });
