import { Document, Schema, model } from 'mongoose';

export type StatoRichiestaPaziente = 'in_attesa' | 'approvata' | 'rifiutata';

export interface IRichiestaRegistrazionePaziente extends Document {
  // Anagrafica paziente
  firstName: string;
  lastName: string;
  birthDate: Date;
  codiceFiscale?: string;
  address: string;
  contactPhone?: string;
  email?: string;

  // Necessità assistenziali
  assistanceNeeds: string;
  medicoReferente?: string;
  noteAggiuntive?: string;

  // Richiedente (chi compila il form)
  richiedenteNome: string;
  richiedenteRelazione?: string; // 'paziente' | 'familiare' | 'caregiver' | 'medico'
  richiedenteEmail?: string;
  richiedenteTelefono?: string;

  // Gestione
  stato: StatoRichiestaPaziente;
  noteAdmin?: string;
  pazienteCreatId?: string; // ID del Patient creato dopo approvazione

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IRichiestaRegistrazionePaziente>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    birthDate: { type: Date, required: true },
    codiceFiscale: { type: String, trim: true, uppercase: true },
    address: { type: String, required: true, trim: true },
    contactPhone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },

    assistanceNeeds: { type: String, required: true, trim: true },
    medicoReferente: { type: String, trim: true },
    noteAggiuntive: { type: String, trim: true },

    richiedenteNome: { type: String, required: true, trim: true },
    richiedenteRelazione: { type: String, trim: true },
    richiedenteEmail: { type: String, trim: true, lowercase: true },
    richiedenteTelefono: { type: String, trim: true },

    stato: { type: String, enum: ['in_attesa', 'approvata', 'rifiutata'], default: 'in_attesa' },
    noteAdmin: { type: String, trim: true },
    pazienteCreatId: { type: String },
  },
  { timestamps: true }
);

schema.index({ stato: 1, createdAt: -1 });

export default model<IRichiestaRegistrazionePaziente>('RichiestaRegistrazionePaziente', schema);
