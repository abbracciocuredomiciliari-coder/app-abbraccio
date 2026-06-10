import { Document, Schema, model, Types } from 'mongoose';

export type TipoServizio = 'prelievo' | 'esame_strumentale' | 'prestazione' | 'assistenza';
export type StatoRichiesta = 'in_attesa' | 'in_revisione' | 'confermata' | 'modificata' | 'rifiutata' | 'completata';

export interface IRichiestaPrenotazione extends Document {
  // Richiedente (caregiver/paziente registrato)
  richiedenteUserId: Types.ObjectId;
  richiedenteNome: string;
  richiedenteEmail: string;
  richiedenteTelefono?: string;

  // Paziente (può essere lo stesso richiedente o un altro)
  pazienteId?: Types.ObjectId;
  pazienteNome: string;
  pazienteIndirizzo: string;
  pazienteTelefono?: string;

  // Tipo di servizio richiesto
  tipoServizio: TipoServizio;
  tipoSpecifico?: string; // es. "ECG", "Holter", "Prelievo emocromo", "Iniezione", etc.

  // Date e orari
  dataPreferita: Date;
  orarioPreferito?: string;
  dataAlternativa?: Date;
  orarioAlternativo?: string;

  // Stato e gestione
  stato: StatoRichiesta;
  priorita?: 'bassa' | 'normale' | 'alta' | 'urgente';
  noteRichiedente?: string;
  noteAdmin?: string;

  // Assegnazione (compilato da admin)
  staffAssegnatoId?: Types.ObjectId;
  staffAssegnatoNome?: string;
  dataConfermata?: Date;
  orarioConfermato?: string;

  // Riferimenti creati (popolati dopo conferma)
  prelievoId?: Types.ObjectId;
  esameStrumentaleId?: Types.ObjectId;
  workPlanId?: Types.ObjectId;

  // Cronologia modifiche
  storicoModifiche: Array<{
    data: Date;
    autore: string;
    azione: string;
    note?: string;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

const richiestaPrenotazioneSchema = new Schema<IRichiestaPrenotazione>(
  {
    richiedenteUserId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    richiedenteNome: { type: String, required: true, trim: true },
    richiedenteEmail: { type: String, required: true, trim: true, lowercase: true },
    richiedenteTelefono: { type: String, trim: true },

    pazienteId: { type: Schema.Types.ObjectId, ref: 'Patient', required: false },
    pazienteNome: { type: String, required: true, trim: true },
    pazienteIndirizzo: { type: String, required: true, trim: true },
    pazienteTelefono: { type: String, trim: true },

    tipoServizio: {
      type: String,
      required: true,
      enum: ['prelievo', 'esame_strumentale', 'prestazione', 'assistenza']
    },
    tipoSpecifico: { type: String, trim: true },

    dataPreferita: { type: Date, required: true },
    orarioPreferito: { type: String, trim: true },
    dataAlternativa: { type: Date },
    orarioAlternativo: { type: String, trim: true },

    stato: {
      type: String,
      required: true,
      enum: ['in_attesa', 'in_revisione', 'confermata', 'modificata', 'rifiutata', 'completata'],
      default: 'in_attesa'
    },
    priorita: {
      type: String,
      enum: ['bassa', 'normale', 'alta', 'urgente'],
      default: 'normale'
    },
    noteRichiedente: { type: String, trim: true },
    noteAdmin: { type: String, trim: true },

    staffAssegnatoId: { type: Schema.Types.ObjectId, ref: 'Staff', required: false },
    staffAssegnatoNome: { type: String, trim: true },
    dataConfermata: { type: Date },
    orarioConfermato: { type: String, trim: true },

    prelievoId: { type: Schema.Types.ObjectId, ref: 'Prelievo', required: false },
    esameStrumentaleId: { type: Schema.Types.ObjectId, ref: 'EsameStrumentale', required: false },
    workPlanId: { type: Schema.Types.ObjectId, ref: 'WorkPlan', required: false },

    storicoModifiche: [{
      data: { type: Date, default: Date.now },
      autore: { type: String, required: true },
      azione: { type: String, required: true },
      note: { type: String }
    }]
  },
  { timestamps: true }
);

// Indici per query frequenti
richiestaPrenotazioneSchema.index({ stato: 1, createdAt: -1 });
richiestaPrenotazioneSchema.index({ richiedenteUserId: 1, createdAt: -1 });
richiestaPrenotazioneSchema.index({ tipoServizio: 1, stato: 1 });
richiestaPrenotazioneSchema.index({ dataPreferita: 1, stato: 1 });

export default model<IRichiestaPrenotazione>('RichiestaPrenotazione', richiestaPrenotazioneSchema);
