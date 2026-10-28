import { Document, Schema, model } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════
// OTP FAMIGLIA — codice monouso a 6 cifre inviato via email per l'accesso
// all'area riservata famiglie. Le famiglie non hanno account: l'identità è
// verificata sui contatti già presenti nelle richieste/preventivi.
// Scade dopo 10 minuti, massimo 5 tentativi, cancellato all'uso riuscito.
// ═══════════════════════════════════════════════════════════════════════════

export interface IOtpFamiglia extends Document {
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

const schema = new Schema<IOtpFamiglia>({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });

export default model<IOtpFamiglia>('OtpFamiglia', schema);
