import mongoose, { Schema, Document } from 'mongoose';

export interface IEventoAvverso extends Document {
  // Chi segnala
  patient: mongoose.Types.ObjectId;
  workPlan?: mongoose.Types.ObjectId;
  segnalatoDA: string;
  segnalatoDANome: string;
  ruoloOperatore: string;          // infermiere_oss | medico | altro
  ruoloOperatoreAltro?: string;
  direzioneDiArea?: string;

  // Dati paziente (facoltativi)
  pazienteNomeCognome?: string;
  pazienteCSTV?: string;
  pazienteEta?: number;
  pazienteSesso?: 'M' | 'F';

  // Evento
  dataEvento: Date;
  oraEvento?: string;
  luogoEvento: string;
  descrizioneEvento: string;       // Cos'è successo, dove, quando, come, perché
  svolgimentoFatti?: string;       // Come si sono svolti i fatti (pag 1)

  // Fattori contribuenti — paziente
  fattoriPaziente: string[];

  // Fattori contribuenti — staff/organizzazione
  fattoriStaff: string[];

  // Fattori contribuenti — comunicazione/task
  fattoriComunicazione: string[];

  // Fattori contribuenti — ambiente/attrezzatura
  fattoriAmbiente: string[];

  // Suggerimenti
  suggerimenti?: string;

  // Esito
  dannoRiscontrato: 'nessuno' | 'lieve' | 'moderato' | 'grave' | 'decesso';

  firmaOperatore?: string;
  dataRegistrazione: Date;
  stato: 'aperto' | 'in_revisione' | 'chiuso';
}

const EventoAvversoSchema = new Schema<IEventoAvverso>({
  patient:               { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  workPlan:              { type: Schema.Types.ObjectId, ref: 'WorkPlan' },
  segnalatoDA:           { type: String, required: true },
  segnalatoDANome:       { type: String, required: true },
  ruoloOperatore:        { type: String, required: true },
  ruoloOperatoreAltro:   { type: String },
  direzioneDiArea:       { type: String },

  pazienteNomeCognome:   { type: String },
  pazienteCSTV:          { type: String },
  pazienteEta:           { type: Number },
  pazienteSesso:         { type: String, enum: ['M', 'F'] },

  dataEvento:            { type: Date, required: true },
  oraEvento:             { type: String },
  luogoEvento:           { type: String, required: true },
  descrizioneEvento:     { type: String, required: true },
  svolgimentoFatti:      { type: String },

  fattoriPaziente:       { type: [String], default: [] },
  fattoriStaff:          { type: [String], default: [] },
  fattoriComunicazione:  { type: [String], default: [] },
  fattoriAmbiente:       { type: [String], default: [] },

  suggerimenti:          { type: String },
  dannoRiscontrato:      { type: String, enum: ['nessuno', 'lieve', 'moderato', 'grave', 'decesso'], default: 'nessuno' },
  firmaOperatore:        { type: String },
  dataRegistrazione:     { type: Date, default: Date.now },
  stato:                 { type: String, enum: ['aperto', 'in_revisione', 'chiuso'], default: 'aperto' },
}, { timestamps: true });

export default mongoose.model<IEventoAvverso>('EventoAvverso', EventoAvversoSchema);
