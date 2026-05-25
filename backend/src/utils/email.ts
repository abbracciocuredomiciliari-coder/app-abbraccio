import nodemailer from 'nodemailer';

function getTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) return null;

  return nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  });
}

export async function inviaEmailNotificaAdmin(nomeUtente: string, emailUtente: string, professione: string) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const transporter = getTransporter();
  if (!adminEmail || !transporter) {
    console.log('⚠️ Configurazione email non presente — notifica admin saltata');
    return;
  }
  const frontendUrl = process.env.FRONTEND_URL || 'https://app-abbraccio-frontend-rw2c.vercel.app';
  try {
    await transporter.sendMail({
      from: `"App Abbraccio" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: '🔔 Nuova richiesta di registrazione — App Abbraccio',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
          <h2 style="color:#1e4d8c;margin-top:0;">🔔 Nuova richiesta di registrazione</h2>
          <p>Un nuovo utente ha richiesto l'accesso all'app <strong>Abbraccio Cure Domiciliari</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:140px;">Nome:</td><td style="padding:8px;">${nomeUtente}</td></tr>
            <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Email:</td><td style="padding:8px;">${emailUtente}</td></tr>
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Professione:</td><td style="padding:8px;">${professione || 'Non specificata'}</td></tr>
          </table>
          <a href="${frontendUrl}/gestione-utenti" style="display:inline-block;background:#1e4d8c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Vai a Gestione Utenti →</a>
        </div>`,
    });
    console.log(`✅ Email notifica admin inviata a ${adminEmail}`);
  } catch (err) {
    console.error('❌ Errore invio email notifica admin:', err);
  }
}

export async function inviaEmailNuovoPianoDiLavoro(
  emailOperatore: string,
  nomeOperatore: string,
  nomePaziente: string,
  dataInizio: string,
  task: string
) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('⚠️ Configurazione email non presente — notifica operatore saltata');
    return;
  }
  const frontendUrl = process.env.FRONTEND_URL || 'https://app-abbraccio-frontend-rw2c.vercel.app';
  try {
    await transporter.sendMail({
      from: `"App Abbraccio" <${process.env.SMTP_USER}>`,
      to: emailOperatore,
      subject: '📋 Nuovo piano di lavoro assegnato — App Abbraccio',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
          <h2 style="color:#1e4d8c;margin-top:0;">📋 Nuovo piano di lavoro assegnato</h2>
          <p>Caro/a <strong>${nomeOperatore}</strong>,</p>
          <p>Ti è stato assegnato un nuovo piano di lavoro su <strong>Abbraccio Cure Domiciliari</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:140px;">Paziente:</td><td style="padding:8px;">${nomePaziente}</td></tr>
            <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Data inizio:</td><td style="padding:8px;">${dataInizio}</td></tr>
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Attività:</td><td style="padding:8px;">${task}</td></tr>
          </table>
          <a href="${frontendUrl}/workplan" style="display:inline-block;background:#1e4d8c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Vai al Piano di Lavoro →</a>
          <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari</p>
        </div>`,
    });
    console.log(`✅ Email nuovo piano inviata a ${emailOperatore}`);
  } catch (err) {
    console.error('❌ Errore invio email nuovo piano:', err);
  }
}

export async function inviaEmailNuovoPaziente(
  emailOperatore: string,
  nomeOperatore: string,
  nomePaziente: string,
  indirizzo: string
) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('⚠️ Configurazione email non presente — notifica operatore saltata');
    return;
  }
  const frontendUrl = process.env.FRONTEND_URL || 'https://app-abbraccio-frontend-rw2c.vercel.app';
  try {
    await transporter.sendMail({
      from: `"App Abbraccio" <${process.env.SMTP_USER}>`,
      to: emailOperatore,
      subject: '👤 Nuovo paziente assegnato — App Abbraccio',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
          <h2 style="color:#1e4d8c;margin-top:0;">👤 Nuovo paziente assegnato</h2>
          <p>Caro/a <strong>${nomeOperatore}</strong>,</p>
          <p>Ti è stato assegnato un nuovo paziente su <strong>Abbraccio Cure Domiciliari</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:140px;">Paziente:</td><td style="padding:8px;">${nomePaziente}</td></tr>
            <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Indirizzo:</td><td style="padding:8px;">${indirizzo}</td></tr>
          </table>
          <a href="${frontendUrl}/workplan" style="display:inline-block;background:#1e4d8c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Vai al Piano di Lavoro →</a>
          <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari</p>
        </div>`,
    });
    console.log(`✅ Email nuovo paziente inviata a ${emailOperatore}`);
  } catch (err) {
    console.error('❌ Errore invio email nuovo paziente:', err);
  }
}
