const { MongoClient } = require('mongodb');
require('dotenv').config();

async function showAllPatients() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    console.log('🔍 Connessione al database...');
    await client.connect();
    console.log('✅ Connesso al database');

    const db = client.db('app-abbraccio');
    
    console.log('\n📋 Mostra tutti i pazienti presenti:\n');

    // Mostra tutti i pazienti
    const patients = await db.collection('patients').find({}).toArray();
    
    console.log(`📊 Trovati ${patients.length} pazienti totali:`);
    patients.forEach((patient, index) => {
      console.log(`\n${index + 1}. PAZIENTE:`);
      console.log(`   ID: ${patient._id}`);
      console.log(`   Nome: ${patient.firstName || 'N/D'} ${patient.lastName || 'N/D'}`);
      console.log(`   Data nascita: ${patient.birthDate || 'N/D'}`);
      console.log(`   Codice fiscale: ${patient.codiceFiscale || 'N/D'}`);
      console.log(`   Email: ${patient.email || 'N/D'}`);
      console.log(`   Telefono: ${patient.contactPhone || 'N/D'}`);
      console.log(`   Indirizzo: ${patient.address || 'N/D'}`);
      console.log(`   Necessità: ${patient.assistanceNeeds || 'N/D'}`);
      console.log(`   Creato il: ${patient.createdAt || 'N/D'}`);
    });

    // Mostra anche le richieste di registrazione paziente
    console.log('\n\n📋 Richieste di registrazione pazienti:\n');
    const richieste = await db.collection('richiestaregistrazionepazientes').find({}).toArray();
    
    console.log(`📊 Trovate ${richieste.length} richieste totali:`);
    richieste.forEach((richiesta, index) => {
      console.log(`\n${index + 1}. RICHIESTA:`);
      console.log(`   ID: ${richiesta._id}`);
      console.log(`   Nome: ${richiesta.firstName || 'N/D'} ${richiesta.lastName || 'N/D'}`);
      console.log(`   Data nascita: ${richiesta.birthDate || 'N/D'}`);
      console.log(`   Codice fiscale: ${richiesta.codiceFiscale || 'N/D'}`);
      console.log(`   Email: ${richiesta.email || 'N/D'}`);
      console.log(`   Telefono: ${richiesta.contactPhone || 'N/D'}`);
      console.log(`   Indirizzo: ${richiesta.address || 'N/D'}`);
      console.log(`   Necessità: ${richiesta.assistanceNeeds || 'N/D'}`);
      console.log(`   Richiedente: ${richiesta.richiedenteNome || 'N/D'}`);
      console.log(`   Stato: ${richiesta.stato || 'N/D'}`);
      console.log(`   Creato il: ${richiesta.createdAt || 'N/D'}`);
    });

    // Mostra anche le prenotazioni
    console.log('\n\n📋 Prenotazioni pazienti:\n');
    const prenotazioni = await db.collection('richiestaprenotaziones').find({}).toArray();
    
    console.log(`📊 Trovate ${prenotazioni.length} prenotazioni totali:`);
    prenotazioni.forEach((prenotazione, index) => {
      console.log(`\n${index + 1}. PRENOTAZIONE:`);
      console.log(`   ID: ${prenotazione._id}`);
      console.log(`   Paziente: ${prenotazione.pazienteNome || 'N/D'}`);
      console.log(`   Indirizzo: ${prenotazione.pazienteIndirizzo || 'N/D'}`);
      console.log(`   Telefono: ${prenotazione.pazienteTelefono || 'N/D'}`);
      console.log(`   Stato: ${prenotazione.stato || 'N/D'}`);
      console.log(`   Creato il: ${prenotazione.createdAt || 'N/D'}`);
    });

  } catch (error) {
    console.error('❌ Errore durante la ricerca:', error);
  } finally {
    await client.close();
    console.log('\n📡 Disconnesso dal database');
  }
}

// Esegui la funzione
showAllPatients();
