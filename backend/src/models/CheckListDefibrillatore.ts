import { Document, Schema, model } from 'mongoose';

export interface ICheckListDefibrillatore extends Document {
  data: Date;
  nSerieAED: string;
  ubicazioneAED: string;
  unitaAccessoriNonDanneggiati: boolean;
  batterieElettrodiScorta: boolean;
  batterieElettrodiScortaNonScaduti: boolean;
  asiLampeggiaVerde: boolean;
  commenti: string;
  ispezionatoDa: string;
  createdAt: Date;
  updatedAt: Date;
}

const checkListDefibrillatoreSchema = new Schema<ICheckListDefibrillatore>(
  {
    data: { type: Date, required: true },
    nSerieAED: { type: String, trim: true, default: '' },
    ubicazioneAED: { type: String, trim: true, default: '' },
    unitaAccessoriNonDanneggiati: { type: Boolean, default: false },
    batterieElettrodiScorta: { type: Boolean, default: false },
    batterieElettrodiScortaNonScaduti: { type: Boolean, default: false },
    asiLampeggiaVerde: { type: Boolean, default: false },
    commenti: { type: String, trim: true, default: '' },
    ispezionatoDa: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export default model<ICheckListDefibrillatore>('CheckListDefibrillatore', checkListDefibrillatoreSchema);
