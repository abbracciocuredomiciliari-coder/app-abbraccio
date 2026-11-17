// Carica ed esegue inventario-consegne.js su Aruba, poi scarica il backup JSON in locale.
require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const localScript = path.resolve(__dirname, 'inventario-consegne.js');
const remoteBase = process.env.ARUBA_REMOTE_PATH;
const remotePath = `${remoteBase}/scripts/inventario-consegne.js`;
const localBackup = path.resolve(__dirname, `../../../_mobiletest/inventario_hub_${Date.now()}.json`);

conn.on('ready', () => {
  conn.exec(`mkdir -p ${remoteBase}/scripts`, () => {
    conn.sftp((err, sftp) => {
      if (err) { console.error('SFTP err', err); conn.end(); process.exit(1); }
      fs.createReadStream(localScript).pipe(sftp.createWriteStream(remotePath)).on('close', () => {
        conn.exec(`cd ${remoteBase} && node scripts/inventario-consegne.js`, { env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.nvm/versions/node/v18/bin' } }, (err, stream) => {
          if (err) { console.error('exec err', err); conn.end(); process.exit(1); }
          stream.on('close', () => {
            // Scarica il backup prodotto
            conn.sftp((e2, s2) => {
              if (e2) { conn.end(); return; }
              const ws = fs.createWriteStream(localBackup);
              s2.createReadStream(`${remoteBase}/backup-hub-inventario.json`).pipe(ws).on('close', () => {
                console.log('Backup locale:', localBackup);
                conn.exec(`rm -f ${remoteBase}/backup-hub-inventario.json ${remotePath}`, () => conn.end());
              });
            });
          });
          stream.on('data', d => process.stdout.write(d));
          stream.stderr.on('data', d => process.stderr.write(d));
        });
      });
    });
  });
}).on('error', e => { console.error('conn err', e); process.exit(1); })
  .connect({ host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT || 22), username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000 });
