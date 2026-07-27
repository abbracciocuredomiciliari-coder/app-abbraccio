import { Document, Schema, model } from 'mongoose';

export type StatoDispositivo = 'attivo' | 'sospeso' | 'malfunzionamento' | 'restituito' | 'in_arrivo';
export type TipoDispositivo = 'pressione' | 'saturazione' | 'glucometro' | 'bilancia' | 'termometro' | 'elettrocardiografo' | 'sfigmomanometro' | 'ossimetro' | 'spirometro' | 'altro';

export interface IDispositivoMedico extends Document {
  codice: string;
  pazienteId: string;
  pazienteNome: string;
  tipo: TipoDispositivo;
  modello?: string;
  serialNumber?: string;
  fornitore?: string;
  stato: StatoDispositivo;
  dataAssegnazione?: Date;
  dataRestituzione?: Date;
  note?: string;
  gatewayApi?: string;
  apiKey?: string;
  ultimaSincronizzazione?: Date;
  parametriSupportati: string[];
  creatoDa: string;
}

const dispositivoSchema = new Schema<IDispositivoMedico>(
  {
    codice: { type: String, required: true, unique: true },
    pazienteId: { type: String, required: true, index: true },
    pazienteNome: { type: String, required: true },
    tipo: { type: String, enum: ['pressione', 'saturazione', 'glucometro', 'bilancia', 'termometro', 'elettrocardiografo', 'sfigmomanometro', 'ossimetro', 'spirometro', 'altro'], required: true },
    modello: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    fornitore: { type: String, trim: true },
    stato: { type: String, enum: ['attivo', 'sospeso', 'malfunzionamento', 'restituito', 'in_arrivo'], default: 'attivo', index: true },
    dataAssegnazione: { type: Date, default: Date.now },
    dataRestituzione: { type: Date },
    note: { type: String, trim: true },
    gatewayApi: { type: String, trim: true },
    apiKey: { type: String },
    ultimaSincronizzazione: { type: Date },
    parametriSupportati: [{ type: String }],
    creatoDa: { type: String, required: true },
  },
  { timestamps: true }
);

dispositivoSchema.index({ pazienteId: 1, stato: 1 });

export default model<IDispositivoMedico>('DispositivoMedico', dispositivoSchema);
