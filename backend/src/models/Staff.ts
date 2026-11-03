import { Document, Schema, model, Types } from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption';

// Categorie di ruolo
export type StaffCategory = 'infermieristico' | 'oss' | 'riabilitativo' | 'medico' | 'sociale' | 'coordinamento' | 'direzione' | 'privato' | 'osa' | 'assistente-familiare' | 'badante';

export interface IStaff extends Document {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  category: StaffCategory;
  phone?: string;
  codiceFiscale?: string;
  partitaIva?: string;
  indirizzoResidenza?: string;
  cittaResidenza?: string;
  professionista?: boolean;
  active: boolean;
  dataInizioCollaborazione?: Date;
  dataFineCollaborazione?: Date;
  note?: string;
  userId?: Types.ObjectId; // collegamento con l'account di login (User)
  areaIntermediazione?: boolean;
  modalitaAbilitata: 'entrambi' | 'privato' | 'convenzione' | 'intermediazione';

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
      enum: ['infermieristico', 'oss', 'riabilitativo', 'medico', 'sociale', 'coordinamento', 'direzione', 'privato', 'osa', 'assistente-familiare', 'badante'],
      default: 'infermieristico'
    },
    phone: { type: String, trim: true },
    codiceFiscale: { type: String, trim: true },
    partitaIva: { type: String, trim: true },
    indirizzoResidenza: { type: String, trim: true },
    cittaResidenza: { type: String, trim: true },
    professionista: { type: Boolean, default: false },
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
    areaIntermediazione: { type: Boolean, default: false },
    modalitaAbilitata: {
      type: String,
      enum: ['entrambi', 'privato', 'convenzione', 'intermediazione'],
      default: 'entrambi',
    },
  },
  { timestamps: true }
);

staffSchema.index({ category: 1, active: 1, lastName: 1 });
staffSchema.index({ userId: 1 });
staffSchema.index({ email: 1, active: 1 });

staffSchema.pre('save', function (next) {
  if (this.isModified('phone') && (this as any).phone) (this as any).phone = encrypt((this as any).phone);
  next();
});

staffSchema.set('toJSON', {
  transform: function (_doc, ret) {
    if ((ret as any).phone) (ret as any).phone = decrypt((ret as any).phone);
    return ret;
  },
});

export default model<IStaff>('Staff', staffSchema);