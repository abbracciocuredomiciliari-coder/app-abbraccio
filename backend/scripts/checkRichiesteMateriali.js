const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkRichiesteMateriali() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    console.log('🔍 Analisi richieste materiali...');
    await client.connect();
    console.log('✅ Connesso al database');

    const db = client.db('app-abbraccio');
    
    console.log('\n📋 Richieste materiali presenti:\n');

    // Mostra tutte le richieste materiali
    const richieste = await db.collection('supplyrequests').find({}).toArray();
    
    console.log(`📊 Trovate ${richieste.length} richieste materiali:`);
    richieste.forEach((richiesta, index) => {
      console.log(`\n${index + 1}. RICHIESTA:`);
      console.log(`   ID: ${richiesta._id}`);
      console.log(`   Operatore: ${richiesta.operatoreNome || 'N/D'}`);
      console.log(`   Stato: "${richiesta.stato || 'N/D'}"`);
      console.log(`   Data richiesta: ${richiesta.dataRichiesta || 'N/D'}`);
      console.log(`   Data gestione: ${richiesta.dataGestione || 'N/D'}`);
      console.log(`   Gestita da: ${richiesta.gestitaDa || 'N/D'}`);
      console.log(`   Note admin: ${richiesta.noteAdmin || 'N/D'}`);
      
      if (richiesta.items && richiesta.items.length > 0) {
        console.log(`   Articoli (${richiesta.items.length}):`);
        richiesta.items.forEach((item, itemIndex) => {
          console.log(`     ${itemIndex + 1}. ${item.nome} - Richiesto: ${item.quantitaRichiesta} ${item.unitaMisura || ''}, Autorizzato: ${item.quantitaAutorizzata || 0} ${item.unitaMisura || ''}, Stato: ${item.statoItem || 'N/D'}`);
        });
      }
    });

    // Mostra anche gli stati unici trovati
    const statiUnici = [...new Set(richieste.map(r => r.stato).filter(Boolean))];
    console.log(`\n🔍 Stati trovati nel database: ${statiUnici.join(', ')}`);

    // Confronta con stati previsti nel frontend
    const statiFrontend = ['in attesa', 'autorizzata', 'rifiutata', 'consegnata'];
    console.log(`📋 Stati previsti nel frontend: ${statiFrontend.join(', ')}`);
    
    const statiMancanti = statiFrontend.filter(s => !statiUnici.includes(s));
    const statiExtra = statiUnici.filter(s => !statiFrontend.includes(s));
    
    if (statiMancanti.length > 0) {
      console.log(`⚠️ Stati mancanti nel database: ${statiMancanti.join(', ')}`);
    }
    if (statiExtra.length > 0) {
      console.log(`⚠️ Stati extra nel database: ${statiExtra.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Errore durante l\'analisi:', error);
  } finally {
    await client.close();
    console.log('\n📡 Disconnesso dal database');
  }
}

// Esegui la funzione
checkRichiesteMateriali();
