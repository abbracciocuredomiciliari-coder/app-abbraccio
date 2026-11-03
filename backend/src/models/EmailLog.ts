// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const EmailLogSchema = new mongoose_1.Schema({
    to: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    tipo: { type: String, default: 'generica' },
    area: { type: String, enum: ['privato', 'intermediazione', 'generale'], default: 'generale' },
    riferimento: { type: String },
    allegati: [{ type: String }],
    allegatiSalvati: { type: Number, default: 0 },
    inviataDaNome: { type: String },
    esito: { type: String, enum: ['inviata', 'fallita'], required: true, index: true },
    errore: { type: String },
    messageId: { type: String },
    rettificata: { type: Boolean, default: false },
    rettificaIl: { type: Date },
    rettificaDaNome: { type: String },
    storico: { type: Boolean, default: false },
    dataStimata: { type: Boolean, default: false },
}, { timestamps: true });
EmailLogSchema.index({ createdAt: -1 });
exports.default = (0, mongoose_1.model)('EmailLog', EmailLogSchema);
