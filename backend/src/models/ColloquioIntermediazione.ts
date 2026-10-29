import { Schema, model, Document, Types } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════
// COLLOQUIO INTERMEDIAZIONE — "riunione colloquio" per badanti/colf/famiglie.
// I partecipanti NON devono essere utenti del portale: ricevono un invito via
// email con link pubblico (token) per accettare/rifiutare, e il giorno
// dell'appuntamento un promemoria con il link di collegamento (Jitsi, senza
// login). Il verbale funziona come le Riunioni Équipe: registrazione microfono
// → trascrizione Whisper → verbale generato dall'AI.
// ═══════════════════════════════════════════════════════════════════════════

export type RispostaColloquio = 'attesa' | 'accettato' | 'rifiutato';
export type RuoloColloquio = 'badante' | 'famiglia' | 'operatore' | 'altro';
export type ModalitaColloquio = 'video' | 'presenza' | 'telefono';
export type StatoColloquio = 'programmato' | 'svolto' | 'annullato';

interface IPartecipanteColloquio {
  nome: string;
  email: string;
  ruolo: RuoloColloquio;
  telefono?: string;
  staffId?: string;                 // se scelto dall'elenco del Personale
  invitatoIl?: Date;
  risposta: RispostaColloquio;
  rispostoIl?: Date;
  notaRisposta?: string;
  tokenHash?: string;               // sha256 del link pubblico di risposta
}

export interface IColloquioIntermediazione extends Document {
  titolo: string;
  dataRiunione: Date;
  ordineDelGiorno: string;          // motivo del colloquio
  modalita: ModalitaColloquio;
  stanzaVideo: string;              // stanza Jitsi generata (modalita 'video')
  linkCollegamento?: string;        // link custom (Meet/Teams) o luogo/telefono
  partecipanti: IPartecipanteColloquio[];
  confermaInformativaTrascrizione: boolean;
  registrazioneInCorso: boolean;
  registrazioneIniziataIl?: Date;
  trascrizione?: string;
  verbale?: string;
  stato: StatoColloquio;
  promemoriaInviatoIl?: Date;       // promemoria del giorno dell'appuntamento
  candidatoId?: Types.ObjectId;     // colloquio legato a una candidatura
  staffId?: Types.ObjectId;         // colloquio legato a un membro del personale
  creatoDaId: string;
  creatoDaNome: string;
  createdAt: Date;
  updatedAt: Date;
}

const partecipanteSchema = new Schema<IPartecipanteColloquio>({
  nome: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  ruolo: { type: String, enum: ['badante', 'famiglia', 'operatore', 'altro'], default: 'altro' },
  telefono: { type: String, trim: true },
  staffId: { type: String },
  invitatoIl: { type: Date },
  risposta: { type: String, enum: ['attesa', 'accettato', 'rifiutato'], default: 'attesa' },
  rispostoIl: { type: Date },
  notaRisposta: { type: String, trim: true },
  tokenHash: { type: String },
}, { _id: false });

const colloquioSchema = new Schema<IColloquioIntermediazione>({
  titolo: { type: String, required: true, trim: true },
  dataRiunione: { type: Date, required: true },
  ordineDelGiorno: { type: String, required: true, trim: true },
  modalita: { type: String, enum: ['video', 'presenza', 'telefono'], default: 'video' },
  stanzaVideo: { type: String, required: true, unique: true },
  linkCollegamento: { type: String, trim: true },
  partecipanti: { type: [partecipanteSchema], required: true },
  confermaInformativaTrascrizione: { type: Boolean, default: false },
  registrazioneInCorso: { type: Boolean, default: false },
  registrazioneIniziataIl: { type: Date },
  trascrizione: { type: String, trim: true },
  verbale: { type: String, trim: true },
  stato: { type: String, enum: ['programmato', 'svolto', 'annullato'], default: 'programmato' },
  promemoriaInviatoIl: { type: Date },
  candidatoId: { type: Schema.Types.ObjectId, ref: 'CandidatoIntermediazione' },
  staffId: { type: Schema.Types.ObjectId, ref: 'Staff' },
  creatoDaId: { type: String, required: true },
  creatoDaNome: { type: String, required: true },
}, { timestamps: true });

colloquioSchema.index({ dataRiunione: 1, stato: 1 });
colloquioSchema.index({ 'partecipanti.tokenHash': 1 });

export default model<IColloquioIntermediazione>('ColloquioIntermediazione', colloquioSchema);
