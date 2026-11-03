// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const partecipanteSchema = new mongoose_1.Schema({
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
const colloquioSchema = new mongoose_1.Schema({
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
    candidatoId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CandidatoIntermediazione' },
    staffId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Staff' },
    creatoDaId: { type: String, required: true },
    creatoDaNome: { type: String, required: true },
}, { timestamps: true });
colloquioSchema.index({ dataRiunione: 1, stato: 1 });
colloquioSchema.index({ 'partecipanti.tokenHash': 1 });
exports.default = (0, mongoose_1.model)('ColloquioIntermediazione', colloquioSchema);
