// netlify/functions/catalog.js
export async function handler() {
  try {
    const url = process.env.CATALOG_CSV_URL;
    if (!url) {
      return { statusCode: 500, body: 'Missing CATALOG_CSV_URL' };
    }

    // Hämta CSV från Google Kalkylark (publicerad länk)
    const csv = await fetch(url).then(r => r.text());

    // Enkel CSV->JSON (fungerar för vårt Sheet utan citattecken i cellerna)
    const lines = csv.split(/\r?\n/).filter(Boolean);
    const headers = lines.shift().split(',').map(h => h.trim());

    const products = lines.map(line => {
      const cols = line.split(',');
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (cols[i] ?? '').trim(); });

      // Normalisera fält som används i UI
      obj.retail_price_ore = parseInt(obj.retail_price_ore || '0', 10);
      obj.lead_days       = parseInt(obj.lead_days       || '5', 10);
      obj.active          = String(obj.active || '').toLowerCase() !== 'false';

      return obj;
    }).filter(p => p.sku && p.active);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ products })
    };
  } catch (e) {
    return { statusCode: 500, body: 'Catalog error: ' + e.message };
  }
}
