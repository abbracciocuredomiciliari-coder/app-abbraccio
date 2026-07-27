import { Document, Schema, model } from 'mongoose';

export type TipoParametro = 'frequenza_cardiaca' | 'pressione_sistolica' | 'pressione_diastolica' | 'saturazione_o2' | 'glicemia' | 'temperatura' | 'peso' | 'altezza' | 'bmi' | 'co2' | 'passi' | 'dolore_nrs' | 'spo2' | 'altro';
export type FonteDato = 'manuale' | 'dispositivo' | 'api' | 'caregiver' | 'paziente';

export interface IParametroVita extends Document {
  pazienteId: string;
  pazienteNome: string;
  dispositivoId?: string;
  tipo: TipoParametro;
  valore: number;
  unita: string;
  rilevatoIl: Date;
  fonte: FonteDato;
  anomalo?: boolean;
  note?: string;
  geolocalizzazione?: { lat: number; lng: number };
  validatoDa?: string;
  validatoIl?: Date;
  creatoDa: string;
}

const parametroSchema = new Schema<IParametroVita>(
  {
    pazienteId: { type: String, required: true, index: true },
    pazienteNome: { type: String, required: true },
    dispositivoId: { type: String, index: true },
    tipo: { type: String, enum: ['frequenza_cardiaca', 'pressione_sistolica', 'pressione_diastolica', 'saturazione_o2', 'glicemia', 'temperatura', 'peso', 'altezza', 'bmi', 'co2', 'passi', 'dolore_nrs', 'spo2', 'altro'], required: true },
    valore: { type: Number, required: true },
    unita: { type: String, required: true },
    rilevatoIl: { type: Date, required: true, default: Date.now, index: true },
    fonte: { type: String, enum: ['manuale', 'dispositivo', 'api', 'caregiver', 'paziente'], default: 'manuale' },
    anomalo: { type: Boolean, default: false },
    note: { type: String, trim: true },
    geolocalizzazione: {
      lat: { type: Number },
      lng: { type: Number },
    },
    validatoDa: { type: String },
    validatoIl: { type: Date },
    creatoDa: { type: String, required: true },
  },
  { timestamps: true }
);

parametroSchema.index({ pazienteId: 1, tipo: 1, rilevatoIl: -1 });
parametroSchema.index({ anomalo: 1, rilevatoIl: -1 });

export default model<IParametroVita>('ParametroVita', parametroSchema);
