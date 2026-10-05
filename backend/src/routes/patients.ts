import { Router, Request, Response } from 'express';
import Patient from '../models/Patient';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { encrypt, hashForSearch } from '../utils/encryption';

const router = Router();

router.use(authenticateToken);

router.get('/', auditLog('patients', 'READ'), async (req: Request, res: Response) => {
  try {
    const { tipo, page, limit, search, cf } = req.query;
    const filter: any = {};
    if (cf && typeof cf === 'string' && cf.trim()) filter.codiceFiscaleHash = hashForSearch(cf.trim().toUpperCase());
    if (tipo === 'privato') {
      filter.tipoGestione = 'privato';
      // I pazienti "consulenza famiglie" (intermediazione badanti) non fanno più parte dell'area privata
      filter.categoriaPrivata = { $ne: 'intermediazione_badanti' };
    } else if (tipo === 'convenzione') {
      filter.tipoGestione = 'convenzione';
    } else if (tipo === 'consulenza') {
      // Pazienti dell'area Consulenza Famiglie: nuovi con tipoGestione dedicato
      // e storici marcati come intermediazione_badanti
      filter.$or = [
        { tipoGestione: 'consulenza' },
        { tipoGestione: 'privato', categoriaPrivata: 'intermediazione_badanti' },
      ];
    }
    if (req.query.categoriaPrivata && tipo !== 'consulenza' && req.query.categoriaPrivata !== 'intermediazione_badanti') {
      filter.categoriaPrivata = req.query.categoriaPrivata;
    }
    if (req.query.categoriaPrivata) filter.categoriaPrivata = req.query.categoriaPrivata;
    // Ricerca per nome/cognome se passato
    if (search && typeof search === 'string' && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ firstName: regex }, { lastName: regex }];
    }
    // Paginazione opzionale — senza page/limit si restituisce tutto (retrocompatibile)
    if (page !== undefined && limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
      const skip = (pageNum - 1) * limitNum;
      const [patients, total] = await Promise.all([
        Patient.find(filter).sort({ lastName: 1, firstName: 1 }).skip(skip).limit(limitNum),
        Patient.countDocuments(filter),
      ]);
      return res.json({ data: patients, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) });
    }
    const patients = await Patient.find(filter).sort({ lastName: 1, firstName: 1 });
    return res.json(patients);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei pazienti', error });
  }
});

router.post('/', authorizeRole('admin', 'coordinator'), auditLog('patients', 'CREATE'), async (req: Request, res: Response) => {
  const { firstName, lastName, birthDate, address, assistanceNeeds, codiceFiscale, tipoGestione, categoriaPrivata, siat } = req.body;

  if (!firstName?.trim() || !lastName?.trim() || !birthDate || !address?.trim() || !assistanceNeeds?.trim()) {
    return res.status(400).json({ message: 'I campi firstName, lastName, birthDate, address e assistanceNeeds sono obbligatori' });
  }

  try {
    const patient = await Patient.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate,
      address: address.trim(),
      assistanceNeeds: assistanceNeeds.trim(),
      contactPhone: req.body.contactPhone?.trim(),
      email: req.body.email?.trim(),
      codiceFiscale: codiceFiscale?.trim(),
      tipoGestione: ['privato', 'convenzione', 'consulenza'].includes(tipoGestione) ? tipoGestione : 'privato',
      categoriaPrivata: tipoGestione === 'consulenza' ? 'intermediazione_badanti' : (tipoGestione === 'convenzione' ? undefined : (categoriaPrivata || undefined)),
      inAccettazione: req.body.inAccettazione === true,
      terminato: req.body.terminato === true,
      terminatoIl: req.body.terminato === true ? new Date() : undefined,
      siat: siat || undefined,
    });
    return res.status(201).json(patient);
  } catch (error) {
    return res.status(400).json({ message: 'Errore nella creazione del paziente', error });
  }
});

// POST /api/patients/import-siat - Importa pazienti in convenzione da CSV SIAT
router.post('/import-siat', authorizeRole('admin', 'coordinator'), auditLog('patients', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const { pazienti, nomeFile } = req.body as {
      pazienti: Array<{
        firstName: string;
        lastName: string;
        birthDate: string;
        address: string;
        codiceFiscale?: string;
        contactPhone?: string;
        npi?: string;
        codiceAutorizzazione?: string;
        codicePrestazione?: string;
        tipologiaCura?: string;
        dataAutorizzazione?: string;
        dataScadenzaAutorizzazione?: string;
        distretto?: string;
        asl?: string;
        uvm?: string;
        medicoReferente?: string;
        note?: string;
      }>;
      nomeFile: string;
    };

    if (!Array.isArray(pazienti) || pazienti.length === 0) {
      return res.status(400).json({ message: 'Nessun paziente nel payload' });
    }

    const risultati = { creati: 0, aggiornati: 0, errori: [] as string[] };
    const dataImport = new Date();

    for (const p of pazienti) {
      try {
        if (!p.firstName || !p.lastName || !p.birthDate || !p.address) {
          risultati.errori.push(`Riga saltata: dati obbligatori mancanti per ${p.firstName} ${p.lastName}`);
          continue;
        }

        const siatData = {
          npi: p.npi,
          codiceAutorizzazione: p.codiceAutorizzazione,
          codicePrestazione: p.codicePrestazione,
          tipologiaCura: p.tipologiaCura,
          dataAutorizzazione: p.dataAutorizzazione ? new Date(p.dataAutorizzazione) : undefined,
          dataScadenzaAutorizzazione: p.dataScadenzaAutorizzazione ? new Date(p.dataScadenzaAutorizzazione) : undefined,
          distretto: p.distretto,
          asl: p.asl,
          uvm: p.uvm,
          medicoReferente: p.medicoReferente,
          note: p.note,
          importatoDa: nomeFile,
          importatoIl: dataImport,
        };

        // Cerca per codice fiscale hash o nome+data nascita
        const filtroEsistente: any = p.codiceFiscale
          ? { codiceFiscaleHash: hashForSearch(p.codiceFiscale.toUpperCase().trim()) }
          : { firstName: { $regex: p.firstName, $options: 'i' }, lastName: { $regex: p.lastName, $options: 'i' } };

        const esistente = await Patient.findOne(filtroEsistente);

        if (esistente) {
          await Patient.findByIdAndUpdate(esistente._id, {
            tipoGestione: 'convenzione',
            siat: siatData,
          });
          risultati.aggiornati++;
        } else {
          await Patient.create({
            firstName: p.firstName.trim(),
            lastName: p.lastName.trim(),
            birthDate: new Date(p.birthDate),
            address: p.address.trim(),
            assistanceNeeds: p.tipologiaCura || 'Convenzione SIAT',
            contactPhone: p.contactPhone?.trim(),
            codiceFiscale: p.codiceFiscale?.toUpperCase(),
            tipoGestione: 'convenzione',
            siat: siatData,
          });
          risultati.creati++;
        }
      } catch (err: any) {
        risultati.errori.push(`Errore per ${p.firstName} ${p.lastName}: ${err.message}`);
      }
    }

    return res.status(201).json({
      message: `Import completato: ${risultati.creati} creati, ${risultati.aggiornati} aggiornati`,
      ...risultati,
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore import SIAT', error: error?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/patients/scadenze-pai
// Restituisce pazienti SIAT con PAI in scadenza entro 7 giorni (o già scaduto)
// il cui alert non sia stato ancora chiuso (alertPaiVisto assente),
// oppure in scadenza da meno di 48h rispetto all'ultima chiusura (riapertura automatica)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/scadenze-pai', authorizeRole('admin', 'coordinator', 'direttore'), async (req: Request, res: Response) => {
  try {
    const oggi = new Date();
    const tra7giorni = new Date(oggi.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Pazienti SIAT con scadenza entro 7 giorni o già scaduta
    const pazienti = await Patient.find({
      tipoGestione: 'convenzione',
      'siat.dataScadenzaAutorizzazione': { $lte: tra7giorni },
    })
      .select('firstName lastName address siat.dataScadenzaAutorizzazione siat.tipologiaCura siat.npi siat.asl siat.distretto alertPaiVisto')
      .sort({ 'siat.dataScadenzaAutorizzazione': 1 });

    // Filtra: includi solo quelli con alert non ancora visto (o riscaduto dopo chiusura)
    const daAlertare = pazienti.filter(p => {
      const scadenza = p.siat?.dataScadenzaAutorizzazione;
      if (!scadenza) return false;

      // Se l'alert è già stato chiuso, riapri solo se la scadenza è già passata
      // e la chiusura è avvenuta prima della scadenza effettiva
      if (p.alertPaiVisto?.vistoIl) {
        const vistoIl = new Date(p.alertPaiVisto.vistoIl);
        const scadenzaDate = new Date(scadenza);
        // Se la scadenza è già passata E la chiusura era antecedente alla scadenza → riapri
        if (scadenzaDate < oggi && vistoIl < scadenzaDate) return true;
        // Altrimenti l'alert è già stato gestito
        return false;
      }
      return true;
    });

    return res.json(daAlertare);
  } catch (error) {
    return res.status(500).json({ message: 'Errore recupero scadenze PAI', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/patients/nuovi-accettati
// Restituisce pazienti che hanno accettato (firma preventivo / attivazione piano)
// il cui alert dashboard non sia stato ancora chiuso dopo l'ultima accettazione
// ─────────────────────────────────────────────────────────────────────────────
router.get('/nuovi-accettati', authorizeRole('admin', 'coordinator', 'direttore'), async (req: Request, res: Response) => {
  try {
    const pazienti = await Patient.find({
      accettatoIl: { $exists: true, $ne: null },
      terminato: { $ne: true },
    })
      .select('firstName lastName accettatoIl alertAccettazioneVisto categoriaPrivata')
      .sort({ accettatoIl: -1 });

    const daAlertare = pazienti.filter(p => {
      if (!p.accettatoIl) return false;
      const vistoIl = p.alertAccettazioneVisto?.vistoIl;
      // Alert già gestito dopo l'ultima accettazione → non mostrare
      if (vistoIl && new Date(vistoIl) >= new Date(p.accettatoIl)) return false;
      return true;
    });

    return res.json(daAlertare);
  } catch (error) {
    return res.status(500).json({ message: 'Errore recupero nuovi accettati', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/patients/:id - Modifica dati anagrafici/indirizzo/contatti paziente
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', authorizeRole('admin', 'coordinator'), auditLog('patients', 'UPDATE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Paziente non trovato' });

    const {
      firstName, lastName, birthDate, address, assistanceNeeds,
      contactPhone, email, codiceFiscale, categoriaPrivata, tipoGestione, inAccettazione, terminato, accetta,
    } = req.body;

    if (firstName !== undefined) patient.firstName = firstName.trim();
    if (lastName !== undefined) patient.lastName = lastName.trim();
    if (birthDate !== undefined) patient.birthDate = new Date(birthDate);
    if (address !== undefined) patient.address = address.trim();
    if (assistanceNeeds !== undefined) patient.assistanceNeeds = assistanceNeeds.trim();
    if (contactPhone !== undefined) patient.contactPhone = contactPhone?.trim() || undefined;
    if (email !== undefined) patient.email = email?.trim() || undefined;
    if (codiceFiscale !== undefined) patient.codiceFiscale = codiceFiscale?.trim() || undefined;
    if (categoriaPrivata !== undefined) patient.categoriaPrivata = categoriaPrivata;
    if (tipoGestione !== undefined && ['privato', 'convenzione', 'consulenza'].includes(tipoGestione)) {
      patient.tipoGestione = tipoGestione;
      if (tipoGestione === 'convenzione') patient.categoriaPrivata = undefined;
      if (tipoGestione === 'consulenza') patient.categoriaPrivata = 'intermediazione_badanti';
    }
    if (inAccettazione !== undefined) patient.inAccettazione = inAccettazione === true;
    if (accetta === true) {
      // Passaggio manuale: paziente accettato senza firma preventivo / attivazione piano
      patient.inAccettazione = false;
      if (!patient.accettatoIl) patient.accettatoIl = new Date();
      patient.alertAccettazioneVisto = undefined; // riapri segnale dashboard del passaggio
    }
    if (terminato !== undefined) {
      patient.terminato = terminato === true;
      if (patient.terminato) {
        if (!patient.terminatoIl) patient.terminatoIl = new Date();
        patient.inAccettazione = false;  // un paziente terminato non è più in accettazione
      } else {
        patient.terminatoIl = undefined;
      }
    }

    await patient.save();
    return res.json(patient);
  } catch (error) {
    return res.status(400).json({ message: "Errore nell'aggiornamento del paziente", error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/patients/:id - Dettaglio singolo paziente
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', auditLog('patients', 'READ', req => req.params.id), async (req: Request, res: Response) => {
  try {
    const paziente = await Patient.findById(req.params.id);
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });
    return res.json(paziente);
  } catch (error) {
    return res.status(500).json({ message: 'Errore recupero paziente', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/patients/:id/segna-alert-visto
// Segna l'alert PAI come visto dall'utente corrente
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/segna-alert-visto', authorizeRole('admin', 'coordinator', 'direttore'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const paziente = await Patient.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          alertPaiVisto: {
            vistoIl: new Date(),
            vistoDa: user.name || user.email,
            vistoDaId: user.id || user.userId,
          },
        },
      },
      { new: true }
    );
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });
    return res.json({ ok: true, alertPaiVisto: paziente.alertPaiVisto });
  } catch (error) {
    return res.status(500).json({ message: 'Errore aggiornamento alert PAI', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/patients/:id/segna-accettazione-vista
// Segna l'alert 'paziente accettato' come visto dall'utente corrente
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/segna-accettazione-vista', authorizeRole('admin', 'coordinator', 'direttore'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const paziente = await Patient.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          alertAccettazioneVisto: {
            vistoIl: new Date(),
            vistoDa: user.name || user.email,
            vistoDaId: user.id || user.userId,
          },
        },
      },
      { new: true }
    );
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });
    return res.json({ ok: true, alertAccettazioneVisto: paziente.alertAccettazioneVisto });
  } catch (error) {
    return res.status(500).json({ message: 'Errore aggiornamento alert accettazione', error });
  }
});

// PATCH /api/patients/:id/dati-clinici - Aggiorna dati clinici ADI (diagnosi, comorbilità, allergie, caregiver)
router.patch('/:id/dati-clinici', authorizeRole('admin', 'coordinator', 'operatore'), auditLog('patients', 'UPDATE'), async (req: Request, res: Response) => {
  try {
    const { diagnosiAmmissione, comorbilita, allergie, caregiverRiferimento, caregiverTelefono, codiceFiscale } = req.body;
    const update: any = { diagnosiAmmissione, comorbilita, allergie, caregiverRiferimento };
    if (caregiverTelefono) update.caregiverTelefono = encrypt(caregiverTelefono.trim());
    if (codiceFiscale) {
      const cf = codiceFiscale.toUpperCase().trim();
      update.codiceFiscale = encrypt(cf);
      update.codiceFiscaleHash = hashForSearch(cf);
    }
    const paziente = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });
    return res.json(paziente);
  } catch (error) {
    return res.status(500).json({ message: 'Errore aggiornamento dati clinici', error });
  }
});

// DELETE /api/patients/:id - Elimina un paziente (solo admin)
router.delete('/:id', authorizeRole('admin'), auditLog('patients', 'DELETE'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const paziente = await Patient.findByIdAndDelete(id);
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });
    return res.json({ message: 'Paziente eliminato con successo', patientId: id });
  } catch (error) {
    return res.status(500).json({ message: 'Errore eliminazione paziente', error });
  }
});

export default router;
