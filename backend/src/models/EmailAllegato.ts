import { Schema, model, Types, Document } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL ALLEGATO — contenuto binario degli allegati (PDF ecc.) inviati con
// ogni email. Collection separata per non appesantire le query su EmailLog.
// ═══════════════════════════════════════════════════════════════════════════

export interface IEmailAllegato extends Document {
  emailLogId: Types.ObjectId;
  filename: string;
  contentType?: string;
  size: number;
  data: Buffer;
}

const schema = new Schema<IEmailAllegato>(
  {
    emailLogId: { type: Schema.Types.ObjectId, ref: 'EmailLog', required: true, index: true },
    filename: { type: String, required: true },
    contentType: { type: String },
    size: { type: Number, default: 0 },
    data: { type: Buffer, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default model<IEmailAllegato>('EmailAllegato', schema);
