import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import AuditLog from '../models/AuditLog';

/**
 * Crea un middleware di audit log per le route che gestiscono dati sensibili.
 * Registra automaticamente chi accede a quale risorsa e con quale operazione.
 *
 * @param risorsa  Nome della risorsa (es. 'patients', 'diario', 'archivio')
 * @param azione   Tipo di operazione: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE'
 * @param getIdFn  Funzione opzionale per estrarre l'ID della risorsa dalla request
 */
export const auditLog = (
  risorsa: string,
  azione: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE',
  getIdFn?: (req: AuthRequest) => string | undefined
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Procedi subito — il log è asincrono e non blocca la risposta
    next();

    // Registra il log dopo aver passato il controllo (fire-and-forget)
    try {
      if (!req.user || typeof req.user === 'string') return;

      const payload = req.user as { userId: string; email: string; role: string };
      const risorsaId = getIdFn ? getIdFn(req) : (req.params?.id || req.params?.patientId || req.params?.supplyId || undefined);

      // Ottieni IP reale (Render usa proxy)
      const ip =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        'unknown';

      await AuditLog.create({
        userId: payload.userId,
        userEmail: payload.email,
        userRole: payload.role,
        azione,
        risorsa,
        risorsaId,
        ip,
        userAgent: req.headers['user-agent']?.substring(0, 200),
        timestamp: new Date(),
      });
    } catch (err) {
      // Il fallimento del log non deve mai bloccare l'applicazione
      console.error('[AuditLog] Errore nella registrazione del log:', err);
    }
  };
};
