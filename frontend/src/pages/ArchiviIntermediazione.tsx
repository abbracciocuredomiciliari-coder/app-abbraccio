import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { FileText, Download, Mail, Users, Eye, Trash2, Receipt, Send } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface ContrattoCollegato {
  _id: string;
  stato: 'emesso' | 'firmato';
  email?: string;
  nome?: string;
  dataFirma?: string;
  allegatoFileName?: string;
  token?: string;
  importo?: number;
}

interface RichiestaArchivio {
  _id: string;
  patient?: { firstName: string; lastName: string; codiceFiscale?: string; email?: string } | null;
  contrattoId?: ContrattoCollegato | string;
  preventivoPdfFileName?: string;
  fatturaId?: string;
  contrattoOrfano?: boolean;
  createdAt: string;
}

interface ConsensoGdprRow {
  _id: string;
  patient?: { firstName: string; lastName: string } | null;
  nomeFirmatario?: string;
  cognomeFirmatario?: string;
  dataFirma?: string;
  luogoFirma?: string;
  versioneInformativa?: string;
  revocato?: boolean;
}

interface PreventivoInviato {
  _id: string;
  tipo: 'preventivo_veloce' | 'costo_badante';
  canale: 'whatsapp' | 'email';
  nomeCliente?: string;
  email?: string;
  telefono?: string;
  totale?: number;
  inviatoDa?: string;
  createdAt: string;
  simulazione?: {
    risultato?: { contrattoLabel?: string; livelloLabel?: string; oreSettimanali?: number };
    cafMensile?: number;
    escludiTfrTredicesima?: boolean;
  };
}

export default function ArchiviIntermediazione() {
  const { user } = useAuth();
  const [archivioContratti, setArchivioContratti] = useState<RichiestaArchivio[]>([]);
  const [archivioGdpr, setArchivioGdpr] = useState<ConsensoGdprRow[]>([]);
  const [inviati, setInviati] = useState<PreventivoInviato[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { carica(); }, []);

  async function carica() {
    try {
      setLoading(true);
      const [ac, ag, ai] = await Promise.all([
        api.get('/badanti-intermediazione/archivio/contratti'),
        api.get('/badanti-intermediazione/archivio/gdpr'),
        api.get('/preventivi-inviati', { params: { area: 'intermediazione' } }),
      ]);
      setArchivioContratti(ac.data || []);
      setArchivioGdpr(ag.data || []);
      setInviati(ai.data || []);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore caricamento archivi');
    } finally {
      setLoading(false);
    }
  }

  // Contratti firmati = preventivi accettati: segnalazione principale
  const firmatiCount = archivioContratti.filter(r =>
    r.contrattoId && typeof r.contrattoId === 'object' && r.contrattoId.stato === 'firmato'
  ).length;

  // Scarica il PDF preventivo/costo allegato al contratto
  async function scaricaPreventivoContratto(contratto: ContrattoCollegato) {
    try {
      const res = await api.get(`/contratti-pazienti/${contratto._id}/allegato`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = contratto.allegatoFileName || 'preventivo.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore download preventivo');
    }
  }

  // Apre in una nuova scheda il documento HTML firmato (contratto o informativa GDPR)
  async function apriDocumentoFirmato(contrattoId: string, tipo: 'pdf' | 'gdpr-firmato', nome: string) {
    try {
      const res = await api.get(`/contratti-pazienti/${contrattoId}/${tipo}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/html' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      alert(err?.response?.data?.message || `Errore apertura ${nome}`);
    }
  }

  // Elimina un contratto dall'archivio (contratto + consenso GDPR collegato;
  // la richiesta intermediazione torna 'aperta' se esiste ancora)
  async function eliminaContratto(contratto: ContrattoCollegato) {
    const firmato = contratto.stato === 'firmato';
    const testo = firmato
      ? 'Questo contratto è FIRMATO. Eliminandolo rimuoverai anche il consenso GDPR collegato e la richiesta tornerà modificabile. Continuare?'
      : 'Eliminare questo contratto dall\'archivio? La richiesta tornerà senza contratto.';
    if (!window.confirm(testo)) return;
    try {
      await api.delete(`/contratti-pazienti/${contratto._id}`);
      await carica();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore eliminazione contratto');
    }
  }

  // Emette la fattura per il corrispettivo del contratto firmato (imponibile + IVA 22%)
  async function fatturaContratto(contratto: ContrattoCollegato) {
    if (!window.confirm(`Emettere la fattura per il contratto (imponibile € ${Number(contratto.importo || 0).toFixed(2)} + IVA 22%)?`)) return;
    try {
      await api.post(`/contratti-pazienti/${contratto._id}/fattura`);
      alert('Fattura generata — la trovi in Gestione Fatturazione e Archivio Fatture');
      await carica();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore generazione fattura');
    }
  }

  // Invia (o reinvia) contratto + GDPR + preventivo al paziente per la firma
  async function inviaFirmaContratto(contratto: ContrattoCollegato) {
    const email = window.prompt('Email del destinatario', contratto.email || '');
    if (!email) return;
    try {
      await api.post(`/contratti-pazienti/${contratto._id}/invia-email`, { email });
      alert('Email inviata');
      await carica();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore invio');
    }
  }

  // Rigenera e mostra/scarica il PDF del costo inviato senza paziente
  async function pdfInviato(inv: PreventivoInviato, apri: boolean) {
    try {
      const res = await api.get(`/preventivi-inviati/${inv._id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      if (apri) {
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `preventivo-${(inv.nomeCliente || 'inviato').replace(/\s+/g, '-').toLowerCase()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella rigenerazione del PDF');
    }
  }

  async function eliminaInviato(inv: PreventivoInviato) {
    if (!window.confirm(`Eliminare questo invio archiviato${inv.nomeCliente ? ` (${inv.nomeCliente})` : ''}?`)) return;
    try {
      await api.delete(`/preventivi-inviati/${inv._id}`);
      await carica();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore eliminazione');
    }
  }

  const euro = (n?: number) => `€ ${Number(n || 0).toFixed(2)}`;

  if (loading) return (
    <section className="tw-min-h-screen tw-flex tw-items-center tw-justify-center tw-bg-slate-50">
      <div className="tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-slate-100 tw-p-10 tw-text-slate-500 tw-font-medium">⏳ Caricamento...</div>
    </section>
  );

  return (
    <section className="fade-in tw-bg-slate-50 tw-min-h-screen tw-p-4 md:tw-p-6">
      <div className="tw-max-w-7xl tw-mx-auto tw-space-y-6">

        <div className="tw-flex tw-justify-between tw-items-center tw-flex-wrap tw-gap-4 tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-slate-100 tw-p-5 md:tw-p-6">
          <div className="tw-flex tw-items-center tw-gap-4">
            <div className="tw-p-3 tw-rounded-xl tw-text-white tw-shadow-sm tw-bg-rose-600">
              <FileText size={24} />
            </div>
            <div>
              <h1 className="tw-text-2xl tw-font-bold tw-text-slate-800">Archivi intermediazione</h1>
              <p className="tw-text-slate-500 tw-text-sm tw-m-0">
                Contratti {archivioContratti.length} · GDPR {archivioGdpr.length}
                {firmatiCount > 0 && <span className="tw-text-green-700 tw-font-bold"> · {firmatiCount} firmati</span>}
              </p>
            </div>
          </div>
          {firmatiCount > 0 && (
            <span className="tw-inline-flex tw-items-center tw-gap-2 tw-px-3 tw-py-1.5 tw-rounded-full tw-bg-green-100 tw-text-green-800 tw-text-sm tw-font-bold">
              <Users size={16} /> {firmatiCount} contratt{firmatiCount === 1 ? 'o firmato' : 'i firmati'} (contratto + GDPR + preventivo)
            </span>
          )}
        </div>

        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-5 md:tw-p-6">
          <h2 className="tw-text-sm tw-font-bold tw-text-slate-600 tw-uppercase tw-mb-3">Archivio Preventivo + Contratto</h2>
          {archivioContratti.length === 0 ? (
            <div className="tw-text-sm tw-text-slate-400">Nessun contratto generato.</div>
          ) : (
            <div className="tw-overflow-x-auto">
              <table className="tw-w-full tw-text-sm">
                <thead>
                  <tr className="tw-text-left tw-text-xs tw-text-slate-500 tw-uppercase tw-border-b">
                    <th className="tw-py-2 tw-pr-3">Paziente</th>
                    <th className="tw-py-2 tw-pr-3">Documento</th>
                    <th className="tw-py-2 tw-pr-3">Stato</th>
                    <th className="tw-py-2 tw-pr-3">Email</th>
                    <th className="tw-py-2">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {archivioContratti.map(r => {
                    const c = r.contrattoId && typeof r.contrattoId === 'object' ? r.contrattoId : undefined;
                    const nomeP = r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : '—';
                    return (
                      <tr key={r._id} className="tw-border-b tw-border-slate-100">
                        <td className="tw-py-2 tw-pr-3 tw-font-medium tw-text-slate-700">{nomeP}</td>
                        <td className="tw-py-2 tw-pr-3 tw-text-slate-500">{r.preventivoPdfFileName || c?.allegatoFileName || 'preventivo.pdf'}</td>
                        <td className="tw-py-2 tw-pr-3">
                          {c?.stato === 'firmato'
                            ? <span className="tw-text-green-700 tw-font-semibold">Firmato{c.dataFirma ? ` ${new Date(c.dataFirma).toLocaleDateString('it-IT')}` : ''}</span>
                            : <span className="tw-text-amber-600 tw-font-semibold">In attesa firma</span>}
                        </td>
                        <td className="tw-py-2 tw-pr-3 tw-text-slate-500">{c?.email || '—'}</td>
                        <td className="tw-py-2 tw-flex tw-gap-2 tw-flex-wrap">
                          {c && c.stato === 'firmato' && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => apriDocumentoFirmato(c._id, 'pdf', 'contratto firmato')}>
                                <Eye size={14} className="tw-inline" /> Contratto firmato
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => apriDocumentoFirmato(c._id, 'gdpr-firmato', 'GDPR firmato')}>
                                <Eye size={14} className="tw-inline" /> GDPR firmato
                              </Button>
                              {!r.fatturaId && (
                                <Button size="sm" onClick={() => fatturaContratto(c)}>
                                  <Receipt size={14} className="tw-inline" /> Fattura
                                </Button>
                              )}
                            </>
                          )}
                          {c && (
                            <Button size="sm" variant="secondary" onClick={() => scaricaPreventivoContratto(c)}>
                              <Download size={14} className="tw-inline" /> Preventivo
                            </Button>
                          )}
                          {c && c.stato !== 'firmato' && (
                            <Button size="sm" variant="secondary" onClick={() => inviaFirmaContratto(c)}>
                              <Mail size={14} className="tw-inline" /> Invia
                            </Button>
                          )}
                          {c && (
                            <Button size="sm" variant="secondary" className="tw-text-red-600" onClick={() => eliminaContratto(c)}>
                              <Trash2 size={14} className="tw-inline" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-5 md:tw-p-6">
          <h2 className="tw-text-sm tw-font-bold tw-text-slate-600 tw-uppercase tw-mb-3">Archivio GDPR Intermediazione</h2>
          {archivioGdpr.length === 0 ? (
            <div className="tw-text-sm tw-text-slate-400">Nessun consenso GDPR raccolto dall'intermediazione.</div>
          ) : (
            <div className="tw-overflow-x-auto">
              <table className="tw-w-full tw-text-sm">
                <thead>
                  <tr className="tw-text-left tw-text-xs tw-text-slate-500 tw-uppercase tw-border-b">
                    <th className="tw-py-2 tw-pr-3">Paziente</th>
                    <th className="tw-py-2 tw-pr-3">Firmatario</th>
                    <th className="tw-py-2 tw-pr-3">Data firma</th>
                    <th className="tw-py-2 tw-pr-3">Luogo</th>
                    <th className="tw-py-2 tw-pr-3">Versione</th>
                    <th className="tw-py-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {archivioGdpr.map(g => (
                    <tr key={g._id} className="tw-border-b tw-border-slate-100">
                      <td className="tw-py-2 tw-pr-3 tw-font-medium tw-text-slate-700">
                        {g.patient ? `${g.patient.firstName} ${g.patient.lastName}` : '—'}
                      </td>
                      <td className="tw-py-2 tw-pr-3">{`${g.nomeFirmatario || ''} ${g.cognomeFirmatario || ''}`.trim() || '—'}</td>
                      <td className="tw-py-2 tw-pr-3">{g.dataFirma ? new Date(g.dataFirma).toLocaleDateString('it-IT') : '—'}</td>
                      <td className="tw-py-2 tw-pr-3">{g.luogoFirma || '—'}</td>
                      <td className="tw-py-2 tw-pr-3">{g.versioneInformativa || '—'}</td>
                      <td className="tw-py-2">
                        {g.revocato
                          ? <span className="tw-text-red-600 tw-font-semibold">Revocato</span>
                          : <span className="tw-text-green-700 tw-font-semibold">Valido</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-5 md:tw-p-6">
          <h2 className="tw-text-sm tw-font-bold tw-text-slate-600 tw-uppercase tw-mb-1 tw-flex tw-items-center tw-gap-2">
            <Send size={16} /> Costi preventivi inviati senza paziente
          </h2>
          <p className="tw-text-xs tw-text-slate-400 tw-mb-3 tw-mt-0">
            Costi del simulatore inviati via WhatsApp o email senza creare il paziente: se il cliente accetta, qui ritrovi cosa gli era stato mandato.
          </p>
          {inviati.length === 0 ? (
            <div className="tw-text-sm tw-text-slate-400">Nessun costo inviato senza paziente.</div>
          ) : (
            <div className="tw-overflow-x-auto">
              <table className="tw-w-full tw-text-sm">
                <thead>
                  <tr className="tw-text-left tw-text-xs tw-text-slate-500 tw-uppercase tw-border-b">
                    <th className="tw-py-2 tw-pr-3">Data</th>
                    <th className="tw-py-2 tw-pr-3">Cliente</th>
                    <th className="tw-py-2 tw-pr-3">Contatto</th>
                    <th className="tw-py-2 tw-pr-3">Canale</th>
                    <th className="tw-py-2 tw-pr-3">Riepilogo</th>
                    <th className="tw-py-2 tw-pr-3 tw-text-right">Totale/mese</th>
                    <th className="tw-py-2">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {inviati.map(inv => {
                    const sim = inv.simulazione?.risultato;
                    return (
                      <tr key={inv._id} className="tw-border-b tw-border-slate-100">
                        <td className="tw-py-2 tw-pr-3 tw-whitespace-nowrap tw-text-slate-600">
                          {new Date(inv.createdAt).toLocaleDateString('it-IT')}
                          {inv.inviatoDa && <div className="tw-text-[11px] tw-text-slate-400">da {inv.inviatoDa}</div>}
                        </td>
                        <td className="tw-py-2 tw-pr-3 tw-font-medium tw-text-slate-700">{inv.nomeCliente || '—'}</td>
                        <td className="tw-py-2 tw-pr-3 tw-text-slate-500 tw-text-xs">
                          {inv.email && <div>✉️ {inv.email}</div>}
                          {inv.telefono && <div>📞 {inv.telefono}</div>}
                          {!inv.email && !inv.telefono && '—'}
                        </td>
                        <td className="tw-py-2 tw-pr-3">
                          <span className={`tw-inline-block tw-px-2 tw-py-0.5 tw-rounded-full tw-text-[11px] tw-font-bold ${inv.canale === 'whatsapp' ? 'tw-bg-green-100 tw-text-green-700' : 'tw-bg-blue-100 tw-text-blue-700'}`}>
                            {inv.canale === 'whatsapp' ? '💬 WhatsApp' : '✉️ Email'}
                          </span>
                        </td>
                        <td className="tw-py-2 tw-pr-3 tw-text-slate-500 tw-text-xs">
                          {sim ? `${sim.contrattoLabel || ''} — ${sim.livelloLabel || ''}${sim.oreSettimanali ? `, ${sim.oreSettimanali}h/sett` : ''}` : '—'}
                          {inv.simulazione?.escludiTfrTredicesima && <div className="tw-text-[11px] tw-text-slate-400">TFR/13ª esclusi{inv.simulazione.cafMensile !== undefined ? ` · CAF ${euro(inv.simulazione.cafMensile)}` : ''}</div>}
                        </td>
                        <td className="tw-py-2 tw-pr-3 tw-text-right tw-font-bold tw-text-emerald-700">{inv.totale !== undefined ? euro(inv.totale) : '—'}</td>
                        <td className="tw-py-2 tw-flex tw-gap-2 tw-flex-wrap">
                          <Button size="sm" variant="secondary" onClick={() => pdfInviato(inv, true)}>
                            <Eye size={14} className="tw-inline" /> PDF
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => pdfInviato(inv, false)}>
                            <Download size={14} className="tw-inline" />
                          </Button>
                          {user?.role === 'admin' && (
                            <Button size="sm" variant="secondary" className="tw-text-red-600" onClick={() => eliminaInviato(inv)}>
                              <Trash2 size={14} className="tw-inline" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
