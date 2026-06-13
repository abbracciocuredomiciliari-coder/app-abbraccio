import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET as string;

export interface AuthRequest extends Request {
  user?: JwtPayload | string;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.query.token as string | undefined);

  if (!token) {
    return res.status(401).json({ message: 'Token di autenticazione mancante' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token non valido' });
  }
};
