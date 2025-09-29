// netlify/functions/assistant.js

// 6 standardpaket definieras här (endast SKU:er från din katalog)
const STANDARD_BUNDLES = [
  { title: "Daily Essentials+", skus: ["HF-001","HF-003","HF-014"] },
  { title: "Immun Boost",      skus: ["HF-006","HF-018","HF-002","HF-008"] },
  { title: "Energi & Fokus",   skus: ["HF-005","HF-022","HF-023","HF-013"] },
  { title: "Sömn & Återhämtning", skus: ["HF-004","HF-021","HF-026","HF-039","HF-040"] },
  { title: "Kickstart Vikt 30", skus: ["HF-009","HF-011","HF-013","HF-001","HF-031"] },
  { title: "Kickstart Vegan 30", skus: ["HF-009","HF-012","HF-013","HF-001","HF-031"] },
];

const SYS_PROMPT = `
Du är en svensk AI-hälsocoach. Du får inte hitta på egna produkter.
Regler:
- Använd ENDAST artiklar från katalogen (sku, name, retail_price_ore, lead_days).
- Om användaren vill ha EN specifik produkt (t.ex. "Omega-3") får du föreslå ett paket med EN artikel.
- Om relevant: föreslå något av våra sex standardpaket.
- Annars: skapa ett skräddarsytt paket (1 eller fler artiklar).
- Returnera ALLTID strikt JSON:
{
  "reply": "kort svensk rekommendation",
  "package": { "title": "Namn", "items": [{"sku":"HF-001"}, ...] }
}
Skriv inga priser; servern räknar totalen. Be om godkännande innan kundvagn.
`;


// Hämta färsk katalog från vår egen function
async function loadCatalog(baseUrl) {
  const url = `${baseUrl}/.netlify/functions/catalog`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Kan inte ladda katalog');
  const j = await r.json();
  return new Map(j.products.map(p => [p.sku, p]));
}

export async function handler(event) {
  try {
    const { message } = JSON.parse(event.body || '{}');

    if (!process.env.OPENAI_API_KEY) {
      return { statusCode: 200, body: JSON.stringify({ reply: "AI saknar OPENAI_API_KEY.", package: null }) };
    }

    // 1) Ladda katalog
    // process.env.URL sätts av Netlify i functions (ex. https://lafamiliahealth.netlify.app)
    const baseUrl = process.env.URL || '';
    const bySku = await loadCatalog(baseUrl);

    // 2) Ring OpenAI
    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYS_PROMPT },
        { role: "user", content: message || "" },
        { role: "system", content: "Standardpaket (endast referens): " + JSON.stringify(STANDARD_BUNDLES) }
      ],
      temperature: 0.5
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const j = await r.json();
    if (!r.ok) {
      const msg = j?.error?.message || 'okänt fel';
      return { statusCode: 200, body: JSON.stringify({ reply: "AI-fel: " + msg, package: null }) };
    }

    let content = j.choices?.[0]?.message?.content || "";
    content = content.replace(/^```json\n?|```$/g, "").trim();

    let out;
    try { out = JSON.parse(content); } catch { out = { reply: content, package: null }; }

    // 3) Validera items mot katalogen & räkna total
    if (out?.package?.items?.length) {
      const fixedItems = [];
      let total = 0, maxLead = 0;

      for (const it of out.package.items) {
        const sku = (it.sku || '').trim();
        const p = sku && bySku.get(sku);
        if (p) {
          fixedItems.push({ sku, name: p.name, price: p.retail_price_ore });
          total += p.retail_price_ore;
          maxLead = Math.max(maxLead, p.lead_days || 0);
        }
      }
      if (fixedItems.length) {
        out.package.items = fixedItems;
        out.package.total_price = total;
        out.package.lead_days = maxLead || 5;
        if (!out.package.title) out.package.title = "Skräddarsytt paket";
      } else {
        out.package = null;
      }
    } else {
      out.package = null;
    }

    return { statusCode: 200, body: JSON.stringify(out) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ reply: "Tekniskt fel: " + e.message, package: null }) };
  }
}
