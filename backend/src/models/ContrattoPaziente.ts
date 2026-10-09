import { Document, Schema, model, Types } from 'mongoose';

export interface IContrattoPaziente extends Document {
  patient: Types.ObjectId;
  profilo: 'OSS' | 'Infermiere' | 'Assistente familiare' | 'Operatore generale';
  importo: number;
  data: Date;
  stato: 'emesso' | 'firmato';
  token: string;
  email?: string;
  nome?: string;
  luogoFirma?: string;
  dataFirma?: Date;
  firmaImg?: string;
  htmlFirmato?: string;
  gdprAccettato?: boolean;
  gdprHtmlFirmato?: string;
  consensoGdprId?: string;
  preventivoId?: Types.ObjectId; // preventivo (DocumentoFatturazione) allegato alla richiesta firma
  allegatoFileName?: string;     // file preventivo caricato a mano
  allegatoContentType?: string;
  allegatoData?: Buffer;
}

const contrattoPazienteSchema = new Schema<IContrattoPaziente>(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    profilo: { type: String, enum: ['OSS', 'Infermiere', 'Assistente familiare', 'Operatore generale'], required: true },
    importo: { type: Number, required: true, default: 150 },
    data: { type: Date, default: Date.now },
    stato: { type: String, enum: ['emesso', 'firmato'], default: 'emesso' },
    token: { type: String, unique: true, sparse: true },
    email: { type: String, trim: true, lowercase: true },
    nome: { type: String, trim: true },
    luogoFirma: { type: String, trim: true },
    dataFirma: { type: Date },
    firmaImg: { type: String },
    htmlFirmato: { type: String },
    gdprAccettato: { type: Boolean, default: false },
    gdprHtmlFirmato: { type: String },
    consensoGdprId: { type: String },
    preventivoId: { type: Schema.Types.ObjectId, ref: 'DocumentoFatturazione' },
    allegatoFileName: { type: String },
    allegatoContentType: { type: String },
    allegatoData: { type: Buffer },
  },
  { timestamps: true }
);

contrattoPazienteSchema.index({ patient: 1, data: -1 });
contrattoPazienteSchema.index({ token: 1 });

export default model<IContrattoPaziente>('ContrattoPaziente', contrattoPazienteSchema);
