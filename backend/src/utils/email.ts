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
    const info = await transporter.sendMail({
      from: `"App Abbraccio" <${process.env.SMTP_USER}>`,
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

// ─── Notifica admin — nuova registrazione ─────────────────────────────────────
export async function inviaEmailNotificaAdmin(
  nomeUtente: string,
  emailUtente: string,
  professione: string
) {
  const adminEmail = process.env.ADMIN_EMAIL;
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
