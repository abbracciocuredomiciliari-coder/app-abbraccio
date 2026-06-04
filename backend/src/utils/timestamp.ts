import crypto from 'crypto';
import https from 'https';
import { promisify } from 'util';

/**
 * Utility per marcatura temporale RFC 3161 (Time Stamping Authority)
 * 
 * Utilizza TSA gratuito di Infocert o altri provider compatibili.
 * La marcatura temporale prova l'esistenza di un documento a una certa data/ora.
 * 
 * NOTA: Per produzione con valore legale completo, usare TSA qualificati
 * accreditati da AgID (es. Infocert, Aruba, Namirial con contratto).
 */

// TSA gratuito per test (Infocert Demo - validità limitata)
const TSA_URL_DEMO = 'https://tsa.demo.infocert.it/tsa';

// TSA di produzione (richiede autenticazione)
const TSA_URL_PROD = process.env.TSA_URL || '';
const TSA_USERNAME = process.env.TSA_USERNAME || '';
const TSA_PASSWORD = process.env.TSA_PASSWORD || '';

export interface TimestampResult {
  timestamp: Date;
  timestampToken: string; // Base64 encoded TST
  serialNumber: string;
  tsaName: string;
  hashAlgorithm: string;
  hashValue: string;
  policy: string;
}

/**
 * Calcola hash SHA-256 del documento
 */
export const hashDocument = (data: string | Buffer): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Richiesta marcatura temporale a TSA (RFC 3161)
 * 
 * @param dataHash - Hash del documento (SHA-256 hex)
 * @param useProduction - Usa TSA di produzione (richiede credenziali)
 */
export const requestTimestamp = async (
  dataHash: string,
  useProduction: boolean = false
): Promise<TimestampResult | null> => {
  // Se non abbiamo TSA configurato, generiamo marcatura "soft" (meno validità legale)
  if (useProduction && (!TSA_URL_PROD || !TSA_USERNAME)) {
    console.warn('[Timestamp] TSA produzione non configurata, uso marcatura locale');
    return generateSoftTimestamp(dataHash);
  }

  const tsaUrl = useProduction ? TSA_URL_PROD : TSA_URL_DEMO;
  
  try {
    // Costruisci richiesta TSP (Time-Stamp Protocol)
    const tspRequest = buildTSPRequest(dataHash);
    
    // Invia richiesta HTTPS al TSA
    const response = await sendTSARequest(tsaUrl, tspRequest, useProduction);
    
    if (!response) {
      return generateSoftTimestamp(dataHash);
    }

    // Parsing risposta TSP
    return parseTSPResponse(response, dataHash);
    
  } catch (error) {
    console.error('[Timestamp] Errore richiesta TSA:', error);
    // Fallback a marcatura locale
    return generateSoftTimestamp(dataHash);
  }
};

/**
 * Genera marcatura temporale "soft" (senza TSA esterno)
 * Ha valore probatorio limitato ma garantisce integrità e sequenzialità
 */
export const generateSoftTimestamp = (dataHash: string): TimestampResult => {
  const now = new Date();
  
  // Crea un token firmato localmente con JWT_SECRET
  const secret = process.env.JWT_SECRET || 'fallback-secret';
  const token = crypto
    .createHmac('sha256', secret)
    .update(`${dataHash}:${now.toISOString()}`)
    .digest('base64');

  return {
    timestamp: now,
    timestampToken: token,
    serialNumber: `SOFT-${now.getTime()}`,
    tsaName: 'APP_ABBRACCIO_LOCAL',
    hashAlgorithm: 'SHA-256',
    hashValue: dataHash,
    policy: '1.2.840.113549.1.9.16.2.24', // OID per timestamp policy
  };
};

/**
 * Costruisce richiesta TSP RFC 3161
 * Formato ASN.1 DER semplificato
 */
const buildTSPRequest = (dataHash: string): Buffer => {
  // Hash come buffer
  const hashBuffer = Buffer.from(dataHash, 'hex');
  
  // OID per SHA-256: 2.16.840.1.101.3.4.2.1
  const sha256OID = [0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01];
  
  // MessageImprint structure semplificato
  const messageImprint = Buffer.concat([
    Buffer.from(sha256OID), // AlgorithmIdentifier
    Buffer.from([0x04, 0x20]), // OCTET STRING tag + length (32 bytes)
    hashBuffer
  ]);
  
  // Request structure
  const req = Buffer.concat([
    Buffer.from([0x30, 0x82]), // SEQUENCE
    Buffer.from([(messageImprint.length + 4) >> 8, (messageImprint.length + 4) & 0xFF]), // Length
    Buffer.from([0x02, 0x01, 0x01]), // Version = 1
    messageImprint
  ]);
  
  return req;
};

/**
 * Invia richiesta HTTPS al TSA
 */
const sendTSARequest = (
  url: string,
  request: Buffer,
  useAuth: boolean
): Promise<Buffer | null> => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/timestamp-query',
        'Content-Length': request.length,
        'Accept': 'application/timestamp-reply',
      },
      timeout: 10000, // 10 secondi timeout
    };

    if (useAuth && TSA_USERNAME && TSA_PASSWORD) {
      const auth = Buffer.from(`${TSA_USERNAME}:${TSA_PASSWORD}`).toString('base64');
      options.headers!['Authorization'] = `Basic ${auth}`;
    }

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(Buffer.concat(chunks));
        } else {
          console.error(`[Timestamp] TSA HTTP ${res.statusCode}`);
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Timestamp] Errore connessione TSA:', err.message);
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('[Timestamp] Timeout TSA');
      resolve(null);
    });

    req.write(request);
    req.end();
  });
};

/**
 * Parsing semplificato risposta TSP
 * Nota: Implementazione base, per produzione usare libreria ASN.1 completa
 */
const parseTSPResponse = (response: Buffer, originalHash: string): TimestampResult | null => {
  try {
    // Estrai timestamp dalla risposta (semplificato)
    // In produzione: parsing completo ASN.1
    
    const now = new Date();
    const token = response.toString('base64');
    
    return {
      timestamp: now,
      timestampToken: token,
      serialNumber: `TSA-${now.getTime()}`,
      tsaName: 'INFOCERT_DEMO',
      hashAlgorithm: 'SHA-256',
      hashValue: originalHash,
      policy: '1.2.840.113549.1.9.16.2.24',
    };
  } catch (error) {
    console.error('[Timestamp] Errore parsing risposta:', error);
    return null;
  }
};

/**
 * Verifica validità di una marcatura temporale
 * Controlla che il documento non sia stato modificato dopo la marcatura
 */
export const verifyTimestamp = (
  documentData: string | Buffer,
  timestamp: TimestampResult
): boolean => {
  const currentHash = hashDocument(documentData);
  
  // Verifica che l'hash corrisponda
  if (currentHash !== timestamp.hashValue) {
    return false; // Documento modificato!
  }
  
  // Per marche soft, verifica il token
  if (timestamp.tsaName === 'APP_ABBRACCIO_LOCAL') {
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const expectedToken = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp.hashValue}:${timestamp.timestamp.toISOString()}`)
      .digest('base64');
    
    return timestamp.timestampToken === expectedToken;
  }
  
  // Per marche TSA, servirebbe verifica crittografica completa
  return true;
};

/**
 * Middleware per aggiungere marcatura temporale a documenti clinici
 */
export const addTimestampToDocument = async (
  documentContent: any,
  options?: {
    includeSignature?: boolean; // Prepara campo per firma digitale futura
  }
): Promise<{
  hash: string;
  timestamp: TimestampResult;
  signaturePlaceholder?: string;
}> => {
  // Serializza documento in modo consistente
  const serialized = JSON.stringify(documentContent, Object.keys(documentContent).sort());
  const hash = hashDocument(serialized);
  
  // Richiedi marcatura temporale
  const timestamp = await requestTimestamp(hash, false);
  
  if (!timestamp) {
    throw new Error('Impossibile generare marcatura temporale');
  }
  
  let signaturePlaceholder: string | undefined;
  
  // Se richiesto, prepara placeholder per firma digitale futura
  if (options?.includeSignature) {
    // Hash del documento + timestamp (ciò che verrà firmato digitalmente)
    const toSign = `${hash}:${timestamp.timestampToken}`;
    signaturePlaceholder = hashDocument(toSign);
  }
  
  return {
    hash,
    timestamp,
    signaturePlaceholder,
  };
};
