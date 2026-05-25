import { Document, Schema, model, Types } from 'mongoose';

// Categorie di ruolo
export type StaffCategory = 'infermieristico' | 'oss' | 'riabilitativo' | 'medico' | 'coordinamento' | 'direzione';

export interface IStaff extends Document {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  category: StaffCategory;
  phone?: string;
  active: boolean;
  dataInizioCollaborazione?: Date;
  dataFineCollaborazione?: Date;
  note?: string;
  userId?: Types.ObjectId; // collegamento con l'account di login (User)
}

const staffSchema = new Schema<IStaff>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['infermieristico', 'oss', 'riabilitativo', 'medico', 'coordinamento', 'direzione'],
      default: 'infermieristico'
    },
    phone: { type: String, trim: true },
    active: { type: Boolean, default: true },
    dataInizioCollaborazione: { type: Date },
    dataFineCollaborazione: { type: Date },
    note: { type: String, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Index for efficient queries
staffSchema.index({ category: 1, active: 1, lastName: 1 });

export default model<IStaff>('Staff', staffSchema);