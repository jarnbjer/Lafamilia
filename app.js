// ======= Standardpaket att visa på startsidan =======

  if (map.size === 0) {
    console.warn("Katalogen är tom – kolla /.netlify/functions/catalog");
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '<div class="muted">Inga produkter kunde laddas. Prova att ladda om sidan.</div>';
    return;
  }

const STANDARD_BUNDLES = [
  { title:"Daily Essentials+",     skus:["HF-001","HF-003","HF-014"], img:"assets/daily.jpg",    desc:"Bas + omega-3 + kollagen" },
  { title:"Immun Boost",           skus:["HF-006","HF-018","HF-002","HF-008"], img:"assets/energy.jpg",   desc:"C + selen + D + probiotika" },
  { title:"Energi & Fokus",        skus:["HF-005","HF-022","HF-023","HF-013"], img:"assets/kickstart.jpg",desc:"B-komplex + rhodiola + grönt te + elektrolyter" },
  { title:"Sömn & Återhämtning",   skus:["HF-004","HF-021","HF-026","HF-039","HF-040"], img:"assets/sleep.jpg",   desc:"Magnesium + L-teanin + kvällsritual" },
  { title:"Kickstart Vikt 30",     skus:["HF-009","HF-011","HF-013","HF-001","HF-031"], img:"assets/kickstart.jpg",desc:"Fiber + protein + elektrolyter + plan" },
  { title:"Kickstart Vegan 30",    skus:["HF-009","HF-012","HF-013","HF-001","HF-031"], img:"assets/kickstart.jpg",desc:"Fiber + vegoprotein + elektrolyter + plan" }
];

function money(ore){
  return (ore/100).toLocaleString('sv-SE',{ style:'currency', currency:'SEK' }).replace('SEK','kr');
}

// Fallback om din kundvagnsfunktion inte finns (hindrar krascher under test)
if (typeof window.addCustomToCart !== 'function') {
  window.addCustomToCart = (pkg) => {
    alert(`(Demo) Lägger i kundvagn: ${pkg.title} – ${money(pkg.total_price)}`);
  };
}
if (typeof window.openDrawer !== 'function') {
  window.openDrawer = () => {};
}

// Hämta katalog via vår Netlify-function
async function fetchCatalog(){
  const r = await fetch('/.netlify/functions/catalog');
  if (!r.ok) throw new Error('Katalog kunde inte hämtas');
  const j = await r.json();
  return new Map(j.products.map(p => [p.sku, p]));
}

// Rendera de sex standardpaketen
async function renderStandardBundles(){
  const map = await fetchCatalog();
  const grid = document.getElementById('productGrid');
  if (!grid) return;
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
      const pkg = {
        title: b.title,
        items: items.map(p => ({ name: p.name, price: p.retail_price_ore })),
        total_price: total
      };
      addCustomToCart(pkg);
      openDrawer();
    });

    grid.appendChild(card);
  });
}

// AI-coach: fråga, visa paket, be om OK → lägg i kundvagn
function wireCoachForm(){
  const form = document.getElementById('coachForm');
  const resultEl = document.getElementById('coachResult');
  if (!form || !resultEl) return;

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = new FormData(form).get('msg');
    resultEl.innerHTML = '<div class="muted small">Tänker…</div>';

    try{
      const res = await fetch('/.netlify/functions/assistant', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
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
      html += `</div>`;
      resultEl.innerHTML = html;

      const okBtn = document.getElementById('approveBtn');
      if (okBtn && data.package) {
        okBtn.onclick = ()=>{
          addCustomToCart({
            title: data.package.title,
            items: data.package.items.map(i => ({ name: i.name, price: i.price })),
            total_price: data.package.total_price
          });
          openDrawer();
        };
      }
      const tweakBtn = document.getElementById('tweakBtn');
      if (tweakBtn) {
        tweakBtn.onclick = ()=> alert('Säg vad du vill ändra: "koffeinfritt", "max 900 kr", "lägg till sömn" osv.');
      }
    } catch (err) {
      resultEl.innerHTML = '<div class="coach-proposal">Tekniskt fel – kontrollera OPENAI_API_KEY / CATALOG_CSV_URL och deploy.</div>';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderStandardBundles();
  wireCoachForm();
});

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

async function fetchCatalog(){
  const r = await fetch('/.netlify/functions/catalog');
  const j = await r.json();
  return j.products; // [{sku, name, retail_price_ore, image_url, lead_days, ...}]
}
function money(ore){ return (ore/100).toLocaleString('sv-SE',{style:'currency',currency:'SEK'}).replace('SEK','kr'); }

async function renderAllProducts(){
  const list = await fetchCatalog();
  const grid = document.getElementById('allProducts');
  if(!grid) return;
  grid.innerHTML = '';
  list.forEach(p=>{
    const card = document.createElement('article');
    card.className = 'card product';
    card.innerHTML = `
      <div class="img" style="background:url('${p.image_url || 'assets/daily.jpg'}') center/cover;height:220px"></div>
      <div class="padded">
        <h3 class="title">${p.name}</h3>
        <p class="desc">${p.description || ''}</p>
        <div class="price-row"><span class="price">${money(p.retail_price_ore)}</span></div>
        <button class="btn add">Lägg i kundvagn</button>
        <div class="leadtime muted">Leveranstid: ${p.lead_days || 5} dagar</div>
      </div>`;
    card.querySelector('.add').addEventListener('click', ()=>{
      // lägg som en vanlig rad (inte paket)
      addToCart({ id:p.sku, name:p.name, price:p.retail_price_ore });
      openDrawer();
    });
    grid.appendChild(card);
  });
}
document.addEventListener('DOMContentLoaded', renderAllProducts);


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
