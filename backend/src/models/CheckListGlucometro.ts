import { Document, Schema, model } from 'mongoose';

// Risultato per ogni livello di controllo: basso / normale / alto
export type RisultatoControllo = 'basso' | 'normale' | 'alto' | '';

export interface ILivelloControllo {
  risultato: RisultatoControllo;
  passato: boolean;
  note: string;
}

export interface ICheckListGlucometro extends Document {
  dataControllo: Date;
  idGlucometro: string;
  operatore: string;
  // Tre livelli di controllo
  livelloBasso: ILivelloControllo;
  livelloNormale: ILivelloControllo;
  livelloAlto: ILivelloControllo;
  // Esito complessivo
  controlloSuperato: boolean;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

const livelloControlloSchema = new Schema<ILivelloControllo>(
  {
    risultato: { type: String, enum: ['basso', 'normale', 'alto', ''], default: '' },
    passato: { type: Boolean, default: false },
    note: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const checkListGlucometroSchema = new Schema<ICheckListGlucometro>(
  {
    dataControllo: { type: Date, required: true },
    idGlucometro: { type: String, trim: true, default: '' },
    operatore: { type: String, trim: true, default: '' },
    livelloBasso: { type: livelloControlloSchema, default: () => ({ risultato: '', passato: false, note: '' }) },
    livelloNormale: { type: livelloControlloSchema, default: () => ({ risultato: '', passato: false, note: '' }) },
    livelloAlto: { type: livelloControlloSchema, default: () => ({ risultato: '', passato: false, note: '' }) },
    controlloSuperato: { type: Boolean, default: false },
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export default model<ICheckListGlucometro>('CheckListGlucometro', checkListGlucometroSchema);
