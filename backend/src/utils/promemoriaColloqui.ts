// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.avviaPromemoriaColloqui = avviaPromemoriaColloqui;
const ColloquioIntermediazione_1 = __importDefault(require("../models/ColloquioIntermediazione"));
const colloquiIntermediazione_1 = require("../routes/colloquiIntermediazione");
const INTERVALLO_MS = 30 * 60 * 1000;
async function inviaPromemoriaDiOggi() {
    try {
        const inizio = new Date();
        inizio.setHours(0, 0, 0, 0);
        const fine = new Date(inizio);
        fine.setDate(fine.getDate() + 1);
        const colloqui = await ColloquioIntermediazione_1.default.find({
            stato: 'programmato',
            promemoriaInviatoIl: { $exists: false },
            dataRiunione: { $gte: inizio, $lt: fine },
        });
        for (const c of colloqui) {
            try {
                const inviate = await (0, colloquiIntermediazione_1.inviaEmailPromemoria)(c);
                console.log(`[Promemoria colloqui] "${c.titolo}" del ${c.dataRiunione.toISOString()} — inviati ${inviate} promemoria`);
            }
            catch (e) {
                console.error(`[Promemoria colloqui] Errore su colloquio ${c._id}:`, e.message);
            }
        }
    }
    catch (e) {
        console.error('[Promemoria colloqui] Errore ciclo:', e.message);
    }
}
function avviaPromemoriaColloqui() {
    inviaPromemoriaDiOggi();
    const timer = setInterval(inviaPromemoriaDiOggi, INTERVALLO_MS);
    if (typeof timer.unref === 'function')
        timer.unref();
    console.log('[Promemoria colloqui] Scheduler attivo (controllo ogni 30 minuti)');
}
