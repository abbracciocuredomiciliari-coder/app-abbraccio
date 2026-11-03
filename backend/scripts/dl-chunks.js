require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('grep -oE "ConsegnaEsterna-[A-Za-z0-9_-]+\.js" /var/www/app-abbraccio/frontend/dist/assets/index-COROt2iD.js | sort -u', { env: { PATH: '/usr/bin:/bin' } }, (e, st) => {
    let out = '';
    st.on('data', d => out += d);
    st.on('close', () => {
      const ce = out.trim().split('\n')[0];
      const files = [
        'IscrizioneIntermediazione-D_Qz27_2.js', 'AreaFamiglia-BXU0uBwc.js',
        'ColloquioPubblico-DYUXDL-O.js', 'ConsegneAmministrative-OvA_ZZo8.js',
        'PreventivoVeloce-C--essYa.js', 'ReportConsegne-D90KTNSb.js',
        'RiunioniColloquio-dEgpAgE6.js', 'ArchivioEmail-C9lblTVv.js', ce,
      ].filter(Boolean);
      conn.sftp((err, sftp) => {
        let i = 0;
        const next = () => {
          if (i >= files.length) { conn.end(); return; }
          const f = files[i++];
          sftp.fastGet(`/var/www/app-abbraccio/frontend/dist/assets/${f}`, `C:/Users/Fin/AppData/Local/Temp/restore/${f}`, e2 => {
            console.log(e2 ? 'ERR ' + f : 'ok ' + f); next();
          });
        };
        next();
      });
    });
  });
}).on('error', e => { console.error('ERR', e.message); process.exit(1); }).connect({
  host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT || 22),
  username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000,
});
