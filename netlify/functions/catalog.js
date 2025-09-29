// netlify/functions/catalog.js

const FALLBACK_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR0sAcNtkP2wrN-oFq7fF6LbdlAle37JL557zaorNxuyaXrWiw91IvQ4it8c79PRlJLWfp0E2R7vxrH/pub?output=csv";

function parseCSV(csvText) {
  const rows = [];
  let row = [], field = '', inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i], next = csvText[i+1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* ignore */ }
      else { field += c; }
    }
  }
  row.push(field); rows.push(row);
  return rows;
}

export async function handler() {
  try {
    const url = process.env.CATALOG_CSV_URL || FALLBACK_URL;

    const csv = await fetch(url).then(r => {
      if (!r.ok) throw new Error(`CSV fetch failed: ${r.status}`);
      return r.text();
    });

    const table = parseCSV(csv).filter(r => r.some(x => (x ?? '').toString().trim() !== ''));
    if (table.length < 2) {
      return { statusCode: 200, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ products: [] }) };
    }

    const headers = table[0].map(h => String(h).trim());
    const products = table.slice(1).map(cols => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = (cols[i] ?? '').toString().trim());
      obj.retail_price_ore = parseInt(obj.retail_price_ore || '0', 10);
      obj.lead_days        = parseInt(obj.lead_days || '5', 10);
      obj.active           = String(obj.active || '').toLowerCase() !== 'false';
      return obj;
    }).filter(p => p.sku && p.active);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ products })
    };
  } catch (e) {
    return { statusCode: 500, body: 'Catalog error: ' + e.message };
  }
}
