// Conteggio temporaneo: dimensione reale della rete professionisti (da eseguire su Aruba).
require('dotenv').config();
const { MongoClient } = require('mongodb');
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const cols = (await db.listCollections().toArray()).map(x => x.name);
  const interesting = cols.filter(n => /staff|candidat|operator|user|profession|personale/i.test(n));
  console.log('COLLEZIONI:', interesting.join(', '));
  for (const n of interesting) {
    const total = await db.collection(n).countDocuments();
    console.log(`${n}: ${total}`);
  }
  // dettaglio staff per ruolo/modalità
  if (cols.includes('staffs')) {
    const byRole = await db.collection('staffs').aggregate([
      { $group: { _id: '$ruolo', n: { $sum: 1 } } }, { $sort: { n: -1 } }
    ]).toArray();
    console.log('STAFF per ruolo:', JSON.stringify(byRole));
  }
  await c.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
