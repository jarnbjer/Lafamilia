// ===== Helpers =====
const STANDARD_BUNDLES = [
  { title:"Daily Essentials+",     skus:["HF-001","HF-003","HF-014"], img:"assets/daily.jpg",    desc:"Bas + omega-3 + kollagen" },
  { title:"Immun Boost",           skus:["HF-006","HF-018","HF-002","HF-008"], img:"assets/energy.jpg",   desc:"C + selen + D + probiotika" },
  { title:"Energi & Fokus",        skus:["HF-005","HF-022","HF-023","HF-013"], img:"assets/kickstart.jpg",desc:"B-komplex + rhodiola + grönt te + elektrolyter" },
  { title:"Sömn & Återhämtning",   skus:["HF-004","HF-021","HF-026","HF-039","HF-040"], img:"assets/sleep.jpg",   desc:"Magnesium + L-teanin + kvällsritual" },
  { title:"Kickstart Vikt 30",     skus:["HF-009","HF-011","HF-013","HF-001","HF-031"], img:"assets/kickstart.jpg",desc:"Fiber + protein + elektrolyter + plan" },
  { title:"Kickstart Vegan 30",    skus:["HF-009","HF-012","HF-013","HF-001","HF-031"], img:"assets/kickstart.jpg",desc:"Fiber + vegoprotein + elektrolyter + plan" }
];

function money(ore){ return (ore/100).toLocaleString('sv-SE',{style:'currency',currency:'SEK'}).replace('SEK','kr'); }

// Fallbacks så inget kraschar om kundvagn saknas ännu
if (typeof window.addCustomToCart !== 'function') {
  window.addCustomToCart = (pkg)=>alert(`(Demo) Lägger i kundvagn: ${pkg.title} – ${money(pkg.total_price)}`);
}
if (typeof window.openDrawer !== 'function') { window.openDrawer = ()=>{}; }

// ===== Data / API =====
async function fetchCatalog(){
  console.log("[LF] Hämtar katalog …");
  const r = await fetch('/.netlify/functions/catalog');
  if (!r.ok) throw new Error("Kunde inte hämta katalog ("+r.status+")");
  const j = await r.json();
  console.log("[LF] Katalog laddad:", j.products?.length, "artiklar");
  return new Map(j.products.map(p => [p.sku, p]));
}

// ===== UI =====
async function renderStandardBundles(){
  const grid = document.getElementById('productGrid');
  if (!grid) { console.warn("[LF] Hittar inte #productGrid i HTML"); return; }

  let map;
  try { map = await fetchCatalog(); }
  catch (e) {
    console.error("[LF] Katalogfel:", e);
    grid.innerHTML = `<div class="muted">Kunde inte ladda produkter. Prova att ladda om.</div>`;
    return;
  }

  if (map.size === 0) {
    console.warn("[LF] Katalogen är tom – kontrollera /.netlify/functions/catalog");
    grid.innerHTML = `<div class="muted">Inga produkter kunde laddas.</div>`;
    return;
  }

  grid.innerHTML = '';
  STANDARD_BUNDLES.forEach(b => {
    const items = b.skus.map(sku => map.get(sku)).filter(Boolean);
    if (items.length === 0) {
      console.warn("[LF] Paket utan matchande SKU:er i katalogen:", b.title, b.skus);
      return;
    }
    let total = 0, lead = 0;
    items.forEach(p => { total += p.retail_price_ore; lead = Math.max(lead, parseInt(p.lead_days||5,10)); });

    const card = document.createElement('article');
    card.className = 'card product';
    const imgUrl = b.img || 'assets/kickstart.jpg'; // enkel fallback
    card.innerHTML = `
      <div class="img" style="background:url('${imgUrl}') center/cover;height:220px"></div>
      <div class="padded">
        <h3 class="title">${b.title}</h3>
        <p class="desc">${b.desc || ''}</p>
        <ul class="contents">${items.map(p=>`<li>${p.name}</li>`).join('')}</ul>
        <div class="price-row"><span class="price">${money(total)}</span></div>
        <button class="btn add">Lägg i kundvagn</button>
        <div class="leadtime muted">Leveranstid: ${lead || 5} dagar</div>
      </div>`;
    card.querySelector('.add').addEventListener('click', ()=>{
      const pkg = { title: b.title, items: items.map(p=>({ name:p.name, price:p.retail_price_ore })), total_price: total };
      addCustomToCart(pkg); openDrawer();
    });
    grid.appendChild(card);
  });
  console.log("[LF] Paketen renderade.");
}

// ===== AI-coach =====
function wireCoachForm(){
  const form = document.getElementById('coachForm');
  const resultEl = document.getElementById('coachResult');
  if (!form || !resultEl) { console.warn("[LF] Hittar inte coachForm/coachResult"); return; }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = new FormData(form).get('msg');
    resultEl.innerHTML = '<div class="muted small">Tänker…</div>';

    try{
      const res = await fetch('/.netlify/functions/assistant', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      console.log("[LF] AI-svar:", data);

      const reply = data.reply || 'Kunde inte generera svar.';
      let html = `<div class="coach-proposal"><h3>AI-coach</h3><p>${reply}</p>`;

      if (data.package) {
        const list = data.package.items.map(x => `• ${x.name} (${money(x.price)})`).join('<br>');
        html += `
          <p><strong>${data.package.title}</strong></p>
          <p>${list}</p>
          <p><strong>Totalt: ${money(data.package.total_price)}</strong> • ETA: ${data.package.lead_days||5} d</p>
          <div class="row2">
            <button id="approveBtn" class="btn">Godkänn & lägg i kundvagn</button>
            <button id="tweakBtn" class="btn ghost">Justera</button>
          </div>`;
      }
      resultEl.innerHTML = html + '</div>';

      const okBtn = document.getElementById('approveBtn');
      if (okBtn && data.package) {
        okBtn.onclick = ()=>{
          addCustomToCart({
            title: data.package.title,
            items: data.package.items.map(i => ({ name:i.name, price:i.price })),
            total_price: data.package.total_price
          });
          openDrawer();
        };
      }
      const tweakBtn = document.getElementById('tweakBtn');
      if (tweakBtn) { tweakBtn.onclick = ()=> alert('Säg vad du vill ändra: "koffeinfritt", "max 900 kr", "lägg till sömn" osv.'); }
    }catch(err){
      console.error("[LF] AI-felkod:", err);
      resultEl.innerHTML = '<div class="coach-proposal">Tekniskt fel – kontrollera OPENAI_API_KEY / deploy.</div>';
    }
  });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', ()=>{
  renderStandardBundles();
  wireCoachForm();
});
