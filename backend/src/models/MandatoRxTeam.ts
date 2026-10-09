import { Document, Schema, model, Types } from 'mongoose';

export interface IEsameRichiesto {
  tipo: 'rx_domiciliare' | 'ecografia_domiciliare' | 'ecocolordoppler' | 'ecocolordoppler_tsa' | 'altro';
  dettaglio?: string; // distretto/sede/tipo specifico indicato dall'operatore
}

export interface IAccessoInfo {
  allettato?: boolean;
  deambulante?: boolean;
  carrozzina?: boolean;
  ascensore?: boolean;
  scaleAccessoDifficoltoso?: boolean;
  ossigenoterapia?: boolean;
}

export interface IMandatoRxTeam extends Document {
  patient: Types.ObjectId;
  nPratica: string;
  dataRichiesta: Date;
  operatoreAbbraccio?: string;
  esami: IEsameRichiesto[];
  prescrizioneMedica: 'allegata' | 'da_consegnare' | 'non_prevista';
  quesitoClinico?: string;
  compenso: number; // compenso/tariffa dell'esame richiesto dal paziente
  dataEsecuzione?: string;
  fasciaOraria?: string;
  referenteRxTeam?: string;
  recapitoNote?: string;
  accessoInfo?: IAccessoInfo;
  noteOrganizzative?: string;
  stato: 'emesso' | 'firmato';
  token: string;
  email?: string;
  nome?: string;
  luogoFirma?: string;
  dataFirma?: Date;
  firmaImg?: string;
  htmlFirmato?: string;
  accettato?: boolean;
}

const esameRichiestoSchema = new Schema<IEsameRichiesto>(
  {
    tipo: { type: String, enum: ['rx_domiciliare', 'ecografia_domiciliare', 'ecocolordoppler', 'ecocolordoppler_tsa', 'altro'], required: true },
    dettaglio: { type: String, trim: true },
  },
  { _id: false }
);

const accessoInfoSchema = new Schema<IAccessoInfo>(
  {
    allettato: { type: Boolean, default: false },
    deambulante: { type: Boolean, default: false },
    carrozzina: { type: Boolean, default: false },
    ascensore: { type: Boolean, default: false },
    scaleAccessoDifficoltoso: { type: Boolean, default: false },
    ossigenoterapia: { type: Boolean, default: false },
  },
  { _id: false }
);

const mandatoRxTeamSchema = new Schema<IMandatoRxTeam>(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    nPratica: { type: String, trim: true },
    dataRichiesta: { type: Date, default: Date.now },
    operatoreAbbraccio: { type: String, trim: true },
    esami: { type: [esameRichiestoSchema], default: [] },
    prescrizioneMedica: { type: String, enum: ['allegata', 'da_consegnare', 'non_prevista'], default: 'non_prevista' },
    quesitoClinico: { type: String, trim: true },
    compenso: { type: Number, required: true, default: 0 },
    dataEsecuzione: { type: String, trim: true },
    fasciaOraria: { type: String, trim: true },
    referenteRxTeam: { type: String, trim: true },
    recapitoNote: { type: String, trim: true },
    accessoInfo: { type: accessoInfoSchema, default: () => ({}) },
    noteOrganizzative: { type: String, trim: true },
    stato: { type: String, enum: ['emesso', 'firmato'], default: 'emesso' },
    token: { type: String, unique: true, sparse: true },
    email: { type: String, trim: true, lowercase: true },
    nome: { type: String, trim: true },
    luogoFirma: { type: String, trim: true },
    dataFirma: { type: Date },
    firmaImg: { type: String },
    htmlFirmato: { type: String },
    accettato: { type: Boolean, default: false },
  },
  { timestamps: true }
);

mandatoRxTeamSchema.index({ patient: 1, dataRichiesta: -1 });
mandatoRxTeamSchema.index({ token: 1 });

export default model<IMandatoRxTeam>('MandatoRxTeam', mandatoRxTeamSchema);
