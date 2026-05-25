import { Document, Schema, model, Types } from 'mongoose';

// Snapshot completo di un piano di lavoro archiviato
export interface IArchivioCartella extends Document {
  // Riferimenti originali (per ricerca)
  workPlanId: Types.ObjectId;
  patientId: Types.ObjectId;

  // Dati paziente (snapshot)
  paziente: {
    firstName: string;
    lastName: string;
    codiceFiscale?: string;
    dataNascita?: string;
    address?: string;
  };

  // Dati piano di lavoro (snapshot)
  workPlan: {
    type: string;
    category: string;
    task: string;
    date: string;
    dataFine?: string;
    status: string;
    tipoCompenso?: string;
    tariffa?: number;
    compensoTotale?: number;
    compensoPagato?: boolean;
    notes?: string;
  };

  // Operatore assegnato (snapshot)
  operatore: {
    firstName: string;
    lastName: string;
    role: string;
  };

  // Accessi registrati (snapshot)
  accessi: Array<{
    staffName: string;
    staffRole: string;
    oraEntrata: Date;
    oraUscita?: Date;
    durataMinuti?: number;
    compensoMaturato?: number;
    note?: string;
    firmaLogin: string;
  }>;

  // Diario clinico (snapshot)
  diario: Array<{
    dataRegistrazione: Date;
    staffName: string;
    firmaLogin: string;
    testo: string;
    firmato: boolean;
    dataFirma?: Date;
    parametriVitali?: {
      pressioneSistolica?: number;
      pressioneDiastolica?: number;
      frequenzaCardiaca?: number;
      frequenzaRespiratoria?: number;
      temperatura?: number;
      saturazione?: number;
      glicemia?: number;
      peso?: number;
      dolore?: number;
    };
  }>;

  // Allegati (snapshot dei metadati + URL Cloudinary)
  allegati: Array<{
    nomeFile: string;
    mimeType: string;
    dimensione: number;
    descrizione?: string;
    caricatoDa: string;
    dataCaricamento: Date;
    urlCloudinary?: string;
  }>;

  // Metadati archivio
  dataArchiviazione: Date;
  archiviatoDa: string;  // nome utente che ha archiviato
  note?: string;         // note di archiviazione

  createdAt: Date;
  updatedAt: Date;
}

const archivioCartellaSchema = new Schema<IArchivioCartella>(
  {
    workPlanId: { type: Schema.Types.ObjectId, ref: 'WorkPlan', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },

    paziente: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      codiceFiscale: { type: String },
      dataNascita: { type: String },
      address: { type: String },
    },

    workPlan: {
      type: { type: String, required: true },
      category: { type: String, required: true },
      task: { type: String, required: true },
      date: { type: String },
      dataFine: { type: String },
      status: { type: String },
      tipoCompenso: { type: String },
      tariffa: { type: Number },
      compensoTotale: { type: Number },
      compensoPagato: { type: Boolean },
      notes: { type: String },
    },

    operatore: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      role: { type: String, required: true },
    },

    accessi: [{
      staffName: { type: String },
      staffRole: { type: String },
      oraEntrata: { type: Date },
      oraUscita: { type: Date },
      durataMinuti: { type: Number },
      compensoMaturato: { type: Number },
      note: { type: String },
      firmaLogin: { type: String },
    }],

    diario: [{
      dataRegistrazione: { type: Date },
      staffName: { type: String },
      firmaLogin: { type: String },
      testo: { type: String },
      firmato: { type: Boolean },
      dataFirma: { type: Date },
      parametriVitali: {
        pressioneSistolica: { type: Number },
        pressioneDiastolica: { type: Number },
        frequenzaCardiaca: { type: Number },
        frequenzaRespiratoria: { type: Number },
        temperatura: { type: Number },
        saturazione: { type: Number },
        glicemia: { type: Number },
        peso: { type: Number },
        dolore: { type: Number },
      },
    }],

    allegati: [{
      nomeFile: { type: String },
      mimeType: { type: String },
      dimensione: { type: Number },
      descrizione: { type: String },
      caricatoDa: { type: String },
      dataCaricamento: { type: Date },
      urlCloudinary: { type: String },
    }],

    dataArchiviazione: { type: Date, default: Date.now },
    archiviatoDa: { type: String, required: true },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

archivioCartellaSchema.index({ patientId: 1, dataArchiviazione: -1 });
archivioCartellaSchema.index({ workPlanId: 1 });

export default model<IArchivioCartella>('ArchivioCartella', archivioCartellaSchema);
