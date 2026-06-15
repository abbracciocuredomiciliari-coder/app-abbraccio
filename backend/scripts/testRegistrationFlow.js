const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testRegistrationFlow() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    console.log('🧪 Test flusso di registrazione e cancellazione...');
    await client.connect();
    console.log('✅ Connesso al database');

    const db = client.db('app-abbraccio');
    
    const testEmail = 'test_operatore@example.com';
    
    console.log('\n📋 Stato iniziale:');
    const initialUser = await db.collection('users').findOne({ email: testEmail });
    console.log(`   Utente con email "${testEmail}": ${initialUser ? 'TROVATO' : 'NON TROVATO'}`);
    
    console.log('\n🧪 Simulazione processo di registrazione:');
    
    // Simula il controllo che farebbe l'endpoint di registrazione
    const existingUser = await db.collection('users').findOne({ 
      email: testEmail.toLowerCase().trim() 
    });
    
    if (existingUser) {
      console.log(`   ❌ Email "${testEmail}" già registrata (ID: ${existingUser._id})`);
      console.log('   Questo bloccherebbe una nuova registrazione.');
      
      // Mostra dettagli dell'utente esistente
      console.log('   Dettagli utente esistente:');
      console.log(`     - Nome: ${existingUser.name || 'N/D'}`);
      console.log(`     - Ruolo: ${existingUser.role || 'N/D'}`);
      console.log(`     - Stato: ${existingUser.status || 'N/D'}`);
      console.log(`     - Creato: ${existingUser.createdAt || 'N/D'}`);
      console.log(`     - Aggiornato: ${existingUser.updatedAt || 'N/D'}`);
      
    } else {
      console.log(`   ✅ Email "${testEmail}" disponibile per la registrazione`);
    }
    
    console.log('\n🔍 Analisi del problema:');
    console.log('   Se un operatore viene cancellato ma l\'email rimane, le cause potrebbero essere:');
    console.log('   1. Soft delete (cambiamento stato invece di eliminazione fisica)');
    console.log('   2. Errore durante l\'eliminazione');
    console.log('   3. Transazione non completata');
    console.log('   4. Backup/replica del database non sincronizzata');
    
    // Mostra tutti gli utenti operatori per vedere se ci sono anomalie
    console.log('\n📋 Tutti gli utenti operatori:');
    const operatorUsers = await db.collection('users').find({ 
      role: { $in: ['operator', 'staff'] }
    }).toArray();
    
    console.log(`   Trovati ${operatorUsers.length} operatori:`);
    operatorUsers.forEach(user => {
      console.log(`     - ${user.name} (${user.email}) - Stato: ${user.status || 'N/D'} - Creato: ${user.createdAt}`);
    });
    
    // Controlla se ci sono utenti con stato "deleted", "inactive", etc.
    console.log('\n🔍 Ricerca utenti con stato di cancellazione:');
    const deletedUsers = await db.collection('users').find({
      $or: [
        { status: { $regex: /delete|inactive|suspend|cancel/i } },
        { deleted: true },
        { isActive: false }
      ]
    }).toArray();
    
    if (deletedUsers.length > 0) {
      console.log(`   Trovati ${deletedUsers.length} utenti potenzialmente cancellati:`);
      deletedUsers.forEach(user => {
        console.log(`     - ${user.name} (${user.email}) - Status: ${user.status}`);
      });
    } else {
      console.log('   Nessun utente con stato di cancellazione trovato');
    }
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error);
  } finally {
    await client.close();
    console.log('\n📡 Disconnesso dal database');
  }
}

// Esegui la funzione
testRegistrationFlow();
