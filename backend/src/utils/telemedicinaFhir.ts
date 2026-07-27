import ParametroVita from '../models/ParametroVita';
import Teleconsulto from '../models/Teleconsulto';
import Patient from '../models/Patient';
import { Request, Response } from 'express';

const loincMap: Record<string, string> = {
  frequenza_cardiaca: '8867-4',
  pressione_sistolica: '8480-6',
  pressione_diastolica: '8462-4',
  saturazione_o2: '59408-5',
  spo2: '59408-5',
  glicemia: '2339-0',
  temperatura: '8310-5',
  peso: '29463-7',
  altezza: '8302-2',
  bmi: '39156-5',
  co2: '2021-4',
};

const unitMap: Record<string, string> = {
  frequenza_cardiaca: '/min',
  pressione_sistolica: 'mmHg',
  pressione_diastolica: 'mmHg',
  saturazione_o2: '%',
  spo2: '%',
  glicemia: 'mg/dL',
  temperatura: 'Cel',
  peso: 'kg',
  altezza: 'cm',
  bmi: 'kg/m2',
  co2: 'mmHg',
};

export async function exportFhirBundle(req: Request, res: Response) {
  try {
    const { pazienteId } = req.params;
    const { days = '30' } = req.query as any;
    const from = new Date();
    from.setDate(from.getDate() - parseInt(days || '30', 10));

    const [patient, parametri, teleconsulti] = await Promise.all([
      Patient.findById(pazienteId).lean(),
      ParametroVita.find({ pazienteId, rilevatoIl: { $gte: from } }).sort({ rilevatoIl: -1 }).limit(500),
      Teleconsulto.find({ patientId: pazienteId }).sort({ dataOra: -1 }).limit(100),
    ]);

    if (!patient) return res.status(404).json({ message: 'Paziente non trovato' });

    const id = `abbraccio-patient-${pazienteId}`;
    const patientResource = {
      resourceType: 'Patient',
      id,
      identifier: [{ system: 'https://abbracciocuredomiciliari.it/patient-id', value: pazienteId }],
      name: [{ family: patient?.lastName || '', given: [patient?.firstName || ''] }],
      birthDate: patient?.birthDate ? new Date(patient.birthDate).toISOString().slice(0, 10) : undefined,
    };

    const entries: any[] = [{ resource: patientResource }];

    parametri.forEach(p => {
      entries.push({
        resource: {
          resourceType: 'Observation',
          id: `obs-${p._id}`,
          status: 'final',
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }],
          code: { coding: [{ system: 'http://loinc.org', code: loincMap[p.tipo] || 'UNKNOWN', display: p.tipo }] },
          subject: { reference: `Patient/${id}` },
          effectiveDateTime: new Date(p.rilevatoIl).toISOString(),
          valueQuantity: { value: p.valore, unit: unitMap[p.tipo] || p.unita, system: 'http://unitsofmeasure.org', code: unitMap[p.tipo] || p.unita },
          note: [{ text: `Fonte: ${p.fonte}${p.anomalo ? ' - VALORE ANOMALO' : ''}` }],
        },
      });
    });

    teleconsulti.forEach(t => {
      entries.push({
        resource: {
          resourceType: 'Encounter',
          id: `enc-${t._id}`,
          status: t.stato === 'completato' ? 'finished' : t.stato === 'in_corso' ? 'in-progress' : 'planned',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
          subject: { reference: `Patient/${id}` },
          period: { start: new Date(t.dataOra).toISOString(), end: t.completatoIl ? new Date(t.completatoIl).toISOString() : undefined },
          type: [{ coding: [{ system: 'https://abbracciocuredomiciliari.it/telemedicina-encounter-type', code: t.professione, display: t.titolo }] }],
        },
      });
    });

    const bundle = {
      resourceType: 'Bundle',
      id: `bundle-${pazienteId}-${Date.now()}`,
      meta: { lastUpdated: new Date().toISOString() },
      type: 'collection',
      total: entries.length,
      entry: entries,
    };

    res.setHeader('Content-Type', 'application/fhir+json');
    return res.json(bundle);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore esportazione FHIR', error: error.message });
  }
}
