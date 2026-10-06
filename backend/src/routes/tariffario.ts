import { Router, Request, Response } from 'express';
import Tariffario from '../models/Tariffario';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { TARIFFARIO_SEED } from '../utils/tariffarioSeed';

const router = Router();

const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];

const NOMI_ESAMI_STRUMENTALI = ['ECG', 'Holter cardiaco', 'Holter pressorio', 'Spirometria', 'Polisonnigrafo', 'Polisonnografia'];

function calcolaIsEsameStrumentale(categoria: string, nome: string): boolean {
  return categoria === 'radiologia' ||
    categoria === 'ecografia' ||
    NOMI_ESAMI_STRUMENTALI.includes(nome.trim());
}

// ─── Auto-seed idempotente: se il listino è vuoto, popola con i valori di default ───
export async function seedTariffarioSeVuoto() {
  try {
    const count = await Tariffario.countDocuments();
    if (count === 0) {
      await Tariffario.insertMany(TARIFFARIO_SEED.map(v => ({ ...v, attivo: true })));
      console.log(`✅ Tariffario: inserite ${TARIFFARIO_SEED.length} voci di default.`);
    }
  } catch (err) {
    console.error('Errore seed tariffario:', err);
  }
}

export async function migraEsamiStrumentaliTariffario() {
  try {
    const res = await Tariffario.updateMany(
      {
        $and: [
          {
            $or: [
              { categoria: { $in: ['radiologia', 'ecografia'] } },
              { categoria: 'prestazioni_infermieristiche', nome: { $in: NOMI_ESAMI_STRUMENTALI } },
            ],
          },
          {
            $or: [
              { isEsameStrumentale: { $exists: false } },
              { isEsameStrumentale: false },
            ],
          },
        ],
      },
      { $set: { isEsameStrumentale: true } }
    );
    if (res.modifiedCount > 0) {
      console.log(`✅ Tariffario: marcati ${res.modifiedCount} esami strumentali.`);
    }
  } catch (err) {
    console.error('Errore migrazione esami strumentali tariffario:', err);
  }
}

const NOMI_ASSISTENZA_TRASPORTO = ['Bagno a letto', 'Assistenza OSS', 'Assistenza notturna (notte h21–h07)', 'Assistenza infermieristica', 'Assistenza infermieristica notturna (h21–h07)'];
const VOCI_ASSISTENZA_SEED = TARIFFARIO_SEED.filter(v => v.categoria === 'assistenza_domiciliare' && NOMI_ASSISTENZA_TRASPORTO.includes(v.nome));

export async function migraVociAssistenzaTariffario() {
  try {
    const res = await Tariffario.updateMany(
      {
        categoria: 'prestazioni_infermieristiche',
        nome: { $in: NOMI_ASSISTENZA_TRASPORTO },
      },
      { $set: { categoria: 'assistenza_trasporto', isEsameStrumentale: false } }
    );
    if (res.modifiedCount > 0) {
      console.log(`✅ Tariffario: spostate ${res.modifiedCount} voci assistenza in Assistenza e Trasporto.`);
    }

    // Carica eventuali voci mancanti
    const esistenti = await Tariffario.find({ nome: { $in: NOMI_ASSISTENZA_TRASPORTO } }).select('nome').lean();
    const esistentiNomi = new Set(esistenti.map((d: any) => d.nome));
    const mancanti = VOCI_ASSISTENZA_SEED
      .filter(v => !esistentiNomi.has(v.nome))
      .map(v => ({ ...v, attivo: true, isEsameStrumentale: false }));
    if (mancanti.length > 0) {
      await Tariffario.insertMany(mancanti);
      console.log(`✅ Tariffario: caricate ${mancanti.length} voci assistenza.`);
    }
  } catch (err) {
    console.error('Errore migrazione voci assistenza tariffario:', err);
  }
}

// ─── Seed incrementale Visite Mediche: inserisce le voci mancanti (idempotente) ───
const VOCI_VISITE_SEED = TARIFFARIO_SEED.filter(v => v.categoria === 'visite_mediche');

export async function seedVisiteMedicheTariffario() {
  try {
    const esistenti = await Tariffario.find({ categoria: 'visite_mediche' }).select('nome').lean();
    const esistentiNomi = new Set(esistenti.map((d: any) => d.nome));
    const mancanti = VOCI_VISITE_SEED
      .filter(v => !esistentiNomi.has(v.nome))
      .map(v => ({ ...v, attivo: true }));
    if (mancanti.length > 0) {
      await Tariffario.insertMany(mancanti);
      console.log(`✅ Tariffario: caricate ${mancanti.length} voci visite mediche.`);
    }
  } catch (err) {
    console.error('Errore seed visite mediche tariffario:', err);
  }
}

// ─── Separazione definitiva: Assistenza Domiciliare / Trasporto / Prelievi ─────
// Storicamente "assistenza_trasporto" mischiava assistenza oraria (OSS/infermieristica)
// con il vero trasporto in ambulanza, e i prelievi stavano dentro "prestazioni_infermieristiche".
// Questa migrazione idempotente separa le tre cose in categorie dedicate e coerenti.
const NOMI_SOLO_ASSISTENZA = ['Bagno a letto', 'Assistenza OSS', 'Assistenza notturna (notte h21–h07)', 'Assistenza infermieristica', 'Assistenza infermieristica notturna (h21–h07)'];
const NOMI_SOLO_TRASPORTO = ['Ambulanza percorso urbano andata', 'Ambulanza andata e ritorno', 'Extraurbano', 'Urgenza (in 2h)'];
const NOMI_PRELIEVI = ['Prelievo ematico ed esame urine (consegnato)', 'Raccolta urine sterile con cateterismo estemporaneo'];

export async function separaCategorieTariffario() {
  try {
    const rAssistenza = await Tariffario.updateMany(
      { nome: { $in: NOMI_SOLO_ASSISTENZA } },
      { $set: { categoria: 'assistenza_domiciliare' } }
    );
    const rTrasporto = await Tariffario.updateMany(
      { nome: { $in: NOMI_SOLO_TRASPORTO } },
      { $set: { categoria: 'trasporto' } }
    );
    const rPrelievi = await Tariffario.updateMany(
      { nome: { $in: NOMI_PRELIEVI } },
      { $set: { categoria: 'prelievi' } }
    );
    // Rete di sicurezza: qualsiasi voce rimasta nella vecchia categoria mista finisce in trasporto
    const rResidue = await Tariffario.updateMany(
      { categoria: 'assistenza_trasporto' },
      { $set: { categoria: 'trasporto' } }
    );
    const totale = rAssistenza.modifiedCount + rTrasporto.modifiedCount + rPrelievi.modifiedCount + rResidue.modifiedCount;
    if (totale > 0) {
      console.log(`✅ Tariffario: separate categorie (assistenza ${rAssistenza.modifiedCount}, trasporto ${rTrasporto.modifiedCount}, prelievi ${rPrelievi.modifiedCount}, residue ${rResidue.modifiedCount}).`);
    }
  } catch (err) {
    console.error('Errore separazione categorie tariffario:', err);
  }
}

// GET /api/tariffario — lista completa (tutti gli utenti autenticati)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { soloAttivi } = req.query;
    const filtro: any = {};
    if (soloAttivi === 'true') filtro.attivo = true;
    const voci = await Tariffario.find(filtro).sort({ categoria: 1, ordine: 1, nome: 1 });
    return res.json(voci);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento del tariffario', error: error.message });
  }
});

// POST /api/tariffario — crea nuova voce (solo gestione)
router.post('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('tariffario', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const { categoria, nome, prezzo, unitaMisura, note, ordine } = req.body;
    if (!categoria || !nome || prezzo === undefined) {
      return res.status(400).json({ message: 'Campi obbligatori: categoria, nome, prezzo' });
    }
    const user = req.user as { email?: string } | undefined;
    const voce = await Tariffario.create({
      categoria, nome, prezzo, unitaMisura, note,
      ordine: ordine || 0,
      aggiornatoDa: user?.email,
      isEsameStrumentale: calcolaIsEsameStrumentale(categoria, nome),
    });
    return res.status(201).json(voce);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella creazione della voce', error: error.message });
  }
});

// PUT /api/tariffario/:id — modifica voce (prezzo, nome, ecc.) (solo gestione)
router.put('/:id', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('tariffario', 'UPDATE'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user as { email?: string } | undefined;
    const isEsame = calcolaIsEsameStrumentale(req.body.categoria || '', req.body.nome || '');
    const voce = await Tariffario.findByIdAndUpdate(
      req.params.id,
      { ...req.body, aggiornatoDa: user?.email, isEsameStrumentale: isEsame },
      { new: true, runValidators: true }
    );
    if (!voce) return res.status(404).json({ message: 'Voce non trovata' });
    return res.json(voce);
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nell'aggiornamento della voce", error: error.message });
  }
});

// DELETE /api/tariffario/:id — elimina definitivamente (solo admin)
router.delete('/:id', authenticateToken, authorizeRole('admin'), auditLog('tariffario', 'DELETE'), async (req: Request, res: Response) => {
  try {
    const voce = await Tariffario.findByIdAndDelete(req.params.id);
    if (!voce) return res.status(404).json({ message: 'Voce non trovata' });
    return res.json({ message: 'Voce eliminata' });
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nell'eliminazione della voce", error: error.message });
  }
});

export default router;
