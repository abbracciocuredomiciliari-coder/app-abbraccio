import { Document, Schema, model, Types } from 'mongoose';

export type StatoScheda = 'inviata' | 'accettata' | 'archiviata' | 'rifiutata';
export type FrequenzaPrestazione = 'singola' | 'multipla' | 'continuata';
export type MetodoPagamento = 'contanti' | 'carta_credito' | 'bonifico' | 'altro';
export type FrequenzaPagamento = 'giornaliera' | 'settimanale' | 'ogni_10_giorni' | 'mensile';

export interface ISchedaServizio extends Document {
  // Collegamento paziente (opzionale — può essere compilata da caregiver non registrato)
  pazienteId?: Types.ObjectId;
  compilataDa?: Types.ObjectId; // userId del compilatore

  // 1. Dati paziente
  nomeCognomePaziente: string;
  dataNascita: string;

  // 2. Dettagli prestazione
  tipoPrestazione: string;
  frequenzaPrestazione: FrequenzaPrestazione;
  giorniContinuata?: number;
  operatoreIncaricato?: string;

  // 3. Tariffa e pagamento
  costoPrestazione: number;
  ivaPercentuale?: number;
  metodoPagamento: MetodoPagamento;
  frequenzaPagamento: FrequenzaPagamento;
  pagamentoEffettuato: boolean;

  // Firma paziente/caregiver
  firmaBase64: string;
  nomeFirmatario: string;
  ruoloFirmatario: 'paziente' | 'caregiver';
  dataFirma: Date;

  // Gestione admin
  stato: StatoScheda;
  noteAdmin?: string;
  archiviataDa?: Types.ObjectId;
  dataArchiviazione?: Date;

  // Collegamento documento archiviato in PatientDocument
  documentoArchiviatoId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const schedaServizioSchema = new Schema<ISchedaServizio>(
  {
    pazienteId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    compilataDa: { type: Schema.Types.ObjectId, ref: 'User' },

    nomeCognomePaziente: { type: String, required: true, trim: true },
    dataNascita: { type: String, required: true, trim: true },

    tipoPrestazione: { type: String, required: true, trim: true },
    frequenzaPrestazione: {
      type: String,
      required: true,
      enum: ['singola', 'multipla', 'continuata'],
    },
    giorniContinuata: { type: Number },
    operatoreIncaricato: { type: String, trim: true },

    costoPrestazione: { type: Number, required: true },
    ivaPercentuale: { type: Number, default: 0 },
    metodoPagamento: {
      type: String,
      required: true,
      enum: ['contanti', 'carta_credito', 'bonifico', 'altro'],
    },
    frequenzaPagamento: {
      type: String,
      required: true,
      enum: ['giornaliera', 'settimanale', 'ogni_10_giorni', 'mensile'],
    },
    pagamentoEffettuato: { type: Boolean, default: false },

    firmaBase64: { type: String, required: true },
    nomeFirmatario: { type: String, required: true, trim: true },
    ruoloFirmatario: { type: String, required: true, enum: ['paziente', 'caregiver'] },
    dataFirma: { type: Date, default: Date.now },

    stato: {
      type: String,
      required: true,
      enum: ['inviata', 'accettata', 'archiviata', 'rifiutata'],
      default: 'inviata',
    },
    noteAdmin: { type: String, trim: true },
    archiviataDa: { type: Schema.Types.ObjectId, ref: 'User' },
    dataArchiviazione: { type: Date },
    documentoArchiviatoId: { type: Schema.Types.ObjectId, ref: 'PatientDocument' },
  },
  { timestamps: true }
);

schedaServizioSchema.index({ stato: 1, createdAt: -1 });
schedaServizioSchema.index({ pazienteId: 1 });
schedaServizioSchema.index({ compilataDa: 1 });

export default model<ISchedaServizio>('SchedaServizio', schedaServizioSchema);
