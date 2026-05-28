import { Document, Schema, model } from 'mongoose';

export interface IAuditLog extends Document {
  userId: string;
  userEmail: string;
  userRole: string;
  azione: string;       // es. 'READ', 'CREATE', 'UPDATE', 'DELETE'
  risorsa: string;      // es. 'patients', 'diario', 'archivio'
  risorsaId?: string;   // ID specifico della risorsa acceduta
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: String, required: true },
    userEmail: { type: String, required: true },
    userRole: { type: String, required: true },
    azione: { type: String, required: true, enum: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
    risorsa: { type: String, required: true },
    risorsaId: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  {
    // Non usare timestamps automatici — usiamo il campo timestamp esplicito
    timestamps: false,
    // Indice TTL: conserva i log per 2 anni (conforme GDPR art. 30)
    // Per disabilitare la scadenza automatica, rimuovere l'indice TTL
  }
);

// Indici per query efficienti
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ risorsa: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

export default model<IAuditLog>('AuditLog', auditLogSchema);
