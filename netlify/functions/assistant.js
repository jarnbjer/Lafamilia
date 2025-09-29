
const CATALOG = {
  'Daily Essentials': 59500,
  'Energiboost': 84500,
  'Kickstart 30': 129500,
  'Sleep Deep': 89500
};

const SYS_PROMPT = `
Du är en svensk AI-hälsocoach för La Familia Health. 
Mål:
- Förstå besökarens mål (t.ex. viktnedgång), preferenser (koffeinfritt/vegan), längd/vikt, budget.
- Föreslå antingen ett av våra färdigpaket eller ett skräddarsytt paket (kombination av våra paket).
- Be alltid om godkännande innan du lägger i kundvagnen.
- Svara kort, tydligt och trevligt. Lägg till disclaimers när det behövs.

Tillgängliga paket (SEK, heltal i öre):
- Daily Essentials = 59500
- Energiboost = 84500
- Kickstart 30 = 129500
- Sleep Deep = 89500

VIKTIG UTDATA:
Svara alltid i JSON med fälten:
{
  "reply": "vänlig sammanfattning och rekommendation (svenska)",
  "package": {
     "title": "Skräddarsytt paket" eller ett namn,
     "items": [{"name":"Daily Essentials","price":59500}, ...],
     "total_price": 149500
  }
}
Om du inte kan föreslå paket, returnera bara {"reply":"...", "package": null}.
Använd ENDAST artiklar från listan ovan och deras priser. Summera total_price korrekt i öre.
`;

export async function handler(event){
  try{
    const { message } = JSON.parse(event.body || '{}');
    if(!process.env.OPENAI_API_KEY){
      return { statusCode:200, body: JSON.stringify({ reply: "AI inte aktiv: saknar OPENAI_API_KEY i Netlify.", package:null }) };
    }
    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYS_PROMPT },
        { role: "user", content: message || "" }
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
    if(!r.ok){
      const errText = await r.text();
      return { statusCode: 200, body: JSON.stringify({ reply: "AI-fel: " + errText, package: null }) };
    }
    const j = await r.json();
    let content = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
    content = content.replace(/^```json\n?|```$/g, "").trim();
    let out;
    try { out = JSON.parse(content); } catch { out = { reply: content, package: null }; }
    if(out && out.package && Array.isArray(out.package.items)){
      let total = 0;
      out.package.items = out.package.items.map(it => {
        const price = CATALOG[it.name] ?? 0;
        total += price;
        return { name: it.name, price };
      });
      out.package.total_price = total;
      if(!out.package.title) out.package.title = "Skräddarsytt paket";
    } else {
      out.package = null;
    }
    return { statusCode:200, body: JSON.stringify(out) };
  }catch(e){
    return { statusCode:200, body: JSON.stringify({ reply: "Tekniskt fel i function: " + e.message, package:null }) };
  }
}
