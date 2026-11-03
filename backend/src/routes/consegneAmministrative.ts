// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const auth_1 = require("../middleware/auth");
const audit_1 = require("../middleware/audit");
const ConsegnaAmministrativa_1 = __importDefault(require("../models/ConsegnaAmministrativa"));
const router = (0, express_1.Router)();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];
const STATI_VALIDI = ['da_gestire', 'presa_in_carico', 'in_attesa_riscontro', 'gestita'];
router.post('/pubblica', async (req, res) => {
    try {
        const autoreNome = String(req.body?.autoreNome || '').trim().slice(0, 80);
        const titolo = String(req.body?.titolo || '').trim().slice(0, 140);
        const testo = String(req.body?.testo || '').trim().slice(0, 4000);
        const tipo = ['giornata', 'pratica', 'generale'].includes(req.body?.tipo) ? req.body.tipo : 'generale';
        const priorita = req.body?.priorita === 'urgente' ? 'urgente' : 'normale';
        const riferimento = String(req.body?.riferimento || '').trim().slice(0, 160) || undefined;
        const dataGiornata = req.body?.dataGiornata ? new Date(req.body.dataGiornata) : undefined;
        if (!autoreNome || !titolo || !testo) {
            return res.status(400).json({ message: 'Nome, titolo e testo della consegna sono obbligatori' });
        }
        const consegna = await ConsegnaAmministrativa_1.default.create({
            titolo,
            testo,
            tipo,
            priorita,
            riferimento,
            dataGiornata: dataGiornata && !isNaN(dataGiornata.getTime()) ? dataGiornata : undefined,
            autoreNome: `${autoreNome} (da remoto)`,
            origine: 'esterna',
            storico: [{ azione: 'creata', daNome: `${autoreNome} (da remoto)`, il: new Date() }],
        });
        return res.status(201).json({ message: 'Consegna registrata', id: consegna._id });
    }
    catch (error) {
        console.error('[Consegne pubblica POST] Errore:', error);
        return res.status(500).json({ message: 'Errore nella registrazione della consegna', error: error.message });
    }
});
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const query = {};
        if (req.query.aperte === '1')
            query.stato = { $ne: 'gestita' };
        if (req.query.stato && STATI_VALIDI.includes(String(req.query.stato)))
            query.stato = String(req.query.stato);
        const consegne = await ConsegnaAmministrativa_1.default.find(query).sort({ priorita: -1, createdAt: -1 }).limit(300).lean();
        return res.json(consegne);
    }
    catch (error) {
        console.error('[Consegne GET] Errore:', error);
        return res.status(500).json({ message: 'Errore nel recupero delle consegne', error: error.message });
    }
});
router.get('/conteggio', auth_1.authenticateToken, async (_req, res) => {
    try {
        const aperte = await ConsegnaAmministrativa_1.default.countDocuments({ stato: { $ne: 'gestita' } });
        const daGestire = await ConsegnaAmministrativa_1.default.countDocuments({ stato: 'da_gestire' });
        return res.json({ aperte, daGestire });
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore conteggio consegne', error: error.message });
    }
});
router.post('/', auth_1.authenticateToken, (0, audit_1.auditLog)('consegne_amministrative', 'CREATE'), async (req, res) => {
    try {
        const user = req.user;
        const titolo = String(req.body?.titolo || '').trim().slice(0, 140);
        const testo = String(req.body?.testo || '').trim().slice(0, 4000);
        const tipo = ['giornata', 'pratica', 'generale'].includes(req.body?.tipo) ? req.body.tipo : 'generale';
        const priorita = req.body?.priorita === 'urgente' ? 'urgente' : 'normale';
        const riferimento = String(req.body?.riferimento || '').trim().slice(0, 160) || undefined;
        const dataGiornata = req.body?.dataGiornata ? new Date(req.body.dataGiornata) : undefined;
        if (!titolo || !testo) {
            return res.status(400).json({ message: 'Titolo e testo della consegna sono obbligatori' });
        }
        const userId = user.userId || user.id;
        const consegna = await ConsegnaAmministrativa_1.default.create({
            titolo,
            testo,
            tipo,
            priorita,
            riferimento,
            dataGiornata: dataGiornata && !isNaN(dataGiornata.getTime()) ? dataGiornata : undefined,
            autoreId: new mongoose_1.default.Types.ObjectId(userId),
            autoreNome: user.name || 'Utente',
            storico: [{ azione: 'creata', da: new mongoose_1.default.Types.ObjectId(userId), daNome: user.name || 'Utente', il: new Date() }],
        });
        return res.status(201).json(consegna);
    }
    catch (error) {
        console.error('[Consegne POST] Errore:', error);
        return res.status(500).json({ message: 'Errore nella creazione della consegna', error: error.message });
    }
});
router.patch('/:id/stato', auth_1.authenticateToken, (0, audit_1.auditLog)('consegne_amministrative', 'UPDATE'), async (req, res) => {
    try {
        const user = req.user;
        const nuovoStato = String(req.body?.stato || '');
        if (!STATI_VALIDI.includes(nuovoStato)) {
            return res.status(400).json({ message: 'Stato non valido' });
        }
        const nota = String(req.body?.nota || '').trim().slice(0, 500) || undefined;
        const consegna = await ConsegnaAmministrativa_1.default.findById(req.params.id);
        if (!consegna)
            return res.status(404).json({ message: 'Consegna non trovata' });
        const userId = user.userId || user.id;
        const userNome = user.name || 'Utente';
        consegna.stato = nuovoStato;
        if (nuovoStato === 'presa_in_carico') {
            consegna.presaInCaricoDaId = new mongoose_1.default.Types.ObjectId(userId);
            consegna.presaInCaricoDaNome = userNome;
            consegna.presaInCaricoIl = new Date();
        }
        if (nuovoStato === 'gestita') {
            consegna.gestitaDaNome = userNome;
            consegna.gestitaIl = new Date();
        }
        consegna.storico.push({ azione: nuovoStato, da: new mongoose_1.default.Types.ObjectId(userId), daNome: userNome, il: new Date(), nota });
        await consegna.save();
        return res.json(consegna);
    }
    catch (error) {
        console.error('[Consegne PATCH stato] Errore:', error);
        return res.status(500).json({ message: 'Errore aggiornamento consegna', error: error.message });
    }
});
router.post('/:id/nota', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const nota = String(req.body?.nota || '').trim().slice(0, 500);
        if (!nota)
            return res.status(400).json({ message: 'Nota vuota' });
        const consegna = await ConsegnaAmministrativa_1.default.findById(req.params.id);
        if (!consegna)
            return res.status(404).json({ message: 'Consegna non trovata' });
        consegna.storico.push({ azione: 'nota', da: new mongoose_1.default.Types.ObjectId(user.userId || user.id), daNome: user.name || 'Utente', il: new Date(), nota });
        await consegna.save();
        return res.json(consegna);
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore aggiunta nota', error: error.message });
    }
});
router.delete('/:id', auth_1.authenticateToken, (0, audit_1.auditLog)('consegne_amministrative', 'DELETE'), async (req, res) => {
    try {
        const user = req.user;
        const consegna = await ConsegnaAmministrativa_1.default.findById(req.params.id);
        if (!consegna)
            return res.status(404).json({ message: 'Consegna non trovata' });
        const userId = String(user.userId || user.id);
        const isAutore = consegna.autoreId?.toString() === userId;
        if (!isAutore && !RUOLI_GESTIONE.includes(user.role)) {
            return res.status(403).json({ message: 'Solo l\'autore o la gestione può eliminare una consegna' });
        }
        await consegna.deleteOne();
        return res.json({ message: 'Consegna eliminata' });
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore eliminazione consegna', error: error.message });
    }
});
export default router;