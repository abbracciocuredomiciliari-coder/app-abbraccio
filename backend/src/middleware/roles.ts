import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const authorizeRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || typeof req.user === 'string') {
      return res.status(401).json({ message: 'Autenticazione richiesta' });
    }

    const tokenPayload = req.user as { role?: string };
    if (!tokenPayload.role || !roles.includes(tokenPayload.role)) {
      return res.status(403).json({ message: 'Permesso negato' });
    }

    next();
  };
};
