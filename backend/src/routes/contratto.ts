import { Router, Response, Request } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Testo completo del contratto (versione attuale)
const TESTO_CONTRATTO = `CONTRATTO PROFESSIONISTI
Contratto di prestazione d'opera intellettuale ai sensi degli artt. 2229 e ss. C.C.
ABBRACCIO CURE DOMICILIARI con sede in Via di S.Maria Ausiliatrice 4B, 00181 (Roma), iscritta con codice fiscale e partita IVA n° 18316251000 , rappresentata dal proprio amministratore Delegato Simona Schembri. PEC abbracciocuredomiciliari@facilepec.com.
e
Il Dr. ___________________________________nato a _____________ il ______________, codice fiscale ___________________-e partita Iva  n° ________________________residente a ______________. PEC Professionale ___________________________________. 

Premesse:
- La Società opera nell'ambito dell'home care e dei servizi di assistenza sanitaria domiciliare integrata (di seguito "ADI" o Privata) e per la propria attività necessita di disporre di professionisti capaci, dotati di autonomia e professionalmente competenti e preparati;
- Il Professionista è in possesso dei necessari titoli per svolgere la professione di ____________________  ed è iscritto all'albo professionale dell'Ordine di ______________ numero tessera iscrizione ____________________________;.
- Il Professionista è titolare di Partita Iva  con regime fiscale ed opera abitualmente in favore di una pluralità di clienti;
- Il Professionista, a sua volta, intende fornire alla Società la propria opera intellettuale, purché in modo tale da mantenere la piena autonomia operativa e organizzativa di tempo e luoghi e da assicurargli il diritto di poter esercitare l'attività professionale anche in favore di clienti ulteriori e diversi dalla Società;
- Le Parti, con la sottoscrizione del presente contratto, intendono disciplinare, con reciproca, espressa e libera volontà, le prestazioni professionali rese dal Professionista, concordando insieme le modalità organizzative, in favore della Società;
- Le Parti sin da ora dichiarano di non essere in conflitto di interesse note con soggetti terzi di qualsivoglia natura, ovvero di incompatibilità normativa rispetto alla sottoscrizione del presente contratto o alla esecuzione degli impegni in esso contenuti;
- Alcuni dei contenuti del presente accordo sono più compiutamente descritti negli Allegati, da considerarsi parte integrante dell'accordo stesso.

Tutto ciò premesso, le parti convengono quanto segue.

1. Oggetto
1.1. Oggetto della prestazione d'opera intellettuale è l'esecuzione, esclusivamente personale e sotto la propria direzione e responsabilità, di attività professionale in ambito socio sanitario e più specificamente nell'ambito dell'assistenza domiciliare, consistente nello svolgimento dei seguenti incarichi (di seguito gli "Incarichi"): ________________ DOMICILIARE che la Società affida al Professionista e il Professionista accetta.
1.2. Il Professionista si impegna ad eseguire, a favore della Società in piena autonomia e senza vincoli di subordinazione, senza esclusiva e senza obbligo di non concorrenza, a regola d'arte e con il livello di professionalità e conformemente a tutti gli altri termini e condizioni di cui al presente contratto (di seguito il "Contratto"), le prestazioni professionali di lavoro autonomo in ambito socio sanitario e più specificamente nell'ambito dell'assistenza domiciliare all'interno della Regione LAZIO (il "Territorio"), tutte di seguito indicate in questo art. 1, nel periodo di vigenza contrattuale così como meglio specificato dall'art. 5.1.
1.3. Il Professionista dichiara che gli Incarichi verranno svolti direttamente, con organizzazione e mezzi propri come indicato in Allegato F, nel rispetto degli obblighi di diligenza professionale e in ottemperanza al programma sanitario relativo ai Piani di Assistenza, dei singoli assistiti.
1.4. Il Professionista si impegna a rispettare le disposizioni contenute nel Codice Etico aziendale, di cui dichiara di aver preso visione, delle policy e delle procedure della Società che gli verranno fornite. In caso di comportamento del Professionista gravemente contrario a tali disposizioni, la Società si riserva ogni diritto/azione in merito, ivi inclusa l'eventuale risoluzione del presente Contratto.
1.5. Il Professionista si impegna quindi a coordinarsi con la Società, adottando ogni misura che si renda necessaria e/o opportuna per il corretto svolgimento degli Incarichi. I locali che saranno utilizzabili e utili per lo svolgimento degli Incarichi saranno fruibili dal Professionista nei giorni e negli orari concordati tra le Parti, previa fissazione degli appuntamenti alla luce delle disponibilità indicate dal Professionista.
1.6. Il rapporto nascente dal Contratto è regolato dalle norme sull'esercizio delle professioni intellettuali di cui agli artt. 2229 e ss. c.c. Pertanto, nessuno degli obblighi inerenti il rapporto di lavoro subordinato e/o parasubordinato potrà applicarsi al Professionista, il quale espleterà gli Incarichi con massima autonomia organizzativa, indipendenza di giudizio, iniziativa all'azione e discrezionalità di scelta e senza vincoli di subordinazione.

2. Modalità di esecuzione degli Incarichi
2.1. Il Professionista si impegna a rispettare le date e gli orari di disponibilità da lui indicati alla Società e comunicati con congruo anticipo a quest'ultima (almeno 20 gg lavorativi) per permettere alla Società di assegnare i pazienti alle sue prestazioni. Qualora il Professionista fosse impossibilitato a erogare gli Incarichi alle ore e/o date indicate dovrà tempestivamente comunicare alla Società l'impedimento per permettere agli Assistiti le cure necessarie.
2.2. Ogni Incarico potrà essere revocato o temporaneamente sospeso in qualsiasi momento tramite comunicazione scritta, inviata almeno 24 ore prima della data di esecuzione dell'Incarico, anche via email o sms, da parte della Società, con specificazione della motivazione. Nelle ipotesi di revoca o sospensione, il Professionista non percepirà alcun compenso per gli incarichi tempestivamente revocati o sospesi, né avrà diritto ad alcun risarcimento danni.
2.3. Ai fini di una migliore rendicontazione delle attività, al Professionista è richiesto di utilizzare le piattaforme informatiche aziendali per: (i) la tenuta della cartella clinica; (ii) per la gestione dei materiali e (iii) la registrazione degli accessi al domicilio degli Assistiti.
2.4. La presente clausola è essenziale per la Società ed il mancato adempimento della stessa da parte del Professionista facoltizzerà la Società a non pagare il corrispettivo delle attività non correttamente e tempestivamente rendicontate tramite le proprie piattaforme informatiche.

3. Corrispettivo e Pagamenti
3.1. Il corrispettivo richiesto dal Professionista e accettato dalla Società è riportato nel piano di assegnazione lavoro.
3.2. Il Corrispettivo è stato determinato dal Professionista che si impegna a predisporre un rendiconto degli Incarichi prestati utilizzando le piattaforme informatiche aziendali. La Società, a riguardo, si riserva il diritto di effettuare gli opportuni controlli e rilevamenti sullo svolgimento degli Incarichi.
3.3. Il Corrispettivo ha natura onnicomprensiva e, pertanto, comprende ogni attività ancillare utile allo svolgimento degli Incarichi nonché l'utilizzo da parte del Professionista degli strumenti per l'esecuzione degli Incarichi.
3.4. La Società eseguirà i pagamenti in favore del Professionista entro 30 giorni dalla emissione della fattura data fine mese mediante bonifico bancario alle coordinate bancarie indicate dal Professionista.

4. Dichiarazioni, requisiti professionali richiesti e obbligazioni ulteriori delle Parti
4.1. Il Professionista dichiara di essere in possesso dei requisiti professionali e di salute necessari ai fini dello svolgimento degli Incarichi e consegna alla Società la documentazione. Il Professionista altresì dichiara di avver provveduto con regolarità al proprio aggiornamento professionale e di versare in una situazione conforme agli obblighi derivanti dalla normativa corrente in materia di crediti formativi.
4.2. Il collaboratore si impegna a partecipare e a superare positivamente tutti gli eventuali corsi di formazione predisposti dalla Società che la disciplina di Accreditamento dovesse richiedere obbligatoriamente per il mantenimento dei requisiti del personale sanitario impiegato nelle assistenze. Al fine di facilitare la fruizione dei corsi di formazione richiesti dalla normativa, la Società potrà – a sua totale discrezione, anche a titolo gratuito – proporre convenzioni con Enti terzi di formazione certificati o mettere a disposizione del collaboratore anche le proprie piattaforme per la formazione da remoto. Il mancato superamento dei corsi obbligatori costituirà giusta causa di recesso dal contratto da parte della Società.
4.3. Il Professionista si obbliga a garantire, per la Durata del Contratto, il mantenimento dei requisiti professionali nonché ad aggiornare la Documentazione. 
4.4. Il Professionista si impegna a rispettare le disposizioni fiscali, previdenziali, assistenziali, sulla tracciabilità dei flussi finanziari (L n. 136/2010), di salute e sicurezza sul lavoro e igienico-sanitarie (D.lgs. n. 81/2008), soprattutto per quanto riguarda i dispositivi di protezione individuale e l'esibizione della tessera di riconoscimento, esonerando espressamente la Società da ogni responsabilità attinente il rispetto di tali disposizioni.
4.5. Nell'esecuzione degli Incarichi, all'esclusivo fine di garantire la migliore soddisfazione possibile delle esigenze degli Assistiti, il Professionista potrà confrontarsi con gli altri professionisti interessati, quali: il Direttore Sanitario; il Coordinatore Infermieristico o il Coordinatore Riabilitativo, Coordinatore Medico.
4.6. Il Professionista si impegna a comunicare al DS o Coord. eventuali criticità rilevate nello svolgimento degli Incarichi.
4.7. Fermo restando quanto previsto dall'art. 1.3, la Società si impegna a fornire al Professionista le informazioni, la documentazione, i mezzi, il supporto e gli strumenti in suo possesso necessari per lo svolgimento degli Incarichi.
4.8. L'operatore è tenuto a fare richiesta dei Dispositivi di Protezione Individuale attraverso i software aziendali dedicati.
4.9. Il Professionista dichiara di aver visionato tutto quanto innanzi indicato e di averlo considerato di qualità idonea e pertinente al corretto svolgimento della propria opera professionale.

5. Durata degli Incarichi e Recesso
5.1. Gli Incarichi avranno la durata dal __________________ al ________________ con rinnovo tacito annuale, salvo disdetta da una delle Parti a mezzo raccomandata A/R o PEC indicati in intestazione almeno 30 giorni prima della data di scadenza dell'Incarico.
5.2. Ciascuna Parte potrà recedere in qualsiasi momento dal Contratto mediante comunicazione a mezzo raccomandata A/R o PEC con un preavviso minimo di 30 giorni. In tale ipotesi nulla sarà dovuto alla parte passiva, salvo quanto maturato in ragione dell'attività svolta e che risulti non ancora liquidato.

6. Clausola risolutiva espressa
6.1. Ai sensi dell'art. 1456 c.c., il presente contratto si risolverà di diritto in caso di violazione degli obblighi previsti dagli articoli: 1.1, 2.3, 2.4, 3.2, 4.2, 4.4., 4.5, 4.6, 4.7, 4.8, 4.9, 7.1, 11.2; nonché nel caso in cui il Professionista non esegua, o esegua in ritardo, almeno 2 Incarichi senza adeguata motivazione, o qualora le dichiarazioni rese e i Documenti forniti si rivelino falsi e/o incompleti.
6.2. Il Contratto si risolverà senza necessità di alcuna comunicazione da parte della Società qualora il Professionista si renda gravemente inadempiente ledendo il rapporto fiduciario, sia rinviato a giudizio o condannato per determinati reati penali contro i minori, o perda i requisiti professionali previsti per legge per l'esercizio dell'attività.

7. Riservatezza
7.1. In considerazione del carattere fiduciario della prestazione, il Professionista si impegna ad osservare il più scrupoloso riserbo e segreto professionale su tutte le informazioni, tecnologie, programmi o dati relativi ai pazienti di pertinenza della Società o di società controllate/collegate o di terzi.

8. Trattamento dati personali
8.1. Il trattamento dei dati personali sarà effettuato ai sensi del GDPR (Regolamento UE 2016/679) e delle norme nazionali vigenti. Ciascuna parte dichiara di aver ricevuto idonea informativa. Il Professionista si impegna a sottoscrivere ed a rispettare il separato "Atto di nomina a Responsabile esterno" predisposto dal Titolare ai sensi dell'art. 28 del GDPR.

9. Geolocalizzazione
9.1. Le parti predisporranno un sistema elettronico di localizzazione geografica della posizione fruibile attraverso strumenti di mobilità utilizzati dai Prestatori, diretto a perseguire il legittimo interesse delle parti per necessità organizzative, produttive e di tutela del patrimonio aziendale. L'inadempimento legittimerà la risoluzione immediata del contratto ai sensi dell'art. 1456 c.c.

10. Responsabilità, manleve, risarcimento e penale
10.1. Il Professionista si impegna a svolgere le attività sotto la propria personale ed esclusiva responsabilità. Il Professionista si impegna formalmente a esonerare e tenere manlevata e indenne la Società da ogni responsabilità conseguente a fatti propri nei confronti degli Assistiti, fino a un massimo di € 1.000.000,00, fermo restando che la Società risponderà di eventuali danni derivanti da fatto proprio tramite la propria copertura assicurativa.
10.2. Il Professionista dichiara di provvedere regolarmente alla sottoscrizione di una polizza assicurativa contro i rischi professionali. 

11. Legge applicabile e Foro competente
11.1. Il presente contratto è regolato dalle disposizioni della Legge italiana. Per ogni controversia unico competente sarà il Foro di Roma, con espressa esclusione di qualsiasi altro Foro.

Letto, confermato e sottoscritto in __________________ il ______________.

Società S.r.l.                                                                                                       Il Professionista

ALLEGATO - DICHIARAZIONE AI SENSI DEL D.P.R. 445 DEL 28.12.2000
Il/La sottoscritto/a _________________________ nato/a a _________________ residente a ____________________ in _____________________________.
- Consapevole delle sanzioni penali richiamate dall'art. 76 del D.P.R. n. 445 del 28 dicembre 2000
DICHIARA
- di non trovarsi nelle condizioni di incompatibilità previste dalle norme vigenti per il personale del Servizio Sanitario Nazionale;
- di non aver alcun rapporto di lavoro che impedisca la coesistenza di rapporti con la Società a cui la presente è indirizzata.
Letto, confermato e sottoscritto in _______________ il __________________. 
                                                                                                                    
                                                                                                         Il Professionista

ALLEGATO - DICHIARAZIONE SOSTITUTIVA DI CERTIFICAZIONE
Il/La sottoscritto/a [OMISSIS] nato/a a [OMISSIS] il residente in [OMISSIS] in 
DICHIARA
- Di non aver riportato a suo carico condanne per taluno dei reati penali specificati nel testo principale relativi alla tutela dei minori.
Sottoscritto in _______________ il __________________.

                                                                                                           Il Professionista

ALLEGATO - MEZZI PROPRI
- Casella di posta elettronica certificata professionale privata
- Telefono mobile per reperibilità nr: 
- Autoveicoli: 
Il professionista attesta e garantisce alla Società che i mezzi sono idonei, funzionanti e in regola con il codice della strada.
Sottoscritto in _____________________ il _______________________.

                                                                                                               Il Professionista`;

// GET /api/contratto/testo - Restituisce il testo completo del contratto (pubblico)
router.get('/testo', (req: Request, res: Response) => {
  return res.json({ testo: TESTO_CONTRATTO });
});

// GET /api/contratto/pdf/:userId - Genera PDF del contratto firmato per un operatore (admin/coordinator)
router.get('/pdf/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const requester = req.user as { userId: string; role: string };
    if (!requester || (requester.role !== 'admin' && requester.role !== 'coordinator')) {
      return res.status(403).json({ message: 'Non autorizzato' });
    }

    const User = require('../models/User');
    const Staff = require('../models/Staff');

    const user = await User.findById(req.params.userId).select('-password');
    if (!user || !user.firmaContratto) {
      return res.status(404).json({ message: 'Contratto non trovato o non firmato' });
    }

    const staff = await Staff.findOne({ user: user._id });
    
    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Contratto Professionale - ${user.name}</title>
    <style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:25px;max-width:850px;line-height:1.4}
    h1{font-size:18px;color:#1e4d8c;margin-bottom:4px;text-align:center}
    h2{font-size:10px;color:#6b7280;text-align:center;margin:0 0 20px;text-transform:uppercase;letter-spacing:1px}
    .pre{white-space:pre-wrap;font-family:Arial,sans-serif;font-size:11px;line-height:1.4}
    .firma-section{margin-top:30px;border-top:2px solid #1e4d8c;padding-top:20px}
    .firma-box{display:inline-block;vertical-align:top;margin-right:60px}
    .firma-box img{max-width:200px;max-height:70px;border:1px solid #d1d5db;margin-top:8px}
    .field{margin-bottom:8px}
    .field label{font-weight:700;display:inline-block;width:120px}
    .footer{margin-top:30px;font-size:9px;color:#9ca3af;border-top:1px solid #e2e8f0;padding-top:10px;text-align:center}
    @media print{body{margin:15px} .no-print{display:none}}</style></head><body>
    <h1>CONTRATTO PROFESSIONISTI</h1>
    <h2>Contratto di prestazione d'opera intellettuale ai sensi degli artt. 2229 e ss. C.C.</h2>
    <div class="pre">${TESTO_CONTRATTO
      .replace(/Il Dr\. ___________________________________nato a _____________ il ______________, codice fiscale ___________________-e partita Iva  n° ________________________residente a ______________\. PEC Professionale ___________________________________\./, 
        `Il Dr. ${user.name || '_________________'} nato a ${staff?.luogoNascita || '___________'} il ${staff?.dataNascita || '____________'}, codice fiscale ${staff?.codiceFiscale || '_________________'}-e partita Iva  n° ${staff?.partitaIva || '______________________'}residente a ${staff?.indirizzoResidenza || '____________'}. PEC Professionale ${staff?.pec || '_________________________________'}.`)
      .replace(/di ____________________  ed è iscritto all'albo professionale dell'Ordine di ______________ numero tessera iscrizione ____________________________\;/, 
        `di ${staff?.professione || '__________________'} ed è iscritto all'albo professionale dell'Ordine di ${staff?.ordineAlbo || '____________'} numero tessera iscrizione ${staff?.numeroAlbo || '__________________________'};`)
      .replace(/____________________ DOMICILIARE/, `${staff?.professione || '____________________'} DOMICILIARE`)
      .replace(/dal __________________ al ________________/, `dal ${new Date().toLocaleDateString('it-IT')} al ${new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('it-IT')}`)
      .replace(/Letto, confermato e sottoscritto in __________________ il ______________\./, `Letto, confermato e sottoscritto in ${user.luogoFirmaContratto || '________________'} il ${new Date(user.dataFirmaContratto || Date.now()).toLocaleDateString('it-IT')}.`)
      .replace(/Il\/La sottoscritto\/a _________________________ nato\/a a _________________ residente a ____________________ in _____________________________\./, 
        `Il/La sottoscritto/a ${user.name || '_________________________'} nato/a a ${staff?.luogoNascita || '_______________'} residente a ${staff?.indirizzoResidenza || '__________________'} in ${staff?.indirizzoResidenza || '_________________________'}.`)
      .replace(/Il\/La sottoscritto\/a \[OMISSIS\] nato\/a \[OMISSIS\] il residente in \[OMISSIS\] in/, `Il/La sottoscritto/a ${user.name || '_________________________'} nato/a a ${staff?.luogoNascita || '[OMISSIS]'} il ${staff?.dataNascita || '[OMISSIS]'} residente in ${staff?.indirizzoResidenza || '[OMISSIS]'} in`)
      .replace(/- Casella di posta elettronica certificata professionale privata\n- Telefono mobile per reperibilità nr: \n- Autoveicoli:/, 
        `- Casella di posta elettronica certificata professionale privata: ${staff?.pec || '_________________________'}\n- Telefono mobile per reperibilità nr: ${staff?.telefono || '_________________________'}\n- Autoveicoli: ${staff?.autoveicoli || '_________________________'}`)
      .replace(/Sottoscritto in _______________ il __________________\./g, `Sottoscritto in ${user.luogoFirmaContratto || '_____________'} il ${new Date(user.dataFirmaContratto || Date.now()).toLocaleDateString('it-IT')}.`)
    }</div>
    <div class="firma-section">
      <div class="firma-box">
        <div class="field"><label>Società:</label> ABBRACCIO CURE DOMICILIARI S.r.l.</div>
        <div class="field"><label>Data firma:</label> ${new Date(user.dataFirmaContratto || Date.now()).toLocaleDateString('it-IT')}</div>
        <div class="field"><label>Luogo firma:</label> ${user.luogoFirmaContratto || 'Roma'}</div>
      </div>
      <div class="firma-box">
        <div class="field"><label>Professionista:</label> ${user.name}</div>
        <div class="field"><label>Data firma:</label> ${new Date(user.dataFirmaContratto || Date.now()).toLocaleDateString('it-IT')}</div>
        <div class="field"><label>Luogo firma:</label> ${user.luogoFirmaContratto || 'Roma'}</div>
        ${user.firmaContratto ? `<img src="${user.firmaContratto}" alt="Firma operatore" />` : '<p>Firma non disponibile</p>'}
      </div>
    </div>
    <div class="footer">Documento generato — App Abbraccio Cure Domiciliari — ${new Date().toLocaleString('it-IT')}</div>
    <div class="no-print" style="margin-top:24px;text-align:center"><button onclick="window.print()" style="background:#1e4d8c;color:white;border:none;border-radius:8px;padding:12px 28px;font-size:14px;cursor:pointer;font-weight:700">🖨️ Stampa / Salva PDF</button></div>
    </body></html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err: any) {
    return res.status(500).json({ message: 'Errore generazione PDF', error: err?.message });
  }
});

export default router;
