import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/api';
import FirmaCanvas from '../components/FirmaCanvas';

interface EsameRichiesto {
  tipo: 'rx_domiciliare' | 'ecografia_domiciliare' | 'ecocolordoppler' | 'ecocolordoppler_tsa' | 'altro';
  dettaglio?: string;
}

const LABEL_ESAME: Record<string, string> = {
  rx_domiciliare: 'RX domiciliare',
  ecografia_domiciliare: 'Ecografia domiciliare',
  ecocolordoppler: 'EcoColorDoppler',
  ecocolordoppler_tsa: 'EcoColorDoppler TSA',
  altro: 'Altro esame',
};

interface MandatoData {
  patient: {
    firstName: string;
    lastName: string;
    birthDate?: string;
  };
  esami: EsameRichiesto[];
  compenso: number;
  nPratica?: string;
  nome?: string;
}

export default function FirmaMandatoRxTeam() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [stato, setStato] = useState<'caricamento' | 'pronto' | 'firmato' | 'errore'>('caricamento');
  const [errMsg, setErrMsg] = useState('');
  const [firma, setFirma] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [luogoFirma, setLuogoFirma] = useState('Roma');
  const [accettato, setAccettato] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mandato, setMandato] = useState<MandatoData | null>(null);

  useEffect(() => {
    if (!token) {
      setErrMsg('Link non valido. Richiedi un nuovo link all\'amministratore.');
      setStato('errore');
      return;
    }
    api.get(`/mandati-rx-team/firma/${token}`)
      .then(res => {
        if (res.data.giaFirmato) {
          setMandato(res.data);
          setStato('firmato');
        } else {
          setMandato(res.data);
          setNome(res.data.nome || `${res.data.patient?.firstName || ''} ${res.data.patient?.lastName || ''}`.trim());
          setStato('pronto');
        }
      })
      .catch(err => {
        setErrMsg(err?.response?.data?.message || 'Errore di connessione. Riprova più tardi.');
        setStato('errore');
      });
  }, [token]);

  const handleInviaFirma = async () => {
    if (!firma || !accettato) return;
    setLoading(true);
    try {
      await api.post(`/mandati-rx-team/firma/${token}`, { firmaImg: firma, nome, luogoFirma, accettato });
      setErrMsg('');
      setStato('firmato');
    } catch (err: any) {
      setErrMsg(err?.response?.data?.message || 'Errore nel salvataggio della firma. Riprova.');
      setStato('errore');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tw-min-h-screen tw-bg-slate-50 tw-flex tw-items-center tw-justify-center tw-p-5">
      <div className="tw-bg-white tw-rounded-2xl tw-p-8 tw-px-6 tw-max-w-[560px] tw-w-full" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        <div className="tw-text-center tw-mb-6">
          <h1 className="tw-m-0 tw-text-[1.3rem] tw-text-brand tw-font-bold">Foglio di Accompagnamento RX Team</h1>
          <p className="tw-mt-1 tw-mb-0 tw-text-slate-500 tw-text-[0.9rem]">Accettazione digitale esame diagnostico domiciliare e compenso</p>
        </div>

        {stato === 'caricamento' && (
          <div className="tw-text-center tw-py-10 tw-text-slate-500">
            <div className="tw-text-[2rem] tw-mb-3">⏳</div>
            <p>Verifica link in corso...</p>
          </div>
        )}

        {stato === 'errore' && (
          <div className="tw-text-center tw-p-5 tw-bg-red-50 tw-rounded-xl tw-border tw-border-red-200">
            <div className="tw-text-[2.5rem] tw-mb-3">❌</div>
            <h3 className="tw-text-red-600 tw-mt-0 tw-mb-2">Link non valido</h3>
            <p className="tw-text-red-900 tw-m-0 tw-text-[0.9rem]">{errMsg}</p>
          </div>
        )}

        {stato === 'firmato' && (
          <div className="tw-text-center tw-p-5 tw-bg-green-50 tw-rounded-xl tw-border tw-border-green-300">
            <div className="tw-text-[2.5rem] tw-mb-3">✅</div>
            <h3 className="tw-text-green-600 tw-mt-0 tw-mb-2">Accettazione firmata</h3>
            <p className="tw-text-green-800 tw-m-0 tw-text-[0.9rem]">
              Il foglio di accompagnamento RX Team è stato firmato e inviato ad Abbraccio Cure Domiciliari. Puoi chiudere questa pagina.
            </p>
          </div>
        )}

        {stato === 'pronto' && mandato && (() => {
          const apiBase = (api.defaults.baseURL || '/api').replace(/\/$/, '');
          const mandatoPdfUrl = `${apiBase}/mandati-rx-team/mandato-pdf/${token}`;
          return (
            <div>
              <div className="tw-bg-blue-50 tw-rounded-lg tw-py-3.5 tw-px-4 tw-mb-5 tw-border tw-border-blue-200">
                <p className="tw-m-0 tw-text-blue-800 tw-text-[0.9rem]">
                  Ciao <strong>{mandato.patient?.firstName} {mandato.patient?.lastName}</strong>, leggi il riepilogo dell'esame richiesto, conferma l'accettazione e firma con dito, penna o mouse.
                </p>
              </div>

              <div className="tw-bg-slate-50 tw-rounded-lg tw-p-4 tw-mb-4 tw-border tw-border-slate-200">
                {mandato.nPratica && (
                  <p className="tw-text-xs tw-text-slate-500 tw-m-0 tw-mb-2">N. pratica: <strong>{mandato.nPratica}</strong></p>
                )}
                <p className="tw-text-sm tw-font-semibold tw-text-slate-700 tw-mb-1">Esame/i richiesto/i:</p>
                <ul className="tw-m-0 tw-pl-5 tw-text-sm tw-text-slate-700">
                  {(mandato.esami || []).map((e, i) => (
                    <li key={i}>{LABEL_ESAME[e.tipo] || e.tipo}{e.dettaglio ? ` — ${e.dettaglio}` : ''}</li>
                  ))}
                </ul>
                <p className="tw-text-sm tw-font-semibold tw-text-emerald-700 tw-mt-3 tw-mb-0">
                  Compenso pattuito: € {Number(mandato.compenso || 0).toFixed(2)}
                </p>
              </div>

              <div className="tw-flex tw-gap-3 tw-mb-5">
                <a href={mandatoPdfUrl} target="_blank" rel="noreferrer" className="tw-flex-1 tw-text-center tw-py-2 tw-px-3 tw-rounded-lg tw-bg-emerald-100 tw-text-emerald-800 tw-text-sm tw-font-semibold hover:tw-bg-emerald-200 tw-transition-colors">
                  ⬇️ Scarica foglio RX Team (PDF)
                </a>
              </div>

              <div className="tw-mb-4">
                <label className="tw-block tw-text-sm tw-font-semibold tw-text-slate-700 tw-mb-2">Nome e cognome del firmatario</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm"
                  placeholder="es. Mario Rossi"
                />
              </div>

              <div className="tw-mb-4">
                <label className="tw-block tw-text-sm tw-font-semibold tw-text-slate-700 tw-mb-2">Luogo firma</label>
                <input
                  type="text"
                  value={luogoFirma}
                  onChange={(e) => setLuogoFirma(e.target.value)}
                  className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm"
                />
              </div>

              <label className="tw-flex tw-items-start tw-gap-3 tw-mb-5 tw-cursor-pointer tw-bg-amber-50 tw-p-3 tw-rounded-lg tw-border tw-border-amber-200">
                <input
                  type="checkbox"
                  checked={accettato}
                  onChange={(e) => setAccettato(e.target.checked)}
                  className="tw-mt-1"
                />
                <span className="tw-text-sm tw-text-slate-700">
                  Ho letto il foglio di accompagnamento, l'esame richiesto e il compenso pattuito, e <strong>dichiaro di accettare</strong> la prestazione concordata con RX Team.
                </span>
              </label>

              <FirmaCanvas
                label="Firma con dito, penna o mouse"
                sublabel="La firma vale come accettazione dell'esame e del compenso indicato"
                onFirmaCompleta={setFirma}
              />

              <button
                onClick={handleInviaFirma}
                disabled={!firma || !accettato || loading}
                className="tw-w-full tw-mt-5 tw-py-3 tw-rounded-lg tw-bg-emerald-600 hover:tw-bg-emerald-700 disabled:tw-bg-slate-300 tw-text-white tw-font-bold tw-border-0 tw-cursor-pointer tw-transition-colors"
              >
                {loading ? 'Salvataggio...' : 'Conferma e firma accettazione'}
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
