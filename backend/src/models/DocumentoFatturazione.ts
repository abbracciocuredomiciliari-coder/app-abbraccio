import { Document, Schema, model, Types } from 'mongoose';

export interface IVocePrestazione {
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
  importo: number;
}

export interface IDocumentoFatturazione extends Document {
  numero: string; // es. PREV-2026-00001 / FATT-2026-00001
  tipo: 'preventivo' | 'fattura';
  patient: Types.ObjectId;
  riferimentoTipo?: 'workplan' | 'prelievo' | 'esame_strumentale';
  riferimentoId?: Types.ObjectId;
  prestazioni: IVocePrestazione[];
  totale: number;
  data: Date;
  stato: 'emesso' | 'annullato';
  note?: string;
  creatoDa: string;
  documentoOrigineId?: Types.ObjectId; // se una fattura nasce dalla conferma di un preventivo
}

const vocePrestazioneSchema = new Schema<IVocePrestazione>(
  {
    descrizione: { type: String, required: true, trim: true },
    quantita: { type: Number, required: true, default: 1 },
    prezzoUnitario: { type: Number, required: true, default: 0 },
    importo: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const documentoFatturazioneSchema = new Schema<IDocumentoFatturazione>(
  {
    numero: { type: String, required: true, unique: true },
    tipo: { type: String, required: true, enum: ['preventivo', 'fattura'] },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    riferimentoTipo: { type: String, enum: ['workplan', 'prelievo', 'esame_strumentale'] },
    riferimentoId: { type: Schema.Types.ObjectId },
    prestazioni: { type: [vocePrestazioneSchema], required: true },
    totale: { type: Number, required: true, default: 0 },
    data: { type: Date, required: true, default: Date.now },
    stato: { type: String, enum: ['emesso', 'annullato'], default: 'emesso' },
    note: { type: String, trim: true },
    creatoDa: { type: String, required: true },
    documentoOrigineId: { type: Schema.Types.ObjectId, ref: 'DocumentoFatturazione' },
  },
  { timestamps: true }
);

documentoFatturazioneSchema.index({ patient: 1, data: -1 });
documentoFatturazioneSchema.index({ tipo: 1, data: -1 });

export default model<IDocumentoFatturazione>('DocumentoFatturazione', documentoFatturazioneSchema);
