import { Router, Request, Response } from 'express';
import BadanteIntermediazione from '../models/BadanteIntermediazione';
import Patient from '../models/Patient';
import RichiestaPrenotazione from '../models/RichiestaPrenotazione';
import { inviaEmail } from '../utils/email';
import { rateLimitByIP } from '../middleware/rateLimit';
import {
  simulaCostoBadante,
  CONTRATTI_SIM,
  caricaParametri,
  SimulazioneInput,
} from '../utils/costoBadante';

const router = Router();

// La landing propone il CAF sanitario a 50 €/mese (campagna pubblica): il default
// del gestionale (P.cafMensileDefault) resta invariato per l'area riservata.
const CAF_LANDING_DEFAULT = 50;
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ═════════════════════════════════════════════════════════════════════════════
// LANDING PUBBLICA /badante — calcolatore preventivi per campagne Meta/FB/IG
// Nessuna autenticazione: espone solo il calcolo e l'invio della richiesta.
// Riutilizza simulaCostoBadante + parametri CCNL dell'area riservata — stessa
// logica, stesse tariffe, stessa gestione CAF sanitario del gestionale.
// ═════════════════════════════════════════════════════════════════════════════

function validaSimulazione(body: any): { error?: string; input?: SimulazioneInput } {
  const { contrattoTipo, livello } = body || {};
  const tipiValidi = CONTRATTI_SIM.map(c => c.value);
  if (!contrattoTipo || !tipiValidi.includes(contrattoTipo)) {
    return { error: `contrattoTipo deve essere uno tra: ${tipiValidi.join(', ')}` };
  }
  const orario = contrattoTipo === 'non_convivente' || contrattoTipo === 'sostituzione';
  if (orario && !(Number(body.oreSettimanali) > 0)) {
    return { error: 'Ore settimanali obbligatorie per i contratti ad orario' };
  }
  return {
    input: {
      contrattoTipo,
      livello,
      oreSettimanali: body.oreSettimanali ? Number(body.oreSettimanali) : undefined,
      tempoDeterminato: !!body.tempoDeterminato,
      pagaPersonalizzata: body.pagaPersonalizzata ? Number(body.pagaPersonalizzata) : undefined,
      indennitaPiuAutosuff: !!body.indennitaPiuAutosuff,
      certificazioneUni: !!body.certificazioneUni,
      indennitaBabysitter: !!body.indennitaBabysitter,
    },
  };
}

// CAF sanitario: quota mensile mostrata sul preventivo; assente = default
// landing (50 €), 0 = rimossa dall'utente, altrimenti importo scelto.
function cafDaBody(body: any): number {
  const n = Number(body?.cafMensile);
  return Number.isFinite(n) && n >= 0 && n <= 2000 ? n : CAF_LANDING_DEFAULT;
}

// ─── POST /api/landing-badante/preview — calcolo costo mensile, senza salvare ──
router.post('/preview', rateLimitByIP(120, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { error, input } = validaSimulazione(req.body);
    if (error) return res.status(400).json({ message: error });
    const P = await caricaParametri();
    const sim = simulaCostoBadante(input!, P);
    return res.json({ ...sim, cafMensile: cafDaBody(req.body) });
  } catch (error: any) {
    return res.status(400).json({ message: error.message || 'Errore nel calcolo del costo' });
  }
});

// ─── POST /api/landing-badante/richiesta — modulo contatto → ricevuta + email ──
// Crea paziente (consulenza/intermediazione), ricevuta in "Intermediazione
// badanti" con la simulazione/preventivo collegato, richiesta in Gestione
// Richieste e notifica email all'amministrazione.
router.post('/richiesta', rateLimitByIP(10, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { nome, telefono, email, messaggio, utm } = req.body || {};
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ message: 'Nome obbligatorio' });
    }
    if (!telefono || !String(telefono).trim()) {
      return res.status(400).json({ message: 'Numero di telefono obbligatorio' });
    }
    const emailPulita = String(email || '').trim().toLowerCase();
    if (emailPulita && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPulita)) {
      return res.status(400).json({ message: 'Email non valida' });
    }

    const { error, input } = validaSimulazione(req.body);
    if (error) return res.status(400).json({ message: error });

    const P = await caricaParametri();
    const sim = simulaCostoBadante(input!, P);
    const cafMensile = cafDaBody(req.body);

    const utmString = utm && typeof utm === 'object'
      ? Object.entries(utm).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&').slice(0, 500)
      : '';
    const notaBase = `Richiesta da landing pubblica /badante${utmString ? ` — UTM: ${utmString}` : ''}`;

    // 1) Paziente: riuso se stessa email gia' presente in intermediazione, altrimenti nuovo lead
    const partiNome = String(nome).trim().split(/\s+/);
    const firstName = partiNome[0];
    const lastName = partiNome.slice(1).join(' ') || partiNome[0];
    let paziente = emailPulita
      ? await Patient.findOne({ email: emailPulita, tipoGestione: 'consulenza' })
      : null;
    if (!paziente) {
      paziente = await Patient.create({
        firstName,
        lastName,
        birthDate: new Date('1900-01-01'),
        address: 'Da definire',
        assistanceNeeds: 'Intermediazione badante/colf — contatto da landing page pubblica',
        contactPhone: String(telefono).trim(),
        email: emailPulita || undefined,
        tipoGestione: 'consulenza',
        categoriaPrivata: 'intermediazione_badanti',
        inAccettazione: true,
      });
    } else {
      if (!paziente.contactPhone) paziente.contactPhone = String(telefono).trim();
      paziente.inAccettazione = true;
      await paziente.save();
    }

    // 2) Ricevuta "Intermediazione badanti" con la simulazione (preventivo) collegata
    const livelloOk = ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'].includes(input!.livello || '')
      ? input!.livello
      : 'BS';
    const richiesta = await BadanteIntermediazione.create({
      patient: paziente._id,
      contrattoTipo: (input!.contrattoTipo === 'non_convivente' || input!.contrattoTipo === 'sostituzione') ? 'orario_non_convivente' : 'convivente',
      livello: livelloOk,
      oreSettimanali: sim.oreSettimanali,
      costoMensile: sim.totaleCostoMensile,
      note: `${notaBase}${messaggio ? ` — Messaggio: ${String(messaggio).trim().slice(0, 1000)}` : ''}`,
      stato: 'aperta',
      simulazione: {
        ...input,
        totaleCostoMensile: sim.totaleCostoMensile,
        retribuzioneNetta: sim.retribuzioneNetta,
        cafMensile,
      },
      creatoDa: 'Landing pubblica',
    });

    // 3) Richiesta in Gestione Richieste (visibile nel Centro Prenotazioni)
    const richiestaPrenotazione = await RichiestaPrenotazione.create({
      richiedenteNome: String(nome).trim(),
      richiedenteEmail: emailPulita || undefined,
      richiedenteTelefono: String(telefono).trim(),
      pazienteId: paziente._id,
      pazienteNome: `${paziente.firstName} ${paziente.lastName}`,
      pazienteIndirizzo: 'Da definire', // non copiare paziente.address: in memoria e' cifrato (pre-save encrypt)
      pazienteTelefono: String(telefono).trim(),
      tipoServizio: 'intermediazione',
      tipoSpecifico: `Preventivo ${sim.contrattoLabel} ${sim.livelloLabel} — ${sim.oreSettimanali}h/sett`,
      categoriaPrivata: 'intermediazione_badanti',
      dataPreferita: new Date(),
      priorita: 'normale',
      noteRichiedente: messaggio ? String(messaggio).trim() : undefined,
      stato: 'in_attesa',
      storicoModifiche: [{
        data: new Date(),
        autore: String(nome).trim(),
        azione: 'Richiesta da landing preventivo badante',
        note: `Costo mensile stimato €${sim.totaleCostoMensile.toFixed(2)} (netto lavoratore €${sim.retribuzioneNetta.toFixed(2)}) — CAF sanitario €${cafMensile.toFixed(2)}/mese — Intermediazione #${richiesta._id}${utmString ? ` — UTM: ${utmString}` : ''}`,
      }],
    });
    richiesta.richiestaPrenotazioneId = richiestaPrenotazione._id as any;
    await richiesta.save();

    // 4) Notifica email admin (non blocca la risposta, ma esito riportato)
    let emailNotifica = false;
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'abbracciocuredomiciliari@gmail.com';
      const frontendUrl = process.env.FRONTEND_URL || 'https://app.abbracciocuredomiciliari.it';
      await inviaEmail({
        to: adminEmail,
        subject: `🏠 Nuova richiesta preventivo badante — ${nome}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
          <h2 style="color:#c2410c;margin-top:0;">🏠 Nuova richiesta dalla landing preventivi badanti</h2>
          <p style="background:#fff7ed;padding:12px;border-radius:6px;border-left:4px solid #f97316;">
            <strong>Azione richiesta:</strong> ricontattare il richiedente. Ricevuta e preventivo già creati in Intermediazione badanti.
          </p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:150px;">Nome:</td><td style="padding:8px;">${esc(nome)}</td></tr>
            <tr><td style="padding:8px;background:#fff7ed;font-weight:bold;">Telefono:</td><td style="padding:8px;">${esc(telefono)}</td></tr>
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Email:</td><td style="padding:8px;">${esc(emailPulita) || '—'}</td></tr>
            ${messaggio ? `<tr><td style="padding:8px;background:#fff7ed;font-weight:bold;">Messaggio:</td><td style="padding:8px;">${esc(messaggio)}</td></tr>` : ''}
            ${utmString ? `<tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Campagna:</td><td style="padding:8px;font-family:monospace;">${esc(utmString)}</td></tr>` : ''}
          </table>
          <h3 style="color:#1e4d8c;font-size:1rem;">Preventivo calcolato</h3>
          <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
            <tr><td style="padding:6px;background:#f8fafc;font-weight:bold;">Contratto:</td><td style="padding:6px;">${sim.contrattoLabel} — ${sim.livelloLabel}, ${sim.oreSettimanali} h/sett</td></tr>
            <tr><td style="padding:6px;background:#fff7ed;font-weight:bold;">Retribuzione lorda:</td><td style="padding:6px;">€${sim.retribuzioneLordaMensile.toFixed(2)}/mese</td></tr>
            <tr><td style="padding:6px;background:#f8fafc;font-weight:bold;">Costo mensile famiglia:</td><td style="padding:6px;"><strong>€${sim.totaleCostoMensile.toFixed(2)}/mese</strong></td></tr>
            <tr><td style="padding:6px;background:#fff7ed;font-weight:bold;">Netto lavoratore:</td><td style="padding:6px;">€${sim.retribuzioneNetta.toFixed(2)}/mese</td></tr>
            <tr><td style="padding:6px;background:#f8fafc;font-weight:bold;">CAF sanitario:</td><td style="padding:6px;">€${cafMensile.toFixed(2)}/mese</td></tr>
          </table>
          <a href="${frontendUrl}/badanti-intermediazione" style="display:inline-block;margin-top:16px;background:#c2410c;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">Apri Intermediazione badanti →</a>
          <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari</p>
        </div>`,
      });
      emailNotifica = true;
    } catch (emailErr) {
      console.error('⚠️ Errore invio notifica landing badante:', emailErr);
    }

    return res.status(201).json({
      message: 'Richiesta inviata con successo',
      emailNotifica,
      preventivo: {
        contrattoLabel: sim.contrattoLabel,
        livelloLabel: sim.livelloLabel,
        totaleCostoMensile: sim.totaleCostoMensile,
        retribuzioneNetta: sim.retribuzioneNetta,
        cafMensile,
      },
    });
  } catch (error: any) {
    console.error('[Landing badante] Errore:', error);
    return res.status(500).json({ message: 'Errore nell\'invio della richiesta', error: error.message });
  }
});

export default router;
