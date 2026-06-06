import { Document, Schema, model } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
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
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
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
  },
  { timestamps: true }
);

export default model<IUser>('User', userSchema);
