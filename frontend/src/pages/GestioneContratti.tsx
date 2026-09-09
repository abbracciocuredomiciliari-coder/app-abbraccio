import { useEffect, useMemo, useState } from 'react';
import api from '../api/api';
import { Search, FileText, Download, Mail, User, CheckCircle, AlertCircle, X, Eye } from 'lucide-react';

interface Utente {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  professione?: string;
  partitaIva?: string;
  regimeFiscale?: string;
  firmaContratto?: string;
  dataFirmaContratto?: string;
  luogoFirmaContratto?: string;
}

interface Anteprima {
  tipo: 'piva' | 'ritenuta';
  titolo: string;
  contratto: string;
}

const roleLabel: Record<string, string> = {
  admin: 'Admin',
  coordinator: 'Coordinatore',
  direttore: 'Direttore',
  caregiver: 'Operatore',
};

export default function GestioneContratti() {
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [selezionato, setSelezionato] = useState<Utente | null>(null);
  const [anteprima, setAnteprima] = useState<Anteprima | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const mostraToast = (msg: string, tipo: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUtenti = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/all-users');
      setUtenti(res.data || []);
    } catch (err: any) {
      mostraToast(err?.response?.data?.message || 'Errore caricamento utenti', 'err');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUtenti();
  }, []);

  const filtrati = useMemo(() => {
    const q = filtro.toLowerCase().trim();
    if (!q) return utenti;
    return utenti.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.professione || '').toLowerCase().includes(q)
    );
  }, [utenti, filtro]);

  const scaricaPDF = async (userId: string, tipo: 'piva' | 'ritenuta', firmato: boolean) => {
    const key = `${userId}-${tipo}-${firmato}`;
    setPending(p => ({ ...p, [key]: true }));
    try {
      const endpoint = firmato
        ? `/contratto/firmato/${userId}?tipo=${tipo}`
        : `/contratto/download/${userId}?tipo=${tipo}`;
      const res = await api.get(endpoint, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contratto_${tipo}_${firmato ? 'firmato_' : ''}${userId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      mostraToast(err?.response?.data?.message || 'Errore download PDF', 'err');
    } finally {
      setPending(p => ({ ...p, [key]: false }));
    }
  };

  const mostraAnteprima = async (userId: string, tipo: 'piva' | 'ritenuta') => {
    setPending(p => ({ ...p, [`${userId}-${tipo}-anteprima`]: true }));
    try {
      const res = await api.get(`/contratto/anteprima/${userId}?tipo=${tipo}`);
      setAnteprima({ tipo, titolo: res.data.titolo, contratto: res.data.contratto });
    } catch (err: any) {
      mostraToast(err?.response?.data?.message || 'Errore anteprima', 'err');
    } finally {
      setPending(p => ({ ...p, [`${userId}-${tipo}-anteprima`]: false }));
    }
  };

  const inviaFirma = async (userId: string, tipo: 'piva' | 'ritenuta') => {
    setPending(p => ({ ...p, [`${userId}-${tipo}-invia`]: true }));
    try {
      const res = await api.post(`/contratto/invia-firma/${userId}`, { tipo });
      if (res.data.inviata) {
        mostraToast('Email inviata correttamente');
      } else {
        mostraToast(res.data.message || 'Email non inviata', 'err');
      }
    } catch (err: any) {
      mostraToast(err?.response?.data?.message || 'Errore invio email', 'err');
    } finally {
      setPending(p => ({ ...p, [`${userId}-${tipo}-invia`]: false }));
    }
  };

  const isFirmato = (u: Utente) => !!(u.firmaContratto && u.firmaContratto !== 'null' && u.firmaContratto.length > 10);

  const ContractCard = ({ tipo, utente }: { tipo: 'piva' | 'ritenuta'; utente: Utente }) => {
    const firmato = isFirmato(utente) && (!tipo || (tipo === 'ritenuta' ? utente.regimeFiscale === 'prestazione-occasionale' : utente.regimeFiscale !== 'prestazione-occasionale'));
    const titolo = tipo === 'ritenuta'
      ? 'Prestazione occasionale con ritenuta d\'acconto'
      : 'Prestazione d\'opera (professionisti con P.IVA)';
    const desc = tipo === 'ritenuta'
      ? 'Contratto per collaborazione occasionale con ritenuta d\'acconto a titolo d\'imposta.'
      : 'Contratto di prestazione d\'opera intellettuale per liberi professionisti con P.IVA.';

    return (
      <div className="tw-bg-white tw-rounded-xl tw-border tw-border-slate-200 tw-p-5 tw-shadow-sm">
        <div className="tw-flex tw-items-start tw-justify-between tw-mb-3">
          <div>
            <h3 className="tw-text-lg tw-font-bold tw-text-slate-800">{titolo}</h3>
            <p className="tw-text-sm tw-text-slate-500 tw-mt-1">{desc}</p>
          </div>
          {firmato ? (
            <span className="tw-inline-flex tw-items-center tw-gap-1 tw-text-xs tw-font-semibold tw-bg-green-100 tw-text-green-700 tw-px-2.5 tw-py-1 tw-rounded-full">
              <CheckCircle size={14} /> Firmato
            </span>
          ) : (
            <span className="tw-inline-flex tw-items-center tw-gap-1 tw-text-xs tw-font-semibold tw-bg-amber-100 tw-text-amber-700 tw-px-2.5 tw-py-1 tw-rounded-full">
              <AlertCircle size={14} /> Da firmare
            </span>
          )}
        </div>

        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-3">
          <button
            onClick={() => mostraAnteprima(utente._id, tipo)}
            disabled={pending[`${utente._id}-${tipo}-anteprima`]}
            className="tw-flex tw-items-center tw-justify-center tw-gap-2 tw-px-4 tw-py-2.5 tw-rounded-lg tw-bg-slate-100 hover:tw-bg-slate-200 tw-text-slate-700 tw-text-sm tw-font-medium tw-transition-colors"
          >
            <Eye size={16} /> Anteprima testo
          </button>
          <button
            onClick={() => scaricaPDF(utente._id, tipo, false)}
            disabled={pending[`${utente._id}-${tipo}-false`]}
            className="tw-flex tw-items-center tw-justify-center tw-gap-2 tw-px-4 tw-py-2.5 tw-rounded-lg tw-bg-blue-600 hover:tw-bg-blue-700 tw-text-white tw-text-sm tw-font-medium tw-transition-colors"
          >
            <Download size={16} /> Scarica PDF
          </button>
          {firmato ? (
            <button
              onClick={() => scaricaPDF(utente._id, tipo, true)}
              disabled={pending[`${utente._id}-${tipo}-true`]}
              className="tw-flex tw-items-center tw-justify-center tw-gap-2 tw-px-4 tw-py-2.5 tw-rounded-lg tw-bg-emerald-600 hover:tw-bg-emerald-700 tw-text-white tw-text-sm tw-font-medium tw-transition-colors sm:tw-col-span-2"
            >
              <FileText size={16} /> Scarica PDF firmato
            </button>
          ) : (
            <button
              onClick={() => inviaFirma(utente._id, tipo)}
              disabled={pending[`${utente._id}-${tipo}-invia`]}
              className="tw-flex tw-items-center tw-justify-center tw-gap-2 tw-px-4 tw-py-2.5 tw-rounded-lg tw-bg-indigo-600 hover:tw-bg-indigo-700 tw-text-white tw-text-sm tw-font-medium tw-transition-colors sm:tw-col-span-2"
            >
              <Mail size={16} /> Invia link firma digitale
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="tw-p-5 tw-max-w-6xl tw-mx-auto">
      <h1 className="tw-text-2xl tw-font-bold tw-text-slate-800 tw-mb-1">Gestione contratti operatori</h1>
      <p className="tw-text-slate-500 tw-mb-6">Visualizza, scarica, stampa e invia per firma i due tipi di contratto.</p>

      {toast && (
        <div className={`tw-fixed tw-top-4 tw-right-4 tw-z-50 tw-px-4 tw-py-3 tw-rounded-lg tw-shadow-lg tw-text-sm tw-font-medium ${toast.tipo === 'ok' ? 'tw-bg-green-100 tw-text-green-800' : 'tw-bg-red-100 tw-text-red-800'}`}>
          {toast.msg}
        </div>
      )}

      <div className="tw-flex tw-flex-col lg:tw-flex-row tw-gap-6">
        {/* Lista utenti */}
        <div className="tw-w-full lg:tw-w-1/3">
          <div className="tw-bg-white tw-rounded-xl tw-border tw-border-slate-200 tw-p-4 tw-shadow-sm">
            <label className="tw-text-sm tw-font-medium tw-text-slate-700 tw-mb-2 tw-block">Cerca operatore</label>
            <div className="tw-relative">
              <Search className="tw-absolute tw-left-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-slate-400" size={18} />
              <input
                type="text"
                value={filtro}
                onChange={e => setFiltro(e.target.value)}
                placeholder="Nome, email o professione"
                className="tw-w-full tw-pl-10 tw-pr-3 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500"
              />
            </div>

            <div className="tw-mt-4 tw-space-y-2 tw-max-h-[500px] tw-overflow-y-auto">
              {loading ? (
                <p className="tw-text-sm tw-text-slate-500 tw-text-center tw-py-4">Caricamento...</p>
              ) : filtrati.length === 0 ? (
                <p className="tw-text-sm tw-text-slate-500 tw-text-center tw-py-4">Nessun operatore trovato</p>
              ) : (
                filtrati.map(u => (
                  <button
                    key={u._id}
                    onClick={() => setSelezionato(u)}
                    className={`tw-w-full tw-text-left tw-flex tw-items-center tw-gap-3 tw-p-3 tw-rounded-lg tw-border tw-transition-colors ${selezionato?._id === u._id ? 'tw-bg-blue-50 tw-border-blue-300' : 'tw-bg-white tw-border-slate-100 hover:tw-bg-slate-50'}`}
                  >
                    <div className="tw-w-9 tw-h-9 tw-rounded-full tw-bg-slate-100 tw-flex tw-items-center tw-justify-center tw-text-slate-600">
                      <User size={18} />
                    </div>
                    <div className="tw-flex-1 tw-min-w-0">
                      <p className="tw-text-sm tw-font-semibold tw-text-slate-800 tw-truncate">{u.name}</p>
                      <p className="tw-text-xs tw-text-slate-500 tw-truncate">{u.email}</p>
                      {u.professione && <p className="tw-text-xs tw-text-slate-400 tw-truncate">{u.professione}</p>}
                    </div>
                    {isFirmato(u) && <CheckCircle size={16} className="tw-text-green-600 tw-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Dettaglio contratti */}
        <div className="tw-w-full lg:tw-w-2/3">
          {!selezionato ? (
            <div className="tw-bg-white tw-rounded-xl tw-border tw-border-slate-200 tw-p-8 tw-shadow-sm tw-text-center">
              <FileText size={48} className="tw-text-slate-300 tw-mx-auto tw-mb-3" />
              <p className="tw-text-slate-500">Seleziona un operatore dalla lista per gestire i contratti.</p>
            </div>
          ) : (
            <div className="tw-space-y-5">
              <div className="tw-bg-white tw-rounded-xl tw-border tw-border-slate-200 tw-p-5 tw-shadow-sm">
                <div className="tw-flex tw-items-center tw-justify-between">
                  <div className="tw-flex tw-items-center tw-gap-3">
                    <div className="tw-w-12 tw-h-12 tw-rounded-full tw-bg-blue-100 tw-flex tw-items-center tw-justify-center tw-text-blue-700">
                      <User size={24} />
                    </div>
                    <div>
                      <h2 className="tw-text-lg tw-font-bold tw-text-slate-800">{selezionato.name}</h2>
                      <p className="tw-text-sm tw-text-slate-500">{selezionato.email} {selezionato.professione ? `• ${selezionato.professione}` : ''}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelezionato(null)}
                    className="tw-text-slate-400 hover:tw-text-slate-600"
                    aria-label="Chiudi"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-3 tw-mt-4 tw-text-sm">
                  <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3">
                    <p className="tw-text-slate-400 tw-text-xs">Ruolo</p>
                    <p className="tw-font-medium tw-text-slate-700">{roleLabel[selezionato.role] || selezionato.role}</p>
                  </div>
                  <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3">
                    <p className="tw-text-slate-400 tw-text-xs">Regime</p>
                    <p className="tw-font-medium tw-text-slate-700">{selezionato.regimeFiscale || '-'}</p>
                  </div>
                  <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3">
                    <p className="tw-text-slate-400 tw-text-xs">P.IVA</p>
                    <p className="tw-font-medium tw-text-slate-700">{selezionato.partitaIva || '-'}</p>
                  </div>
                  <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3">
                    <p className="tw-text-slate-400 tw-text-xs">Stato firma</p>
                    <p className={`tw-font-medium ${isFirmato(selezionato) ? 'tw-text-green-600' : 'tw-text-amber-600'}`}>
                      {isFirmato(selezionato) ? `Firmato ${selezionato.luogoFirmaContratto || ''}` : 'Da firmare'}
                    </p>
                  </div>
                </div>
              </div>

              <ContractCard tipo="piva" utente={selezionato} />
              <ContractCard tipo="ritenuta" utente={selezionato} />
            </div>
          )}
        </div>
      </div>

      {/* Modale anteprima */}
      {anteprima && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/50 tw-flex tw-items-center tw-justify-center tw-p-4">
          <div className="tw-bg-white tw-rounded-xl tw-shadow-xl tw-w-full tw-max-w-3xl tw-max-h-[85vh] tw-flex tw-flex-col">
            <div className="tw-flex tw-items-center tw-justify-between tw-p-4 tw-border-b tw-border-slate-200">
              <h3 className="tw-text-lg tw-font-bold tw-text-slate-800">{anteprima.titolo}</h3>
              <button onClick={() => setAnteprima(null)} className="tw-text-slate-400 hover:tw-text-slate-600">
                <X size={22} />
              </button>
            </div>
            <div className="tw-p-4 tw-overflow-y-auto tw-flex-1">
              <pre className="tw-whitespace-pre-wrap tw-text-sm tw-text-slate-700 tw-bg-slate-50 tw-rounded-lg tw-p-4 tw-border tw-border-slate-200" style={{ fontFamily: 'Arial, sans-serif' }}>
                {anteprima.contratto}
              </pre>
            </div>
            <div className="tw-p-4 tw-border-t tw-border-slate-200 tw-flex tw-justify-end">
              <button
                onClick={() => setAnteprima(null)}
                className="tw-px-5 tw-py-2 tw-rounded-lg tw-bg-slate-100 hover:tw-bg-slate-200 tw-text-slate-700 tw-text-sm tw-font-medium"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
