import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import User from '../models/User';
import Staff from '../models/Staff';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { inviaEmailNotificaAdmin, inviaEmailResetPassword } from '../utils/email';

const router = Router();
const jwtSecret = process.env.JWT_SECRET as string;
const tokenExpiration = '8h'; // Ridotto da 30d a 8h per sicurezza dati sanitari

// Rate limiting: max 10 tentativi di login ogni 15 minuti per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Troppi tentativi di accesso. Riprova tra 15 minuti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting: max 5 registrazioni ogni ora per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'Troppi tentativi di registrazione. Riprova tra un\'ora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting: max 5 richieste reset password ogni ora per IP
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'Troppi tentativi. Riprova tra un\'ora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// REGISTRAZIONE — crea utente con status "pending"
router.post('/register', registerLimiter, async (req: Request, res: Response) => {
  const { name, email, password, role, professione, categoria, domicilioPartenza, raggioAzioneKm, domicilioCoords } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ message: 'Nome, email e password sono obbligatori' });
  }

  // Validazione password: minimo 8 caratteri, almeno una lettera e un numero
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ message: 'La password deve essere di almeno 8 caratteri e contenere almeno una lettera e un numero.' });
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
      domicilioPartenza: domicilioPartenza?.trim() || '',
      raggioAzioneKm: raggioAzioneKm || 10,
      ...(domicilioCoords ? { domicilioCoords } : {}),
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
      { userId: user._id, name: user.name, email: user.email, role: user.role },
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
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
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
      { userId: user._id, name: user.name, email: user.email, role: user.role },
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

// GET /me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user || typeof req.user === 'string') {
    return res.status(401).json({ message: 'Utente non autenticato' });
  }
  const payload = req.user as { userId: string; name?: string; email: string; role: string };
  return res.json({ id: payload.userId, name: payload.name, email: payload.email, role: payload.role });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/forgot-password — invia email con link di reset (non richiede auth)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', forgotLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email?.trim()) {
    return res.status(400).json({ message: 'Email obbligatoria' });
  }
  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Risposta sempre identica per non rivelare se l'email è registrata
    if (!user || user.status !== 'approved') {
      return res.json({ message: 'Se l\'email è registrata, riceverai un link di reset.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 ora

    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();

    await inviaEmailResetPassword(user.email, user.name, token);

    return res.json({ message: 'Se l\'email è registrata, riceverai un link di reset.' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'invio dell\'email di reset', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/reset-password — imposta la nuova password con il token ricevuto via email
// ─────────────────────────────────────────────────────────────────────────────
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'Troppi tentativi. Riprova tra un\'ora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/reset-password', resetLimiter, async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token e nuova password obbligatori' });
  }
  if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ message: 'La password deve essere di almeno 8 caratteri con almeno una lettera e un numero.' });
  }
  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ message: 'Link di reset non valido o scaduto. Richiedi un nuovo link.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ message: 'Password aggiornata con successo. Ora puoi effettuare il login.' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel reset della password', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /auth/change-password — cambia password con vecchia password (utente loggato)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Vecchia e nuova password obbligatorie' });
  }
  if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ message: 'La nuova password deve essere di almeno 8 caratteri con almeno una lettera e un numero.' });
  }
  try {
    const payload = req.user as { userId: string };
    const user = await User.findById(payload.userId);
    if (!user) return res.status(404).json({ message: 'Utente non trovato' });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'La vecchia password non è corretta.' });
    }
    if (oldPassword === newPassword) {
      return res.status(400).json({ message: 'La nuova password deve essere diversa da quella attuale.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: 'Password aggiornata con successo.' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel cambio password', error });
  }
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

    // Collega automaticamente User↔Staff tramite email e copia dati zona
    try {
      const zonaUpdate: any = { userId: user._id };
      if (user.domicilioPartenza) zonaUpdate.domicilioPartenza = user.domicilioPartenza;
      if (user.raggioAzioneKm) zonaUpdate.raggioAzioneKm = user.raggioAzioneKm;
      if (user.domicilioCoords?.lat) zonaUpdate.domicilioCoords = user.domicilioCoords;
      await Staff.findOneAndUpdate(
        { email: user.email },
        { $set: zonaUpdate },
        { new: true }
      );
    } catch (linkErr) {
      console.warn('⚠️ Impossibile collegare User↔Staff:', linkErr);
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
