// Backfill "Email inviate": ricostruisce lo storico degli invii documenti
// (preventivi/fatture) dai dati firma.email + firma.inviatoIl su
// DocumentoFatturazione. createdAt = inviatoIl se presente, altrimenti
// updatedAt del documento (data approssimata, flag dataStimata:true).
// Uso sul server: node scripts/backfill-emaillog.js  (da /var/www/app-abbraccio/backend)
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(); // db name preso dalla URI (app-abbraccio)

  const docs = await db.collection('documentofatturaziones')
    .find({ 'firma.email': { $exists: true, $ne: '' } })
    .toArray();

  console.log(`📄 Documenti con email destinatario registrata: ${docs.length}`);

  const existing = await db.collection('emaillogs')
    .find({ storico: true }, { projection: { to: 1, subject: 1, createdAt: 1 } })
    .toArray();
  const seen = new Set(existing.map(e => `${e.to}|${e.subject}|${new Date(e.createdAt).getTime()}`));

  const patientIds = [...new Set(docs.map(d => String(d.patient)))];
  const patients = await db.collection('patients')
    .find({ _id: { $in: patientIds.map(id => new ObjectId(id)) } }, { projection: { tipoGestione: 1 } })
    .toArray();
  const gestioneById = Object.fromEntries(patients.map(p => [String(p._id), p.tipoGestione]));

  // ── Contratti inviati (firma.email/updatedAt su contrattopazientes) ─────────
  const contratti = await db.collection('contrattopazientes')
    .find({ email: { $exists: true, $ne: '' } })
    .toArray();
  console.log(`📜 Contratti con email destinatario registrata: ${contratti.length}`);

  const contrattoPatientIds = [...new Set(contratti.map(c => String(c.patient)))];
  const contrattoPatients = await db.collection('patients')
    .find({ _id: { $in: contrattoPatientIds.map(id => new ObjectId(id)) } }, { projection: { tipoGestione: 1, firstName: 1, lastName: 1 } })
    .toArray();
  const contrattoPazById = Object.fromEntries(contrattoPatients.map(p => [String(p._id), p]));

  const rows = [];
  let skipped = 0;
  for (const c of contratti) {
    const paz = contrattoPazById[String(c.patient)] || {};
    const nomePaz = `${paz.firstName || ''} ${paz.lastName || ''}`.trim();
    const subject = `Contratto d'incarico e GDPR ${c.profilo} — Abbraccio Cure Domiciliari`;
    // 'data' è la data di generazione del contratto (richiesta utente: ora di generazione)
    const when = c.data ? new Date(c.data) : new Date(c.updatedAt || c.createdAt);
    const key = `${c.email}|${subject}|${when.getTime()}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);

    const isConsulenza = c.contesto === 'intermediazione' || !!c.richiestaId || paz.tipoGestione === 'consulenza';
    const allegati = [`CONTRATTO-${c.profilo.toUpperCase().replace(/\s+/g, '-')}.pdf`, 'INFORMATIVA-GDPR.pdf'];
    if (c.allegatoFileName) allegati.push(c.allegatoFileName);
    rows.push({
      to: c.email,
      subject,
      tipo: 'contratto',
      area: isConsulenza ? 'intermediazione' : 'privato',
      riferimento: nomePaz || undefined,
      allegati,
      inviataDaNome: 'storico',
      esito: 'inviata',
      storico: true,
      dataStimata: true, // i contratti non tracciano l'ora esatta dell'invio — mostriamo la data di generazione
      createdAt: when,
      updatedAt: when,
    });
  }

  for (const doc of docs) {
    const label = doc.tipo === 'fattura' ? 'Fattura' : 'Preventivo';
    const subject = `${label} ${doc.numero} — Abbraccio Cure Domiciliari`;
    const when = doc.firma.inviatoIl ? new Date(doc.firma.inviatoIl) : new Date(doc.updatedAt || doc.createdAt || doc.data);
    const dataStimata = !doc.firma.inviatoIl;
    const key = `${doc.firma.email}|${subject}|${when.getTime()}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);

    const isConsulenza = doc.riferimentoTipo === 'badante' || gestioneById[String(doc.patient)] === 'consulenza';
    rows.push({
      to: doc.firma.email,
      subject,
      tipo: doc.tipo,
      area: isConsulenza ? 'intermediazione' : 'privato',
      riferimento: doc.numero,
      allegati: [`${label.toUpperCase()}-${doc.numero}${doc.firma.firmato ? '-firmato' : ''}.pdf`],
      inviataDaNome: doc.creatoDa || 'storico',
      esito: 'inviata',
      storico: true,        // riga ricostruita dai metadati del documento
      dataStimata,          // vera se la data è approssimata (invio pre-tracciamento)
      createdAt: when,
      updatedAt: when,
    });
  }

  if (rows.length) {
    await db.collection('emaillogs').insertMany(rows);
  }
  console.log(`✅ Inserite ${rows.length} email storiche (saltate ${skipped} già presenti)`);

  const perArea = {};
  rows.forEach(r => { perArea[r.area] = (perArea[r.area] || 0) + 1; });
  console.log('   Per area:', perArea);

  rows.sort((a, b) => b.createdAt - a.createdAt).forEach(r => {
    console.log(`   ${r.createdAt.toISOString().slice(0, 10)}${r.dataStimata ? ' ~' : '  '} | ${r.area.padEnd(15)} | ${r.riferimento.padEnd(18)} → ${r.to}`);
  });

  await client.close();
}

main().catch(err => { console.error('❌', err); process.exit(1); });
