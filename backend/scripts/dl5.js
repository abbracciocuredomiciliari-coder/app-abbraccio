require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); process.exit(1); }
    sftp.fastGet('/var/www/app-abbraccio/frontend/dist/assets/index-COROt2iD.js', 'C:/Users/Fin/AppData/Local/Temp/new-index.js', e => {
      console.log(e ? 'err ' + e.message : 'ok'); conn.end();
    });
  });
}).on('error', e => { console.error('ERR', e.message); process.exit(1); }).connect({
  host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT || 22),
  username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000,
});
