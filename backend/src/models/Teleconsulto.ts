import { Document, Schema, model } from 'mongoose';

export type StatoTeleconsulto = 'pianificato' | 'in_corso' | 'completato' | 'annullato' | 'non_presentato';
export type TipoProfessioneTele = 'medico' | 'infermiere' | 'fisioterapista' | 'logopedista' | 'psicologo' | 'coordinatore' | 'generico';

export interface IPartecipanteTeleconsulto {
  userId?: string;
  nome: string;
  email: string;
  ruolo: 'operatore' | 'paziente' | 'caregiver' | 'ospite';
  entratoIl?: Date;
  uscitoIl?: Date;
}

export interface INotaClinica {
  autoreId: string;
  autoreNome: string;
  testo: string;
  inseritaIl: Date;
}

export interface ITeleconsulto extends Document {
  patientId: string;
  patientNome: string;
  dataOra: Date;
  durataMinuti: number;
  professione: TipoProfessioneTele;
  titolo?: string;
  notePianificazione?: string;
  stato: StatoTeleconsulto;
  roomId: string;
  operatori: IPartecipanteTeleconsulto[];
  pazientiCaregiver: IPartecipanteTeleconsulto[];
  consensoVerificato: boolean;
  consensoId?: string;
  noteCliniche: INotaClinica[];
  diarioEntrata: string;
  diarioUscita?: string;
  avviatoIl?: Date;
  completatoIl?: Date;
  creatoDa: string;
  creatoDaNome: string;
}

const partecipanteSchema = new Schema<IPartecipanteTeleconsulto>(
  {
    userId: { type: String },
    nome: { type: String, required: true },
    email: { type: String, required: true },
    ruolo: { type: String, enum: ['operatore', 'paziente', 'caregiver', 'ospite'], required: true },
    entratoIl: { type: Date },
    uscitoIl: { type: Date },
  },
  { _id: false }
);

const notaClinicaSchema = new Schema<INotaClinica>(
  {
    autoreId: { type: String, required: true },
    autoreNome: { type: String, required: true },
    testo: { type: String, required: true },
    inseritaIl: { type: Date, default: Date.now },
  },
  { _id: false }
);

const teleconsultoSchema = new Schema<ITeleconsulto>(
  {
    patientId: { type: String, required: true, index: true },
    patientNome: { type: String, required: true },
    dataOra: { type: Date, required: true, index: true },
    durataMinuti: { type: Number, default: 30 },
    professione: { type: String, enum: ['medico', 'infermiere', 'fisioterapista', 'logopedista', 'psicologo', 'coordinatore', 'generico'], default: 'generico' },
    titolo: { type: String, trim: true },
    notePianificazione: { type: String, trim: true },
    stato: { type: String, enum: ['pianificato', 'in_corso', 'completato', 'annullato', 'non_presentato'], default: 'pianificato', index: true },
    roomId: { type: String, required: true, unique: true },
    operatori: [partecipanteSchema],
    pazientiCaregiver: [partecipanteSchema],
    consensoVerificato: { type: Boolean, default: false },
    consensoId: { type: String },
    noteCliniche: [notaClinicaSchema],
    diarioEntrata: { type: String, default: '' },
    diarioUscita: { type: String, default: '' },
    avviatoIl: { type: Date },
    completatoIl: { type: Date },
    creatoDa: { type: String, required: true },
    creatoDaNome: { type: String, required: true },
  },
  { timestamps: true }
);

teleconsultoSchema.index({ dataOra: 1, stato: 1 });

export default model<ITeleconsulto>('Teleconsulto', teleconsultoSchema);
