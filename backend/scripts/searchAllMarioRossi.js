const { MongoClient } = require('mongodb');
require('dotenv').config();

async function searchAllMarioRossi() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    console.log('🔍 Connessione al database...');
    await client.connect();
    console.log('✅ Connesso al database');

    const db = client.db('app-abbraccio');
    
    console.log('\n🔍 Ricerca estesa di "Mario Rossi" in tutte le collezioni...\n');

    // Funzione per cercare in una collezione con vari criteri
    async function searchInCollection(collectionName, searchFields) {
      try {
        const collection = db.collection(collectionName);
        const searchConditions = [];
        
        // Crea condizioni di ricerca per ogni campo
        searchFields.forEach(field => {
          searchConditions.push({ [field]: { $regex: /mario.*rossi/i } });
          searchConditions.push({ [field]: { $regex: /rossi.*mario/i } });
          searchConditions.push({ [field]: { $regex: /mario/i } });
          searchConditions.push({ [field]: { $regex: /rossi/i } });
        });
        
        const results = await collection.find({ $or: searchConditions }).toArray();
        
        if (results.length > 0) {
          console.log(`📋 Trovati ${results.length} record nella collezione ${collectionName}:`);
          results.forEach((record, index) => {
            console.log(`  ${index + 1}. ID: ${record._id}`);
            searchFields.forEach(field => {
              if (record[field]) {
                console.log(`     ${field}: ${record[field]}`);
              }
            });
            if (record.stato) console.log(`     stato: ${record.stato}`);
            if (record.status) console.log(`     status: ${record.status}`);
            if (record.email) console.log(`     email: ${record.email}`);
            console.log('');
          });
        }
        
        return results.length;
      } catch (error) {
        console.log(`⚠️ Errore cercando in ${collectionName}: ${error.message}`);
        return 0;
      }
    }

    let totalFound = 0;

    // Cerca in tutte le collezioni pertinenti
    totalFound += await searchInCollection('patients', ['firstName', 'lastName', 'name', 'pazienteNome']);
    totalFound += await searchInCollection('richiestaregistrazionepazientes', ['firstName', 'lastName', 'richiedenteNome']);
    totalFound += await searchInCollection('users', ['name', 'firstName', 'lastName']);
    totalFound += await searchInCollection('richiestaprenotaziones', ['pazienteNome', 'richiedenteNome']);
    totalFound += await searchInCollection('schedaservizios', ['nomeCognomePaziente', 'pazienteNome']);
    totalFound += await searchInCollection('diarioclinicos', ['pazienteNome']);

    // Mostra anche un riepilogo di tutte le collezioni con i loro conteggi
    console.log('\n📊 Riepilogo collezioni database:');
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`  - ${collection.name}: ${count} documenti`);
    }

    if (totalFound === 0) {
      console.log('\n❌ Nessun record "Mario Rossi" trovato nel database.');
      console.log('Possibili cause:');
      console.log('  1. I pazienti sono già stati cancellati');
      console.log('  2. Hanno nomi completamente diversi');
      console.log('  3. Si trovano in un database diverso');
      console.log('  4. Il problema potrebbe essere nel frontend (cache, stato, etc.)');
    } else {
      console.log(`\n✅ Trovati in totale ${totalFound} record "Mario Rossi" o simili.`);
    }

  } catch (error) {
    console.error('❌ Errore durante la ricerca:', error);
  } finally {
    await client.close();
    console.log('\n📡 Disconnesso dal database');
  }
}

// Esegui la funzione
searchAllMarioRossi();
