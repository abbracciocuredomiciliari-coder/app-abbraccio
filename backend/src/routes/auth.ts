import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const jwtSecret = process.env.JWT_SECRET as string;
const tokenExpiration = '30d';

router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email già registrata' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, role });

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, jwtSecret, {
      expiresIn: tokenExpiration
    });

    return res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nella registrazione', error });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, jwtSecret, {
      expiresIn: tokenExpiration
    });

    return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante il login', error });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user || typeof req.user === 'string') {
    return res.status(401).json({ message: 'Utente non autenticato' });
  }

  const payload = req.user as { userId: string; email: string; role: string };
  return res.json({ id: payload.userId, email: payload.email, role: payload.role });
});

export default router;
