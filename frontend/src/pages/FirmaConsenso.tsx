import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/api';
import FirmaCanvas from '../components/FirmaCanvas';
import { Button } from '../components/ui/Button';

export default function FirmaConsenso() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [stato, setStato] = useState<'caricamento' | 'pronto' | 'firmato' | 'errore'>('caricamento');
  const [errore, setErrore] = useState('');
  const [patient, setPatient] = useState<any>(null);
  const [firma, setFirma] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrore('Link non valido. Richiedi un nuovo link.');
      setStato('errore');
      return;
    }
    api.get(`/gdpr/consenso/firma/${token}`)
      .then((res) => {
        setPatient(res.data.patient);
        setStato('pronto');
      })
      .catch((err) => {
        setErrore(err?.response?.data?.message || 'Errore nel caricamento del link.');
        setStato('errore');
      });
  }, [token]);

  const inviaFirma = async () => {
    if (!firma || !patient) return;
    setSending(true);
    try {
      await api.post(`/gdpr/consenso/firma/${token}`, {
        firmaImg: firma,
        nome: `${patient.firstName} ${patient.lastName}`,
      });
      setStato('firmato');
    } catch (err: any) {
      setErrore(err?.response?.data?.message || 'Errore nel salvataggio della firma.');
      setStato('errore');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="tw-min-h-screen tw-bg-slate-50 tw-flex tw-items-start tw-justify-center tw-p-5">
      <div className="tw-bg-white tw-rounded-2xl tw-p-6 tw-max-w-[700px] tw-w-full tw-my-6 tw-shadow-lg">
        <div className="tw-text-center tw-mb-6">
          <h1 className="tw-m-0 tw-text-[1.3rem] tw-text-teal-700 tw-font-bold">Consenso GDPR</h1>
          <p className="tw-mt-1 tw-mb-0 tw-text-slate-500 tw-text-[0.9rem]">Firma informativa privacy e trattamento dati</p>
        </div>

        {stato === 'caricamento' && (
          <div className="tw-text-center tw-py-10 tw-text-slate-500">Caricamento...</div>
        )}

        {stato === 'errore' && (
          <div className="tw-text-center tw-p-5 tw-bg-red-50 tw-rounded-xl tw-border tw-border-red-200">
            <h3 className="tw-text-red-600 tw-mt-0 tw-mb-2">Link non valido</h3>
            <p className="tw-text-red-900 tw-m-0 tw-text-[0.9rem]">{errore}</p>
          </div>
        )}

        {stato === 'firmato' && (
          <div className="tw-text-center tw-p-5 tw-bg-green-50 tw-rounded-xl tw-border tw-border-green-300">
            <h3 className="tw-text-green-600 tw-mt-0 tw-mb-2">Consenso firmato</h3>
            <p className="tw-text-green-800 tw-m-0 tw-text-[0.9rem]">
              Grazie. Il consenso è stato firmato e archiviato.
            </p>
          </div>
        )}

        {stato === 'pronto' && patient && (
          <div>
            <div className="tw-bg-blue-50 tw-rounded-lg tw-py-3.5 tw-px-4 tw-mb-5 tw-border tw-border-blue-200">
              <p className="tw-m-0 tw-text-sm tw-text-slate-700">
                <strong>Paziente:</strong> {patient.firstName} {patient.lastName}
              </p>
            </div>
            <p className="tw-text-sm tw-text-slate-600 tw-mb-4">
              Dichiaro di aver letto l'informativa privacy e di prestare il consenso al trattamento dei dati personali e sanitari ai sensi del GDPR.
            </p>
            <FirmaCanvas
              label="Firma"
              sublabel="Usa dito o penna sul touchscreen"
              onFirmaCompleta={setFirma}
              altezza={180}
            />
            <div className="tw-flex tw-justify-end tw-gap-2 tw-mt-4">
              <Button onClick={inviaFirma} disabled={!firma || sending}>
                {sending ? 'Invio...' : 'Firma consenso'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
