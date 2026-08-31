import { Document, Schema, model, Types } from 'mongoose';

export interface IDiariaPrelievo {
  _id?: Types.ObjectId;
  data: Date;
  autore: string;
  autoreId?: Types.ObjectId;
  ruoloAutore?: string;
  testo: string;
  firmato?: boolean;
  dataFirma?: Date;
  firma?: string;
}

export interface IAllegatoPrelievo {
  _id?: Types.ObjectId;
  nomeFile: string;
  nomeFileServer: string;
  mimeType: string;
  dimensione: number;
  descrizione?: string;
  caricatoDa: string;
  caricatoDaId?: Types.ObjectId;
  dataCaricamento: Date;
  urlCloudinary?: string;
  publicIdCloudinary?: string;
}

export interface IPrelievo extends Document {
  patient: Types.ObjectId;
  staff: Types.ObjectId;           // operatore incaricato
  dataPrelievo: Date;
  orario?: string;
  tipoPrelievo: string | string[]; // es. "Emocromo" o ["Emocromo", "Glicemia"]
  note?: string;
  status: 'pianificato' | 'eseguito' | 'annullato';
  tipoGestione: 'privato' | 'convenzione';

  // Registrazione esecuzione
  dataEsecuzione?: Date;
  eseguitoDa?: string;
  eseguitoDaId?: Types.ObjectId;
  noteEsecuzione?: string;

  // Firme touch (canvas base64)
  firmaOperatore?: string;
  firmaPaziente?: string;
  nomeFirmatarioPaziente?: string;
  ruoloFirmatario?: 'paziente' | 'caregiver';

  // Diaria clinica
  diaria: IDiariaPrelievo[];

  // Allegati (es. referto di laboratorio)
  allegati: IAllegatoPrelievo[];

  archiviato?: boolean;
  dataArchiviazione?: Date;
  archiviatoDa?: string;
}

const diariaSchema = new Schema<IDiariaPrelievo>(
  {
    data: { type: Date, required: true, default: Date.now },
    autore: { type: String, required: true },
    autoreId: { type: Schema.Types.ObjectId },
    ruoloAutore: { type: String },
    testo: { type: String, required: true, trim: true },
    firmato: { type: Boolean, default: false },
    dataFirma: { type: Date },
    firma: { type: String },
  },
  { _id: true }
);

const allegatoSchema = new Schema<IAllegatoPrelievo>(
  {
    nomeFile: { type: String, required: true },
    nomeFileServer: { type: String, required: true },
    mimeType: { type: String, required: true },
    dimensione: { type: Number, required: true },
    descrizione: { type: String, trim: true },
    caricatoDa: { type: String, required: true },
    caricatoDaId: { type: Schema.Types.ObjectId },
    dataCaricamento: { type: Date, default: Date.now },
    urlCloudinary: { type: String },
    publicIdCloudinary: { type: String },
  },
  { _id: true }
);

const prelievoSchema = new Schema<IPrelievo>(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    staff: { type: Schema.Types.ObjectId, ref: 'Staff', required: false, default: null },
    dataPrelievo: { type: Date, required: true },
    orario: { type: String },
    tipoPrelievo: { type: Schema.Types.Mixed, required: true }, // supporta string o string[]
    note: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pianificato', 'eseguito', 'annullato'],
      default: 'pianificato',
    },
    tipoGestione: {
      type: String,
      enum: ['privato', 'convenzione'],
      required: true,
      default: 'privato',
    },
    dataEsecuzione: { type: Date },
    eseguitoDa: { type: String },
    eseguitoDaId: { type: Schema.Types.ObjectId },
    noteEsecuzione: { type: String, trim: true },
    firmaOperatore: { type: String },
    firmaPaziente: { type: String },
    nomeFirmatarioPaziente: { type: String },
    ruoloFirmatario: { type: String, enum: ['paziente', 'caregiver'] },
    diaria: [diariaSchema],
    allegati: [allegatoSchema],
    archiviato: { type: Boolean, default: false },
    dataArchiviazione: { type: Date },
    archiviatoDa: { type: String },
  },
  { timestamps: true }
);

prelievoSchema.index({ patient: 1, dataPrelievo: -1 });
prelievoSchema.index({ staff: 1, dataPrelievo: -1 });
prelievoSchema.index({ tipoGestione: 1, dataPrelievo: -1 });
prelievoSchema.index({ patient: 1, dataPrelievo: -1 });

export default model<IPrelievo>('Prelievo', prelievoSchema);
