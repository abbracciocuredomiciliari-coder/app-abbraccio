import { Document, Schema, model } from 'mongoose';

export interface IUser extends Document {
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  phone?: string;
  role: 'admin' | 'coordinator' | 'caregiver' | 'direttore' | 'paziente_registrato';
  status: 'pending' | 'approved' | 'rejected';
  professione?: string;
  categoria?: string;
  domicilioPartenza?: string;
  raggioAzioneKm?: number;
  domicilioCoords?: { lat: number; lng: number };
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  // Per paziente_registrato: dati del paziente associato
  pazienteId?: string;
  telefono?: string;
  // Dati anagrafici completi
  codiceFiscale?: string;
  dataNascita?: Date;
  luogoNascita?: string;
  indirizzoResidenza?: string;
  pec?: string;
  // Tipo collaborazione
  tipoCollaborazione?: 'libero-professionista' | 'dipendente';
  partitaIva?: string;
  regimeFiscale?: 'forfettario' | 'ordinario';
  // Dati albo
  ordineAlbo?: string;
  numeroAlbo?: string;
  // Contratto firmato
  firmaContratto?: string; // base64 firma
  dataFirmaContratto?: Date;
  luogoFirmaContratto?: string;
  contrattoPdfUrl?: string; // URL al PDF generato
  autoveicoli?: string;
  // Documenti allegati (riferimenti a file)
  documenti?: {
    assicurazione?: string; // path/url file
    documentoIdentita?: string;
    attestazioneQualifica?: string;
  };
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, trim: true },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'coordinator', 'caregiver', 'direttore', 'paziente_registrato'],
      default: 'caregiver'
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    professione: { type: String, trim: true },
    categoria: { type: String, trim: true },
    domicilioPartenza: { type: String, trim: true },
    raggioAzioneKm: { type: Number, default: 10 },
    domicilioCoords: {
      lat: { type: Number },
      lng: { type: Number },
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    pazienteId: { type: String, required: false },
    telefono: { type: String, trim: true },
    // Dati anagrafici completi
    codiceFiscale: { type: String, trim: true, uppercase: true },
    dataNascita: { type: Date },
    luogoNascita: { type: String, trim: true },
    indirizzoResidenza: { type: String, trim: true },
    pec: { type: String, trim: true, lowercase: true },
    // Tipo collaborazione
    tipoCollaborazione: { type: String, enum: ['libero-professionista', 'dipendente'] },
    partitaIva: { type: String, trim: true },
    regimeFiscale: { type: String, enum: ['forfettario', 'ordinario'] },
    // Dati albo
    ordineAlbo: { type: String, trim: true },
    numeroAlbo: { type: String, trim: true },
    // Contratto firmato
    firmaContratto: { type: String }, // base64
    dataFirmaContratto: { type: Date },
    luogoFirmaContratto: { type: String, trim: true },
    contrattoPdfUrl: { type: String, trim: true },
    autoveicoli: { type: String, trim: true },
    // Documenti allegati
    documenti: {
      assicurazione: { type: String, trim: true },
      documentoIdentita: { type: String, trim: true },
      attestazioneQualifica: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

export default model<IUser>('User', userSchema);
