// 6 standardpaket – samma som i assistant.js
const STANDARD_BUNDLES = [
  { title:"Daily Essentials+",     skus:["HF-001","HF-003","HF-014"], img:"assets/daily.jpg",  desc:"Bas + omega-3 + kollagen" },
  { title:"Immun Boost",           skus:["HF-006","HF-018","HF-002","HF-008"], img:"assets/energy.jpg",   desc:"C + selen + D + probiotika" },
  { title:"Energi & Fokus",        skus:["HF-005","HF-022","HF-023","HF-013"], img:"assets/kickstart.jpg", desc:"B-komplex + rhodiola + grönt te + elektrolyter" },
  { title:"Sömn & Återhämtning",   skus:["HF-004","HF-021","HF-026","HF-039","HF-040"], img:"assets/sleep.jpg",    desc:"Magnesium + L-teanin + kvällsritual" },
  { title:"Kickstart Vikt 30",     skus:["HF-009","HF-011","HF-013","HF-001","HF-031"], img:"assets/kickstart.jpg", desc:"Fiber + protein + elektrolyter + plan" },
  { title:"Kickstart Vegan 30",    skus:["HF-009","HF-012","HF-013","HF-001","HF-031"], img:"assets/kickstart.jpg", desc:"Fiber + vegoprotein + elektrolyter + plan" }
];

function money(ore){ return (ore/100).toLocaleString('sv-SE',{style:'currency',currency:'SEK'}).replace('SEK','kr'); }

async function fetchCatalog(){
  const r = await fetch('/.netlify/functions/catalog');
  const j = await r.json();
  return new Map(j.products.map(p => [p.sku, p]));
}

async function renderStandardBundles(){
  const map = await fetchCatalog();
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';

  STANDARD_BUNDLES.forEach(b => {
    const items = b.skus.map(sku => map.get(sku)).filter(Boolean);
    let total = 0, lead = 0;
    items.forEach(p => { total += p.retail_price_ore; lead = Math.max(lead, parseInt(p.lead_days||5,10)); });

    const card = document.createElement('article');
    card.className = 'card product';
    card.innerHTML = `
      <div class="img" style="background:url('${b.img}') center/cover;height:220px"></div>
      <div class="padded">
        <h3 class="title">${b.title}</h3>
        <p class="desc">${b.desc || ''}</p>
        <ul class="contents">${items.map(p=>`<li>${p.name}</li>`).join('')}</ul>
        <div class="price-row"><span class="price">${money(total)}</span></div>
        <button class="btn add">Lägg i kundvagn</button>
        <div class="leadtime muted">Leveranstid: ${lead || 5} dagar</div>
      </div>`;
    card.querySelector('.add').addEventListener('click', ()=>{
      const pkg = { title: b.title, items: items.map(p => ({ name:p.name, price:p.retail_price_ore })), total_price: total };
      addCustomToCart(pkg);
    });
    grid.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', renderStandardBundles);
document.getElementById('coachForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const msg = new FormData(e.target).get('msg');
  const el = document.getElementById('coachResult');
  el.innerHTML = '<div class="muted small">Tänker…</div>';
  try{
    const res = await fetch('/.netlify/functions/assistant', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    const reply = data.reply || 'Kunde inte generera svar.';
    let html = `<div class="coach-proposal"><h3>AI-coach</h3><p>${reply}</p>`;
    if(data.package){
      const list = data.package.items.map(x => `• ${x.name} (${money(x.price)})`).join('<br>');
      html += `<p><strong>${data.package.title}</strong></p><p>${list}</p><p><strong>Totalt: ${money(data.package.total_price)}</strong> • ETA: ${data.package.lead_days||5} d</p>
      <div class="row2"><button id="approveBtn" class="btn">Godkänn & lägg i kundvagn</button><button id="tweakBtn" class="btn ghost">Justera</button></div>`;
      el.innerHTML = html + '</div>';
      document.getElementById('approveBtn').onclick = ()=> addCustomToCart(data.package);
      document.getElementById('tweakBtn').onclick = ()=> alert('Skriv t.ex. ”koffeinfritt”, ”budget max 900 kr” eller ”lägg till sömn”.');
    } else {
      el.innerHTML = html + '</div>';
    }
  }catch(e){
    el.innerHTML = '<div class="coach-proposal">Tekniskt fel – kontrollera OPENAI_API_KEY och deploy.</div>';
  }
});
