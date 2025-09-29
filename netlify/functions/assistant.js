// netlify/functions/assistant.js

// Sex standardpaket – bara SKU:er från din katalog (Google Sheet)
const STANDARD_BUNDLES = [
  { title: "Daily Essentials+",      skus: ["HF-001","HF-003","HF-014"] },
  { title: "Immun Boost",            skus: ["HF-006","HF-018","HF-002","HF-008"] },
  { title: "Energi & Fokus",         skus: ["HF-005","HF-022","HF-023","HF-013"] },
  { title: "Sömn & Återhämtning",    skus: ["HF-004","HF-021","HF-026","HF-039","HF-040"] },
  { title: "Kickstart Vikt 30",      skus: ["HF-009","HF-011","HF-013","HF-001","HF-031"] },
  { title: "Kickstart Vegan 30",     skus: ["HF-009","HF-012","HF-013","HF-001","HF-031"] },
];

// Systemprompt – AI ska använda endast katalogen, prioritera paket, alltid be om OK
const SYS_PROMPT = `
Du är en svensk AI-hälsocoach. Du får ENDAST använda artiklar från den katalog du får (sku, name, retail_price_ore, lead_days).
Prioritet:
1) Föreslå ett av våra sex standardpaket om det passar.
2) Annars föreslå ett skräddarsytt paket av 1–6 artiklar från katalogen (1 artikel är OK om kunden ber specifikt).
Regler:
- Returnera ALLTID strikt JSON (ingen extra text), exakt detta format:
{
  "reply": "kort svensk rekommendation",
  "package": { "title": "Namn", "items": [ { "sku": "HF-001" }, ... ] },
  "ask_confirm": true
}
- Skriv inga priser; servern räknar totalen.
- Avsluta alltid med att be om godkännande innan kundvagn.
`;

// Hämta färsk katalog från vår egen function
async function loadCatalog(baseUrl) {
  const url = `${baseUrl}/.netlify/functions/catalog`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Kan inte ladda katalog');
  const j = await r.json();
  // Gör en Map för snabb lookup
  return new Map(j.products.map(p => [p.sku, p]));
}

export async function handler(event) {
  try {
    const { message } = JSON.parse(event.body || '{}');

    if (!process.env.OPENAI_API_KEY) {
      return { statusCode: 200, body: JSON.stringify({
        reply: "AI saknar OPENAI_API_KEY i Netlify Environment.",
        package: null,
        ask_confirm: false
      }) };
    }

    // 1) Ladda katalog
    const baseUrl = process.env.URL || '';
    const bySku = await loadCatalog(baseUrl);

    // 2) Ring OpenAI
    const payload = {
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: SYS_PROMPT },
        { role: "user",   content: message || "" },
        { role: "system", content: "Standardpaket (endast referens): " + JSON.stringify(STANDARD_BUNDLES) }
      ]
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
      return { statusCode: 200, body: JSON.stringify({ reply: "AI-fel: " + msg, package: null, ask_confirm: false }) };
    }

    // 3) Plocka ut svaret och försök tolka JSON
    let content = j.choices?.[0]?.message?.content || "";
    content = content.replace(/^```json\s*|\s*```$/g, "").trim();

    let out;
    try { out = JSON.parse(content); } catch {
      out = { reply: content, package: null, ask_confirm: false };
    }

    // 4) Validera items mot katalogen & räkna pris + ledtid
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
        out.package.items       = fixedItems;
        out.package.total_price = total;
        out.package.lead_days   = maxLead || 5;
        if (!out.package.title) out.package.title = "Skräddarsytt paket";
        out.ask_confirm = true;
      } else {
        out.package = null;
        out.ask_confirm = false;
      }
    } else {
      out.package = null;
      out.ask_confirm = false;
    }

    return { statusCode: 200, body: JSON.stringify(out) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({
      reply: "Tekniskt fel: " + e.message,
      package: null,
      ask_confirm: false
    }) };
  }
}
