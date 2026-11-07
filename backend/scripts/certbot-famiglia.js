// Attende che famiglia.abbracciocuredomiciliari.it risolva sul DNS autorevole
// Aruba, poi lancia certbot --nginx per l'HTTPS sul server.
require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remote = `for i in $(seq 1 180); do
    ip=$(nslookup famiglia.abbracciocuredomiciliari.it dns.technorail.com 2>/dev/null | awk '/^Address: 94\\\\./{print $2; exit}')
    if [ "$ip" = "94.177.199.228" ]; then echo "DNS OK dopo $i min"; break; fi
    sleep 60
  done
  echo "IP visto: $ip"
  if [ "$ip" = "94.177.199.228" ]; then
    certbot --nginx -d famiglia.abbracciocuredomiciliari.it --non-interactive --agree-tos -m info@abbracciocuredomiciliari.it --redirect 2>&1 | tail -15
    echo "=== verifica ==="
    curl -s https://famiglia.abbracciocuredomiciliari.it -o /dev/null -w 'HTTPS: %{http_code}\\n'
  else
    echo "TIMEOUT: DNS non propagato dopo 3 ore"
  fi`;
  conn.exec(remote, { env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' } }, (err, stream) => {
    if (err) { console.error(err); conn.end(); process.exit(1); }
    stream.on('close', () => conn.end());
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stdout.write(d));
  });
}).on('error', e => { console.error('SSH error:', e); process.exit(1); })
  .connect({ host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT || 22), username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 30000 });
