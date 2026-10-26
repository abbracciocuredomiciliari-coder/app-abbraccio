const { MongoClient } = require('mongodb');
require('dotenv').config();

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  console.log('URI db name:', /\/([^/?]+)(\?|$)/.exec(uri)?.[1]);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    const n = await db.collection(c.name).countDocuments();
    if (n > 0) console.log(`${c.name}: ${n}`);
  }
  const docs = db.collection('documentofatturaziones');
  const withFirma = await docs.countDocuments({ 'firma.inviatoIl': { $exists: true, $ne: null } });
  const withEmail = await docs.countDocuments({ 'firma.email': { $exists: true, $ne: '' } });
  const tot = await docs.countDocuments({});
  console.log(`\ndocumentofatturaziones: tot=${tot}, con firma.email=${withEmail}, con firma.inviatoIl=${withFirma}`);
  const sample = await docs.find({ 'firma.email': { $exists: true } }, { projection: { numero: 1, 'firma.email': 1, 'firma.inviatoIl': 1 } }).limit(5).toArray();
  console.log(JSON.stringify(sample, null, 1));
  const logs = await db.collection('emaillogs').countDocuments({});
  console.log('emaillogs:', logs);
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
