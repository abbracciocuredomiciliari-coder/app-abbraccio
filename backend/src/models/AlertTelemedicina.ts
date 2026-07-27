import { Document, Schema, model } from 'mongoose';

export type StatoAlert = 'aperto' | 'in_carico' | 'risolto' | 'evaso' | 'chiuso';
export type PrioritaAlert = 'bassa' | 'media' | 'alta' | 'critica';
export type TipoAlert = 'parametro_fuori_range' | 'mancanza_dato' | 'dispositivo_offline' | 'manovra_richiesta' | 'allarme_paziente' | 'teleconsulto_urgente';

export interface IAlertTelemedicina extends Document {
  pazienteId: string;
  pazienteNome: string;
  tipo: TipoAlert;
  priorita: PrioritaAlert;
  stato: StatoAlert;
  messaggio: string;
  dettagli?: string;
  parametroId?: string;
  dispositivoId?: string;
  sogliaRiferimento?: string;
  assegnatoA?: string;
  assegnatoANome?: string;
  inCaricoIl?: Date;
  risoltoIl?: Date;
  azioni: { data: Date; autore: string; autoreId: string; nota: string }[];
  teleconsultoId?: string;
  slaMinuti?: number;
  slaScadenza?: Date;
  escalationLevel: number;
  inRitardo?: boolean;
  storicoAssegnazioni: { data: Date; assegnatoA?: string; assegnatoANome?: string; autore: string; autoreId: string; nota?: string }[];
  creatoDa: string;
}

const azioneSchema = new Schema(
  {
    data: { type: Date, default: Date.now },
    autore: { type: String, required: true },
    autoreId: { type: String, required: true },
    nota: { type: String, required: true },
  },
  { _id: false }
);

const assegnaSchema = new Schema(
  {
    data: { type: Date, default: Date.now },
    assegnatoA: { type: String },
    assegnatoANome: { type: String },
    autore: { type: String, required: true },
    autoreId: { type: String, required: true },
    nota: { type: String },
  },
  { _id: false }
);

const alertSchema = new Schema<IAlertTelemedicina>(
  {
    pazienteId: { type: String, required: true, index: true },
    pazienteNome: { type: String, required: true },
    tipo: { type: String, enum: ['parametro_fuori_range', 'mancanza_dato', 'dispositivo_offline', 'manovra_richiesta', 'allarme_paziente', 'teleconsulto_urgente'], required: true },
    priorita: { type: String, enum: ['bassa', 'media', 'alta', 'critica'], default: 'media' },
    stato: { type: String, enum: ['aperto', 'in_carico', 'risolto', 'evaso', 'chiuso'], default: 'aperto', index: true },
    messaggio: { type: String, required: true },
    dettagli: { type: String },
    parametroId: { type: String },
    dispositivoId: { type: String },
    sogliaRiferimento: { type: String },
    assegnatoA: { type: String },
    assegnatoANome: { type: String },
    inCaricoIl: { type: Date },
    risoltoIl: { type: Date },
    azioni: [azioneSchema],
    teleconsultoId: { type: String, index: true },
    slaMinuti: { type: Number },
    slaScadenza: { type: Date, index: true },
    escalationLevel: { type: Number, default: 0 },
    inRitardo: { type: Boolean, default: false },
    storicoAssegnazioni: [assegnaSchema],
    creatoDa: { type: String, required: true },
  },
  { timestamps: true }
);

alertSchema.index({ pazienteId: 1, stato: 1, priorita: -1 });
alertSchema.index({ stato: 1, slaScadenza: 1 });

export default model<IAlertTelemedicina>('AlertTelemedicina', alertSchema);
