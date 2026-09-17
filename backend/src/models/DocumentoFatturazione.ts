import { Document, Schema, model, Types } from 'mongoose';

export interface IVocePrestazione {
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
  importo: number;
  tipo?: string;
}

export interface IDocumentoFatturazione extends Document {
  numero: string; // es. PREV-2026-00001 / FATT-2026-00001
  tipo: 'preventivo' | 'fattura';
  patient: Types.ObjectId;
  riferimentoTipo?: 'workplan' | 'prelievo' | 'esame_strumentale' | 'badante';
  riferimentoId?: Types.ObjectId;
  prestazioni: IVocePrestazione[];
  totale: number;
  data: Date;
  dataPrestazione?: Date; // data della prestazione/visita effettuata
  stato: 'emesso' | 'firmato' | 'annullato';
  note?: string;
  creatoDa: string;
  totaleLabel?: string;
  documentoOrigineId?: Types.ObjectId; // se una fattura nasce dalla conferma di un preventivo
  firma?: {
    token: string;
    firmato: boolean;
    firmatoIl?: Date;
    nome?: string;
    email?: string;
    firmaImg?: string; // firma in base64 PNG
    rifiutoRegistro?: boolean; // per fatture: rifiuto comunicazione Sistema TS (spese sanitarie)
  };
}

const vocePrestazioneSchema = new Schema<IVocePrestazione>(
  {
    descrizione: { type: String, required: true, trim: true },
    quantita: { type: Number, required: true, default: 1 },
    prezzoUnitario: { type: Number, required: true, default: 0 },
    importo: { type: Number, required: true, default: 0 },
    tipo: { type: String, trim: true },
  },
  { _id: false }
);

const documentoFatturazioneSchema = new Schema<IDocumentoFatturazione>(
  {
    numero: { type: String, required: true, unique: true },
    tipo: { type: String, required: true, enum: ['preventivo', 'fattura'] },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    riferimentoTipo: { type: String, enum: ['workplan', 'prelievo', 'esame_strumentale', 'badante'] },
    riferimentoId: { type: Schema.Types.ObjectId },
    prestazioni: { type: [vocePrestazioneSchema], required: true },
    totale: { type: Number, required: true, default: 0 },
    data: { type: Date, required: true, default: Date.now },
    dataPrestazione: { type: Date },
    stato: { type: String, enum: ['emesso', 'firmato', 'annullato'], default: 'emesso' },
    note: { type: String, trim: true },
    creatoDa: { type: String, required: true },
    totaleLabel: { type: String, trim: true },
    documentoOrigineId: { type: Schema.Types.ObjectId, ref: 'DocumentoFatturazione' },
    firma: {
      token: { type: String, unique: true, sparse: true },
      firmato: { type: Boolean, default: false },
      firmatoIl: { type: Date },
      nome: { type: String, trim: true },
      email: { type: String, trim: true },
      firmaImg: { type: String },
      rifiutoRegistro: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

documentoFatturazioneSchema.index({ patient: 1, data: -1 });
documentoFatturazioneSchema.index({ tipo: 1, data: -1 });

export default model<IDocumentoFatturazione>('DocumentoFatturazione', documentoFatturazioneSchema);
