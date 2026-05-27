import { Document, Schema, model } from 'mongoose';

// ─── Voce del Registro Interventi ────────────────────────────────────────────
export interface IRegistroIntervento {
  data: Date;
  tipoIntervento: string;
  esito: 'Ok' | 'Ko';
  firma: string;
}

// ─── Documento principale ─────────────────────────────────────────────────────
export interface ISchedaControlloDefibrillatore extends Document {
  apparecchio: string;
  idSN: string;
  // Registro Interventi e Controlli
  registroInterventi: IRegistroIntervento[];
  // Checklist Verifica Prima dell'Uso
  integritaCaviAlimentazione: boolean;
  integritaCaviAlimentazioneNote: string;
  correttoAvvioAutoTest: boolean;
  correttoAvvioAutoTestNote: string;
  puliziaScocca: boolean;
  puliziaScoccanote: string;
  batteriaCarica: boolean;
  batteriaCaricaNote: string;
  // Metadati
  compilatoDa: string;
  dataCompilazione: Date;
  createdAt: Date;
  updatedAt: Date;
}

const registroInterventoSchema = new Schema<IRegistroIntervento>(
  {
    data: { type: Date, required: true },
    tipoIntervento: { type: String, trim: true, default: '' },
    esito: { type: String, enum: ['Ok', 'Ko'], required: true },
    firma: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const schedaControlloDefibrillatoreSchema = new Schema<ISchedaControlloDefibrillatore>(
  {
    apparecchio: { type: String, trim: true, default: '' },
    idSN: { type: String, trim: true, default: '' },
    // Registro interventi
    registroInterventi: { type: [registroInterventoSchema], default: [] },
    // Checklist verifica prima dell'uso
    integritaCaviAlimentazione: { type: Boolean, default: false },
    integritaCaviAlimentazioneNote: { type: String, trim: true, default: '' },
    correttoAvvioAutoTest: { type: Boolean, default: false },
    correttoAvvioAutoTestNote: { type: String, trim: true, default: '' },
    puliziaScocca: { type: Boolean, default: false },
    puliziaScoccanote: { type: String, trim: true, default: '' },
    batteriaCarica: { type: Boolean, default: false },
    batteriaCaricaNote: { type: String, trim: true, default: '' },
    // Metadati
    compilatoDa: { type: String, trim: true, default: '' },
    dataCompilazione: { type: Date, required: true },
  },
  { timestamps: true }
);

export default model<ISchedaControlloDefibrillatore>(
  'SchedaControlloDefibrillatore',
  schedaControlloDefibrillatoreSchema
);
