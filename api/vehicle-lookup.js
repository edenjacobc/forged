const https = require('https');

function httpsPost(options, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpsGet(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

let cachedToken = null;
let tokenExpiry = 0;

async function getDvsaToken(clientId, clientSecret) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         'https://tapi.dvsa.gov.uk/.default',
  }).toString();

  const res = await httpsPost({
    hostname: 'login.microsoftonline.com',
    path:     '/a455b827-244f-4c97-b5b4-ce5d13b4d00c/oauth2/v2.0/token',
    method:   'POST',
    headers: {
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (res.status !== 200) throw new Error(`Token fetch failed: ${res.status}`);
  const json = JSON.parse(res.body);
  cachedToken = json.access_token;
  tokenExpiry = now + (json.expires_in - 60) * 1000;
  return cachedToken;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { registrationNumber } = req.body || {};
  if (!registrationNumber) return res.status(400).json({ error: 'registrationNumber required' });

  const dvlaKey = process.env.DVLA_API_KEY;
  if (!dvlaKey) return res.status(500).json({ error: 'DVLA API key not configured' });

  const reg = registrationNumber.replace(/\s+/g, '').toUpperCase();

  try {
    const payload = JSON.stringify({ registrationNumber: reg });
    const dvlaRes = await httpsPost({
      hostname: 'driver-vehicle-licensing.api.gov.uk',
      path:     '/vehicle-enquiry/v1/vehicles',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'x-api-key':      dvlaKey,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, payload);

    if (dvlaRes.status === 404) return res.status(404).json({ error: 'Vehicle not found' });
    if (dvlaRes.status === 400) return res.status(400).json({ error: 'Invalid registration format' });
    if (dvlaRes.status !== 200) return res.status(dvlaRes.status).json({ error: 'DVLA error' });

    const vehicle = JSON.parse(dvlaRes.body);

    const dvsaClientId     = process.env.DVSA_CLIENT_ID;
    const dvsaClientSecret = process.env.DVSA_CLIENT_SECRET;
    const dvsaApiKey       = process.env.DVSA_API_KEY;

    if (dvsaClientId && dvsaClientSecret && dvsaApiKey) {
      try {
        const token = await getDvsaToken(dvsaClientId, dvsaClientSecret);
        const motRes = await httpsGet({
          hostname: 'history.mot.api.gov.uk',
          path:     `/v1/trade/vehicles/registration/${reg}`,
          method:   'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-api-key':     dvsaApiKey,
            'Accept':        'application/json',
          },
        });
        if (motRes.status === 200) {
          const motData = JSON.parse(motRes.body);
          const motMake  = (motData.make  || '').trim().toUpperCase();
          const motModel = (motData.model || '').trim().toUpperCase();
          if (motData.make) vehicle.make = motData.make;
          if (motData.model && motModel !== motMake) {
            vehicle.model = motModel.startsWith(motMake + ' ')
              ? motData.model.slice(motMake.length + 1).trim()
              : motData.model;
          }
        }
      } catch { /* MOT API failure is non-fatal */ }
    }

    return res.status(200).json(vehicle);
  } catch (err) {
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
};
