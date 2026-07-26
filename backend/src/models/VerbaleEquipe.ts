import { Schema, model, Document } from 'mongoose';

interface IPartecipanteVerbale {
  userId: string;
  nome: string;
  email: string;
  invitatoIl?: Date;
  firma?: string;
  firmatoIl?: Date;
}

export interface IVerbaleEquipe extends Document {
  titolo: string;
  dataRiunione: Date;
  ordineDelGiorno: string;
  stanzaVideo: string;
  partecipanti: IPartecipanteVerbale[];
  confermaInformativaTrascrizione: boolean;
  trascrizione?: string;
  verbale?: string;
  stato: 'bozza' | 'in_firma' | 'firmato';
  creatoDaId: string;
  creatoDaNome: string;
  createdAt: Date;
  updatedAt: Date;
}

const partecipanteSchema = new Schema<IPartecipanteVerbale>({
  userId: { type: String, required: true },
  nome: { type: String, required: true },
  email: { type: String, required: true },
  invitatoIl: { type: Date },
  firma: { type: String },
  firmatoIl: { type: Date },
}, { _id: false });

const verbaleEquipeSchema = new Schema<IVerbaleEquipe>({
  titolo: { type: String, required: true, trim: true },
  dataRiunione: { type: Date, required: true },
  ordineDelGiorno: { type: String, required: true, trim: true },
  stanzaVideo: { type: String, required: true, unique: true },
  partecipanti: { type: [partecipanteSchema], required: true },
  confermaInformativaTrascrizione: { type: Boolean, default: false },
  trascrizione: { type: String, trim: true },
  verbale: { type: String, trim: true },
  stato: { type: String, enum: ['bozza', 'in_firma', 'firmato'], default: 'bozza' },
  creatoDaId: { type: String, required: true },
  creatoDaNome: { type: String, required: true },
}, { timestamps: true });

verbaleEquipeSchema.index({ 'partecipanti.userId': 1, dataRiunione: -1 });
export default model<IVerbaleEquipe>('VerbaleEquipe', verbaleEquipeSchema);
