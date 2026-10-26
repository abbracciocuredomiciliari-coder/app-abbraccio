// ─── Invio email contratto d'incarico + GDPR (+ preventivo allegato) ─────────
// Helper riusabile: usato da routes/contrattiPazienti.ts e dal flusso
// intermediazione badanti (routes/badantiIntermediazione.ts).

import crypto from 'crypto';
import type { Request } from 'express';
import ContrattoPaziente from '../models/ContrattoPaziente';
import DocumentoFatturazione from '../models/DocumentoFatturazione';
import { inviaEmail } from './email';
import { generaDocumentoPDF } from './fatturazionePdf';
import { generaContrattoPazientePDF, generaGdprPDF } from './contrattoPazientePdf';
import { decrypt } from './encryption';

export function normalizzaPaziente(raw: any) {
  const p = raw && raw.toJSON ? raw.toJSON() : { ...raw };
  p.address = decrypt(p.address);
  p.contactPhone = decrypt(p.contactPhone);
  p.codiceFiscale = decrypt(p.codiceFiscale);
  p.email = p.email || '';
  return p;
}

// Invia al destinatario: contratto PDF, informativa GDPR PDF, preventivo/allegato
// e link pubblico per la firma online. Ritorna true solo se l'SMTP ha accettato
// il messaggio; false se non configurato o rifiutato dal server. Solleva
// eccezione per errori pre-invio (contratto mancante, generazione PDF).
export async function inviaEmailContrattoPaziente(contrattoId: string, email: string, req: Request): Promise<boolean> {
  const contratto = await ContrattoPaziente.findById(contrattoId)
    .populate('patient', 'firstName lastName birthDate address contactPhone codiceFiscale email');
  if (!contratto) throw new Error('Contratto non trovato');
  if (!contratto.token) contratto.token = crypto.randomBytes(32).toString('hex');
  contratto.email = email;
  await contratto.save();

  const pazienteNorm = normalizzaPaziente(contratto.patient);
  const pdfContratto = await generaContrattoPazientePDF(contratto.toObject(), pazienteNorm);
  const pdfGdpr = await generaGdprPDF(pazienteNorm, {
    nomeFirmatario: contratto.nome || `${pazienteNorm.firstName} ${pazienteNorm.lastName}`,
    cognomeFirmatario: '',
    finalita: { prestazioneSanitaria: true, fatturazione: true, auditInterno: true, ricercaScientifica: false },
    datiSensibili: { datiSanitari: true, datiEconomici: true, immagini: false },
    accettato: false,
  });

  const frontendUrl = process.env.FRONTEND_URL || 'https://app.abbracciocuredomiciliari.it';
  const apiProtocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const apiHost = req.get('host') || 'api.abbracciocuredomiciliari.it';
  const anteprimaUrl = `${apiProtocol}://${apiHost}/api/contratti-pazienti/anteprima/${contratto.token}`;
  const gdprUrl = `${apiProtocol}://${apiHost}/api/contratti-pazienti/gdpr/${contratto.token}`;
  const contrattoPdfUrl = `${apiProtocol}://${apiHost}/api/contratti-pazienti/contratto-pdf/${contratto.token}`;
  const gdprPdfUrl = `${apiProtocol}://${apiHost}/api/contratti-pazienti/gdpr-pdf/${contratto.token}`;
  const firmaUrl = `${frontendUrl}/firma-contratto-paziente?token=${contratto.token}`;
  const preventivoUrl = contratto.preventivoId ? `${apiProtocol}://${apiHost}/api/contratti-pazienti/preventivo/${contratto.token}` : '';
  const allegatoUrl = contratto.allegatoData ? `${apiProtocol}://${apiHost}/api/contratti-pazienti/allegato/${contratto.token}` : '';

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
    <h2 style="color:#1e4d8c;margin-top:0;">Contratto d'incarico e informativa GDPR</h2>
    <p>Gentile <strong>${pazienteNorm.firstName || ''} ${pazienteNorm.lastName || ''}</strong>,</p>
    <p>in allegato trovi in formato PDF il contratto d'incarico completo e l'informativa GDPR${(preventivoUrl || allegatoUrl) ? ', insieme al documento preventivo,' : ''} per l'attività di reclutamento del profilo <strong>${contratto.profilo}</strong>.</p>
    <p style="margin:16px 0;padding:16px;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:6px;">
      <strong>Leggi entrambi i documenti</strong> prima di firmare:<br/>
      <a href="${anteprimaUrl}" style="display:inline-block;margin-top:8px;background:#16a34a;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Visualizza contratto</a>
      <a href="${gdprUrl}" style="display:inline-block;margin-top:8px;margin-left:8px;background:#16a34a;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Visualizza GDPR</a><br/>
      <a href="${contrattoPdfUrl}" style="display:inline-block;margin-top:8px;background:#047857;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Scarica contratto (PDF)</a>
      <a href="${gdprPdfUrl}" style="display:inline-block;margin-top:8px;margin-left:8px;background:#047857;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Scarica GDPR (PDF)</a>
    </p>
    ${(preventivoUrl || allegatoUrl) ? `<p style="margin:16px 0;padding:16px;background:#fffbeb;border-left:4px solid #d97706;border-radius:6px;">
      <strong>Documento preventivo allegato</strong> — scaricalo in formato PDF:<br/>
      ${preventivoUrl ? `<a href="${preventivoUrl}" style="display:inline-block;margin-top:8px;background:#d97706;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Scarica preventivo (PDF)</a>` : ''}
      ${allegatoUrl ? `<a href="${allegatoUrl}" style="display:inline-block;margin-top:8px;${preventivoUrl ? 'margin-left:8px;' : ''}background:#d97706;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Scarica allegato${contratto.allegatoFileName ? ` (${contratto.allegatoFileName})` : ''}</a>` : ''}
    </p>` : ''}
    <p style="margin:16px 0;padding:16px;background:#eff6ff;border-left:4px solid #1e4d8c;border-radius:6px;">
      Dopo averli letti, firma contratto e consenso <strong>online con dito o penna</strong>:<br/>
      <a href="${firmaUrl}" style="display:inline-block;margin-top:8px;background:#1e4d8c;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Firma contratto e consenso</a>
    </p>
    <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari S.R.L.S.</p>
  </div>`;

  const attachments: { filename: string; content?: Buffer; contentType?: string }[] = [
    {
      filename: `contratto-incarico-${contratto.profilo.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      content: pdfContratto,
      contentType: 'application/pdf',
    },
    {
      filename: `informativa-gdpr.pdf`,
      content: pdfGdpr,
      contentType: 'application/pdf',
    },
  ];
  if (contratto.preventivoId) {
    const docPrev = await DocumentoFatturazione.findById(contratto.preventivoId)
      .populate('patient', 'firstName lastName codiceFiscale address email')
      .lean();
    if (docPrev) {
      attachments.push({
        filename: `PREVENTIVO-${docPrev.numero}.pdf`,
        content: await generaDocumentoPDF(docPrev),
        contentType: 'application/pdf',
      });
    }
  }
  if (contratto.allegatoData) {
    attachments.push({
      filename: contratto.allegatoFileName || 'allegato',
      content: contratto.allegatoData,
      contentType: contratto.allegatoContentType || 'application/octet-stream',
    });
  }

  const nomePaziente = `${pazienteNorm?.firstName || ''} ${pazienteNorm?.lastName || ''}`.trim();
  return await inviaEmail({
    to: email,
    subject: `Contratto d'incarico e GDPR ${contratto.profilo} — Abbraccio Cure Domiciliari`,
    html,
    attachments,
    log: {
      tipo: 'contratto',
      area: contratto.contesto === 'intermediazione' || contratto.richiestaId ? 'intermediazione' : 'privato',
      riferimento: nomePaziente || undefined,
    },
  });
}
