import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import AuditLog from '../models/AuditLog';

const router = Router();

/**
 * GET /api/audit-log
 * Restituisce il registro degli accessi ai dati sensibili.
 * Solo admin e direttore possono consultarlo.
 * Parametri query opzionali: userId, risorsa, azione, from, to, limit
 */
router.get(
  '/',
  authenticateToken,
  authorizeRole('admin', 'direttore'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId, risorsa, azione, from, to, limit = '200' } = req.query;

      const filter: any = {};
      if (userId) filter.userId = userId;
      if (risorsa) filter.risorsa = risorsa;
      if (azione) filter.azione = azione;
      if (from || to) {
        filter.timestamp = {};
        if (from) filter.timestamp.$gte = new Date(from as string);
        if (to) filter.timestamp.$lte = new Date(to as string);
      }

      const logs = await AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .limit(Math.min(parseInt(limit as string) || 200, 1000));

      return res.json(logs);
    } catch (error) {
      return res.status(500).json({ message: 'Errore nel recupero dei log', error });
    }
  }
);

/**
 * GET /api/audit-log/stats
 * Statistiche aggregate degli accessi (ultimi 30 giorni).
 * Solo admin.
 */
router.get(
  '/stats',
  authenticateToken,
  authorizeRole('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const da = new Date();
      da.setDate(da.getDate() - 30);

      const [perUtente, perRisorsa, perAzione] = await Promise.all([
        AuditLog.aggregate([
          { $match: { timestamp: { $gte: da } } },
          { $group: { _id: { userId: '$userId', userEmail: '$userEmail' }, totale: { $sum: 1 } } },
          { $sort: { totale: -1 } },
          { $limit: 20 },
        ]),
        AuditLog.aggregate([
          { $match: { timestamp: { $gte: da } } },
          { $group: { _id: '$risorsa', totale: { $sum: 1 } } },
          { $sort: { totale: -1 } },
        ]),
        AuditLog.aggregate([
          { $match: { timestamp: { $gte: da } } },
          { $group: { _id: '$azione', totale: { $sum: 1 } } },
          { $sort: { totale: -1 } },
        ]),
      ]);

      return res.json({ perUtente, perRisorsa, perAzione, periodo: '30 giorni' });
    } catch (error) {
      return res.status(500).json({ message: 'Errore nel recupero delle statistiche', error });
    }
  }
);

export default router;
