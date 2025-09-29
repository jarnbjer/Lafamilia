// netlify/functions/catalog.js

function parseCSV(csvText) {
  // Robust CSV-parser som hanterar "citat","kommatecken, i text", och radbrytningar
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"'; // escaped quote
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\r') {
        // hoppa över CR (Windows-radslut)
      } else {
        field += c;
      }
    }
  }
  // sista fältet/sista raden
  row.push(field);
  rows.push(row);
  return rows;
}

export async function handler() {
  try {
    const url = process.env.CATALOG_CSV_URL;
    if (!url) {
      return { statusCode: 500, body: 'Missing CATALOG_CSV_URL' };
    }

    const csv = await fetch(url).then(r => r.text());
    const table = parseCSV(csv).filter(r => r.some(x => x && String(x).trim() !== ''));

    if (table.length < 2) {
      return { statusCode: 200, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ products: [] }) };
    }

    const headers = table[0].map(h => String(h).trim());
    const products = table.slice(1).map(cols => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (cols[i] ?? '').toString().trim(); });
      obj.retail_price_ore = parseInt(obj.retail_price_ore || '0', 10);
      obj.lead_days        = parseInt(obj.lead_days        || '5', 10);
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
