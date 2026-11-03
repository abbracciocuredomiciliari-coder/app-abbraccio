require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const remote = `cd /var/www/app-abbraccio/backend && node -e "
require('dotenv').config({path:'.env'});
const mongoose=require('mongoose');
mongoose.connect(process.env.MONGODB_URI||process.env.MONGO_URI).then(async()=>{
  const r=await mongoose.connection.db.collection('tariffaccnls').updateOne({key:'ccnl'},{$set:{'parametri.cafPerTipo':{convivente:100,assistenza_notturna:100,presenza_notturna:100,convivente_part_time:75,non_convivente:75,non_convivente_sotto30:50,sostituzione:50}}});
  console.log('modified:',r.modifiedCount,'matched:',r.matchedCount);
  process.exit(0);
}).catch(e=>{console.log('ERR '+e.message.slice(0,80));process.exit(1)});"`;
  conn.exec(remote, { env: { PATH: '/root/.nvm/versions/node/v18/bin:/usr/local/bin:/usr/bin:/bin' } }, (e, s) => {
    if (e) { console.log('exec err', e.message); process.exit(1); }
    s.on('data', d => process.stdout.write(d)).on('stderr', d => process.stdout.write(d)).on('close', () => { conn.end(); process.exit(0); });
  });
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
.connect({ host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT) || 22, username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 20000 });
