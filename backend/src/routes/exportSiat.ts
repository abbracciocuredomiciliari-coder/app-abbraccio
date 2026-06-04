import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import Patient from '../models/Patient';
import WorkPlan from '../models/WorkPlan';
import DiarioClinico from '../models/DiarioClinico';
import { buildCDA2, buildCSV } from '../utils/siatFormatter';

const router = Router();

router.use(authenticateToken);

/**
 * GET /api/export/siat/paziente/:patientId?format=cda2|csv
 * Esporta dati paziente in formato SIAT
 * Solo admin e coordinator possono esportare
 */
router.get(
  '/siat/paziente/:patientId',
  authorizeRole('admin', 'coordinator'),
  auditLog('export-siat', 'READ', (req: AuthRequest) => req.params.patientId),
  async (req: AuthRequest, res: Response) => {
    try {
      const { patientId } = req.params;
      const { format = 'csv', dataInizio, dataFine } = req.query;

      // Recupera paziente
      const patient = await Patient.findById(patientId).lean();
      if (!patient) {
        return res.status(404).json({ message: 'Paziente non trovato' });
      }

      // Recupera workplan attivo
      const workPlan = await WorkPlan.findOne({
        patient: patientId,
        status: { $in: ['pending', 'active'] }
      }).sort({ createdAt: -1 }).lean();

      // Recupera diario clinico nel periodo
      const filterDiario: any = { patient: patientId };
      if (dataInizio || dataFine) {
        filterDiario.dataRegistrazione = {};
        if (dataInizio) filterDiario.dataRegistrazione.$gte = new Date(dataInizio as string);
        if (dataFine) filterDiario.dataRegistrazione.$lte = new Date(dataFine as string);
      }

      const diario = await DiarioClinico.find(filterDiario)
        .sort({ dataRegistrazione: -1 })
        .lean();

      // Genera esportazione
      let content: string;
      let contentType: string;
      let fileExtension: string;

      if (format === 'cda2') {
        content = buildCDA2(patient, workPlan, diario);
        contentType = 'application/xml';
        fileExtension = 'xml';
      } else {
        content = buildCSV(patient, workPlan, diario);
        contentType = 'text/csv';
        fileExtension = 'csv';
      }

      const fileName = `SIAT_${patient.lastName}_${patient.firstName}_${new Date().toISOString().split('T')[0]}.${fileExtension}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(content);

    } catch (error: any) {
      console.error('[ExportSIAT] Errore:', error);
      res.status(500).json({ message: 'Errore esportazione SIAT', error: error.message });
    }
  }
);

/**
 * GET /api/export/siat/workplan/:workPlanId?format=cda2|csv
 * Esporta singolo workplan in formato SIAT
 */
router.get(
  '/siat/workplan/:workPlanId',
  authorizeRole('admin', 'coordinator', 'operatore'),
  auditLog('export-siat', 'READ', (req: AuthRequest) => req.params.workPlanId),
  async (req: AuthRequest, res: Response) => {
    try {
      const { workPlanId } = req.params;
      const { format = 'csv' } = req.query;

      const workPlan = await WorkPlan.findById(workPlanId)
        .populate('patient')
        .lean();

      if (!workPlan) {
        return res.status(404).json({ message: 'WorkPlan non trovato' });
      }

      const patient = workPlan.patient as any;
      const diario = await DiarioClinico.find({ workPlan: workPlanId })
        .sort({ dataRegistrazione: -1 })
        .lean();

      let content: string;
      let contentType: string;
      let fileExtension: string;

      if (format === 'cda2') {
        content = buildCDA2(patient, workPlan, diario);
        contentType = 'application/xml';
        fileExtension = 'xml';
      } else {
        content = buildCSV(patient, workPlan, diario);
        contentType = 'text/csv';
        fileExtension = 'csv';
      }

      const fileName = `SIAT_WorkPlan_${patient.lastName}_${new Date().toISOString().split('T')[0]}.${fileExtension}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(content);

    } catch (error: any) {
      console.error('[ExportSIAT] Errore:', error);
      res.status(500).json({ message: 'Errore esportazione SIAT', error: error.message });
    }
  }
);

/**
 * POST /api/export/siat/invio-manuale
 * Genera template per invio manuale su SIAT
 * (stampabile da operatore)
 */
router.post(
  '/siat/invio-manuale',
  authorizeRole('admin', 'coordinator', 'operatore'),
  auditLog('export-siat', 'CREATE'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { workPlanId, tipoInvio } = req.body;

      const workPlan = await WorkPlan.findById(workPlanId)
        .populate('patient')
        .populate('assignedTo', 'firstName lastName')
        .lean();

      if (!workPlan) {
        return res.status(404).json({ message: 'WorkPlan non trovato' });
      }

      const patient = workPlan.patient as any;
      const operatore = workPlan.assignedTo as any;

      // Template HTML per stampa modulo SIAT
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Modulo SIAT - ${tipoInvio || 'Generico'}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; font-size: 12pt; }
    h1 { font-size: 14pt; color: #1e4d8c; border-bottom: 2px solid #1e4d8c; padding-bottom: 5px; }
    .section { margin: 20px 0; border: 1px solid #ccc; padding: 15px; }
    .section-title { font-weight: bold; background: #f0f0f0; padding: 5px; margin: -15px -15px 10px -15px; }
    .field { margin: 8px 0; }
    .label { font-weight: bold; display: inline-block; width: 200px; }
    .value { display: inline-block; }
    .checkbox { border: 1px solid #000; width: 15px; height: 15px; display: inline-block; margin-right: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f0f0f0; }
    .signature { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; }
    @media print {
      .no-print { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1>📋 MODULO PER INVIO SU SIAT REGIONE LAZIO</h1>
  
  <div class="section">
    <div class="section-title">1. Dati Anagrafici Paziente</div>
    <div class="field"><span class="label">Cognome:</span> <span class="value">${patient.lastName}</span></div>
    <div class="field"><span class="label">Nome:</span> <span class="value">${patient.firstName}</span></div>
    <div class="field"><span class="label">Data di nascita:</span> <span class="value">${patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('it-IT') : 'N/D'}</span></div>
    <div class="field"><span class="label">Codice Fiscale:</span> <span class="value">${patient.codiceFiscale || '________________________'}</span></div>
    <div class="field"><span class="label">Indirizzo:</span> <span class="value">${patient.address}</span></div>
    <div class="field"><span class="label">Telefono:</span> <span class="value">${patient.contactPhone || '________________________'}</span></div>
  </div>

  <div class="section">
    <div class="section-title">2. Tipo di Invio SIAT</div>
    <div class="field">
      <span class="checkbox">${tipoInvio === 'ammissione' ? 'X' : ''}</span> Ammissione Cure Domiciliari
    </div>
    <div class="field">
      <span class="checkbox">${tipoInvio === 'modifica' ? 'X' : ''}</span> Modifica Piano Assistenziale
    </div>
    <div class="field">
      <span class="checkbox">${tipoInvio === 'chiusura' ? 'X' : ''}</span> Chiusura/Dimissione
    </div>
    <div class="field">
      <span class="checkbox">${tipoInvio === 'sospensione' ? 'X' : ''}</span> Sospensione Temporanea
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Piano Assistenziale (sintesi)</div>
    <div class="field"><span class="label">Operatore assegnato:</span> <span class="value">${operatore ? `${operatore.firstName} ${operatore.lastName}` : 'Non assegnato'}</span></div>
    <div class="field"><span class="label">Data inizio presa in carico:</span> <span class="value">${workPlan.startDate ? new Date(workPlan.startDate).toLocaleDateString('it-IT') : new Date(workPlan.createdAt).toLocaleDateString('it-IT')}</span></div>
    <div class="field"><span class="label">Necessità assistenziali:</span></div>
    <div style="white-space: pre-wrap; margin-left: 20px;">${patient.assistanceNeeds || workPlan.needs || 'N/D'}</div>
  </div>

  <div class="section">
    <div class="section-title">4. Ultimi Accessi Registrati</div>
    <table>
      <tr><th>Data</th><th>Operatore</th><th>Note</th></tr>
      ${(workPlan.accessi || []).slice(0, 5).map((a: any) => `
        <tr>
          <td>${a.data ? new Date(a.data).toLocaleDateString('it-IT') : 'N/D'}</td>
          <td>${a.staffName || 'N/D'}</td>
          <td>${a.attivitaSvolte ? (a.attivitaSvolte.substring(0, 50) + '...') : 'N/D'}</td>
        </tr>
      `).join('') || '<tr><td colspan="3">Nessun accesso registrato</td></tr>'}
    </table>
  </div>

  <div class="section">
    <div class="section-title">5. Note per l'ASL</div>
    <div style="border: 1px solid #ccc; min-height: 60px; padding: 10px;">
      _________________________________________________________________<br>
      _________________________________________________________________<br>
      _________________________________________________________________
    </div>
  </div>

  <div class="signature">
    <div style="display: flex; justify-content: space-between;">
      <div>
        <strong>Data compilazione:</strong> ${new Date().toLocaleDateString('it-IT')}<br><br>
        <strong>Firma Operatore:</strong> _________________________<br>
        ${operatore ? `${operatore.firstName} ${operatore.lastName}` : ''}
      </div>
      <div>
        <strong>Timbro Struttura:</strong><br><br>
        ABBRACCIO CURE DOMICILIARI<br>
        Via di Santa Maria Ausiliatrice 4B
      </div>
    </div>
  </div>

  <div class="no-print" style="margin-top: 30px; padding: 15px; background: #fff3cd; border: 1px solid #ffc107;">
    <strong>⚠️ Istruzioni:</strong>
    <ol>
      <li>Stampare questo modulo in 2 copie (una per l'ASL, una per la struttura)</li>
      <li>Accedere a SIAT Regione Lazio con le credenziali della struttura</li>
      <li>Inserire manualmente i dati seguendo le sezioni indicate</li>
      <li>Allegare copia del modulo firmato alla pratica SIAT</li>
      <li>Conservare la seconda copia in cartella del paziente</li>
    </ol>
    <button onclick="window.print()" style="padding: 10px 20px; background: #1e4d8c; color: white; border: none; cursor: pointer;">
      🖨️ Stampa Modulo
    </button>
  </div>
</body>
</html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);

    } catch (error: any) {
      console.error('[ExportSIAT] Errore:', error);
      res.status(500).json({ message: 'Errore generazione modulo', error: error.message });
    }
  }
);

export default router;
