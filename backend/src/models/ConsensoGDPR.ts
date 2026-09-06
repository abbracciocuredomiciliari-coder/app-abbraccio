import { Document, Schema, model } from 'mongoose';

export interface IConsensoGDPR extends Document {
  patientId: string;
  pazienteAnonimoId: string; // ID pseudonimizzato
  
  // Finalità del trattamento
  finalita: {
    prestazioneSanitaria: boolean;
    fatturazione: boolean;
    auditInterno: boolean;
    ricercaScientifica: boolean;
  };
  
  // Modalità trattamento accettate
  modalita: {
    cartaceo: boolean;
    informatico: boolean;
    telefonico: boolean;
  };
  
  // Dati sensibili autorizzati
  datiSensibili: {
    datiSanitari: boolean;
    datiEconomici: boolean;
    immagini: boolean;
  };
  
  // Consenso comunicazione a terzi
  comunicazioneTerzi: {
    mediciSpecialisti: boolean;
    struttureSanitarie: boolean;
    familiari: boolean;
    assicurazioni: boolean;
  };
  
  // Identità del firmatario
  firmatoDa: 'paziente' | 'tutore' | 'rappresentanteLegale';
  nomeFirmatario: string;
  cognomeFirmatario: string;
  codiceFiscaleFirmatario?: string;
  
  // Dati firma
  firmaDigitale?: string; // Hash della firma
  dataFirma: Date;
  luogoFirma?: string;
  
  // Versione informativa accettata
  versioneInformativa: string;

  // HTML/PDF firmato (per firma da contratto)
  htmlFirmato?: string;
  
  // Revoca (diritto all'oblio)
  revocato: boolean;
  dataRevoca?: Date;
  motivoRevoca?: string;
  
  // Identificativo operatore che ha raccolto il consenso
  operatoreId: string;
  operatoreEmail: string;
  
  // Audit
  ipAddress?: string;
  userAgent?: string;
  inviiEmail: { email: string; dataInvio: Date }[];
  
  createdAt: Date;
  updatedAt: Date;
}

const consensoSchema = new Schema<IConsensoGDPR>(
  {
    patientId: { type: String, required: true, index: true },
    pazienteAnonimoId: { type: String, required: true, unique: true },
    
    finalita: {
      prestazioneSanitaria: { type: Boolean, default: false },
      fatturazione: { type: Boolean, default: false },
      auditInterno: { type: Boolean, default: false },
      ricercaScientifica: { type: Boolean, default: false },
    },
    
    modalita: {
      cartaceo: { type: Boolean, default: true },
      informatico: { type: Boolean, default: true },
      telefonico: { type: Boolean, default: true },
    },
    
    datiSensibili: {
      datiSanitari: { type: Boolean, default: false },
      datiEconomici: { type: Boolean, default: false },
      immagini: { type: Boolean, default: false },
    },
    
    comunicazioneTerzi: {
      mediciSpecialisti: { type: Boolean, default: false },
      struttureSanitarie: { type: Boolean, default: false },
      familiari: { type: Boolean, default: false },
      assicurazioni: { type: Boolean, default: false },
    },
    
    firmatoDa: { type: String, enum: ['paziente', 'tutore', 'rappresentanteLegale'], required: true },
    nomeFirmatario: { type: String, required: true },
    cognomeFirmatario: { type: String, required: true },
    codiceFiscaleFirmatario: { type: String },
    
    firmaDigitale: { type: String },
    dataFirma: { type: Date, default: Date.now },
    luogoFirma: { type: String },
    
    versioneInformativa: { type: String, required: true }, // es. "v2024.1"
    htmlFirmato: { type: String },
    
    revocato: { type: Boolean, default: false },
    dataRevoca: { type: Date },
    motivoRevoca: { type: String },
    
    operatoreId: { type: String, required: true },
    operatoreEmail: { type: String, required: true },
    
    ipAddress: { type: String },
    userAgent: { type: String },
    inviiEmail: [{ email: { type: String, required: true }, dataInvio: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

// Indici per query efficienti
consensoSchema.index({ patientId: 1, revocato: 1 });
consensoSchema.index({ dataFirma: -1 });

export default model<IConsensoGDPR>('ConsensoGDPR', consensoSchema);
