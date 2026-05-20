import { Document, Schema, model, Types } from 'mongoose';

export type StatoObiettivo = 'attivo' | 'raggiunto' | 'parziale' | 'non_raggiunto' | 'rivalutato';

export interface IValutazione {
  data: Date;
  stato: StatoObiettivo;
  note?: string;
  valutatoDa: string;
}

export interface IObiettivoWorkPlan extends Document {
  workPlan: Types.ObjectId;
  patient: Types.ObjectId;
  descrizione: string;
  stato: StatoObiettivo;
  dataInizio: Date;
  dataRivalutazione?: Date; // scadenza per rivalutazione
  valutazioni: IValutazione[];
  createdBy: string;
}

const valutazioneSchema = new Schema<IValutazione>({
  data: { type: Date, required: true, default: Date.now },
  stato: { type: String, required: true, enum: ['attivo', 'raggiunto', 'parziale', 'non_raggiunto', 'rivalutato'] },
  note: { type: String, trim: true },
  valutatoDa: { type: String, required: true },
}, { _id: true });

const obiettivoWorkPlanSchema = new Schema<IObiettivoWorkPlan>(
  {
    workPlan: { type: Schema.Types.ObjectId, ref: 'WorkPlan', required: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    descrizione: { type: String, required: true, trim: true },
    stato: {
      type: String,
      required: true,
      enum: ['attivo', 'raggiunto', 'parziale', 'non_raggiunto', 'rivalutato'],
      default: 'attivo'
    },
    dataInizio: { type: Date, required: true, default: Date.now },
    dataRivalutazione: { type: Date },
    valutazioni: { type: [valutazioneSchema], default: [] },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

obiettivoWorkPlanSchema.index({ workPlan: 1 });
obiettivoWorkPlanSchema.index({ patient: 1 });

export default model<IObiettivoWorkPlan>('ObiettivoWorkPlan', obiettivoWorkPlanSchema);
