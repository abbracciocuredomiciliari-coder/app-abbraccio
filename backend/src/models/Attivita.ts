import { Schema, model, Types, Document } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════
// ATTIVITA — unità di lavoro operativa del gestionale ("consegna evoluta").
// Regola fondamentale: ogni attività aperta ha un responsabile e una
// prossima azione datata. Una lettura o un messaggio non equivalgono a
// lavoro concluso.
//
// Stati: da_prendere → in_lavorazione ⇄ in_attesa → completata | annullata
//   - in_lavorazione richiede responsabile
//   - in_attesa richiede interlocutore + dataControllo
//   - completata richiede esito
//   - annullata richiede motivo
// "lettaDa" è un attributo separato: leggere non chiude il compito.
// Trasferimento (passaggio turno): il destinatario deve accettare; fino ad
// allora la responsabilità resta al cedente.
// ═══════════════════════════════════════════════════════════════════════════

export type StatoAttivita = 'da_prendere' | 'in_lavorazione' | 'in_attesa' | 'completata' | 'annullata';
export type PrioritaAttivita = 'bassa' | 'normale' | 'alta' | 'urgente';

export interface IAggiornamentoAttivita {
  data: Date;
  autoreId?: Types.ObjectId;
  autoreNome: string;
  testo: string;
}

export interface IEventoAttivita {
  azione: string;       // 'creata' | 'assegnata' | 'presa' | 'in_attesa' | 'ripresa' | 'completata' | 'annullata' | 'riaperta' | 'trasferita' | 'accettata' | 'letta'
  data: Date;
  autoreId?: Types.ObjectId;
  autoreNome: string;
  nota?: string;
}

export interface IAttivita extends Document {
  titolo: string;
  azioneRichiesta?: string;            // cosa deve fare il responsabile
  // Collegamento opzionale a una pratica
  praticaTipo?: 'richiesta' | 'paziente' | 'intermediazione' | 'consegna' | 'generale';
  praticaId?: Types.ObjectId;
  praticaLabel?: string;               // es. "Richiesta #55 — Rossi Maria"
  area?: 'privato' | 'convenzione' | 'consulenza' | 'organizzativa';
  priorita: PrioritaAttivita;
  scadenza?: Date;
  stato: StatoAttivita;
  // Responsabilità
  responsabileId?: Types.ObjectId;
  responsabileNome?: string;
  collaboratoriNomi?: string[];
  autoreId?: Types.ObjectId;
  autoreNome: string;
  // Attesa
  interlocutoreAttesa?: string;        // con chi siamo in attesa
  dataControlloAttesa?: Date;          // quando ricontrollare
  // Esito / chiusura
  esito?: string;
  completataIl?: Date;
  completataDa?: string;
  motivoAnnullamento?: string;
  // Lettura (separata dallo stato)
  lettaDa?: { userId: Types.ObjectId; nome: string; il: Date }[];
  // Passaggio turno: trasferimento pendente — responsabilità al cedente
  // finché il destinatario non accetta
  trasferimento?: {
    aId: Types.ObjectId;
    aNome: string;
    daNome: string;
    richiestoIl: Date;
    accettato: boolean;
    accettatoIl?: Date;
  };
  aggiornamenti: IAggiornamentoAttivita[];
  storico: IEventoAttivita[];
  createdAt: Date;
  updatedAt: Date;
}

const AttivitaSchema = new Schema<IAttivita>(
  {
    titolo: { type: String, required: true, trim: true, maxlength: 200 },
    azioneRichiesta: { type: String, trim: true, maxlength: 2000 },
    praticaTipo: { type: String, enum: ['richiesta', 'paziente', 'intermediazione', 'consegna', 'generale'] },
    praticaId: { type: Schema.Types.ObjectId },
    praticaLabel: { type: String, trim: true, maxlength: 200 },
    area: { type: String, enum: ['privato', 'convenzione', 'consulenza', 'organizzativa'], index: true },
    priorita: { type: String, enum: ['bassa', 'normale', 'alta', 'urgente'], default: 'normale' },
    scadenza: { type: Date, index: true },
    stato: {
      type: String,
      enum: ['da_prendere', 'in_lavorazione', 'in_attesa', 'completata', 'annullata'],
      default: 'da_prendere',
      index: true,
    },
    responsabileId: { type: Schema.Types.ObjectId, ref: 'User' },
    responsabileNome: { type: String, trim: true },
    collaboratoriNomi: [{ type: String, trim: true }],
    autoreId: { type: Schema.Types.ObjectId, ref: 'User' },
    autoreNome: { type: String, required: true },
    interlocutoreAttesa: { type: String, trim: true },
    dataControlloAttesa: { type: Date },
    esito: { type: String, trim: true, maxlength: 2000 },
    completataIl: { type: Date },
    completataDa: { type: String },
    motivoAnnullamento: { type: String, trim: true },
    lettaDa: [{
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      nome: { type: String },
      il: { type: Date, default: Date.now },
    }],
    trasferimento: {
      aId: { type: Schema.Types.ObjectId, ref: 'User' },
      aNome: { type: String },
      daNome: { type: String },
      richiestoIl: { type: Date },
      accettato: { type: Boolean, default: false },
      accettatoIl: { type: Date },
    },
    aggiornamenti: [{
      data: { type: Date, default: Date.now },
      autoreId: { type: Schema.Types.ObjectId, ref: 'User' },
      autoreNome: { type: String, required: true },
      testo: { type: String, required: true, maxlength: 2000 },
    }],
    storico: [{
      azione: { type: String, required: true },
      data: { type: Date, default: Date.now },
      autoreId: { type: Schema.Types.ObjectId, ref: 'User' },
      autoreNome: { type: String, required: true },
      nota: { type: String },
    }],
  },
  { timestamps: true }
);

AttivitaSchema.index({ stato: 1, scadenza: 1 });
AttivitaSchema.index({ responsabileId: 1, stato: 1 });
AttivitaSchema.index({ praticaTipo: 1, praticaId: 1 });
AttivitaSchema.index({ 'trasferimento.aId': 1, 'trasferimento.accettato': 1 });

export default model<IAttivita>('Attivita', AttivitaSchema);
