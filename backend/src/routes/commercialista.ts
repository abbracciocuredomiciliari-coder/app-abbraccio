import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import ConsegnaCommercialista from '../models/ConsegnaCommercialista';
import DocumentoFatturazione from '../models/DocumentoFatturazione';
import FatturaRicevuta from '../models/FatturaRicevuta';
import RitenutaAcconto from '../models/RitenutaAcconto';
import generaDocumentoPDF from '../utils/fatturazionePdf';
import generaRitenutaPDF from '../utils/ritenutaPdf';
import { buildZip, ZipEntry } from '../utils/zipStore';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// AREA COMMERCIALISTA — accesso limitato alla sola documentazione
// amministrativa esplicitamente resa disponibile (consegne marcate come
// consegnate/verificate). Nessun accesso a cartelle cliniche, note operative,
// pazienti o pratiche: questo router espone SOLO le due operazioni sotto.
// ═══════════════════════════════════════════════════════════════════════════

const STATI_VISIBILI = ['scaricata', 'consegnata', 'verificata'];

// GET /api/commercialista/consegne — le consegne rese disponibili dall'ufficio
router.get('/consegne', authenticateToken, authorizeRole('commercialista'), async (_req: Request, res: Response) => {
  try {
    const consegne = await ConsegnaCommercialista.find({ stato: { $in: STATI_VISIBILI } })
      .select('periodoDal periodoAl tipologie stato preparataIl preparataDa consegnataIl modalitaConsegna anomalie documenti.origine documenti.numero documenti.soggetto documenti.data documenti.totale')
      .sort({ preparataIl: -1 }).limit(50).lean();
    return res.json(consegne.map((c: any) => ({
      _id: c._id,
      periodoDal: c.periodoDal,
      periodoAl: c.periodoAl,
      tipologie: c.tipologie,
      stato: c.stato,
      preparataIl: c.preparataIl,
      consegnataIl: c.consegnataIl,
      modalitaConsegna: c.modalitaConsegna,
      totaleDocumenti: (c.documenti || []).length,
      anomalie: (c.anomalie || []).length,
    })));
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore caricamento consegne', error: error.message });
  }
});

// GET /api/commercialista/consegne/:id/pacchetto — download ZIP indice+originali.
// Solo consegne esplicitamente rese disponibili: niente bozze né preparazioni interne.
router.get('/consegne/:id/pacchetto', authenticateToken, authorizeRole('commercialista'), async (req: Request, res: Response) => {
  try {
    const consegna = await ConsegnaCommercialista.findById(req.params.id);
    if (!consegna || !STATI_VISIBILI.includes(consegna.stato)) {
      return res.status(404).json({ message: 'Consegna non disponibile' });
    }
    const entries: ZipEntry[] = [];
    const righeIndice: string[] = [];
    const escCsv = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const slug = (s: string) => String(s || '').replace(/[^\w.-]+/g, '_').slice(0, 80);

    for (const d of consegna.documenti || []) {
      let fileName = '';
      try {
        if (['fattura', 'preventivo', 'nota_credito'].includes(d.origine)) {
          const doc = await DocumentoFatturazione.findById(d.rifId)
            .populate('patient', 'firstName lastName codiceFiscale address email').lean();
          if (doc) {
            fileName = `documenti/${d.origine}/${slug(d.numero)}.pdf`;
            entries.push({ name: fileName, data: await generaDocumentoPDF(doc) });
          }
        } else if (d.origine === 'fattura_ricevuta') {
          const doc = await FatturaRicevuta.findById(d.rifId).select('allegato').lean() as any;
          if (doc?.allegato?.contenuto) {
            const ext = (doc.allegato.fileName || 'doc.pdf').split('.').pop() || 'pdf';
            fileName = `documenti/fatture-ricevute/${slug(d.numero)}.${ext}`;
            entries.push({ name: fileName, data: doc.allegato.contenuto });
          }
        } else if (d.origine === 'ritenuta') {
          const doc = await RitenutaAcconto.findById(d.rifId).lean();
          if (doc) {
            fileName = `documenti/ritenute/${slug(d.numero)}.pdf`;
            entries.push({ name: fileName, data: await generaRitenutaPDF(doc as any) });
          }
        }
      } catch (e) {
        console.error(`[Commercialista pacchetto] Errore ${d.rifId}:`, e);
      }
      righeIndice.push([d.origine, d.numero, d.soggetto, d.data ? new Date(d.data).toLocaleDateString('it-IT') : '', (d.totale ?? '').toString().replace('.', ','), fileName || 'ORIGINALE NON DISPONIBILE'].map(escCsv).join(';'));
    }

    entries.unshift({ name: '00-INDICE.csv', data: Buffer.from('﻿"origine";"numero";"soggetto";"data";"totale";"file"\r\n' + righeIndice.join('\r\n'), 'utf8') });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="documenti-${consegna._id}.zip"`);
    return res.send(buildZip(entries));
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore generazione pacchetto', error: error.message });
  }
});

export default router;
