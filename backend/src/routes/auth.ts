import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Staff from '../models/Staff';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { inviaEmailNotificaAdmin } from '../utils/email';

const router = Router();
const jwtSecret = process.env.JWT_SECRET as string;
const tokenExpiration = '30d';

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

    // Collega automaticamente User↔Staff tramite email
    try {
      await Staff.findOneAndUpdate(
        { email: user.email },
        { $set: { userId: user._id } },
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
