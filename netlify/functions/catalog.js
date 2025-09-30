// netlify/functions/catalog.js
exports.handler = async () => {
  try {
    const url = process.env.CATALOG_CSV_URL;
    if (!url) {
      return { statusCode: 500, body: JSON.stringify({ error: "CATALOG_CSV_URL saknas i miljövariabler" }) };
    }

    const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: `Kunde inte hämta CSV (${res.status})` }) };
    }
    const csvText = await res.text();

    // Enkel CSV-parser: hanterar citat & kommatecken
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ products: [] }) };
    }

    const headers = rows[0].map(h => h.trim());
    const products = rows.slice(1).map(cols => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = (cols[i] ?? "").trim());

      // Normalisera vissa typer
      if (obj.retail_price_ore) obj.retail_price_ore = parseInt(obj.retail_price_ore, 10) || 0;
      if (obj.lead_days) obj.lead_days = parseInt(obj.lead_days, 10) || 0;
      if (typeof obj.vegan === 'string') obj.vegan = /^true$/i.test(obj.vegan) || obj.vegan === '1' || obj.vegan.toLowerCase() === 'ja';

      return obj;
    }).filter(p => p.sku && p.name);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ products })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

// Minimal robust CSV-parser (celler kan vara "citerade, med, kommatecken")
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i+1];

    if (ch === '"' ) {
      if (inQuotes && next === '"') { // escaped quote
        cell += '"'; i++; continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) { row.push(cell); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (cell.length || row.length) { row.push(cell); rows.push(row); row = []; cell = ''; }
      // swallow \r\n pairs
      if (ch === '\r' && next === '\n') { i++; }
      continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
