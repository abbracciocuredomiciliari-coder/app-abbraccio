// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const AllegatoSchema = new mongoose_1.Schema({
    filename: { type: String, required: true },
    contentType: { type: String },
    size: { type: Number, default: 0 },
    data: { type: Buffer },
}, { _id: false });
const EmailRicevutaSchema = new mongoose_1.Schema({
    uid: { type: Number, required: true, unique: true, index: true },
    messageId: { type: String, unique: true, sparse: true },
    from: {
        nome: { type: String },
        email: { type: String, required: true },
    },
    to: [{ type: String }],
    subject: { type: String, default: '(senza oggetto)' },
    data: { type: Date, required: true, index: true },
    snippet: { type: String },
    testo: { type: String },
    html: { type: String },
    allegati: [AllegatoSchema],
    letta: { type: Boolean, default: false, index: true },
    inReplyTo: { type: String },
}, { timestamps: true });
EmailRicevutaSchema.index({ data: -1 });
exports.default = (0, mongoose_1.model)('EmailRicevuta', EmailRicevutaSchema);
