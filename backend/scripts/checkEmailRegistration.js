const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkEmailRegistration() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    console.log('🔍 Analisi sistema di registrazione email...');
    await client.connect();
    console.log('✅ Connesso al database');

    const db = client.db('app-abbraccio');
    
    console.log('\n📋 Analisi utenti nel database:\n');

    // Mostra tutti gli utenti
    const users = await db.collection('users').find({}).toArray();
    
    console.log(`📊 Trovati ${users.length} utenti totali:`);
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. UTENTE:`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Nome: ${user.name || 'N/D'}`);
      console.log(`   Email: ${user.email || 'N/D'}`);
      console.log(`   Ruolo: ${user.role || 'N/D'}`);
      console.log(`   Stato: ${user.status || 'N/D'}`);
      console.log(`   Creato il: ${user.createdAt || 'N/D'}`);
      console.log(`   Aggiornato il: ${user.updatedAt || 'N/D'}`);
      console.log(`   Password hash: ${user.password ? 'Presente' : 'Mancante'}`);
    });

    // Simula il controllo di registrazione per ogni email
    console.log('\n🔍 Simulazione controllo duplicati email:');
    for (const user of users) {
      if (user.email) {
        const existingUser = await db.collection('users').findOne({ 
          email: user.email.toLowerCase().trim() 
        });
        console.log(`   Email "${user.email}": ${existingUser ? 'TROVATA (bloccherà registrazione)' : 'Non trovata'}`);
      }
    }

    // Controlla se ci sono email duplicate
    console.log('\n🔍 Ricerca email duplicate:');
    const emailCounts = {};
    users.forEach(user => {
      if (user.email) {
        const normalizedEmail = user.email.toLowerCase().trim();
        emailCounts[normalizedEmail] = (emailCounts[normalizedEmail] || 0) + 1;
      }
    });

    const duplicates = Object.entries(emailCounts).filter(([email, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('   ⚠️ Email duplicate trovate:');
      duplicates.forEach(([email, count]) => {
        console.log(`     - ${email}: ${count} occorrenze`);
      });
    } else {
      console.log('   ✅ Nessuna email duplicata trovata');
    }

    // Mostra anche il log delle eliminazioni recenti (se c'è una collezione audit)
    try {
      const auditLogs = await db.collection('auditlogs').find({
        action: { $regex: /delete|elimina/i },
        entityType: 'user'
      }).sort({ timestamp: -1 }).limit(10).toArray();

      if (auditLogs.length > 0) {
        console.log('\n📋 Log eliminazioni recenti:');
        auditLogs.forEach(log => {
          console.log(`   - ${log.timestamp}: ${log.action} - Utente ${log.entityId || 'N/D'} (${log.details?.email || 'N/D'})`);
        });
      }
    } catch (err) {
      // La collezione auditlogs potrebbe non esistere
    }

  } catch (error) {
    console.error('❌ Errore durante l\'analisi:', error);
  } finally {
    await client.close();
    console.log('\n📡 Disconnesso dal database');
  }
}

// Esegui la funzione
checkEmailRegistration();
