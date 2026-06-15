const { MongoClient } = require('mongodb');
require('dotenv').config();

async function removeMarioRossi() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    console.log('🔍 Connessione al database...');
    await client.connect();
    console.log('✅ Connesso al database');

    const db = client.db('abbraccio-cure-domiciliari');
    
    console.log('\n🔍 Ricerca pazienti "Mario Rossi"...\n');

    // 1. Cerca nella collezione patients
    const patients = await db.collection('patients').find({
      $or: [
        { firstName: 'Mario', lastName: 'Rossi' },
        { name: { $regex: /Mario.*Rossi/i } }
      ]
    }).toArray();

    console.log(`📋 Trovati ${patients.length} pazienti nella collezione patients:`);
    patients.forEach(p => {
      console.log(`  - ID: ${p._id}, Nome: ${p.firstName} ${p.lastName}, Email: ${p.email || 'N/D'}, CF: ${p.codiceFiscale || 'N/D'}`);
    });

    // 2. Cerca nella collezione richiestaregistrazionepazientes
    const richieste = await db.collection('richiestaregistrazionepazientes').find({
      $or: [
        { firstName: 'Mario', lastName: 'Rossi' },
        { richiedenteNome: { $regex: /Mario.*Rossi/i } }
      ]
    }).toArray();

    console.log(`\n📋 Trovate ${richieste.length} richieste nella collezione richiestaregistrazionepazientes:`);
    richieste.forEach(r => {
      console.log(`  - ID: ${r._id}, Nome: ${r.firstName} ${r.lastName}, Stato: ${r.stato}, Richiedente: ${r.richiedenteNome}`);
    });

    // 3. Cerca nella collezione users
    const users = await db.collection('users').find({
      name: { $regex: /Mario.*Rossi/i }
    }).toArray();

    console.log(`\n📋 Trovati ${users.length} utenti nella collezione users:`);
    users.forEach(u => {
      console.log(`  - ID: ${u._id}, Nome: ${u.name}, Email: ${u.email}, Ruolo: ${u.role}, Stato: ${u.status}`);
    });

    // 4. Cerca anche in altre collezioni che potrebbero contenere Mario Rossi
    const prenotazioni = await db.collection('richiestaprenotaziones').find({
      pazienteNome: { $regex: /Mario.*Rossi/i }
    }).toArray();

    console.log(`\n📋 Trovate ${prenotazioni.length} prenotazioni con paziente "Mario Rossi":`);
    prenotazioni.forEach(p => {
      console.log(`  - ID: ${p._id}, Paziente: ${p.pazienteNome}, Stato: ${p.stato}`);
    });

    console.log('\n⚠️  ATTENZIONE: Stai per cancellare TUTTI i record "Mario Rossi" trovati.');
    console.log('Questo includerà:');
    console.log(`  - ${patients.length} pazienti`);
    console.log(`  - ${richieste.length} richieste di registrazione`);
    console.log(`  - ${users.length} utenti`);
    console.log(`  - ${prenotazioni.length} prenotazioni`);
    
    console.log('\n🗑️  Inizio cancellazione...');

    // Cancella i pazienti
    if (patients.length > 0) {
      const patientIds = patients.map(p => p._id);
      const deletePatientsResult = await db.collection('patients').deleteMany({ _id: { $in: patientIds } });
      console.log(`✅ Cancellati ${deletePatientsResult.deletedCount} pazienti dalla collezione patients`);
    }

    // Cancella le richieste
    if (richieste.length > 0) {
      const richiestaIds = richieste.map(r => r._id);
      const deleteRichiesteResult = await db.collection('richiestaregistrazionepazientes').deleteMany({ _id: { $in: richiestaIds } });
      console.log(`✅ Cancellate ${deleteRichiesteResult.deletedCount} richieste dalla collezione richiestaregistrazionepazientes`);
    }

    // Cancella gli utenti
    if (users.length > 0) {
      const userIds = users.map(u => u._id);
      const deleteUsersResult = await db.collection('users').deleteMany({ _id: { $in: userIds } });
      console.log(`✅ Cancellati ${deleteUsersResult.deletedCount} utenti dalla collezione users`);
    }

    // Cancella le prenotazioni
    if (prenotazioni.length > 0) {
      const prenotazioneIds = prenotazioni.map(p => p._id);
      const deletePrenotazioniResult = await db.collection('richiestaprenotaziones').deleteMany({ _id: { $in: prenotazioneIds } });
      console.log(`✅ Cancellate ${deletePrenotazioniResult.deletedCount} prenotazioni dalla collezione richiestaprenotaziones`);
    }

    console.log('\n🎉 Cancellazione completata con successo!');
    console.log('Tutti i record "Mario Rossi" sono stati rimossi dal database.');

  } catch (error) {
    console.error('❌ Errore durante la cancellazione:', error);
  } finally {
    await client.close();
    console.log('\n📡 Disconnesso dal database');
  }
}

// Esegui la funzione
removeMarioRossi();
