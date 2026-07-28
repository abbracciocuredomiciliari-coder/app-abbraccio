import { Document, Schema, model, Types } from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption';

// Categorie di ruolo
export type StaffCategory = 'infermieristico' | 'oss' | 'riabilitativo' | 'medico' | 'sociale' | 'coordinamento' | 'direzione';

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
  modalitaAbilitata: 'entrambi' | 'privato' | 'convenzione';

  // === ZONA DI LAVORO ===
  domicilioPartenza?: string;       // Indirizzo testo
  raggioAzioneKm?: number;          // Raggio in km
  domicilioCoords?: { lat: number; lng: number }; // Coordinate geocodificate
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
      enum: ['infermieristico', 'oss', 'riabilitativo', 'medico', 'sociale', 'coordinamento', 'direzione'],
      default: 'infermieristico'
    },
    phone: { type: String, trim: true },
    active: { type: Boolean, default: true },
    dataInizioCollaborazione: { type: Date },
    dataFineCollaborazione: { type: Date },
    note: { type: String, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    domicilioPartenza: { type: String, trim: true },
    raggioAzioneKm: { type: Number, default: 10 },
    domicilioCoords: {
      lat: { type: Number },
      lng: { type: Number },
    },
    modalitaAbilitata: {
      type: String,
      enum: ['entrambi', 'privato', 'convenzione'],
      default: 'entrambi',
    },
  },
  { timestamps: true }
);

staffSchema.index({ category: 1, active: 1, lastName: 1 });
staffSchema.index({ userId: 1 });
staffSchema.index({ email: 1, active: 1 });

staffSchema.pre('save', function (next) {
  if (this.isModified('phone') && this.phone) this.phone = encrypt(this.phone);
  next();
});

staffSchema.set('toJSON', {
  transform: function (_doc, ret) {
    if (ret.phone) ret.phone = decrypt(ret.phone);
    return ret;
  },
});

export default model<IStaff>('Staff', staffSchema);