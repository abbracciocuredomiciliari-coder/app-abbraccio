require('dotenv').config({ path: '.env.deploy' });
const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const remote = `cd /var/www/app-abbraccio/backend && node -e "
require('dotenv').config({path:'.env'});
const mongoose=require('mongoose');
mongoose.connect(process.env.MONGODB_URI||process.env.MONGO_URI).then(async()=>{
  const db=mongoose.connection.db;
  const c=await db.collection('consegnaamministrativas').find({},{projection:{stato:1,tipo:1,origine:1,createdAt:1,titolo:1,messaggio:1}}).limit(3).toArray();
  console.log('=== CONSEGNE sample:',JSON.stringify(c,null,0));
  const t=await db.collection('tariffarios').find({}).limit(3).toArray();
  console.log('=== TARIFFARIO sample:',JSON.stringify(t,null,0));
  const cc=await db.collection('tariffaccnls').find({}).limit(1).toArray();
  console.log('=== TARIFFACCNL:',JSON.stringify(cc,null,0).slice(0,1500));
  const sc=await db.collection('supplyrequests').find({}).toArray();
  console.log('=== SUPPLY:',JSON.stringify(sc,null,0).slice(0,600));
  process.exit(0);
}).catch(e=>{console.log('ERR '+e.message.slice(0,80));process.exit(1)});"`;
  conn.exec(remote, { env: { PATH: '/root/.nvm/versions/node/v18/bin:/usr/local/bin:/usr/bin:/bin' } }, (e, s) => {
    if (e) { console.log('exec err', e.message); process.exit(1); }
    s.on('data', d => process.stdout.write(d)).on('stderr', d => process.stdout.write(d)).on('close', () => { conn.end(); process.exit(0); });
  });
}).on('error', e => { console.log('ERR', e.message); process.exit(1); })
.connect({ host: process.env.ARUBA_HOST, port: Number(process.env.ARUBA_PORT) || 22, username: process.env.ARUBA_USER, password: process.env.ARUBA_PASSWORD, readyTimeout: 20000 });
