import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/auth';
import { inviaEmail } from '../utils/email';
import { generatePatientReport, isReportAiAvailable } from '../utils/reportGenerator';
import Patient from '../models/Patient';
import WorkPlan from '../models/WorkPlan';
import Staff from '../models/Staff';
import SignedReport from '../models/SignedReport';

const router = Router();

const PRIVILEGED_ROLES = ['admin', 'coordinator', 'direttore'];

async function resolveStaffId(userId: string): Promise<string | undefined> {
  const staff = await Staff.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
  return staff?._id?.toString();
}

async function canAccessPatient(user: any, patientId: string): Promise<boolean> {
  if (PRIVILEGED_ROLES.includes(user.role)) return true;
  const userId = user.userId || user.id;
  const staffId = await resolveStaffId(userId);
  if (!staffId) return false;
  const count = await WorkPlan.countDocuments({
    patient: new mongoose.Types.ObjectId(patientId),
    $or: [
      { staff: new mongoose.Types.ObjectId(staffId) },
      { 'prestazioni.staff': new mongoose.Types.ObjectId(staffId) },
    ],
  });
  return count > 0;
}

router.post('/patient/:patientId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { patientId } = req.params;
    const { recipientEmail, fromDate, toDate } = req.body;

    const patient = await Patient.findById(patientId).lean();
    if (!patient) {
      return res.status(404).json({ message: 'Paziente non trovato' });
    }

    const ok = await canAccessPatient(user, patientId);
    if (!ok) {
      return res.status(403).json({ message: 'Non autorizzato a generare la relazione per questo paziente' });
    }

    if (!isReportAiAvailable()) {
      return res.status(503).json({ message: 'GROQ_API_KEY non configurata' });
    }

    const opts: { fromDate?: Date; toDate?: Date } = {};
    if (fromDate) opts.fromDate = new Date(fromDate);
    if (toDate) opts.toDate = new Date(toDate);

    const result = await generatePatientReport(patientId, opts);

    let emailSent = false;
    if (recipientEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      const subject = `Relazione clinica ${result.patient.nome} — App Abbraccio`;
      const html = `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#1e4d8c;margin-top:0;">Relazione clinico-assistenziale</h2>
        <p><strong>Paziente:</strong> ${result.patient.nome}</p>
        <p><strong>Data di nascita:</strong> ${result.patient.dataNascita}</p>
        <p><strong>Generata il:</strong> ${new Date(result.generatedAt).toLocaleString('it-IT')}</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
        <pre style="white-space:pre-wrap;font-family:Arial,sans-serif;line-height:1.5;">${result.report.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      </div>`;
      emailSent = await inviaEmail({ to: recipientEmail, subject, html });
    }

    return res.json({ ...result, emailSent });
  } catch (error: any) {
    console.error('[Reports POST] Errore:', error);
    return res.status(500).json({ message: 'Errore nella generazione della relazione', error: error.message });
  }
});

// POST /api/reports/patient/:patientId/sign - Salva relazione firmata con firma touch
router.post('/patient/:patientId/sign', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { patientId } = req.params;
    const { reportText, signatureBase64 } = req.body;

    if (!reportText?.trim()) {
      return res.status(400).json({ message: 'Testo relazione obbligatorio' });
    }
    if (!signatureBase64?.trim()) {
      return res.status(400).json({ message: 'Firma obbligatoria' });
    }

    const patient = await Patient.findById(patientId).lean();
    if (!patient) {
      return res.status(404).json({ message: 'Paziente non trovato' });
    }

    const ok = await canAccessPatient(user, patientId);
    if (!ok) {
      return res.status(403).json({ message: 'Non autorizzato a salvare la relazione per questo paziente' });
    }

    const userId = user.userId || user.id;
    const staff = await Staff.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
    if (!staff) {
      return res.status(403).json({ message: 'Operatore non collegato a uno staff' });
    }

    const signedReport = await SignedReport.create({
      patient: new mongoose.Types.ObjectId(patientId),
      staff: staff._id,
      staffName: user.name || `${staff.firstName} ${staff.lastName}` || 'Operatore',
      reportText: reportText.trim(),
      signatureBase64: signatureBase64.trim(),
    });

    return res.status(201).json({ message: 'Relazione firmata salvata', signedReport });
  } catch (error: any) {
    console.error('[Reports Sign] Errore:', error);
    return res.status(500).json({ message: 'Errore nel salvataggio della relazione firmata', error: error.message });
  }
});

export default router;
