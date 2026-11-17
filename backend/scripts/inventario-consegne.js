// Inventario pre-hub: attivita + consegneamministrativas (lettura + backup JSON).
require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const attivita = await db.collection('attivitas').find({}).toArray();
  const consegne = await db.collection('consegnaamministrativas').find({}).toArray();
  const stampa = (nome, arr, campo) => {
    const byStato = {};
    for (const x of arr) byStato[x[campo] || '?'] = (byStato[x[campo] || '?'] || 0) + 1;
    console.log(`${nome}: ${arr.length} — per stato:`, JSON.stringify(byStato));
    console.log(`  IDs: ${arr.map(x => x._id).join(',')}`);
  };
  stampa('ATTIVITA', attivita, 'stato');
  stampa('CONSEGNE', consegne, 'stato');
  // Tipi attività
  const tipi = {};
  for (const a of attivita) tipi[a.tipo || 'attivita'] = (tipi[a.tipo || 'attivita'] || 0) + 1;
  console.log('ATTIVITA per tipo:', JSON.stringify(tipi));
  const aree = {};
  for (const a of attivita) aree[a.area || '?'] = (aree[a.area || '?'] || 0) + 1;
  console.log('ATTIVITA per area:', JSON.stringify(aree));
  // Trasferimenti pendenti
  const trasf = attivita.filter(a => a.trasferimento && a.trasferimento.accettato === false).length
    + consegne.filter(x => x.trasferimento && x.trasferimento.accettato === false).length;
  console.log('TRASFERIMENTI PENDENTI:', trasf);
  fs.writeFileSync('backup-hub-inventario.json', JSON.stringify({ quando: new Date().toISOString(), attivita, consegne }, null, 1));
  console.log('BACKUP salvato: backup-hub-inventario.json');
  await c.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
