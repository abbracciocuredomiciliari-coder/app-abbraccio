import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

// Store semplice in memoria (per produzione usare Redis)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const ipStore = new Map<string, RateLimitEntry>();
const userStore = new Map<string, RateLimitEntry>();

// Pulizia automatica ogni ora
setInterval(() => {
  const now = Date.now();
  ipStore.forEach((entry, key) => {
    if (entry.resetTime < now) ipStore.delete(key);
  });
  userStore.forEach((entry, key) => {
    if (entry.resetTime < now) userStore.delete(key);
  });
}, 3600000);

/**
 * Rate limiting per IP (usato per login)
 */
export const rateLimitByIP = (maxRequests: number = 5, windowMs: number = 900000) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
               req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    
    const entry = ipStore.get(ip);
    if (!entry || entry.resetTime < now) {
      ipStore.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (entry.count >= maxRequests) {
      return res.status(429).json({
        message: 'Troppi tentativi. Riprova tra qualche minuto.',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      });
    }
    
    entry.count++;
    return next();
  };
};

/**
 * Rate limiting per utente autenticato (API sensibili)
 */
export const rateLimitByUser = (maxRequests: number = 100, windowMs: number = 60000) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || typeof req.user === 'string') {
      return res.status(401).json({ message: 'Autenticazione richiesta' });
    }
    
    const payload = req.user as { userId: string };
    const userId = payload.userId;
    const now = Date.now();
    
    const entry = userStore.get(userId);
    if (!entry || entry.resetTime < now) {
      userStore.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (entry.count >= maxRequests) {
      return res.status(429).json({
        message: 'Limite richieste superato. Riprova tra un minuto.',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      });
    }
    
    entry.count++;
    return next();
  };
};
