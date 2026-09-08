import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/api';
import FirmaCanvas from '../components/FirmaCanvas';

export default function FirmaRitenuta() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [stato, setStato] = useState<'caricamento' | 'pronto' | 'firmato' | 'errore'>('caricamento');
  const [errore, setErrore] = useState('');
  const [doc, setDoc] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [firma, setFirma] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrore('Link non valido. Richiedi un nuovo link all\'amministratore.');
      setStato('errore');
      return;
    }

    let objectUrl: string | null = null;

    const verifica = async () => {
      try {
        const [infoRes, pdfRes] = await Promise.all([
          api.get(`/ritenute-acconto/firma/${token}`),
          api.get(`/ritenute-acconto/firma/${token}/pdf`, { responseType: 'blob' }),
        ]);

        if (infoRes.data.giaFirmato) {
          setStato('firmato');
          return;
        }

        setDoc(infoRes.data);
        setNome(`${infoRes.data.datiProfessionista?.firstName || ''} ${infoRes.data.datiProfessionista?.lastName || ''}`.trim());
        const blob = new Blob([pdfRes.data], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
        setStato('pronto');
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Errore nel caricamento del documento. Riprova più tardi.';
        setErrore(msg);
        setStato('errore');
      }
    };

    verifica();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token]);

  const inviaFirma = async () => {
    if (!firma) return;
    setSending(true);
    try {
      await api.post(`/ritenute-acconto/firma/${token}`, { firmaImg: firma, nome });
      setStato('firmato');
    } catch (err: any) {
      setErrore(err?.response?.data?.message || 'Errore nel salvataggio della firma. Riprova.');
    } finally {
      setSending(false);
    }
  };

  const formatEuro = (n: number) => `€${(Number(n) || 0).toFixed(2)}`;
  const formatData = (d: string) => (d ? new Date(d).toLocaleDateString('it-IT') : '-');

  return (
    <div className="tw-min-h-screen tw-bg-slate-50 tw-flex tw-items-start tw-justify-center tw-p-5">
      <div className="tw-bg-white tw-rounded-2xl tw-p-6 tw-max-w-[700px] tw-w-full tw-my-6" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        <div className="tw-text-center tw-mb-6">
          <h1 className="tw-m-0 tw-text-[1.3rem] tw-text-teal-700 tw-font-bold">Portale Firma Ritenuta</h1>
          <p className="tw-mt-1 tw-mb-0 tw-text-slate-500 tw-text-[0.9rem]">Firma la ritenuta d'acconto</p>
        </div>

        {stato === 'caricamento' && (
          <div className="tw-text-center tw-py-10 tw-text-slate-500">
            <div className="tw-text-[2rem] tw-mb-3">⏳</div>
            <p>Verifica link e caricamento documento...</p>
          </div>
        )}

        {stato === 'errore' && (
          <div className="tw-text-center tw-p-5 tw-bg-red-50 tw-rounded-xl tw-border tw-border-red-200">
            <div className="tw-text-[2.5rem] tw-mb-3">❌</div>
            <h3 className="tw-text-red-600 tw-mt-0 tw-mb-2">Link non valido</h3>
            <p className="tw-text-red-900 tw-m-0 tw-text-[0.9rem]">{errore}</p>
          </div>
        )}

        {stato === 'firmato' && (
          <div className="tw-text-center tw-p-5 tw-bg-green-50 tw-rounded-xl tw-border tw-border-green-300">
            <div className="tw-text-[2.5rem] tw-mb-3">✅</div>
            <h3 className="tw-text-green-600 tw-mt-0 tw-mb-2">Ritenuta firmata</h3>
            <p className="tw-text-green-800 tw-m-0 tw-text-[0.9rem]">
              Grazie {nome || ''}. La copia firmata ti sarà inviata per email.
            </p>
          </div>
        )}

        {stato === 'pronto' && doc && (
          <div>
            <div className="tw-bg-blue-50 tw-rounded-lg tw-py-3.5 tw-px-4 tw-mb-5 tw-border tw-border-blue-200">
              <p className="tw-m-0 tw-text-blue-800 tw-text-[0.9rem]">
                Spett.le <strong>{doc.datiProfessionista?.firstName || ''} {doc.datiProfessionista?.lastName || ''}</strong>,
                {' '}qui sotto trovi la ritenuta d'acconto n. <strong>{doc.numero}</strong>
                {' '}del <strong>{formatData(doc.data)}</strong>.
              </p>
            </div>

            <div className="tw-grid tw-grid-cols-2 tw-gap-3 tw-mb-4">
              <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3 tw-border tw-border-slate-200">
                <div className="tw-text-xs tw-text-slate-500">Importo lordo</div>
                <div className="tw-text-lg tw-font-bold tw-text-slate-800">{formatEuro(doc.importoLordo)}</div>
              </div>
              <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3 tw-border tw-border-slate-200">
                <div className="tw-text-xs tw-text-slate-500">Ritenuta ({doc.percentualeRitenuta || 20}%)</div>
                <div className="tw-text-lg tw-font-bold tw-text-slate-800">{formatEuro(doc.importoRitenuta)}</div>
              </div>
              <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3 tw-border tw-border-slate-200">
                <div className="tw-text-xs tw-text-slate-500">Bollo</div>
                <div className="tw-text-lg tw-font-bold tw-text-slate-800">{formatEuro(doc.importoBollo)}</div>
              </div>
              <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3 tw-border tw-border-slate-200">
                <div className="tw-text-xs tw-text-slate-500">Netto a pagare</div>
                <div className="tw-text-lg tw-font-bold tw-text-teal-700">{formatEuro(doc.nettoAPagare)}</div>
              </div>
            </div>

            {pdfUrl && (
              <div className="tw-mb-5 tw-border tw-border-slate-200 tw-rounded-lg tw-overflow-hidden" style={{ height: '360px' }}>
                <iframe src={pdfUrl} title="Anteprima ritenuta" className="tw-w-full tw-h-full tw-border-none" />
              </div>
            )}

            <div className="tw-mb-5">
              <label className="tw-block tw-text-sm tw-font-semibold tw-text-slate-700 tw-mb-2">Nome e cognome del firmatario</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="es. Mario Rossi"
                className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm"
              />
            </div>

            <FirmaCanvas
              label="Firma con dito o penna"
              sublabel="Firma per presa visione della ritenuta d'acconto"
              onFirmaCompleta={setFirma}
            />

            <button
              onClick={inviaFirma}
              disabled={!firma || sending}
              className="tw-w-full tw-mt-5 tw-py-3 tw-rounded-lg tw-bg-emerald-600 hover:tw-bg-emerald-700 disabled:tw-bg-slate-300 tw-text-white tw-font-bold tw-border-0 tw-cursor-pointer tw-transition-colors"
            >
              {sending ? 'Invio in corso...' : 'Invia firma'}
            </button>

            {errore && <p className="tw-text-red-600 tw-text-sm tw-mt-3 tw-text-center">{errore}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
