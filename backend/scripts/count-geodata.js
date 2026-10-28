// Conteggio staff con coordinate/città per mappa albo (sola lettura, su Aruba).
require('dotenv').config();
const { MongoClient } = require('mongodb');
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const s = db.collection('staffs');
  const tot = await s.countDocuments();
  const conCoords = await s.countDocuments({ 'domicilioCoords.lat': { $exists: true, $ne: null } });
  const conCitta = await s.countDocuments({ cittaResidenza: { $exists: true, $nin: [null, ''] } });
  const perCitta = await s.aggregate([
    { $group: { _id: '$cittaResidenza', n: { $sum: 1 }, coords: { $sum: { $cond: [{ $ifNull: ['$domicilioCoords.lat', false] }, 1, 0] } } } },
    { $sort: { n: -1 } }, { $limit: 15 },
  ]).toArray();
  const perCategoria = await s.aggregate([
    { $group: { _id: '$category', n: { $sum: 1 } } }, { $sort: { n: -1 } },
  ]).toArray();
  console.log(JSON.stringify({ tot, conCoords, conCitta, perCitta, perCategoria }, null, 1));
  await c.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
