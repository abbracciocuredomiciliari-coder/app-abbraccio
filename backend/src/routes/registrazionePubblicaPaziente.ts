import { Router, Request, Response } from 'express';
import Patient from '../models/Patient';
import { inviaEmail } from '../utils/email';

const router = Router();

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/registrazione-pubblica-paziente — pubblica, senza login
// Crea direttamente un paziente nel modello privato (senza approvazione)
// ═════════════════════════════════════════════════════════════════════════════
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      // Dati paziente
      firstName,
      lastName,
      birthDate,
      codiceFiscale,
      address,
      contactPhone,
      email,
      assistanceNeeds,
      diagnosiAmmissione,
      comorbilita,
      allergie,
      // Dati caregiver/richiedente
      caregiverNome,
      caregiverRelazione, // es: 'figlio', 'coniuge', 'parente', 'paziente_stesso', 'altro'
      caregiverTelefono,
      caregiverEmail,
      noteAggiuntive,
    } = req.body;

    // Validazione campi obbligatori
    if (!firstName || !lastName || !birthDate || !address || !assistanceNeeds) {
      return res.status(400).json({
        message: 'Compila tutti i campi obbligatori: nome, cognome, data di nascita, indirizzo, esigenze assistenziali'
      });
    }

    // Validazione caregiver (se non è il paziente stesso)
    const isPazienteStesso = caregiverRelazione === 'paziente_stesso';
    if (!isPazienteStesso && !caregiverNome) {
      return res.status(400).json({
        message: 'Inserire il nome del caregiver che richiede l\'assistenza'
      });
    }

    // Controllo duplicato per codice fiscale (se fornito)
    if (codiceFiscale) {
      const esistenteCF = await Patient.findOne({ codiceFiscale: codiceFiscale.toUpperCase().trim() });
      if (esistenteCF) {
        return res.status(409).json({
          message: 'Esiste già un paziente con questo codice fiscale. Contatta la struttura per aggiornare i dati.'
        });
      }
    }

    // Controllo duplicato per nome + data nascita
    const esistenteNome = await Patient.findOne({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: new Date(birthDate)
    });
    if (esistenteNome) {
      return res.status(409).json({
        message: 'Esiste già un paziente con questi dati anagrafici. Contatta la struttura per verificare.'
      });
    }

    // Creazione paziente con tipoGestione 'privato' di default
    const patient = await Patient.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: new Date(birthDate),
      address: address.trim(),
      assistanceNeeds: assistanceNeeds.trim(),
      contactPhone: contactPhone?.trim() || undefined,
      email: email?.trim().toLowerCase() || undefined,
      codiceFiscale: codiceFiscale?.trim().toUpperCase() || undefined,
      diagnosiAmmissione: diagnosiAmmissione?.trim() || undefined,
      comorbilita: comorbilita?.trim() || undefined,
      allergie: allergie?.trim() || undefined,
      caregiverRiferimento: isPazienteStesso ? `${firstName} ${lastName} (paziente stesso)` : `${caregiverNome} (${caregiverRelazione})`,
      caregiverTelefono: caregiverTelefono?.trim() || contactPhone?.trim() || undefined,
      tipoGestione: 'privato', // sempre privato per registrazione pubblica
    });

    // Invio email notifica alla struttura
    try {
      await inviaEmail({
        to: process.env.EMAIL_ADMIN || process.env.EMAIL_USER || '',
        subject: `🏥 Nuova registrazione paziente privato — ${firstName} ${lastName}`,
        html: `
          <h2>Nuova registrazione paziente (modello privato)</h2>
          <p><strong>Paziente:</strong> ${firstName} ${lastName}</p>
          <p><strong>Data nascita:</strong> ${new Date(birthDate).toLocaleDateString('it-IT')}</p>
          <p><strong>Codice Fiscale:</strong> ${codiceFiscale || 'Non fornito'}</p>
          <p><strong>Indirizzo:</strong> ${address}</p>
          <p><strong>Telefono:</strong> ${contactPhone || 'Non fornito'}</p>
          <p><strong>Email:</strong> ${email || 'Non fornita'}</p>
          <hr>
          <p><strong>Esigenze assistenziali:</strong><br>${assistanceNeeds}</p>
          ${diagnosiAmmissione ? `<p><strong>Diagnosi:</strong> ${diagnosiAmmissione}</p>` : ''}
          ${comorbilita ? `<p><strong>Comorbilità:</strong> ${comorbilita}</p>` : ''}
          ${allergie ? `<p><strong>Allergie:</strong> ${allergie}</p>` : ''}
          <hr>
          <p><strong>Richiedente:</strong> ${isPazienteStesso ? 'Il paziente stesso' : `${caregiverNome} (${caregiverRelazione})`}</p>
          <p><strong>Contatto richiedente:</strong> Tel: ${caregiverTelefono || 'Non fornito'} — Email: ${caregiverEmail || 'Non fornita'}</p>
          ${noteAggiuntive ? `<p><strong>Note:</strong> ${noteAggiuntive}</p>` : ''}
          <hr>
          <p><em>Il paziente è stato creato automaticamente nel sistema con gestione PRIVATO.</em></p>
          <p><a href="${process.env.FRONTEND_URL || ''}/patients">Vai alla lista pazienti</a></p>
        `,
      });
    } catch (emailErr) {
      console.warn('⚠️ Errore invio email notifica registrazione:', emailErr);
      // Non bloccare la risposta se l'email fallisce
    }

    // Invio email conferma al caregiver/paziente (se email fornita)
    if (caregiverEmail || email) {
      try {
        await inviaEmail({
          to: caregiverEmail || email,
          subject: `✅ Registrazione confermata — Abbracciare Cure Domiciliari`,
          html: `
            <h2>Grazie per averci scelto!</h2>
            <p>La richiesta di assistenza domiciliare per <strong>${firstName} ${lastName}</strong> è stata registrata.</p>
            <p><strong>Cosa succede ora:</strong></p>
            <ul>
              <li>Il nostro staff valuterà l'istanza e verificherà la disponibilità</li>
              <li>Vi contatteremo entro 24-48 ore per organizzare la prima visita</li>
              <li>Per urgenze, chiamare il numero in calce</li>
            </ul>
            <hr>
            <p><em>Abbracciare Cure Domiciliari</em></p>
          `,
        });
      } catch (emailErr) {
        console.warn('⚠️ Errore invio email conferma:', emailErr);
      }
    }

    return res.status(201).json({
      message: 'Registrazione completata con successo',
      patientId: patient._id,
      patient: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        tipoGestione: patient.tipoGestione,
      }
    });

  } catch (error: any) {
    console.error('❌ Errore registrazione pubblica paziente:', error);
    return res.status(500).json({
      message: 'Errore durante la registrazione. Riprova più tardi.',
      error: error.message,
    });
  }
});

export default router;
