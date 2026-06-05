import { Document, Schema, model, Types } from 'mongoose';

export interface IGiornoSettimana {
  giorno: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Dom, 1=Lun, ..., 6=Sab
  accessiAlGiorno?: number;       // per prestazionale: quanti accessi quel giorno
  minutiPerAccesso?: number;      // per assistenziale: minuti per accesso
}

export interface IWorkPlan extends Document {
  type: 'prestazionale' | 'assistenziale' | 'esami_strumentali';
  category: string;
  tipoEsame?: string;   // per esami_strumentali: ECG, Holter ECG, ecc.
  patient: Types.ObjectId;
  staff: Types.ObjectId;
  date: Date;           // data inizio piano
  dataFine?: Date;      // data fine piano
  time?: string;
  duration?: number;
  task: string;
  notes?: string;
  status: 'pending' | 'completed' | 'cancelled';
  // Pianificazione settimanale
  giorniSettimana?: IGiornoSettimana[];  // giorni attivi con dettagli
  // Compenso operatore
  tipoCompenso?: 'orario' | 'fisso' | 'nessuno';
  tariffa?: number;
  compensoTotale?: number;
  compensoPagato?: boolean;
  // Costo prestazione al paziente (ricavo admin) - solo pazienti PRIVATI
  costoPrestazione?: number;
  // Tariffa da fatturare all'ASL - solo pazienti in CONVENZIONE
  tariffaAsl?: number;
}

const workPlanSchema = new Schema<IWorkPlan>(
  {
    type: { 
      type: String, 
      required: true, 
      enum: ['prestazionale', 'assistenziale', 'esami_strumentali'],
      default: 'prestazionale'
    },
    category: { type: String, required: true },
    tipoEsame: { type: String, trim: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    staff: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
    date: { type: Date, required: true },
    dataFine: { type: Date },
    time: { type: String },
    duration: { type: Number, default: 60 },
    giorniSettimana: [{
      giorno: { type: Number, required: true, min: 0, max: 6 },
      accessiAlGiorno: { type: Number, default: 1 },
      minutiPerAccesso: { type: Number, default: 60 },
    }],
    task: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    status: { 
      type: String, 
      required: true, 
      enum: ['pending', 'completed', 'cancelled'], 
      default: 'pending' 
    },
    tipoCompenso: { type: String, enum: ['orario', 'fisso', 'nessuno'], default: 'nessuno' },
    tariffa: { type: Number, default: 0 },
    compensoTotale: { type: Number, default: 0 },
    compensoPagato: { type: Boolean, default: false },
    costoPrestazione: { type: Number, default: 0 },
    tariffaAsl: { type: Number, default: 0 },
  },
  { timestamps: true }
);

workPlanSchema.index({ staff: 1, status: 1, date: 1 });
workPlanSchema.index({ patient: 1, date: 1 });
workPlanSchema.index({ status: 1, date: 1 });
workPlanSchema.index({ compensoPagato: 1, staff: 1 });

export default model<IWorkPlan>('WorkPlan', workPlanSchema);