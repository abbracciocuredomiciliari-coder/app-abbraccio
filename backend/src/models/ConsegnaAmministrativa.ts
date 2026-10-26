import { Schema, model, Types, Document } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════
// CONSEGNA AMMINISTRATIVA — passaggio di consegne tra ufficio e personale
// esterno. Visibile a tutti gli utenti autenticati (Gestione Privata,
// Convenzione e Intermediazioni condividono la stessa bacheca).
//
// Ciclo di vita:
//   da_gestire → presa_in_carico → in_attesa_riscontro → gestita
// Le consegne non "gestite" restano attive come promemoria e alimentano
// l'alert "nuova consegna da gestire" / badge sul menu.
// ═══════════════════════════════════════════════════════════════════════════

export type StatoConsegna = 'da_gestire' | 'presa_in_carico' | 'in_attesa_riscontro' | 'gestita';
export type TipoConsegna = 'giornata' | 'pratica' | 'generale';
export type PrioritaConsegna = 'normale' | 'urgente';

export interface IMovimentoConsegna {
  azione: string;         // 'creata' | 'presa_in_carico' | 'in_attesa_riscontro' | 'gestita' | 'riaperta' | 'nota'
  da?: Types.ObjectId;
  daNome?: string;
  il: Date;
  nota?: string;
}

export interface IConsegnaAmministrativa extends Document {
  titolo: string;
  testo: string;
  tipo: TipoConsegna;
  priorita: PrioritaConsegna;
  dataGiornata?: Date;          // per tipo 'giornata': giorno lavorativo di riferimento
  riferimento?: string;         // per tipo 'pratica': es. nome paziente / pratica
  stato: StatoConsegna;
  autoreId: Types.ObjectId;
  autoreNome: string;
  presaInCaricoDaId?: Types.ObjectId;
  presaInCaricoDaNome?: string;
  presaInCaricoIl?: Date;
  gestitaDaNome?: string;
  gestitaIl?: Date;
  storico: IMovimentoConsegna[];
  createdAt: Date;
  updatedAt: Date;
}

const MovimentoSchema = new Schema<IMovimentoConsegna>({
  azione: { type: String, required: true },
  da: { type: Schema.Types.ObjectId, ref: 'User' },
  daNome: { type: String },
  il: { type: Date, default: Date.now },
  nota: { type: String },
}, { _id: false });

const ConsegnaAmministrativaSchema = new Schema<IConsegnaAmministrativa>({
  titolo: { type: String, required: true, trim: true, maxlength: 140 },
  testo: { type: String, required: true, trim: true, maxlength: 4000 },
  tipo: { type: String, enum: ['giornata', 'pratica', 'generale'], default: 'generale' },
  priorita: { type: String, enum: ['normale', 'urgente'], default: 'normale' },
  dataGiornata: { type: Date },
  riferimento: { type: String, trim: true, maxlength: 160 },
  stato: {
    type: String,
    enum: ['da_gestire', 'presa_in_carico', 'in_attesa_riscontro', 'gestita'],
    default: 'da_gestire',
    index: true,
  },
  autoreId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  autoreNome: { type: String, required: true },
  presaInCaricoDaId: { type: Schema.Types.ObjectId, ref: 'User' },
  presaInCaricoDaNome: { type: String },
  presaInCaricoIl: { type: Date },
  gestitaDaNome: { type: String },
  gestitaIl: { type: Date },
  storico: { type: [MovimentoSchema], default: [] },
}, { timestamps: true });

ConsegnaAmministrativaSchema.index({ createdAt: -1 });

export default model<IConsegnaAmministrativa>('ConsegnaAmministrativa', ConsegnaAmministrativaSchema);
