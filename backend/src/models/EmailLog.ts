import { Schema, model, Types, Document } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL LOG — archivio progressivo di TUTTE le email inviate dal gestionale.
// Popolato automaticamente da utils/email.ts → invia(): ogni invio (riuscito
// o fallito) lascia una riga. Il campo `rettificata` viene marcato quando
// sull'email è stata inviata una rettifica ("non tenere conto").
// ═══════════════════════════════════════════════════════════════════════════

export interface IEmailLog extends Document {
  to: string;
  subject: string;
  tipo?: string;              // 'preventivo' | 'fattura' | 'contratto' | 'rettifica' | 'conferma' | 'generica'…
  area?: 'privato' | 'intermediazione' | 'generale';
  riferimento?: string;       // es. "PREV-2026-00012" o nome paziente
  allegati?: string[];        // nomi file allegati
  allegatiSalvati?: number;   // quanti allegati sono conservati scaricabili in EmailAllegato
  inviataDaNome?: string;     // utente loggato che ha scatenato l'invio ('sistema' se automatica)
  esito: 'inviata' | 'fallita';
  errore?: string;
  messageId?: string;
  rettificata?: boolean;      // vera se è stata inviata una rettifica su questa email
  rettificaIl?: Date;
  rettificaDaNome?: string;
  storico?: boolean;          // riga ricostruita dai metadati documento (pre-log)
  dataStimata?: boolean;      // data approssimata per le storiche senza traccia invio
  createdAt: Date;
}

const EmailLogSchema = new Schema<IEmailLog>({
  to: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  tipo: { type: String, default: 'generica' },
  area: { type: String, enum: ['privato', 'intermediazione', 'generale'], default: 'generale' },
  riferimento: { type: String },
  allegati: [{ type: String }],
  allegatiSalvati: { type: Number, default: 0 },
  inviataDaNome: { type: String },
  esito: { type: String, enum: ['inviata', 'fallita'], required: true, index: true },
  errore: { type: String },
  messageId: { type: String },
  rettificata: { type: Boolean, default: false },
  rettificaIl: { type: Date },
  rettificaDaNome: { type: String },
  storico: { type: Boolean, default: false },
  dataStimata: { type: Boolean, default: false },
}, { timestamps: true });

EmailLogSchema.index({ createdAt: -1 });

export default model<IEmailLog>('EmailLog', EmailLogSchema);
