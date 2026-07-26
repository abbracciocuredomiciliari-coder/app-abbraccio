import nodemailer from 'nodemailer';

// ─── Crea il transporter SMTP (configurazione standard — compatibile con Brevo/Gmail/altri) ──
function getTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn(
      `⚠️ SMTP non configurato — SMTP_HOST=${smtpHost || 'MANCANTE'}, ` +
      `SMTP_USER=${smtpUser || 'MANCANTE'}, SMTP_PASS=${smtpPass ? '***' : 'MANCANTE'}`
    );
    return null;
  }

  console.log(`📧 SMTP: host=${smtpHost}, port=${smtpPort}, user=${smtpUser}`);

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

// ─── Verifica connessione SMTP all'avvio ──────────────────────────────────────
export async function verificaConnessioneSMTP() {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('⚠️ SMTP non disponibile — le email non verranno inviate');
    return false;
  }
  try {
    await transporter.verify();
    console.log('✅ Connessione SMTP verificata con successo');
    return true;
  } catch (err: any) {
    console.error('❌ Verifica SMTP fallita:', err?.message || err);
    if (err?.code) console.error(`   Codice: ${err.code}`);
    return false;
  }
}

// ─── Funzione generica di invio ───────────────────────────────────────────────
async function invia(to: string, subject: string, html: string): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`⚠️ Email non inviata a ${to} — SMTP non configurato`);
    return false;
  }
  try {
    const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
    const info = await transporter.sendMail({
      from: `"App Abbraccio" <${fromEmail}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email inviata a ${to} — messageId: ${info.messageId}`);
    return true;
  } catch (err: any) {
    console.error(`❌ Errore invio email a ${to}:`, err?.message || err);
    if (err?.code) console.error(`   Codice: ${err.code}`);
    if (err?.response) console.error(`   Risposta SMTP: ${err.response}`);
    if (err?.responseCode) console.error(`   Codice risposta: ${err.responseCode}`);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Funzione generica per invio email (wrapper pubblico della funzione invia)
// ═════════════════════════════════════════════════════════════════════════════
export async function inviaEmail(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<boolean> {
  // Per ora ignora il campo from (usa default), in futuro può essere esteso
  return invia(options.to, options.subject, options.html);
}

// ─── Notifica admin — nuova registrazione ─────────────────────────────────────
export async function inviaEmailNotificaAdmin(
  nomeUtente: string,
  emailUtente: string,
  professione: string
) {
  const adminEmail = process.env.ADMIN_EMAIL || 'abbracciocuredomiciliari@gmail.com';
  if (!adminEmail) {
    console.warn('⚠️ ADMIN_EMAIL non configurata — notifica admin saltata');
    return;
  }
  const frontendUrl = process.env.FRONTEND_URL || 'https://app-abbraccio-frontend-rw2c.vercel.app';
  await invia(
    adminEmail,
    '🔔 Nuova richiesta di registrazione — App Abbraccio',
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#1e4d8c;margin-top:0;">🔔 Nuova richiesta di registrazione</h2>
      <p>Un nuovo utente ha richiesto l'accesso all'app <strong>Abbraccio Cure Domiciliari</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:140px;">Nome:</td><td style="padding:8px;">${nomeUtente}</td></tr>
        <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Email:</td><td style="padding:8px;">${emailUtente}</td></tr>
        <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Professione:</td><td style="padding:8px;">${professione || 'Non specificata'}</td></tr>
      </table>
      <a href="${frontendUrl}/gestione-utenti" style="display:inline-block;background:#1e4d8c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Vai a Gestione Utenti →</a>
    </div>`
  );
}

// ─── Notifica operatore — nuovo piano di lavoro ───────────────────────────────
export async function inviaEmailNuovoPianoDiLavoro(
  emailOperatore: string,
  nomeOperatore: string,
  nomePaziente: string,
  dataInizio: string,
  task: string,
  pianoId?: string
) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://app-abbraccio-frontend-rw2c.vercel.app';
  console.log(`📧 Tentativo invio email piano a: ${emailOperatore}`);

  const linkPortale = pianoId
    ? `${frontendUrl}/portale-operatore?piano=${pianoId}&azione=accettazione`
    : `${frontendUrl}/portale-operatore`;

  await invia(
    emailOperatore,
    '📋 Nuovo piano di lavoro assegnato — Azione richiesta',
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#1e4d8c;margin-top:0;">📋 Nuovo piano di lavoro assegnato</h2>
      <p>Caro/a <strong>${nomeOperatore}</strong>,</p>
      <p>Ti è stato assegnato un nuovo piano di lavoro su <strong>Abbraccio Cure Domiciliari</strong>.</p>
      <p style="background:#fef3c7;padding:12px;border-radius:6px;border-left:4px solid #f59e0b;">
        <strong>⚠️ Azione richiesta:</strong> Accetta o rifiuta l'incarico dal tuo portale operatore.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:140px;">Paziente:</td><td style="padding:8px;">${nomePaziente}</td></tr>
        <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Data inizio:</td><td style="padding:8px;">${dataInizio}</td></tr>
        <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Attività:</td><td style="padding:8px;">${task}</td></tr>
      </table>
      <div style="display:flex;gap:12px;margin:20px 0;flex-wrap:wrap;">
        <a href="${linkPortale}" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;text-align:center;">✅ Accetta Incarico</a>
        <a href="${linkPortale}" style="display:inline-block;background:#dc2626;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;text-align:center;">❌ Rifiuta Incarico</a>
      </div>
      <p style="margin-top:16px;font-size:14px;color:#666;">
        Clicca su uno dei pulsanti sopra per aprire il portale operatore e gestire l'incarico.
      </p>
      <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari</p>
    </div>`
  );
}

// ─── Reset password — link sicuro via email ───────────────────────────────────
export async function inviaEmailResetPassword(
  emailDestinatario: string,
  nomeUtente: string,
  resetToken: string
) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://app-abbraccio-frontend-rw2c.vercel.app';
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
  console.log(`📧 Invio email reset password a: ${emailDestinatario}`);
  await invia(
    emailDestinatario,
    '🔑 Reset password — App Abbraccio',
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#1e4d8c;margin-top:0;">🔑 Reset della tua password</h2>
      <p>Ciao <strong>${nomeUtente}</strong>,</p>
      <p>Hai richiesto il reset della password per il tuo account su <strong>Abbraccio Cure Domiciliari</strong>.</p>
      <p>Clicca il pulsante qui sotto per impostare una nuova password. Il link è valido per <strong>1 ora</strong>.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#1e4d8c;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:1rem;">Reimposta password →</a>
      </div>
      <p style="font-size:0.85rem;color:#888;">Se non hai richiesto il reset, ignora questa email. La password non verrà modificata.</p>
      <p style="font-size:0.85rem;color:#888;">Se il pulsante non funziona, copia questo link nel browser:<br/><a href="${resetUrl}" style="color:#1e4d8c;">${resetUrl}</a></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
      <p style="margin:0;font-size:12px;color:#888;">Abbraccio Cure Domiciliari</p>
    </div>`
  );
}

// ─── Notifica operatore — prelievo assegnato ──────────────────────────────────
export async function inviaEmailPrelievoAssegnato(
  emailOperatore: string,
  nomeOperatore: string,
  nomePaziente: string,
  dataPrelievo: string,
  tipoPrelievo: string
) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://app-abbraccio-frontend-rw2c.vercel.app';
  console.log(`📧 Tentativo invio email prelievo a: ${emailOperatore}`);
  await invia(
    emailOperatore,
    '💉 Prelievo assegnato — App Abbraccio',
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#0369a1;margin-top:0;">💉 Prelievo assegnato</h2>
      <p>Caro/a <strong>${nomeOperatore}</strong>,</p>
      <p>Ti è stato assegnato un nuovo prelievo su <strong>Abbraccio Cure Domiciliari</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f0f9ff;font-weight:bold;width:140px;">Paziente:</td><td style="padding:8px;">${nomePaziente}</td></tr>
        <tr><td style="padding:8px;background:#e0f2fe;font-weight:bold;">Data:</td><td style="padding:8px;">${dataPrelievo}</td></tr>
        <tr><td style="padding:8px;background:#f0f9ff;font-weight:bold;">Tipo:</td><td style="padding:8px;">${tipoPrelievo}</td></tr>
      </table>
      <a href="${frontendUrl}/portale-operatore" style="display:inline-block;background:#0369a1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Vai al Portale Operatore →</a>
      <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari</p>
    </div>`
  );
}

// ─── Notifica operatore — esame strumentale assegnato ─────────────────────────
export async function inviaEmailEsameAssegnato(
  emailOperatore: string,
  nomeOperatore: string,
  nomePaziente: string,
  dataEsame: string,
  tipoEsame: string
) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://app-abbraccio-frontend-rw2c.vercel.app';
  console.log(`📧 Tentativo invio email esame a: ${emailOperatore}`);
  await invia(
    emailOperatore,
    '🔬 Esame strumentale assegnato — App Abbraccio',
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#dc2626;margin-top:0;">🔬 Esame strumentale assegnato</h2>
      <p>Caro/a <strong>${nomeOperatore}</strong>,</p>
      <p>Ti è stato assegnato un nuovo esame strumentale su <strong>Abbraccio Cure Domiciliari</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#fef2f2;font-weight:bold;width:140px;">Paziente:</td><td style="padding:8px;">${nomePaziente}</td></tr>
        <tr><td style="padding:8px;background:#fee2e2;font-weight:bold;">Data:</td><td style="padding:8px;">${dataEsame}</td></tr>
        <tr><td style="padding:8px;background:#fef2f2;font-weight:bold;">Tipo:</td><td style="padding:8px;">${tipoEsame}</td></tr>
      </table>
      <a href="${frontendUrl}/portale-operatore" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Vai al Portale Operatore →</a>
      <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari</p>
    </div>`
  );
}

// ─── Notifica operatore — nuovo paziente assegnato ────────────────────────────
export async function inviaEmailNuovoPaziente(
  emailOperatore: string,
  nomeOperatore: string,
  nomePaziente: string,
  indirizzo: string
) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://app-abbraccio-frontend-rw2c.vercel.app';
  console.log(`📧 Tentativo invio email paziente a: ${emailOperatore}`);
  await invia(
    emailOperatore,
    '👤 Nuovo paziente assegnato — App Abbraccio',
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#1e4d8c;margin-top:0;">👤 Nuovo paziente assegnato</h2>
      <p>Caro/a <strong>${nomeOperatore}</strong>,</p>
      <p>Ti è stato assegnato un nuovo paziente su <strong>Abbraccio Cure Domiciliari</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:140px;">Paziente:</td><td style="padding:8px;">${nomePaziente}</td></tr>
        <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Indirizzo:</td><td style="padding:8px;">${indirizzo}</td></tr>
      </table>
      <a href="${frontendUrl}/portale-operatore" style="display:inline-block;background:#1e4d8c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Vai al Portale Operatore →</a>
      <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari</p>
    </div>`
  );
}

// ─── Notifica admin — nuova richiesta prenotazione ───────────────────────────
export async function inviaEmailNuovaRichiestaPrenotazione(
  adminEmail: string,
  richiesta: any
) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://app-abbraccio-frontend-rw2c.vercel.app';
  console.log(`📧 Notifica admin nuova richiesta #${richiesta._id}`);

  const tipoServizioLabel: Record<string, string> = {
    prelievo: '💉 Prelievo',
    esame_strumentale: '🔬 Esame Strumentale',
    prestazione: '🏥 Prestazione',
    psicologia: '🧠 Terapia psicologica',
    assistenza: '🤝 Assistenza'
  };

  const dataPreferita = new Date(richiesta.dataPreferita).toLocaleDateString('it-IT');
  const dataAlternativa = richiesta.dataAlternativa
    ? new Date(richiesta.dataAlternativa).toLocaleDateString('it-IT')
    : null;

  await invia(
    adminEmail,
    `📅 Nuova richiesta prenotazione — ${tipoServizioLabel[richiesta.tipoServizio] || richiesta.tipoServizio}`,
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#1e4d8c;margin-top:0;">📅 Nuova richiesta prenotazione</h2>
      <p style="background:#fef3c7;padding:12px;border-radius:6px;border-left:4px solid #f59e0b;">
        <strong>Azione richiesta:</strong> Revisiona e conferma la richiesta dal pannello admin.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:140px;">Servizio:</td><td style="padding:8px;">${tipoServizioLabel[richiesta.tipoServizio] || richiesta.tipoServizio}</td></tr>
        <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Tipo:</td><td style="padding:8px;">${richiesta.tipoSpecifico || 'N/A'}</td></tr>
        <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Paziente:</td><td style="padding:8px;">${richiesta.pazienteNome}</td></tr>
        <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Indirizzo:</td><td style="padding:8px;">${richiesta.pazienteIndirizzo}</td></tr>
        <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Richiedente:</td><td style="padding:8px;">${richiesta.richiedenteNome} (${richiesta.richiedenteEmail})</td></tr>
        <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Data preferita:</td><td style="padding:8px;">${dataPreferita} ${richiesta.orarioPreferito || ''}</td></tr>
        ${dataAlternativa ? `<tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Data alternativa:</td><td style="padding:8px;">${dataAlternativa} ${richiesta.orarioAlternativo || ''}</td></tr>` : ''}
        <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Priorità:</td><td style="padding:8px;">${richiesta.priorita || 'normale'}</td></tr>
        ${richiesta.noteRichiedente ? `<tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Note:</td><td style="padding:8px;">${richiesta.noteRichiedente}</td></tr>` : ''}
      </table>
      <a href="${frontendUrl}/gestione-richieste" style="display:inline-block;background:#1e4d8c;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">📋 Gestisci Richieste →</a>
      <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari</p>
    </div>`
  );
}

// ─── Conferma consenso GDPR — copia al paziente/firmatario ──────────────────
export async function inviaEmailConsensoGDPR(
  emailDestinatario: string,
  nomePaziente: string,
  nomeFirmatario: string,
  ruoloFirmatario: string,
  dataFirma: string,
  versioneInformativa: string
) {
  console.log(`📧 Invio copia consenso GDPR a: ${emailDestinatario}`);
  return invia(
    emailDestinatario,
    '✅ Consenso GDPR firmato — Abbraccio Cure Domiciliari',
    `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:28px;border:1px solid #e2e8f0;border-radius:10px;">
      <div style="text-align:center;border-bottom:2px solid #1e4d8c;padding-bottom:16px;margin-bottom:20px;">
        <h2 style="color:#1e4d8c;margin:0;font-size:1.3rem;">🛡️ Consenso al trattamento dei dati personali</h2>
        <p style="color:#6b7280;font-size:0.9rem;margin:4px 0 0;">Abbraccio Cure Domiciliari — Via Di Santa Maria Ausiliatrice 4b, Roma</p>
      </div>

      <p>Gentile <strong>${nomeFirmatario}</strong>,</p>
      <p>Le confermiamo che il consenso al trattamento dei dati personali ai sensi del Regolamento UE 2016/679 (GDPR) per il/la paziente <strong>${nomePaziente}</strong> è stato registrato con firma digitale.</p>

      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;font-weight:bold;color:#374151;width:160px;">Paziente:</td><td style="padding:6px 0;color:#374151;">${nomePaziente}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold;color:#374151;">Firmato da:</td><td style="padding:6px 0;color:#374151;">${nomeFirmatario} (${ruoloFirmatario})</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold;color:#374151;">Data firma:</td><td style="padding:6px 0;color:#374151;">${dataFirma}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold;color:#374151;">Versione informativa:</td><td style="padding:6px 0;color:#374151;">${versioneInformativa}</td></tr>
        </table>
      </div>

      <p style="font-size:0.88rem;color:#374151;">Il consenso riguarda il trattamento dei dati personali e sanitari per le finalità connesse all'erogazione dei servizi di assistenza domiciliare, ai sensi degli artt. 6 e 9 del GDPR.</p>

      <div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:10px 14px;border-radius:0 6px 6px 0;font-size:0.85rem;margin:16px 0;">
        <strong>I suoi diritti (artt. 15–21 GDPR):</strong> Accesso, rettifica, cancellazione, limitazione, portabilità e opposizione al trattamento. Potrà esercitarli in qualsiasi momento contattando abbracciocuredomiciliari@gmail.com o Tel. 351 417 5117.
      </div>

      <p style="font-size:0.82rem;color:#6b7280;margin-top:20px;">
        Per revocare il consenso o per qualsiasi informazione:<br/>
        📧 abbracciocuredomiciliari@gmail.com &nbsp;|&nbsp; 📞 351 417 5117<br/>
        Garante Privacy: <a href="https://www.garanteprivacy.it" style="color:#1e4d8c;">www.garanteprivacy.it</a> — garante@gpdp.it
      </p>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
      <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
        Abbraccio Cure Domiciliari — Roma, Via Di Santa Maria Ausiliatrice 4b<br/>
        Questa è una email automatica di conferma. Non rispondere a questo messaggio.
      </p>
    </div>`
  );
}

export async function inviaEmailConsensoPrestazione(
  emailDestinatario: string,
  nomePaziente: string,
  nomeFirmatario: string,
  ruoloFirmatario: string,
  dataFirma: string,
  versioneDocumento: string
) {
  return invia(
    emailDestinatario,
    '✅ Consenso alla prestazione sanitaria firmato — Abbraccio Cure Domiciliari',
    `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:28px;border:1px solid #e2e8f0;border-radius:10px;">
      <h2 style="color:#9a3412;margin:0 0 16px;">Consenso alla prestazione sanitaria e ai rischi del trattamento</h2>
      <p>Gentile <strong>${nomeFirmatario}</strong>,</p>
      <p>Le confermiamo che il consenso informato per il/la paziente <strong>${nomePaziente}</strong> è stato firmato e archiviato.</p>
      <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0 0 8px;"><strong>Paziente:</strong> ${nomePaziente}</p>
        <p style="margin:0 0 8px;"><strong>Firmatario:</strong> ${nomeFirmatario} (${ruoloFirmatario})</p>
        <p style="margin:0 0 8px;"><strong>Data firma:</strong> ${dataFirma}</p>
        <p style="margin:0;"><strong>Versione documento:</strong> ${versioneDocumento}</p>
      </div>
      <p style="font-size:0.88rem;color:#374151;">Il consenso comprende l'informativa sulle prestazioni sanitarie e assistenziali, i rischi prevedibili e le limitazioni del trattamento.</p>
      <p style="font-size:11px;color:#9ca3af;border-top:1px solid #e2e8f0;padding-top:12px;">Abbraccio Cure Domiciliari — Questa è una email automatica di conferma.</p>
    </div>`
  );
}

// ─── Conferma prenotazione — notifica al caregiver/paziente ────────────────────
export async function inviaEmailConfermaPrenotazione(
  emailDestinatario: string,
  richiesta: any
) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://app-abbraccio-frontend-rw2c.vercel.app';
  console.log(`📧 Conferma prenotazione a: ${emailDestinatario}`);

  const tipoServizioLabel: Record<string, string> = {
    prelievo: '💉 Prelievo',
    esame_strumentale: '🔬 Esame Strumentale',
    prestazione: '🏥 Prestazione',
    psicologia: '🧠 Terapia psicologica',
    assistenza: '🤝 Assistenza'
  };

  const dataConfermata = richiesta.dataConfermata
    ? new Date(richiesta.dataConfermata).toLocaleDateString('it-IT')
    : new Date(richiesta.dataPreferita).toLocaleDateString('it-IT');
  const orarioConfermato = richiesta.orarioConfermato || richiesta.orarioPreferito || 'Da concordare';

  const statoColor = richiesta.stato === 'rifiutata' ? '#dc2626' : '#16a34a';
  const statoLabel = richiesta.stato === 'rifiutata' ? '❌ Rifiutata' : '✅ Confermata';

  await invia(
    emailDestinatario,
    `${statoLabel} — ${tipoServizioLabel[richiesta.tipoServizio] || richiesta.tipoServizio}`,
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:${statoColor};margin-top:0;">${statoLabel}</h2>
      <p>Gentile <strong>${richiesta.richiedenteNome}</strong>,</p>
      <p>La sua richiesta di prenotazione è stata <strong>${richiesta.stato === 'rifiutata' ? 'rifiutata' : 'confermata'}</strong> da Abbraccio Cure Domiciliari.</p>

      ${richiesta.stato === 'rifiutata' && richiesta.noteAdmin ? `<p style="background:#fef2f2;padding:12px;border-radius:6px;border-left:4px solid #dc2626;"><strong>Motivo:</strong> ${richiesta.noteAdmin}</p>` : ''}

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:140px;">Servizio:</td><td style="padding:8px;">${tipoServizioLabel[richiesta.tipoServizio] || richiesta.tipoServizio}</td></tr>
        <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Tipo:</td><td style="padding:8px;">${richiesta.tipoSpecifico || 'N/A'}</td></tr>
        <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Paziente:</td><td style="padding:8px;">${richiesta.pazienteNome}</td></tr>
        <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Data confermata:</td><td style="padding:8px;">${dataConfermata}</td></tr>
        <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Orario:</td><td style="padding:8px;">${orarioConfermato}</td></tr>
        ${richiesta.staffAssegnatoNome ? `<tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Operatore:</td><td style="padding:8px;">${richiesta.staffAssegnatoNome}</td></tr>` : ''}
      </table>

      ${richiesta.stato !== 'rifiutata' ? `<a href="${frontendUrl}/centro-prenotazioni-privato" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">📅 Vedi le mie prenotazioni →</a>` : ''}

      <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari<br/>Per modifiche contattare l'amministrazione.</p>
    </div>`
  );
}

// ─── Notifica operatore — gestione richiesta materiali ───────────────────────
export async function inviaEmailGestioneRichiestaMateriali(
  richiesta: any,
  operatoreEmail: string
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;

  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const dataGestione = richiesta.dataGestione 
      ? new Date(richiesta.dataGestione).toLocaleDateString('it-IT')
      : new Date().toLocaleDateString('it-IT');

    const statoColor = richiesta.stato === 'rifiutata' ? '#dc2626' : 
                       richiesta.stato === 'consegnata' ? '#16a34a' : '#3b82f6';
    const statoLabel = richiesta.stato === 'rifiutata' ? '❌ Rifiutata' : 
                       richiesta.stato === 'consegnata' ? '🚚 Consegnata' : '✅ Autorizzata';

    await invia(
      operatoreEmail,
      `${statoLabel} — Richiesta Materiali`,
      `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Notifica Abbraccio</title>
        </head>
        <body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:20px;margin:0;">
          <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);overflow:hidden;">
            <div style="background:${statoColor};color:white;padding:20px;text-align:center;">
              <h1 style="margin:0;font-size:24px;">${statoLabel}</h1>
            </div>
            <div style="padding:30px;">
              <p>Gentile <strong>${richiesta.operatoreNome}</strong>,</p>
              <p>La sua richiesta di materiali è stata <strong>${richiesta.stato === 'rifiutata' ? 'rifiutata' : richiesta.stato === 'consegnata' ? 'consegnata' : 'autorizzata'}</strong> da Abbraccio Cure Domiciliari.</p>
              
              ${richiesta.stato === 'rifiutata' && richiesta.noteAdmin ? `<p style="background:#fef2f2;padding:12px;border-radius:6px;border-left:4px solid #dc2626;"><strong>Motivo:</strong> ${richiesta.noteAdmin}</p>` : ''}
              ${richiesta.stato === 'autorizzata' ? `<p style="background:#eff6ff;padding:12px;border-radius:6px;border-left:4px solid #3b82f6;"><strong>📅 Data ritiro previsto:</strong> ${dataGestione}</p>` : ''}
              ${richiesta.stato === 'consegnata' ? `<p style="background:#f0fdf4;padding:12px;border-radius:6px;border-left:4px solid #16a34a;"><strong>✅ Materiale consegnato in data:</strong> ${dataGestione}</p>` : ''}
              
              <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:140px;">Data richiesta:</td><td style="padding:8px;">${new Date(richiesta.dataRichiesta).toLocaleDateString('it-IT')}</td></tr>
                <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Gestita da:</td><td style="padding:8px;">${richiesta.gestitaDa || 'Amministrazione'}</td></tr>
                <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Articoli richiesti:</td><td style="padding:8px;">${richiesta.items.length} articoli</td></tr>
              </table>

              <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:8px;text-align:left;font-weight:bold;">Articolo</th>
                    <th style="padding:8px;text-align:center;font-weight:bold;">Categoria</th>
                    <th style="padding:8px;text-align:center;font-weight:bold;">Richiesto</th>
                    <th style="padding:8px;text-align:center;font-weight:bold;">Autorizzato</th>
                  </tr>
                </thead>
                <tbody>
                  ${richiesta.items.map((item: any) => `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:8px;">${item.nome}</td>
                      <td style="padding:8px;text-align:center;">${item.categoria === 'farmaco' ? '💊 Farmaco' : '🏥 Presidio'}</td>
                      <td style="padding:8px;text-align:center;font-weight:600;color:#b45309;">${item.quantitaRichiesta} ${item.unitaMisura}</td>
                      <td style="padding:8px;text-align:center;font-weight:700;color:${item.quantitaAutorizzata > 0 ? '#16a34a' : '#dc2626'};">
                        ${item.quantitaAutorizzata || 0} ${item.quantitaAutorizzata ? item.unitaMisura : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              ${richiesta.noteAdmin ? `<p style="background:#fffbeb;padding:12px;border-radius:6px;border-left:4px solid #f59e0b;"><strong>📝 Note:</strong> ${richiesta.noteAdmin}</p>` : ''}
              
              <a href="${frontendUrl}/richieste-consegne" style="display:inline-block;background:#1e4d8c;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">📋 Vedi le mie richieste →</a>
            </div>
            <div style="background:#f8fafc;padding:20px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
              <p>© 2025 Abbraccio Cure Domiciliari S.r.l. | Tutti i diritti riservati</p>
            </div>
          </div>
        </body>
        </html>
      `
    );

    console.log(`📧 Email gestione richiesta materiali inviata a ${operatoreEmail}`);
    return true;
  } catch (err: any) {
    console.error('❌ Errore invio email gestione richiesta materiali:', err?.message || err);
    return false;
  }
}
