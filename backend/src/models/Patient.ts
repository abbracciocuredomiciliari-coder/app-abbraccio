import { Document, Schema, model } from 'mongoose';
import { encrypt, decrypt, hashForSearch } from '../utils/encryption';

export interface IPatient extends Document {
  firstName: string;
  lastName: string;
  birthDate: Date;
  address: string;
  assistanceNeeds: string;
  contactPhone?: string;
  email?: string;
  codiceFiscale?: string;
  codiceFiscaleHash?: string;
  // === DATI CLINICI ADI ===
  diagnosiAmmissione?: string;
  comorbilita?: string;
  allergie?: string;
  caregiverRiferimento?: string;
  caregiverTelefono?: string;
  
  // === MODALITÀ GESTIONE ===
  tipoGestione: 'privato' | 'convenzione' | 'consulenza';  // default: privato

  // === ACCETTAZIONE ===
  inAccettazione?: boolean;  // paziente in fase di accettazione: solo preventivi, nessun piano operativo
  accettatoIl?: Date;        // data accettazione preventivo / attivazione piano
  terminato?: boolean;       // paziente terminato: percorso concluso
  terminatoIl?: Date;        // data chiusura paziente
  alertAccettazioneVisto?: {  // alert dashboard 'paziente accettato' già visto
    vistoIl: Date;
    vistoDa: string;
    vistoDaId: string;
  };

  // === CATEGORIA SERVIZIO PRIVATO ===
  categoriaPrivata?: 'diagnostica' | 'prelievi' | 'assistenza_domiciliare' | 'trasporto' | 'visite_mediche' | 'riabilitazione' | 'intermediazione_badanti';

  // === ALERT PAI IN SCADENZA ===
  alertPaiVisto?: {
    vistoIl: Date;
    vistoDa: string;      // nome utente
    vistoDaId: string;    // userId
  };

  // === DATI CONVENZIONE SIAT LAZIO ===
  siat?: {
    npi?: string;                // Numero Progressivo Intervento SIAT
    codiceAutorizzazione?: string; // Codice autorizzazione Regione Lazio
    codicePrestazione?: string;   // Codice prestazione ADI/SAD
    tipologiaCura?: string;       // Es: ADI 1°livello, SAD, ecc.
    dataAutorizzazione?: Date;
    dataScadenzaAutorizzazione?: Date;
    distretto?: string;           // Distretto ASL di riferimento
    asl?: string;                 // ASL di competenza
    uvm?: string;                 // Unità di Valutazione Multidimensionale
    medicoReferente?: string;
    importatoDa?: string;         // Nome file CSV origine
    importatoIl?: Date;
    note?: string;
  };
}

const patientSchema = new Schema<IPatient>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    birthDate: { type: Date, required: true },
    address: { type: String, required: true, trim: true },
    assistanceNeeds: { type: String, required: true, trim: true },
    contactPhone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    codiceFiscale: { type: String, trim: true, uppercase: true },
    codiceFiscaleHash: { type: String, index: true },
    diagnosiAmmissione: { type: String, trim: true },
    comorbilita: { type: String, trim: true },
    allergie: { type: String, trim: true },
    caregiverRiferimento: { type: String, trim: true },
    caregiverTelefono: { type: String, trim: true },
    tipoGestione: { type: String, enum: ['privato', 'convenzione', 'consulenza'], default: 'privato' },
    inAccettazione: { type: Boolean, default: false },
    accettatoIl: { type: Date },
    terminato: { type: Boolean, default: false },
    terminatoIl: { type: Date },
    alertAccettazioneVisto: {
      vistoIl: { type: Date },
      vistoDa: { type: String },
      vistoDaId: { type: String },
    },
    categoriaPrivata: { type: String, enum: ['diagnostica', 'prelievi', 'assistenza_domiciliare', 'trasporto', 'visite_mediche', 'riabilitazione', 'intermediazione_badanti'] },
    alertPaiVisto: {
      vistoIl: { type: Date },
      vistoDa: { type: String },
      vistoDaId: { type: String },
    },
    siat: {
      npi: { type: String, trim: true },
      codiceAutorizzazione: { type: String, trim: true },
      codicePrestazione: { type: String, trim: true },
      tipologiaCura: { type: String, trim: true },
      dataAutorizzazione: { type: Date },
      dataScadenzaAutorizzazione: { type: Date },
      distretto: { type: String, trim: true },
      asl: { type: String, trim: true },
      uvm: { type: String, trim: true },
      medicoReferente: { type: String, trim: true },
      importatoDa: { type: String },
      importatoIl: { type: Date },
      note: { type: String },
    },
  },
  { timestamps: true }
);

patientSchema.index({ tipoGestione: 1, lastName: 1 });
patientSchema.index({ codiceFiscaleHash: 1 });

patientSchema.pre('save', function (next) {
  if (this.isModified('address')) this.address = encrypt(this.address);
  if (this.isModified('contactPhone') && this.contactPhone) this.contactPhone = encrypt(this.contactPhone);
  if (this.isModified('caregiverTelefono') && this.caregiverTelefono) this.caregiverTelefono = encrypt(this.caregiverTelefono);
  if (this.isModified('codiceFiscale') && this.codiceFiscale) {
    const cf = this.codiceFiscale.toUpperCase().trim();
    this.codiceFiscaleHash = hashForSearch(cf);
    this.codiceFiscale = encrypt(cf);
  }
  next();
});

patientSchema.set('toJSON', {
  transform: function (_doc, ret) {
    ret.address = decrypt(ret.address);
    if (ret.contactPhone) ret.contactPhone = decrypt(ret.contactPhone);
    if (ret.caregiverTelefono) ret.caregiverTelefono = decrypt(ret.caregiverTelefono);
    if (ret.codiceFiscale) ret.codiceFiscale = decrypt(ret.codiceFiscale);
    delete ret.codiceFiscaleHash;
    return ret;
  },
});

export default model<IPatient>('Patient', patientSchema);
