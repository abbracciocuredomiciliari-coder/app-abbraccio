import { Document, Schema, model, Types } from 'mongoose';

// ─── Voce di diaria (giornale clinico dell'esame) ────────────────────────────
export interface IDiariaEsame {
  _id?: Types.ObjectId;
  data: Date;
  autore: string;          // nome operatore/medico
  autoreId?: Types.ObjectId;
  ruoloAutore?: string;
  testo: string;           // descrizione di quanto eseguito
  firmato?: boolean;
  dataFirma?: Date;
}

// ─── Referto medico ──────────────────────────────────────────────────────────
export interface IRefertoEsame {
  testoReferto?: string;       // testo del referto scritto dal medico
  redattoDa?: string;          // nome medico
  redattoDaId?: Types.ObjectId;
  dataReferto?: Date;
  firmato?: boolean;
  dataFirma?: Date;
  // File allegato del referto
  nomeFile?: string;
  nomeFileServer?: string;
  mimeType?: string;
  dimensione?: number;
  urlCloudinary?: string;
  publicIdCloudinary?: string;
}

// ─── Allegato generico ───────────────────────────────────────────────────────
export interface IAllegatoEsame {
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

// ─── Documento principale ────────────────────────────────────────────────────
export interface IEsameStrumentale extends Document {
  // Dati piano
  workPlan: Types.ObjectId;    // riferimento al WorkPlan (type=esami_strumentali)
  patient: Types.ObjectId;
  staff: Types.ObjectId;       // operatore esecutore
  tipoEsame: string;           // ECG, Holter ECG, ecc.
  dataEsame: Date;
  orario?: string;
  note?: string;
  status: 'pianificato' | 'eseguito' | 'refertato' | 'archiviato';

  // Diaria (giornale di quanto eseguito)
  diaria: IDiariaEsame[];

  // Referto medico
  referto?: IRefertoEsame;

  // Allegati generici
  allegati: IAllegatoEsame[];

  // Conferma esecuzione
  dataEsecuzione?: Date;
  eseguitoDa?: string;
  eseguitoDaId?: Types.ObjectId;

  // Archiviazione
  archiviato?: boolean;
  dataArchiviazione?: Date;
  archiviatoDa?: string;
}

// ─── Schema ──────────────────────────────────────────────────────────────────
const diariaSchema = new Schema<IDiariaEsame>(
  {
    data: { type: Date, required: true, default: Date.now },
    autore: { type: String, required: true },
    autoreId: { type: Schema.Types.ObjectId },
    ruoloAutore: { type: String },
    testo: { type: String, required: true, trim: true },
    firmato: { type: Boolean, default: false },
    dataFirma: { type: Date },
  },
  { _id: true }
);

const refertoSchema = new Schema<IRefertoEsame>(
  {
    testoReferto: { type: String, trim: true },
    redattoDa: { type: String },
    redattoDaId: { type: Schema.Types.ObjectId },
    dataReferto: { type: Date },
    firmato: { type: Boolean, default: false },
    dataFirma: { type: Date },
    nomeFile: { type: String },
    nomeFileServer: { type: String },
    mimeType: { type: String },
    dimensione: { type: Number },
    urlCloudinary: { type: String },
    publicIdCloudinary: { type: String },
  },
  { _id: false }
);

const allegatoEsameSchema = new Schema<IAllegatoEsame>(
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

const esameStrumentaleSchema = new Schema<IEsameStrumentale>(
  {
    workPlan: { type: Schema.Types.ObjectId, ref: 'WorkPlan', required: false },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    staff: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
    tipoEsame: { type: String, required: true, trim: true },
    dataEsame: { type: Date, required: true },
    orario: { type: String },
    note: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pianificato', 'eseguito', 'refertato', 'archiviato'],
      default: 'pianificato',
    },
    diaria: [diariaSchema],
    referto: refertoSchema,
    allegati: [allegatoEsameSchema],
    dataEsecuzione: { type: Date },
    eseguitoDa: { type: String },
    eseguitoDaId: { type: Schema.Types.ObjectId },
    archiviato: { type: Boolean, default: false },
    dataArchiviazione: { type: Date },
    archiviatoDa: { type: String },
  },
  { timestamps: true }
);

esameStrumentaleSchema.index({ workPlan: 1 });
esameStrumentaleSchema.index({ patient: 1, dataEsame: -1 });
esameStrumentaleSchema.index({ staff: 1, dataEsame: -1 });

export default model<IEsameStrumentale>('EsameStrumentale', esameStrumentaleSchema);
