/**
 * Utility per formattare dati in formato compatibile SIAT Regione Lazio
 * 
 * NOTA: Questi formati sono basati su standard HL7/CDA e pratiche comuni
 * per sistemi sanitari regionali. Verificare sempre con la documentazione
 * ufficiale della Regione Lazio prima dell'invio effettivo.
 */

/**
 * Genera CSV compatibile con importazione SIAT
 * Formato standard per import dati anagrafici e assistenziali
 */
export const buildCSV = (patient: any, workPlan: any, diario: any[]): string => {
  const now = new Date().toISOString();
  
  // Header CSV
  const headers = [
    'TIPO_RECORD',
    'CODICE_FISCALE',
    'COGNOME',
    'NOME',
    'DATA_NASCITA',
    'INDIRIZZO',
    'TELEFONO',
    'TIPO_PRESA_CARICO',
    'DATA_INIZIO',
    'DATA_FINE',
    'STATO_PRATICA',
    'NECESSITA_ASSISTENZIALI',
    'OPERATORE_REFERENTE',
    'ULTIMO_ACCESSO_DATA',
    'ULTIMO_ACCESSO_OPERATORE',
    'NUMERO_ACCESSI',
    'DATA_EXPORT',
    'NOTE'
  ].join(';');

  // Record principale
  const lastAccess = diario && diario.length > 0 ? diario[0] : null;
  
  const record = [
    'PAZIENTE',                                    // TIPO_RECORD
    patient.codiceFiscale || '',                   // CODICE_FISCALE
    patient.lastName || '',                        // COGNOME
    patient.firstName || '',                       // NOME
    patient.birthDate ? new Date(patient.birthDate).toISOString().split('T')[0] : '', // DATA_NASCITA
    patient.address || '',                         // INDIRIZZO
    patient.contactPhone || '',                    // TELEFONO
    workPlan ? 'CURE_DOMICILIARI' : 'NON_ASSEGNATO', // TIPO_PRESA_CARICO
    workPlan?.date ? new Date(workPlan.date).toISOString().split('T')[0] : '',
    workPlan?.dataFine ? new Date(workPlan.dataFine).toISOString().split('T')[0] : '',
    workPlan?.status === 'completed' ? 'CHIUSA' : workPlan?.status === 'pending' ? 'ATTIVA' : 'SOSPESA',
    (patient.assistanceNeeds || workPlan?.task || '').replace(/\n/g, ' ').substring(0, 250),
    workPlan?.staff ? (typeof workPlan.staff === 'string' ? workPlan.staff : `${(workPlan.staff as any).firstName} ${(workPlan.staff as any).lastName}`) : '',
    lastAccess?.dataRegistrazione ? new Date(lastAccess.dataRegistrazione).toISOString().split('T')[0] : '',
    lastAccess?.staffName || '',
    diario?.length || 0,
    now.split('T')[0],
    `Export generato da App Abbraccio - ${now}`
  ].map(field => {
    // Escape campi con virgole o punti e virgola
    const str = String(field || '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(';');

  // Record dettaglio accessi (se presenti)
  const accessiRecords = diario?.map((entry, index) => [
    'ACCESSO',
    patient.codiceFiscale || '',
    `ACCESSO_${index + 1}`,
    entry.staffName || '',
    entry.dataRegistrazione ? new Date(entry.dataRegistrazione).toISOString().split('T')[0] : '',
    (entry.testo || '').replace(/\n/g, ' ').substring(0, 200),
    entry.firmato ? 'FIRMATO' : 'BOZZA',
    entry.parametriVitali ? JSON.stringify(entry.parametriVitali) : '',
    '', '', '', '', '', '', '', '', '', '', ''
  ].join(';')).join('\n') || '';

  return `${headers}\n${record}\n${accessiRecords}`;
};

/**
 * Genera CDA2 (Clinical Document Architecture) semplificato
 * Formato standard internazionale per documenti clinici
 * 
 * NOTA: Questo è un template semplificato. Per invio effettivo al FSE/SIAT
 * è necessario conformarsi agli specifici template regionali (es. Referto di Cura)
 */
export const buildCDA2 = (patient: any, workPlan: any, diario: any[]): string => {
  const docId = `APP_ABBRACCIO_${patient._id}_${Date.now()}`;
  const now = new Date().toISOString();
  const lastDiario = diario && diario.length > 0 ? diario[0] : null;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:hl7-org:v3 CDA.xsd">
  <realmCode code="IT"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  
  <!-- Identificativo documento -->
  <id root="2.16.840.1.113883.2.9.2.120" extension="${docId}"/>
  
  <!-- Codice documento: Referto di cure domiciliari -->
  <code code="68615-6" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Cure domiciliari"/>
  
  <title>Referto Cure Domiciliari - ${patient.lastName} ${patient.firstName}</title>
  <effectiveTime value="${now.replace(/[-:T.Z]/g, '').slice(0, 14)}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="it-IT"/>
  
  <!-- Paziente -->
  <recordTarget>
    <patientRole>
      <id root="2.16.840.1.113883.2.9.4.3.2" extension="${patient.codiceFiscale || 'CF_NON_DISPONIBILE'}"/>
      <addr>
        <streetAddressLine>${patient.address || 'Indirizzo non disponibile'}</streetAddressLine>
      </addr>
      <telecom value="tel:${patient.contactPhone || ''}"/>
      <patient>
        <name>
          <family>${patient.lastName}</family>
          <given>${patient.firstName}</given>
        </name>
        <administrativeGenderCode code="${patient.gender === 'M' ? 'M' : patient.gender === 'F' ? 'F' : 'UN'}" codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="${patient.birthDate ? patient.birthDate.toISOString().split('T')[0].replace(/-/g, '') : ''}"/>
      </patient>
    </patientRole>
  </recordTarget>
  
  <!-- Autore (operatore/ struttura) -->
  <author>
    <time value="${now.replace(/[-:T.Z]/g, '').slice(0, 14)}"/>
    <assignedAuthor>
      <id root="2.16.840.1.113883.2.9.4.3.2" extension="STRUTTURA_ACCORDATA"/>
      <assignedPerson>
        <name>
          <family>ABBRACCIO CURE DOMICILIARI</family>
          <given>Struttura Accreditata</given>
        </name>
      </assignedPerson>
      <representedOrganization>
        <name>ABBRACCIO CURE DOMICILIARI</name>
        <addr>
          <streetAddressLine>Via di Santa Maria Ausiliatrice 4B</streetAddressLine>
          <city>Roma</city>
          <postalCode>00181</postalCode>
        </addr>
      </representedOrganization>
    </assignedAuthor>
  </author>
  
  <!-- Custoditore documento -->
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <name>ABBRACCIO CURE DOMICILIARI</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>
  
  <!-- Componente principale -->
  <component>
    <structuredBody>
      
      <!-- Sezione: Necessità assistenziali -->
      <component>
        <section>
          <code code="10158-8" codeSystem="2.16.840.1.113883.6.1" displayName="Necessità assistenziali"/>
          <title>Necessità Assistenziali</title>
          <text>
            <paragraph>${(patient.assistanceNeeds || workPlan?.needs || 'Necessità non specificate').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</paragraph>
          </text>
        </section>
      </component>
      
      <!-- Sezione: Piano di cure -->
      <component>
        <section>
          <code code="18776-5" codeSystem="2.16.840.1.113883.6.1" displayName="Piano di trattamento"/>
          <title>Piano di Cure Domiciliari</title>
          <text>
            <table>
              <thead>
                <tr>
                  <th>Data Inizio</th>
                  <th>Stato</th>
                  <th>Operatore Referente</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${workPlan?.date ? new Date(workPlan.date).toLocaleDateString('it-IT') : 'N/D'}</td>
                  <td>${workPlan?.status === 'completed' ? 'Completato' : workPlan?.status === 'pending' ? 'Attivo' : 'Sospeso'}</td>
                  <td>${workPlan?.staff ? (typeof workPlan.staff === 'string' ? 'Operatore ID: ' + workPlan.staff : `${(workPlan.staff as any).firstName} ${(workPlan.staff as any).lastName}`) : 'Non assegnato'}</td>
                </tr>
              </tbody>
            </table>
          </text>
        </section>
      </component>
      
      <!-- Sezione: Diario Clinico (ultimi 5 accessi) -->
      <component>
        <section>
          <code code="51845-8" codeSystem="2.16.840.1.113883.6.1" displayName="Referto di visita"/>
          <title>Ultimi Accessi Domiciliari</title>
          <text>
            ${diario && diario.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Operatore</th>
                  <th>Note</th>
                  <th>Firma</th>
                </tr>
              </thead>
              <tbody>
                ${diario.slice(0, 5).map(d => `
                <tr>
                  <td>${new Date(d.dataRegistrazione).toLocaleDateString('it-IT')}</td>
                  <td>${d.staffName || 'N/D'}</td>
                  <td>${(d.testo || 'Nessuna nota').substring(0, 100).replace(/</g, '&lt;').replace(/>/g, '&gt;')}...</td>
                  <td>${d.firmato ? 'Firmato digitalmente' : 'Bozza'}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            ` : '<paragraph>Nessun accesso registrato</paragraph>'}
          </text>
        </section>
      </component>
      
      <!-- Sezione: Parametri vitali (ultimi) -->
      ${lastDiario?.parametriVitali ? `
      <component>
        <section>
          <code code=" vital-signs-section" codeSystem="loinc"/>
          <title>Parametri Vitali - Ultimo Rilevamento</title>
          <text>
            <list>
              ${lastDiario.parametriVitali.pressioneSistolica ? `<item>Pressione: ${lastDiario.parametriVitali.pressioneSistolica}/${lastDiario.parametriVitali.pressioneDiastolica} mmHg</item>` : ''}
              ${lastDiario.parametriVitali.frequenzaCardiaca ? `<item>FC: ${lastDiario.parametriVitali.frequenzaCardiaca} bpm</item>` : ''}
              ${lastDiario.parametriVitali.temperatura ? `<item>Temperatura: ${lastDiario.parametriVitali.temperatura}°C</item>` : ''}
              ${lastDiario.parametriVitali.saturazione ? `<item>SatO2: ${lastDiario.parametriVitali.saturazione}%</item>` : ''}
              ${lastDiario.parametriVitali.glicemia ? `<item>Glicemia: ${lastDiario.parametriVitali.glicemia} mg/dL</item>` : ''}
            </list>
          </text>
        </section>
      </component>
      ` : ''}
      
    </structuredBody>
  </component>
  
</ClinicalDocument>`;

  return xml;
};

/**
 * Validazione base formato codice fiscale
 */
export const isValidCodiceFiscale = (cf: string): boolean => {
  if (!cf || cf.length !== 16) return false;
  
  // Pattern base: 3 lettere + 3 lettere + 2 numeri + 1 lettera + 2 numeri + 1 lettera + 3 numeri + 1 lettera
  const pattern = /^[A-Z]{3}[A-Z]{3}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i;
  return pattern.test(cf);
};

/**
 * Sanitizza stringhe per CSV/XML
 */
export const sanitizeForExport = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};
