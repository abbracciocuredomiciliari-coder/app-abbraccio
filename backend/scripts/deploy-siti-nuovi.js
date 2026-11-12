// Deploy nuovi siti (pacchetto ristrutturazione):
//  - famiglia.abbracciocuredomiciliari.it → nuovo portale alla root,
//    sito attuale (questionario → gestionale) spostato in /dashboard/
//  - shop.abbracciocuredomiciliari.it → /var/www/shop-abbraccio + vhost nginx
// DNS shop va creato nel pannello prima di certbot (vedi output finale).
require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const host = process.env.ARUBA_HOST;
const username = process.env.ARUBA_USER;
const password = process.env.ARUBA_PASSWORD;
const DESKTOP = path.resolve(__dirname, '..', '..', '..');
const FAMIGLIA_SRC = path.join(DESKTOP, 'ristrutturazione gestionale', '_deploy', 'famiglie');
const SHOP_SRC = path.join(DESKTOP, 'ristrutturazione gestionale', '_deploy', 'shop');
const FAMIGLIA_REMOTE = '/var/www/famiglia-abbraccio';
const SHOP_REMOTE = '/var/www/shop-abbraccio';

const conn = new Client();
const connect = () => new Promise((res, rej) => {
  conn.on('ready', res).on('error', rej).connect({ host, port: 22, username, password, readyTimeout: 30000, keepaliveInterval: 5000 });
});
const exec = cmd => new Promise((res, rej) => {
  conn.exec(cmd, { env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' } }, (err, s) => {
    if (err) return rej(err);
    let out = '', stderr = '';
    s.on('close', code => res({ code, out, stderr }));
    s.on('data', d => out += d.toString());
    s.stderr.on('data', d => stderr += d.toString());
  });
});
const getSftp = () => new Promise((res, rej) => conn.sftp((e, s) => e ? rej(e) : res(s)));
const mkdir = (sftp, p) => new Promise(r => sftp.mkdir(p, e => r(!e)));
const fastPut = (sftp, l, r) => new Promise((res, rej) => sftp.fastPut(l, r, e => e ? rej(e) : res()));
async function uploadDir(sftp, local, remote) {
  await mkdir(sftp, remote);
  for (const e of fs.readdirSync(local, { withFileTypes: true })) {
    const lp = path.join(local, e.name), rp = `${remote}/${e.name}`;
    if (e.isDirectory()) await uploadDir(sftp, lp, rp);
    else await fastPut(sftp, lp, rp);
  }
}

async function main() {
  await connect();
  console.log('SSH ok.');

  // ── 1. FAMIGLIA: sposta sito attuale in /dashboard/ (se non già fatto) ──
  const chk = await exec(`test -d ${FAMIGLIA_REMOTE}/dashboard && echo EXISTS || echo MISSING`);
  if (chk.out.trim() === 'MISSING') {
    const mv = await exec(`cd ${FAMIGLIA_REMOTE} && mkdir -p dashboard && bash -O extglob -O dotglob -c 'mv !(dashboard) dashboard/' && ls dashboard | head -5`);
    if (mv.code !== 0) { console.error('Move dashboard fallito:', mv.stderr, mv.out); conn.end(); return; }
    console.log('Sito attuale spostato in /dashboard/:', mv.out.trim().replace(/\n/g, ', '));
  } else {
    console.log('/dashboard esiste già — mantengo la struttura.');
  }

  const sftp = await getSftp();
  // sincronizza anche la copia locale aggiornata (auto-apertura #richiesta) dentro /dashboard
  console.log('Sync questionario attuale → /dashboard ...');
  await uploadDir(sftp, path.join(DESKTOP, 'famiglia-abbraccio'), `${FAMIGLIA_REMOTE}/dashboard`);

  console.log('Upload nuovo portale famiglie → root...');
  await uploadDir(sftp, FAMIGLIA_SRC, FAMIGLIA_REMOTE);

  // ── 2. SHOP: cartella + upload ──
  console.log('Upload shop → ' + SHOP_REMOTE + ' ...');
  await uploadDir(sftp, SHOP_SRC, SHOP_REMOTE);

  // ── 3. Vhost nginx shop (HTTP; HTTPS dopo DNS + certbot) ──
  const vhost = `server {
    listen 80;
    server_name shop.abbracciocuredomiciliari.it;
    root ${SHOP_REMOTE};
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location ~* \\.(?:css|js)$ { expires 1h; add_header Cache-Control "public"; try_files $uri =404; }
    location ~* \\.(?:png|jpg|jpeg|gif|ico|svg|webp|woff2?|mp4)$ { expires 7d; add_header Cache-Control "public"; try_files $uri =404; }
}`;
  const vh = await exec(`cat > /etc/nginx/sites-available/shop-abbraccio <<'EOF'\n${vhost}\nEOF\nln -sf /etc/nginx/sites-available/shop-abbraccio /etc/nginx/sites-enabled/shop-abbraccio && nginx -t && nginx -s reload && echo VHOST_OK`);
  console.log(vh.out || vh.stderr);

  // ── 4. Chown/permessi base ──
  await exec(`chmod -R 755 ${FAMIGLIA_REMOTE} ${SHOP_REMOTE}`);

  conn.end();
  console.log(`\nDEPLOY COMPLETATO.
Famiglia: https://famiglia.abbracciocuredomiciliari.it (nuovo portale) + /dashboard (questionario reale)
Shop: pronto su ${SHOP_REMOTE} — ATTIVA IL DNS: crea record A 'shop' → ${host} nel pannello DNS,
poi sul server esegui: certbot --nginx -d shop.abbracciocuredomiciliari.it`);
}

main().catch(e => { console.error('ERRORE:', e.message || e); try { conn.end(); } catch {} });
