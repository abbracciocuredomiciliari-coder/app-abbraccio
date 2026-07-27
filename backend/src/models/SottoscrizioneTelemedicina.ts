import { Document, Schema, model } from 'mongoose';

export type StatoSottoscrizione = 'attiva' | 'sospesa' | 'scaduta' | 'disdetta';

export interface ISottoscrizioneTelemedicina extends Document {
  pazienteId: string;
  pazienteNome: string;
  pacchettoId: string;
  pacchettoNome: string;
  pacchettoCodice: string;
  tipo: string;
  prezzoMensile: number;
  prezzoAttivazione: number;
  durataMinimaMesi: number;
  dataInizio: Date;
  dataFine?: Date;
  incluseProfessioni: string[];
  dispositiviInclusi: string[];
  parametriInclusi: string[];
  verticali: string[];
  dispositiviAssegnati: string[];
  stato: StatoSottoscrizione;
  note?: string;
  creatoDa: string;
}

const sottoscrizioneSchema = new Schema<ISottoscrizioneTelemedicina>(
  {
    pazienteId: { type: String, required: true, index: true },
    pazienteNome: { type: String, required: true },
    pacchettoId: { type: String, required: true, index: true },
    pacchettoNome: { type: String, required: true },
    pacchettoCodice: { type: String, required: true },
    tipo: { type: String, default: 'canone' },
    prezzoMensile: { type: Number, default: 0, min: 0 },
    prezzoAttivazione: { type: Number, default: 0, min: 0 },
    durataMinimaMesi: { type: Number, default: 12 },
    dataInizio: { type: Date, required: true },
    dataFine: { type: Date },
    incluseProfessioni: [{ type: String }],
    dispositiviInclusi: [{ type: String }],
    parametriInclusi: [{ type: String }],
    verticali: [{ type: String }],
    dispositiviAssegnati: [{ type: String }],
    stato: { type: String, enum: ['attiva', 'sospesa', 'scaduta', 'disdetta'], default: 'attiva', index: true },
    note: { type: String },
    creatoDa: { type: String, required: true },
  },
  { timestamps: true }
);

sottoscrizioneSchema.index({ pazienteId: 1, stato: 1 });
sottoscrizioneSchema.index({ pacchettoId: 1, stato: 1 });

export default model<ISottoscrizioneTelemedicina>('SottoscrizioneTelemedicina', sottoscrizioneSchema);
