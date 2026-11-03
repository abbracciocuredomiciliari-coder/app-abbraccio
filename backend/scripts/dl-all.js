require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
const TMP = 'C:/Users/Fin/AppData/Local/Temp/restore';
fs.mkdirSync(TMP, { recursive: true });
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); process.exit(1); }
    conn.exec('ls /var/www/app-abbraccio/backend/dist/routes/', { env: { PATH: '/usr/bin:/bin' } }, (e, st) => {
      let out = '';
      st.on('data', d => out += d);
      st.on('close', () => {
        const remote = out.split('\n').map(s => s.trim()).filter(s => s.endsWith('.js'));
        const local = new Set(fs.readdirSync('src/routes').filter(f => f.endsWith('.ts')).map(f => f.replace('.ts', '.js')));
        const missing = remote.filter(r => !local.has(r));
        console.log('MISSING ROUTES:', missing.join(', '));
        const files = missing.map(r => `/var/www/app-abbraccio/backend/dist/routes/${r}`);
        // modelli mancanti
        const models = ['CandidatoIntermediazione','ColloquioIntermediazione','ConsegnaAmministrativa','EmailAllegato','EmailLog','EmailRicevuta','OtpFamiglia','PreventivoInviato'];
        models.forEach(m => files.push(`/var/www/app-abbraccio/backend/dist/models/${m}.js`));
        // utils mancanti
        ['imapSync','promemoriaColloqui'].forEach(u => files.push(`/var/www/app-abbraccio/backend/dist/utils/${u}.js`));
        let i = 0;
        const next = () => {
          if (i >= files.length) { conn.end(); return; }
          const r = files[i++];
          const l = `${TMP}/${r.split('/').pop()}`;
          sftp.fastGet(r, l, e2 => { console.log(e2 ? 'ERR ' + r : 'ok ' + l.split('/').pop()); next(); });
        };
        next();
      });
    });
  });
}).on('error', e => { console.error('ERR', e.message); process.exit(1); }).connect({
  host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT || 22),
  username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000,
});
