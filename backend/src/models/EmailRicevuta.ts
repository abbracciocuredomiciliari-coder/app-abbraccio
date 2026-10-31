import { Schema, model, Document } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL RICEVUTA — messaggi scaricati dalla casella aziendale via IMAP
// (utils/imapSync.ts). Un record per UID IMAP: la deduplica è garantita dagli
// indici su uid e messageId. Gli allegati piccoli sono conservati nel documento.
// ═══════════════════════════════════════════════════════════════════════════

export interface IAllegatoRicevuto {
  filename: string;
  contentType?: string;
  size: number;
  data?: Buffer;         // assente se troppo grande per essere conservato
}

export interface IEmailRicevuta extends Document {
  uid: number;
  messageId?: string;
  from: { nome?: string; email: string };
  to?: string[];
  subject: string;
  data: Date;              // data del messaggio (header Date)
  snippet?: string;
  testo?: string;          // corpo testuale (max ~200KB)
  html?: string;           // corpo html (max ~300KB), per la vista estesa
  allegati?: IAllegatoRicevuto[];
  letta: boolean;          // letta nel gestionale (e/o flag \Seen sul server)
  inReplyTo?: string;
  createdAt: Date;
}

const AllegatoSchema = new Schema<IAllegatoRicevuto>({
  filename: { type: String, required: true },
  contentType: { type: String },
  size: { type: Number, default: 0 },
  data: { type: Buffer },
}, { _id: false });

const EmailRicevutaSchema = new Schema<IEmailRicevuta>({
  uid: { type: Number, required: true, unique: true, index: true },
  messageId: { type: String, unique: true, sparse: true },
  from: {
    nome: { type: String },
    email: { type: String, required: true },
  },
  to: [{ type: String }],
  subject: { type: String, default: '(senza oggetto)' },
  data: { type: Date, required: true, index: true },
  snippet: { type: String },
  testo: { type: String },
  html: { type: String },
  allegati: [AllegatoSchema],
  letta: { type: Boolean, default: false, index: true },
  inReplyTo: { type: String },
}, { timestamps: true });

EmailRicevutaSchema.index({ data: -1 });

export default model<IEmailRicevuta>('EmailRicevuta', EmailRicevutaSchema);
