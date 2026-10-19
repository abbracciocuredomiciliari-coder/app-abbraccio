// ─── Tariffe CCNL/INPS del simulatore costi badanti ───────────────────────────
// Documento singleton (key 'ccnl') con l'intera struttura ParametriCcnl.
// Alla lettura viene fatta merge sui default PARAMETRI_CCN_2026, così i campi
// aggiunti in futuro dal codice restano valorizzati anche sui doc più vecchi.
import { Document, Schema, model } from 'mongoose';

export interface ITariffaCcnl extends Document {
  key: string;                 // 'ccnl'
  parametri: any;              // ParametriCcnl (Mixed: evolve col motore)
  aggiornatoDa?: string;
  aggiornatoIl?: Date;
}

const tariffaCcnlSchema = new Schema<ITariffaCcnl>(
  {
    key: { type: String, required: true, unique: true, default: 'ccnl' },
    parametri: { type: Schema.Types.Mixed, required: true },
    aggiornatoDa: { type: String },
    aggiornatoIl: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default model<ITariffaCcnl>('TariffaCcnl', tariffaCcnlSchema);
