// Crea indici {createdAt:-1} sulle collezioni che vengono ordinate per data.
// Senza indice, sort() su collezioni grandi supera i 32MB di memoria MongoDB.
require('dotenv').config();
const { MongoClient } = require('mongodb');
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const collezioni = [
    'contrattopazientes', 'documentofatturaziones', 'preventivoinviatoes',
    'emaillogs', 'attivitas', 'consegnaamministrativas',
    'richiestaprenotaziones', 'candidatointermediaziones', 'workplans',
  ];
  for (const nome of collezioni) {
    try {
      const r = await db.collection(nome).createIndex({ createdAt: -1 }, { background: true });
      console.log(`${nome}: indice ${r}`);
    } catch (e) {
      console.log(`${nome}: ${e.message}`);
    }
  }
  await c.close();
})();
