import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/api';
import FirmaCanvas from '../components/FirmaCanvas';

type VerbaleEsterno = {
  titolo: string;
  dataRiunione: string;
  ordineDelGiorno: string;
  verbale?: string;
  allegato?: { nome: string };
  partecipante: { nome: string; firma?: string };
};

export default function FirmaVerbaleEsterno() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [verbale, setVerbale] = useState<VerbaleEsterno | null>(null);
  const [firma, setFirma] = useState('');
  const [stato, setStato] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
  const [messaggio, setMessaggio] = useState('');

  useEffect(() => {
    document.title = 'Firma digitale verbale';
    if (!token) { setStato('error'); setMessaggio('Link di firma non valido.'); return; }
    api.get(`/verbali-equipe/firma-esterna/${token}`)
      .then(response => { setVerbale(response.data); setStato('ready'); })
      .catch(error => { setStato('error'); setMessaggio(error.response?.data?.message || 'Impossibile aprire il verbale.'); });
  }, [token]);

  const firmaVerbale = async () => {
    if (!firma) return;
    try {
      await api.post(`/verbali-equipe/firma-esterna/${token}`, { firma });
      setStato('success');
    } catch (error: any) { setMessaggio(error.response?.data?.message || 'Firma non riuscita.'); }
  };

  const cardClass = "tw-max-w-[760px] tw-my-8 tw-mx-auto tw-p-7 tw-rounded-[14px] tw-bg-white tw-shadow-[0_8px_28px_rgba(15,118,110,0.12)]";
  if (stato === 'loading') return <main className={cardClass}>Caricamento del verbale...</main>;
  if (stato === 'error') return <main className={cardClass}><h1 className="tw-text-red-700">Link non disponibile</h1><p>{messaggio}</p></main>;
  if (stato === 'success') return <main className={cardClass}><h1 className="tw-text-green-700">Verbale firmato</h1><p>Grazie. La firma è stata acquisita correttamente.</p></main>;
  if (!verbale) return null;

  return <main className={cardClass}>
    <p className="tw-m-0 tw-text-teal-700 tw-font-bold">PORTALE FIRMA DIGITALE</p>
    <h1 className="tw-text-teal-800">Firma verbale riunione</h1>
    <p>Ciao <strong>{verbale.partecipante.nome}</strong>, leggi il verbale e firma nello spazio sottostante.</p>
    <section className="tw-p-4 tw-bg-teal-50 tw-rounded-lg tw-my-5">
      <strong>{verbale.titolo}</strong><br />
      <small>{new Date(verbale.dataRiunione).toLocaleString('it-IT')} · {verbale.ordineDelGiorno}</small>
    </section>
    {verbale.allegato && <p><a href={`${api.defaults.baseURL}/verbali-equipe/firma-esterna/${token}/allegato`} target="_blank" rel="noreferrer">📎 Apri allegato: {verbale.allegato.nome}</a></p>}
    <div className="tw-whitespace-pre-wrap tw-border tw-border-slate-300 tw-rounded-lg tw-p-4 tw-max-h-[360px] tw-overflow-y-auto tw-bg-white">{verbale.verbale || 'Il contenuto è disponibile nell’allegato.'}</div>
    {verbale.partecipante.firma ? <p className="tw-text-green-700 tw-font-bold">Questo verbale risulta già firmato.</p> : <section className="tw-mt-5"><FirmaCanvas label="La tua firma" sublabel="Firma con dito o penna" onFirmaCompleta={setFirma} onCancella={() => setFirma('')} altezza={140} /><button onClick={firmaVerbale} disabled={!firma} className="tw-py-2.5 tw-px-4.5 tw-border-0 tw-rounded-md tw-text-white tw-font-bold disabled:tw-cursor-not-allowed" style={{ backgroundColor: firma ? '#0f766e' : '#94a3b8' }}>✍️ Firma il verbale</button>{messaggio && <p className="tw-text-red-700">{messaggio}</p>}</section>}
  </main>;
}
