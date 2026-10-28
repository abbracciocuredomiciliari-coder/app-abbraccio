import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import Staff from '../models/Staff';

// ═══════════════════════════════════════════════════════════════════════════
// ALBO PUBBLICO — dati pubblici e anonimi per la mappa dei professionisti.
// Restituisce SOLO lat/lng + categoria: mai nomi, telefoni o dati personali.
// Le coordinate subiscono un offset deterministico (~1,5 km) derivato
// dall'hash dell'id: il pallino resta nella zona giusta ma non punta
// mai all'abitazione reale della persona (privacy dei lavoratori).
// ═══════════════════════════════════════════════════════════════════════════

const router = Router();

// Solo figure assistenziali visibili in pubblico: esclusi ruoli interni
// (direzione, coordinamento, privato) che non sono operatori erogatori
const CAT_LABEL: Record<string, string> = {
  badante: 'Badante', colf: 'Colf', 'assistente-familiare': 'Assistente familiare',
  oss: 'OSS', infermieristico: 'Infermiere', medico: 'Medico',
  riabilitativo: 'Fisioterapista', sociale: 'Operatore sociale', osa: 'OSA',
};
const CAT_AMMESSE = Object.keys(CAT_LABEL);

// Offset deterministico ~1-2 km per id, stessa direzione/distanza a ogni chiamata
const jitter = (id: string) => {
  const h = crypto.createHash('sha256').update(`albo:${id}`).digest();
  const ang = (h[0] / 255) * 2 * Math.PI;
  const dist = 0.008 + (h[1] / 255) * 0.012; // ~0,9-2,2 km in gradi
  return { dLat: Math.cos(ang) * dist, dLng: (Math.sin(ang) * dist) / Math.cos(Math.PI / 4) };
};

// ─── GET /mappa — pallini anonimi dei professionisti con coordinate ─────────
router.get('/mappa', async (_req: Request, res: Response) => {
  try {
    const staff = await Staff.find({
      active: { $ne: false },
      category: { $in: CAT_AMMESSE },
      'domicilioCoords.lat': { $exists: true, $ne: null },
      'domicilioCoords.lng': { $exists: true, $ne: null },
    }).select('domicilioCoords category').lean();

    const marker = staff.map((s: any) => {
      const j = jitter(String(s._id));
      return {
        lat: +(s.domicilioCoords.lat + j.dLat).toFixed(4),
        lng: +(s.domicilioCoords.lng + j.dLng).toFixed(4),
        cat: CAT_LABEL[s.category] || 'Operatore',
      };
    });

    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ totale: marker.length, marker });
  } catch (error) {
    console.error('[Albo] Errore mappa:', error);
    return res.status(500).json({ message: 'Errore caricamento mappa' });
  }
});

export default router;
