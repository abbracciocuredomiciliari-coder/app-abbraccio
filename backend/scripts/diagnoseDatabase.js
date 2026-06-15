const { MongoClient } = require('mongodb');
require('dotenv').config();

async function diagnoseDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    console.log('🔍 Diagnosi database MongoDB...');
    console.log('📍 URI di connessione:', process.env.MONGODB_URI || 'mongodb://localhost:27017');
    
    await client.connect();
    console.log('✅ Connessione riuscita');

    // Mostra tutti i database disponibili
    console.log('\n📊 Database disponibili:');
    const admin = client.db().admin();
    const databases = await admin.listDatabases();
    
    databases.databases.forEach(db => {
      console.log(`  - ${db.name} (size: ${Math.round(db.sizeOnDisk / 1024 / 1024)}MB)`);
    });

    // Prova a connettersi al database specifico
    const dbName = 'abbraccio-cure-domiciliari';
    const db = client.db(dbName);
    
    console.log(`\n🔍 Analisi database "${dbName}":`);
    
    // Mostra tutte le collezioni
    const collections = await db.listCollections().toArray();
    console.log(`  Collezioni trovate: ${collections.length}`);
    
    if (collections.length === 0) {
      console.log('  ❌ NESSUNA COLLEZIONE TROVATA - Database vuoto o inesistente');
    } else {
      collections.forEach(async (collection) => {
        try {
          const count = await db.collection(collection.name).countDocuments();
          console.log(`    - ${collection.name}: ${count} documenti`);
        } catch (err) {
          console.log(`    - ${collection.name}: ERRORE conteggio`);
        }
      });
    }

    // Se il database è vuoto, prova a vedere se ci sono altri database simili
    if (collections.length === 0) {
      console.log('\n🔍 Ricerca database simili...');
      const similarDbs = databases.databases.filter(db => 
        db.name.toLowerCase().includes('abbraccio') || 
        db.name.toLowerCase().includes('cure') ||
        db.name.toLowerCase().includes('domiciliari')
      );
      
      if (similarDbs.length > 0) {
        console.log('  Database simili trovati:');
        similarDbs.forEach(db => {
          console.log(`    - ${db.name}`);
        });
      } else {
        console.log('  Nessun database simile trovato');
      }
    }

  } catch (error) {
    console.error('❌ Errore durante la diagnosi:', error);
  } finally {
    await client.close();
    console.log('\n📡 Disconnesso dal database');
  }
}

// Esegui la funzione
diagnoseDatabase();
