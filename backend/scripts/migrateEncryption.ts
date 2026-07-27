import 'dotenv/config';
import mongoose from 'mongoose';
import Patient from '../src/models/Patient';
import Staff from '../src/models/Staff';
import { decrypt } from '../src/utils/encryption';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI mancante');
  if (!process.env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY mancante');

  await mongoose.connect(uri);
  console.log('Connesso a MongoDB. Inizio migrazione field-level encryption...');

  let pUpdated = 0, pErrors = 0, sUpdated = 0, sErrors = 0;

  try {
    for await (const doc of Patient.find().cursor()) {
      try {
        // Decifra valori legacy/pianura, pre-save li ricifrerà con AES-256-GCM
        doc.address = decrypt(doc.address);
        if (doc.contactPhone) doc.contactPhone = decrypt(doc.contactPhone);
        if (doc.caregiverTelefono) doc.caregiverTelefono = decrypt(doc.caregiverTelefono);
        if (doc.codiceFiscale) {
          doc.codiceFiscale = decrypt(doc.codiceFiscale);
        }
        // Mark as modified to trigger pre('save') hooks
        doc.markModified('address');
        doc.markModified('contactPhone');
        doc.markModified('caregiverTelefono');
        doc.markModified('codiceFiscale');
        await doc.save();
        pUpdated++;
      } catch (e) {
        console.error('Errore paziente', doc._id, e);
        pErrors++;
      }
    }

    for await (const doc of Staff.find().cursor()) {
      try {
        if (doc.phone) doc.phone = decrypt(doc.phone);
        doc.markModified('phone');
        await doc.save();
        sUpdated++;
      } catch (e) {
        console.error('Errore staff', doc._id, e);
        sErrors++;
      }
    }

    console.log(`Migrazione completata: pazienti ${pUpdated} (errori ${pErrors}), staff ${sUpdated} (errori ${sErrors})`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error('Migrazione fallita:', e);
  process.exit(1);
});
