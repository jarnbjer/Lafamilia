// netlify/functions/catalog.js
export async function handler() {
  try {
    const url = process.env.CATALOG_CSV_URL;
    if (!url) return { statusCode: 500, body: 'Missing CATALOG_CSV_URL' };

    const csv = await fetch(url).then(r => r.text());
    // Enkel CSV->JSON
    const [head, ...rows] = csv.split('\n').filter(Boolean);
    const headers = head.split(',').map(h => h.trim());
    const data = rows.map(r => {
      const cols = r.split(','); const o = {};
      headers.forEach((h, i) => o[h] = (cols[i] ?? '').trim());
      // konvertera priser till int
      o.retail_price_ore = parseInt(o.retail_price_ore || '0', 10);
      o.lead_days = parseInt(o.lead_days || '5', 10);
      return o;
    }).filter(o => o.sku);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ products: data })
    };
  } catch (e) {
    return { statusCode: 500, body: 'Catalog error: ' + e.message };
  }
}
