import { Router, Request, Response } from 'express';
import Tariffario from '../models/Tariffario';
import Patient from '../models/Patient';
import DocumentoFatturazione from '../models/DocumentoFatturazione';
import RichiestaPrenotazione, { TipoServizio } from '../models/RichiestaPrenotazione';
import { inviaEmail, inviaEmailConfermaRichiesta } from '../utils/email';
import { rateLimitByIP } from '../middleware/rateLimit';
import { generaNumero } from './fatturazioneDocumenti';

const router = Router();

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ═════════════════════════════════════════════════════════════════════════════
// LANDING PUBBLICA /preventivo — calcolatore prestazioni private dal listino
// Nessuna autenticazione: espone solo il listino attivo (prezzi > 0), il
// calcolo del preventivo e l'invio della richiesta. Riutilizza il Tariffario
// del gestionale (stessi prezzi dell'area riservata) e crea il preventivo con
// la numerazione PREV standard, marcato riferimentoTipo 'landing' così da
// comparire in una sezione separata dell'Archivio Preventivi.
// ═════════════════════════════════════════════════════════════════════════════

export const CATEGORIE_LISTINO: Record<string, { label: string; descrizione: string; ordine: number }> = {
  prestazioni_infermieristiche: { label: 'Prestazioni infermieristiche', descrizione: 'Accessi infermieristici a domicilio: medicazioni, iniezioni, cateteri, flebo, anche assistenza infermieristica a ore e notturna.', ordine: 1 },
  esami_strumentali: { label: 'Esami strumentali', descrizione: 'ECG, emogasanalisi (EGA), holter pressorio e cardiaco, polisonnigrafia e spirometria a domicilio con referto.', ordine: 2 },
  assistenza_domiciliare: { label: 'Assistenza OSS', descrizione: 'Assistenza alla persona a ore: OSS, igiene personale, bagno a letto e assistenza notturna.', ordine: 3 },
  visite_mediche: { label: 'Visite mediche specialistiche', descrizione: 'Visita dello specialista direttamente a casa del paziente.', ordine: 4 },
  prelievi: { label: 'Prelievi', descrizione: 'Prelievo ematico e raccolta campioni a domicilio con consegna al laboratorio.', ordine: 5 },
  riabilitazione: { label: 'Riabilitazione', descrizione: 'Fisioterapia, logopedia e terapie riabilitative a domicilio, a ora.', ordine: 6 },
  ecografia: { label: 'Ecografie ed ecocolordoppler', descrizione: 'Esami ecografici eseguiti a domicilio con referto.', ordine: 7 },
  radiologia: { label: 'Radiologia (RX) a domicilio', descrizione: 'Radiografie a domicilio con apparecchiatura portatile e referto.', ordine: 8 },
  trasporto: { label: 'Trasporto in ambulanza', descrizione: 'Trasporto sanitario per visite, dimissioni e trasferimenti.', ordine: 9 },
};

// Categoria Patient.categoriaPrivata e tipoServizio della richiesta derivati
// dalla categoria di listino prevalente nel preventivo.
const MAPPA_CATEGORIA_PAZIENTE: Record<string, string> = {
  prestazioni_infermieristiche: 'assistenza_domiciliare',
  esami_strumentali: 'diagnostica',
  assistenza_domiciliare: 'assistenza_domiciliare',
  visite_mediche: 'visite_mediche',
  prelievi: 'prelievi',
  riabilitazione: 'riabilitazione',
  ecografia: 'diagnostica',
  radiologia: 'diagnostica',
  trasporto: 'trasporto',
};
const MAPPA_TIPO_SERVIZIO: Record<string, TipoServizio> = {
  prestazioni_infermieristiche: 'prestazione',
  esami_strumentali: 'esame_strumentale',
  assistenza_domiciliare: 'assistenza',
  visite_mediche: 'visita_specialistica',
  prelievi: 'prelievo',
  riabilitazione: 'riabilitazione',
  ecografia: 'esame_strumentale',
  radiologia: 'esame_strumentale',
  trasporto: 'ambulanza',
};

interface RigaPreventivo {
  voceId: string;
  categoria: string;
  descrizione: string;
  unitaMisura?: string;
  note?: string;
  quantita: number;
  prezzoUnitario: number;   // prezzo applicato (promo se attiva, altrimenti listino)
  prezzoListino: number;    // prezzo di listino al momento del calcolo
  promo: boolean;           // true se e' stato applicato il prezzo promozionale
  importo: number;
}

// Prezzo effettivo di una voce: promo se attiva e valida, altrimenti listino.
function prezzoEffettivo(voce: any): { prezzo: number; promo: boolean } {
  const p = Number(voce.prezzoPromo);
  if (voce.promoAttiva && Number.isFinite(p) && p > 0 && p < voce.prezzo) return { prezzo: p, promo: true };
  return { prezzo: voce.prezzo, promo: false };
}

// Ricalcola le righe lato server a partire dagli id del listino: il client
// invia solo id + quantita', i prezzi vengono SEMPRE dal Tariffario (non sono
// modificabili dal calcolatore pubblico). Una variazione di listino vale da
// subito per i nuovi preventivi; quelli gia' emessi conservano i loro prezzi.
async function costruisciRighe(body: any): Promise<{ error?: string; righe?: RigaPreventivo[] }> {
  const voci = Array.isArray(body?.voci) ? body.voci : [];
  if (voci.length === 0) return { error: 'Seleziona almeno una prestazione' };
  if (voci.length > 40) return { error: 'Troppe prestazioni selezionate' };
  const ids = voci.map((v: any) => String(v?.id || '')).filter((id: string) => /^[a-f\d]{24}$/i.test(id));
  const listino = await Tariffario.find({ _id: { $in: ids }, attivo: true, prezzo: { $gt: 0 } }).lean();
  const righe: RigaPreventivo[] = [];
  for (const v of voci) {
    const voce: any = listino.find((l: any) => String(l._id) === String(v?.id));
    if (!voce) continue;
    const unita = Math.min(Math.max(Math.round(Number(v?.quantita) || 1), 1), 999);
    // Servizi orari (OSS, infermieristica, riabilitazione): la quantità è
    // ore/giorno e si può moltiplicare per il numero di giorni richiesti.
    const isOraria = voce.unitaMisura === 'ora';
    const giorni = isOraria ? Math.min(Math.max(Math.round(Number(v?.giorni) || 1), 1), 365) : 1;
    const q = unita * giorni;
    const { prezzo, promo } = prezzoEffettivo(voce);
    righe.push({
      voceId: String(voce._id),
      categoria: voce.categoria,
      descrizione: giorni > 1 ? `${voce.nome} — ${unita} ore/giorno × ${giorni} giorni` : voce.nome,
      unitaMisura: voce.unitaMisura || undefined,
      note: voce.note || undefined,
      quantita: q,
      prezzoUnitario: prezzo,
      prezzoListino: voce.prezzo,
      promo,
      importo: Math.round(q * prezzo * 100) / 100,
    });
  }
  if (righe.length === 0) return { error: 'Nessuna prestazione valida selezionata' };
  return { righe };
}

// Sconto "più servizi": 5% sul totale quando il preventivo contiene almeno
// due prestazioni diverse. Calcolato solo lato server e mostrato all'utente.
export const SCONTO_PIU_SERVIZI_PERC = 5;
const MIN_SERVIZI_PER_SCONTO = 2;

interface Totali { subtotale: number; scontoPerc: number; sconto: number; totale: number; scontoApplicato: boolean }

function calcolaTotali(righe: RigaPreventivo[]): Totali {
  const subtotale = Math.round(righe.reduce((a, r) => a + r.importo, 0) * 100) / 100;
  const scontoApplicato = righe.length >= MIN_SERVIZI_PER_SCONTO;
  const sconto = scontoApplicato ? Math.round(subtotale * SCONTO_PIU_SERVIZI_PERC) / 100 : 0;
  return { subtotale, scontoPerc: scontoApplicato ? SCONTO_PIU_SERVIZI_PERC : 0, sconto, totale: Math.round((subtotale - sconto) * 100) / 100, scontoApplicato };
}

function categoriaPrevalente(righe: RigaPreventivo[]): string {
  const perCat: Record<string, number> = {};
  for (const r of righe) perCat[r.categoria] = (perCat[r.categoria] || 0) + r.importo;
  return Object.entries(perCat).sort((a, b) => b[1] - a[1])[0]?.[0] || 'prestazioni_infermieristiche';
}

// ─── GET /api/landing-preventivo/listino — voci attive con prezzo, per categoria ─
router.get('/listino', rateLimitByIP(120, 15 * 60 * 1000), async (_req: Request, res: Response) => {
  try {
    const voci = await Tariffario.find({ attivo: true, prezzo: { $gt: 0 } })
      .sort({ categoria: 1, ordine: 1, nome: 1 })
      .select('categoria nome prezzo unitaMisura note promoAttiva prezzoPromo')
      .lean();
    const categorie = Object.entries(CATEGORIE_LISTINO)
      .sort((a, b) => a[1].ordine - b[1].ordine)
      .map(([key, meta]) => ({
        key,
        ...meta,
        voci: voci.filter((v: any) => v.categoria === key).map((v: any) => {
          const { prezzo, promo } = prezzoEffettivo(v);
          return {
            id: String(v._id), nome: v.nome,
            prezzo,                              // prezzo da applicare (promo se attiva)
            prezzoListino: v.prezzo,             // listino: mostrato barrato solo se promo
            promo,
            unitaMisura: v.unitaMisura || null, note: v.note || null,
          };
        }),
      }))
      .filter(c => c.voci.length > 0);
    return res.json({ categorie });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento del listino', error: error.message });
  }
});

// ─── POST /api/landing-preventivo/preview — calcolo senza salvare ─────────────
router.post('/preview', rateLimitByIP(120, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { error, righe } = await costruisciRighe(req.body);
    if (error) return res.status(400).json({ message: error });
    return res.json({ righe, ...calcolaTotali(righe!), minServiziPerSconto: MIN_SERVIZI_PER_SCONTO });
  } catch (error: any) {
    return res.status(400).json({ message: error.message || 'Errore nel calcolo del preventivo' });
  }
});

// ─── POST /api/landing-preventivo/richiesta — modulo → paziente + preventivo + richiesta + email
router.post('/richiesta', rateLimitByIP(10, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { nome, telefono, email, messaggio, utm } = req.body || {};
    if (!nome || !String(nome).trim()) return res.status(400).json({ message: 'Nome obbligatorio' });
    if (!telefono || !String(telefono).trim()) return res.status(400).json({ message: 'Numero di telefono obbligatorio' });
    const emailPulita = String(email || '').trim().toLowerCase();
    if (emailPulita && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPulita)) {
      return res.status(400).json({ message: 'Email non valida' });
    }

    const { error, righe } = await costruisciRighe(req.body);
    if (error) return res.status(400).json({ message: error });
    const totali = calcolaTotali(righe!);
    const tot = totali.totale;
    const catPrev = categoriaPrevalente(righe!);

    const utmString = utm && typeof utm === 'object'
      ? Object.entries(utm).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&').slice(0, 500)
      : '';
    const messaggioPulito = messaggio ? String(messaggio).trim().slice(0, 1000) : '';
    const inPromo = righe!.filter(r => r.promo);
    const notaPrezzi = inPromo.length
      ? ` — PREZZI PROMOZIONALI applicati: ${inPromo.map(r => `${r.descrizione} €${r.prezzoUnitario.toFixed(2)} (listino €${r.prezzoListino.toFixed(2)})`).join('; ')}`
      : '';
    const notaSconto = totali.scontoApplicato ? ` — SCONTO PIÙ SERVIZI ${totali.scontoPerc}%: -€${totali.sconto.toFixed(2)} su €${totali.subtotale.toFixed(2)}` : '';
    const notaBase = `Preventivo generato dal calcolatore pubblico /preventivo${utmString ? ` — UTM: ${utmString}` : ''}${notaPrezzi}${notaSconto}`;

    // 1) Paziente privato in accettazione (lead): compare nella Gestione Privata
    const partiNome = String(nome).trim().split(/\s+/);
    const paziente = await Patient.create({
      firstName: partiNome[0],
      lastName: partiNome.slice(1).join(' ') || partiNome[0],
      birthDate: new Date('1900-01-01'),
      address: 'Da definire',
      assistanceNeeds: `Prestazioni private — contatto dal calcolatore preventivi online (${CATEGORIE_LISTINO[catPrev]?.label || catPrev})`,
      contactPhone: String(telefono).trim(),
      email: emailPulita || undefined,
      tipoGestione: 'privato',
      categoriaPrivata: MAPPA_CATEGORIA_PAZIENTE[catPrev] || 'assistenza_domiciliare',
      inAccettazione: true,
    });

    // 2) Preventivo nell'Archivio Preventivi (sezione "dal calcolatore online")
    const numero = await generaNumero('preventivo', false);
    const preventivo = await DocumentoFatturazione.create({
      numero,
      tipo: 'preventivo',
      patient: paziente._id,
      riferimentoTipo: 'landing',
      prestazioni: [
        ...righe!.map(r => ({
          descrizione: `${r.unitaMisura ? `${r.descrizione} (${r.unitaMisura})` : r.descrizione}${r.promo ? ` — PROMO (listino €${r.prezzoListino.toFixed(2)})` : ''}`,
          quantita: r.quantita,
          prezzoUnitario: r.prezzoUnitario,
          importo: r.importo,
          tipo: r.categoria,
          aliquotaIva: 0,
        })),
        // riga sconto (negativa) cosi' PDF e totale documento restano coerenti
        ...(totali.scontoApplicato ? [{
          descrizione: `Sconto più servizi ${totali.scontoPerc}% (${righe!.length} prestazioni)`,
          quantita: 1,
          prezzoUnitario: -totali.sconto,
          importo: -totali.sconto,
          tipo: 'sconto',
          aliquotaIva: 0,
        }] : []),
      ],
      imponibile: tot,
      totaleIva: 0,
      totale: tot,
      data: new Date(),
      stato: 'emesso',
      note: `${notaBase}${messaggioPulito ? ` — Messaggio: ${messaggioPulito}` : ''}`,
      creatoDa: 'Calcolatore online',
    });

    // 3) Richiesta in Gestione Richieste
    const richiesta = await RichiestaPrenotazione.create({
      richiedenteNome: String(nome).trim(),
      richiedenteEmail: emailPulita || undefined,
      richiedenteTelefono: String(telefono).trim(),
      pazienteId: paziente._id,
      pazienteNome: `${paziente.firstName} ${paziente.lastName}`,
      pazienteIndirizzo: 'Da definire', // non copiare paziente.address: in memoria e' cifrato (pre-save encrypt)
      pazienteTelefono: String(telefono).trim(),
      tipoServizio: MAPPA_TIPO_SERVIZIO[catPrev] || 'prestazione',
      tipoSpecifico: `Preventivo ${numero} — ${righe!.map(r => `${r.descrizione} x${r.quantita}`).join(', ').slice(0, 300)}`,
      categoriaPrivata: ['diagnostica', 'assistenza_domiciliare'].includes(MAPPA_CATEGORIA_PAZIENTE[catPrev]) ? MAPPA_CATEGORIA_PAZIENTE[catPrev] : undefined,
      dataPreferita: new Date(),
      priorita: 'normale',
      noteRichiedente: messaggioPulito || undefined,
      stato: 'in_attesa',
      storicoModifiche: [{
        data: new Date(),
        autore: String(nome).trim(),
        azione: 'Richiesta dal calcolatore preventivi online',
        note: `Preventivo ${numero} — totale €${tot.toFixed(2)}${utmString ? ` — UTM: ${utmString}` : ''}`,
      }],
    });

    // 4) Notifica email admin
    let emailNotifica = false;
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'abbracciocuredomiciliari@gmail.com';
      const frontendUrl = process.env.FRONTEND_URL || 'https://app.abbracciocuredomiciliari.it';
      const righeHtml = righe!.map((r, i) => `<tr><td style="padding:6px;background:${i % 2 ? '#fff' : '#f8fafc'};">${esc(r.descrizione)}${r.unitaMisura ? ` <span style="color:#64748b">(${esc(r.unitaMisura)})</span>` : ''}</td><td style="padding:6px;text-align:center;">${r.quantita}</td><td style="padding:6px;text-align:right;">€${r.prezzoUnitario.toFixed(2)}${r.promo ? `<br><span style="color:#b91c1c;font-size:0.75rem;">PROMO · listino <s>€${r.prezzoListino.toFixed(2)}</s></span>` : ''}</td><td style="padding:6px;text-align:right;font-weight:bold;">€${r.importo.toFixed(2)}</td></tr>`).join('');
      await inviaEmail({
        to: adminEmail,
        subject: `🩺 Nuovo preventivo ${numero} dal calcolatore online — ${nome}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
          <h2 style="color:#1e4d8c;margin-top:0;">🩺 Nuova richiesta dal calcolatore preventivi prestazioni</h2>
          <p style="background:#eff6ff;padding:12px;border-radius:6px;border-left:4px solid #1e4d8c;">
            <strong>Azione richiesta:</strong> ricontattare il richiedente. Paziente in accettazione e preventivo <strong>${numero}</strong> già creati nella Gestione Privata.
          </p>
          ${inPromo.length ? `<p style="background:#fef2f2;padding:12px;border-radius:6px;border-left:4px solid #dc2626;color:#991b1b;"><strong>🏷 Promozione:</strong> ${inPromo.length} ${inPromo.length === 1 ? 'prestazione a prezzo promozionale' : 'prestazioni a prezzo promozionale'} (dettaglio in tabella).</p>` : ''}
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:150px;">Nome:</td><td style="padding:8px;">${esc(nome)}</td></tr>
            <tr><td style="padding:8px;background:#eff6ff;font-weight:bold;">Telefono:</td><td style="padding:8px;">${esc(telefono)}</td></tr>
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Email:</td><td style="padding:8px;">${esc(emailPulita) || '—'}</td></tr>
            ${messaggioPulito ? `<tr><td style="padding:8px;background:#eff6ff;font-weight:bold;">Messaggio:</td><td style="padding:8px;">${esc(messaggioPulito)}</td></tr>` : ''}
            ${utmString ? `<tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Campagna:</td><td style="padding:8px;font-family:monospace;">${esc(utmString)}</td></tr>` : ''}
          </table>
          <h3 style="color:#1e4d8c;font-size:1rem;">Preventivo ${numero}</h3>
          <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
            <tr style="background:#1e4d8c;color:#fff;"><th style="padding:6px;text-align:left;">Prestazione</th><th style="padding:6px;">Q.tà</th><th style="padding:6px;text-align:right;">Prezzo</th><th style="padding:6px;text-align:right;">Importo</th></tr>
            ${righeHtml}
            ${totali.scontoApplicato ? `<tr><td colspan="3" style="padding:6px;text-align:right;color:#64748b;">Subtotale</td><td style="padding:6px;text-align:right;">€${totali.subtotale.toFixed(2)}</td></tr>
            <tr><td colspan="3" style="padding:6px;text-align:right;color:#166534;font-weight:bold;">Sconto più servizi ${totali.scontoPerc}%</td><td style="padding:6px;text-align:right;color:#166534;font-weight:bold;">-€${totali.sconto.toFixed(2)}</td></tr>` : ''}
            <tr><td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">TOTALE</td><td style="padding:8px;text-align:right;font-weight:bold;font-size:1.05rem;color:#166534;">€${tot.toFixed(2)}</td></tr>
          </table>
          <a href="${frontendUrl}/archivio-preventivi" style="display:inline-block;margin-top:16px;background:#1e4d8c;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">Apri Archivio Preventivi →</a>
          <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari</p>
        </div>`,
      });
      emailNotifica = true;
    } catch (emailErr) {
      console.error('⚠️ Errore invio notifica landing preventivo:', emailErr);
    }

    // 5) Conferma ricezione al richiedente (se ha lasciato l'email)
    if (emailPulita) {
      inviaEmailConfermaRichiesta({
        to: emailPulita,
        nome: String(nome).trim(),
        oggettoRichiesta: 'richiesta di preventivo per prestazioni a domicilio',
        dettagli: [
          { label: 'Preventivo', valore: numero },
          { label: 'Prestazioni', valore: String(righe!.length) },
          ...(totali.scontoApplicato ? [{ label: 'Sconto più servizi', valore: `-${totali.scontoPerc}% (-€${totali.sconto.toFixed(2)})` }] : []),
          { label: 'Totale stimato', valore: `€${tot.toFixed(2)}` },
        ],
        note: 'Il preventivo è registrato nel nostro sistema: ti ricontatteremo per confermare disponibilità e tariffa nella tua zona.',
      }).catch(e => console.warn('⚠️ Errore conferma landing preventivo:', e?.message || e));
    }

    return res.status(201).json({
      message: 'Richiesta inviata con successo',
      emailNotifica,
      preventivo: { numero, totale: tot, subtotale: totali.subtotale, sconto: totali.sconto, scontoPerc: totali.scontoPerc, righe: righe!.length, richiestaId: richiesta._id },
    });
  } catch (error: any) {
    console.error('[Landing preventivo] Errore:', error);
    return res.status(500).json({ message: 'Errore nell\'invio della richiesta', error: error.message });
  }
});

export default router;
