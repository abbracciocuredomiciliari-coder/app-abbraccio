import { Router, Request, Response } from 'express';
import Patient from '../models/Patient';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';

const router = Router();

router.use(authenticateToken);

router.get('/', auditLog('patients', 'READ'), async (req: Request, res: Response) => {
  try {
    const { tipo } = req.query; // 'privato' | 'convenzione' | undefined (tutti)
    const filter: any = {};
    if (tipo === 'privato') filter.tipoGestione = 'privato';
    else if (tipo === 'convenzione') filter.tipoGestione = 'convenzione';
    const patients = await Patient.find(filter).sort({ lastName: 1, firstName: 1 });
    return res.json(patients);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei pazienti', error });
  }
});

router.post('/', authorizeRole('admin', 'coordinator'), auditLog('patients', 'CREATE'), async (req: Request, res: Response) => {
  const { firstName, lastName, birthDate, address, assistanceNeeds, codiceFiscale, tipoGestione, siat } = req.body;

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
      codiceFiscale: codiceFiscale?.trim(),
      tipoGestione: tipoGestione || 'privato',
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

        // Cerca per codice fiscale o nome+data nascita
        const filtroEsistente: any = p.codiceFiscale
          ? { codiceFiscale: p.codiceFiscale.toUpperCase() }
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

export default router;
