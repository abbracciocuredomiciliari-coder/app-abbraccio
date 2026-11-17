// Deploy mirato: abbraccino.js (dock mobile a destra) + html cache-bust sullo shop.
require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const path = require('path');

const DESKTOP = path.resolve(__dirname, '..', '..', '..');
const FILES = [
  [path.join(DESKTOP, '_shop', 'abbraccino.js'), '/var/www/shop-abbraccio/abbraccino.js'],
  [path.join(DESKTOP, '_shop', 'index.html'), '/var/www/shop-abbraccio/index.html'],
  [path.join(DESKTOP, '_shop', 'catalogo.html'), '/var/www/shop-abbraccio/catalogo.html'],
];

const conn = new Client();
conn.on('ready', () => {
  conn.sftp(async (err, sftp) => {
    if (err) { console.error('SFTP error', err.message); process.exit(1); }
    for (const [local, remote] of FILES) {
      await new Promise((res, rej) => sftp.fastPut(local, remote, e => e ? rej(e) : res()));
      console.log('OK', remote);
    }
    conn.end();
    console.log('Deploy shop completato.');
  });
}).on('error', e => { console.error('SSH error', e.message); process.exit(1); })
  .connect({ host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT || 22), username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000 });
