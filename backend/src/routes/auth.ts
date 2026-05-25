import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import User from '../models/User';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';

const router = Router();
const jwtSecret = process.env.JWT_SECRET as string;
const tokenExpiration = '30d';

// Funzione per inviare email di notifica all'admin
async function inviaEmailNotificaAdmin(nomeUtente: string, emailUtente: string, professione: string) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!adminEmail || !smtpHost || !smtpUser || !smtpPass) {
    console.log('⚠️ Configurazione email non presente — notifica admin saltata');
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://app-abbraccio-frontend-rw2c.vercel.app';

    await transporter.sendMail({
      from: `"App Abbraccio" <${smtpUser}>`,
      to: adminEmail,
      subject: '🔔 Nuova richiesta di registrazione — App Abbraccio',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e4d8c; margin-top: 0;">🔔 Nuova richiesta di registrazione</h2>
          <p>Un nuovo utente ha richiesto l'accesso all'app <strong>Abbraccio Cure Domiciliari</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; background: #f8fafc; font-weight: bold; width: 140px;">Nome:</td><td style="padding: 8px;">${nomeUtente}</td></tr>
            <tr><td style="padding: 8px; background: #f1f5f9; font-weight: bold;">Email:</td><td style="padding: 8px;">${emailUtente}</td></tr>
            <tr><td style="padding: 8px; background: #f8fafc; font-weight: bold;">Professione:</td><td style="padding: 8px;">${professione || 'Non specificata'}</td></tr>
          </table>
          <p>Per approvare o rifiutare la richiesta, accedi alla sezione <strong>Gestione Utenti</strong> dell'app:</p>
          <a href="${frontendUrl}/gestione-utenti" style="display: inline-block; background: #1e4d8c; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Vai a Gestione Utenti →
          </a>
          <p style="margin-top: 24px; font-size: 12px; color: #888;">Abbraccio Cure Domiciliari — Sistema di gestione</p>
        </div>
      `,
    });
    console.log(`✅ Email notifica inviata a ${adminEmail}`);
  } catch (err) {
    console.error('❌ Errore invio email notifica admin:', err);
  }
}

// REGISTRAZIONE — crea utente con status "pending"
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password, role, professione, categoria } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ message: 'Nome, email e password sono obbligatori' });
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ message: 'Email già registrata' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Il primo utente registrato diventa admin approvato automaticamente
    const totalUsers = await User.countDocuments();
    const isFirstUser = totalUsers === 0;

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: isFirstUser ? 'admin' : (role || 'caregiver'),
      status: isFirstUser ? 'approved' : 'pending',
      professione: professione?.trim() || '',
      categoria: categoria?.trim() || '',
    });

    if (!isFirstUser) {
      // Invia notifica email all'admin
      await inviaEmailNotificaAdmin(user.name, user.email, user.professione || '');

      return res.status(201).json({
        pending: true,
        message: 'Registrazione inviata con successo! La tua richiesta è in attesa di approvazione da parte dell\'amministratore. Riceverai una comunicazione quando il tuo account sarà attivato.',
      });
    }

    // Primo utente: login automatico
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: tokenExpiration }
    );

    return res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nella registrazione', error });
  }
});

// LOGIN — blocca utenti pending o rejected
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    // Gli utenti creati prima dell'aggiornamento non hanno il campo status:
    // li trattiamo come approvati per retrocompatibilità
    const status = user.status || 'approved';

    if (status === 'pending') {
      return res.status(403).json({
        message: 'Il tuo account è in attesa di approvazione da parte dell\'amministratore.',
        status: 'pending',
      });
    }

    if (status === 'rejected') {
      return res.status(403).json({
        message: 'La tua richiesta di accesso è stata rifiutata. Contatta l\'amministratore per maggiori informazioni.',
        status: 'rejected',
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: tokenExpiration }
    );

    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante il login', error });
  }
});

// GET /migrate-status — migrazione una-tantum: approva tutti gli utenti senza status
// Questa route è temporanea e può essere rimossa dopo la migrazione
router.get('/migrate-status', async (req: Request, res: Response) => {
  try {
    const result = await (User as any).updateMany(
      { status: { $exists: false } },
      { $set: { status: 'approved' } }
    );
    const result2 = await (User as any).updateMany(
      { status: null },
      { $set: { status: 'approved' } }
    );
    return res.json({
      message: 'Migrazione completata',
      aggiornati: result.modifiedCount + result2.modifiedCount,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore migrazione', error });
  }
});

// GET /me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user || typeof req.user === 'string') {
    return res.status(401).json({ message: 'Utente non autenticato' });
  }
  const payload = req.user as { userId: string; email: string; role: string };
  return res.json({ id: payload.userId, email: payload.email, role: payload.role });
});

// GET /pending — lista utenti in attesa (solo admin)
router.get('/pending', authenticateToken, authorizeRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const pendingUsers = await User.find({ status: 'pending' }).select('-password').sort({ createdAt: -1 });
    return res.json(pendingUsers);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero degli utenti in attesa', error });
  }
});

// GET /all-users — lista tutti gli utenti (solo admin)
router.get('/all-users', authenticateToken, authorizeRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero degli utenti', error });
  }
});

// PUT /approve/:userId — approva utente (solo admin)
router.put('/approve/:userId', authenticateToken, authorizeRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        status: 'approved',
        ...(role ? { role } : {}),
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }

    return res.json({ message: 'Utente approvato con successo', user });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'approvazione', error });
  }
});

// PUT /reject/:userId — rifiuta utente (solo admin)
router.put('/reject/:userId', authenticateToken, authorizeRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { status: 'rejected' },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }

    return res.json({ message: 'Utente rifiutato', user });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel rifiuto', error });
  }
});

// DELETE /users/:userId — elimina utente (solo admin)
router.delete('/users/:userId', authenticateToken, authorizeRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }
    return res.json({ message: 'Utente eliminato' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'eliminazione', error });
  }
});

export default router;
