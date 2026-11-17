// Simula la query che faceva fallire /api/ricerca: prima con il vecchio sort
// su createdAt, poi con il nuovo sort su _id.
require('dotenv').config();
const { MongoClient } = require('mongodb');
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const t0 = Date.now();
  try {
    const r1 = await db.collection('contrattopazientes').find({}).sort({ createdAt: -1 }).limit(200).toArray();
    console.log(`createdAt sort: OK ${r1.length} docs in ${Date.now() - t0}ms`);
  } catch (e) {
    console.log(`createdAt sort: FALLO -> ${e.message.slice(0, 120)}`);
  }
  const t1 = Date.now();
  const r2 = await db.collection('contrattopazientes').find({}).sort({ _id: -1 }).limit(200).toArray();
  console.log(`_id sort: OK ${r2.length} docs in ${Date.now() - t1}ms`);
  // Indici presenti?
  const idx = await db.collection('contrattopazientes').indexes();
  console.log('indici:', idx.map((i) => i.name).join(', '));
  await c.close();
})();
