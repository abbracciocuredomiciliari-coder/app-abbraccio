// Deploy sito Abbraccio Famiglia su Aruba:
// - carica la cartella Desktop/famiglia-abbraccio in /var/www/famiglia-abbraccio
// - crea/abilita il server block Nginx per abbracciofamiglie.it + www
// - reload Nginx (certbot da lanciare a DNS propagato)
require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const host = process.env.ARUBA_HOST;
const port = Number(process.env.ARUBA_PORT || 22);
const username = process.env.ARUBA_USER;
const password = process.env.ARUBA_PASSWORD;
const localDir = path.resolve(__dirname, '..', '..', '..', 'famiglia-abbraccio');
const remoteDir = '/var/www/famiglia-abbraccio';

const conn = new Client();

function connect() {
  return new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({ host, port, username, password, readyTimeout: 30000, keepaliveInterval: 5000 });
  });
}
function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' } }, (err, stream) => {
      if (err) return reject(err);
      let out = '', stderr = '';
      stream.on('close', (code) => resolve({ code, out, stderr }));
      stream.on('data', d => out += d.toString());
      stream.stderr.on('data', d => stderr += d.toString());
    });
  });
}
function getSftp() {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
  });
}
function mkdir(sftp, p) {
  return new Promise(resolve => {
    sftp.mkdir(p, err => resolve(err ? (err.code === 2 || /exists/i.test(err.message || '')) : true));
  });
}
function fastPut(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, err => err ? reject(err) : resolve());
  });
}
async function uploadDir(sftp, local, remote) {
  await mkdir(sftp, remote);
  for (const entry of fs.readdirSync(local, { withFileTypes: true })) {
    const lp = path.join(local, entry.name);
    const rp = `${remote}/${entry.name}`;
    if (entry.isDirectory()) await uploadDir(sftp, lp, rp);
    else if (entry.isFile()) await fastPut(sftp, lp, rp);
  }
}

const NGINX_CONF = `server {
    listen 80;
    server_name famiglia.abbracciocuredomiciliari.it famigli.abbracciocuredomiciliari.it;
    root /var/www/famiglia-abbraccio;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(?:css|js|png|jpg|jpeg|gif|ico|svg|webp|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
        try_files $uri =404;
    }
}
`;

async function main() {
  console.log('Connessione SSH...');
  await connect();
  const sftp = await getSftp();

  console.log('Caricamento sito in', remoteDir);
  await uploadDir(sftp, localDir, remoteDir);

  console.log('Configurazione Nginx...');
  const tmpConf = path.join(__dirname, '_famiglia-nginx.tmp');
  fs.writeFileSync(tmpConf, NGINX_CONF);
  const tmp = '/tmp/famiglia-nginx.conf';
  await fastPut(sftp, tmpConf, tmp);
  fs.unlinkSync(tmpConf);
  let r = await exec(`cp ${tmp} /etc/nginx/sites-available/famiglia-abbraccio && ln -sf /etc/nginx/sites-available/famiglia-abbraccio /etc/nginx/sites-enabled/famiglia-abbraccio && nginx -t && systemctl reload nginx`);
  console.log('nginx:', r.out.trim(), r.stderr.trim());

  console.log('Deploy famiglia completato. Attendi DNS, poi lancia certbot --nginx -d famiglia.abbracciocuredomiciliari.it');
  conn.end();
}

main().catch(e => { console.error('Errore deploy famiglia:', e); process.exit(1); });
