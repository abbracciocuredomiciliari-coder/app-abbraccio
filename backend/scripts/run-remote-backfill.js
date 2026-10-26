// Carica ed esegue sul server Aruba lo script di backfill dello storico email.
require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const localScript = path.resolve(__dirname, 'backfill-emaillog.js');
const remotePath = `${process.env.ARUBA_REMOTE_PATH}/scripts/backfill-emaillog.js`;

conn.on('ready', () => {
  conn.exec(`mkdir -p ${process.env.ARUBA_REMOTE_PATH}/scripts`, () => {
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP err', err); conn.end(); process.exit(1); }
    const rs = fs.createReadStream(localScript);
    const ws = sftp.createWriteStream(remotePath);
    ws.on('close', () => {
      conn.exec(`cd ${process.env.ARUBA_REMOTE_PATH} && node scripts/backfill-emaillog.js`, { env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.nvm/versions/node/v18/bin' } }, (err, stream) => {
        if (err) { console.error('exec err', err); conn.end(); process.exit(1); }
        stream.on('close', () => conn.end());
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
      });
    });
    rs.pipe(ws);
  });
  });
}).on('error', e => { console.error('conn err', e); process.exit(1); })
  .connect({ host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT || 22), username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000 });
