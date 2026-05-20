import { Router, Request, Response } from 'express';
import Patient from '../models/Patient';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const patients = await Patient.find().sort({ lastName: 1, firstName: 1 });
    return res.json(patients);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei pazienti', error });
  }
});

router.post('/', authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  const { firstName, lastName, birthDate, address, assistanceNeeds } = req.body;

  if (!firstName?.trim() || !lastName?.trim() || !birthDate || !address?.trim() || !assistanceNeeds?.trim()) {
    return res.status(400).json({ message: 'I campi firstName, lastName, birthDate, address e assistanceNeeds sono obbligatori' });
  }

  try {
    const patient = await Patient.create({ firstName: firstName.trim(), lastName: lastName.trim(), birthDate, address: address.trim(), assistanceNeeds: assistanceNeeds.trim(), contactPhone: req.body.contactPhone?.trim() });
    return res.status(201).json(patient);
  } catch (error) {
    return res.status(400).json({ message: 'Errore nella creazione del paziente', error });
  }
});

export default router;
