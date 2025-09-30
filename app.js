// ======================
// La Familia Health - app.js (paket, smart AI, kundvagn, "Om oss"-modal)
// ======================

// ---------- Standardpaket ----------
const STANDARD_BUNDLES = [
  { title:"Daily Essentials+",   skus:["HF-001","HF-003","HF-014"], img:"assets/daily.jpg",  desc:"Bas + omega-3 + kollagen" },
  { title:"Immun Boost",         skus:["HF-006","HF-018","HF-002","HF-008"], img:"assets/boost.jpg",   desc:"C + selen + D + probiotika" },
  { title:"Energi & Fokus",      skus:["HF-005","HF-022","HF-023","HF-013"], img:"assets/energy.jpeg", desc:"B-komplex + rhodiola + grönt te + elektrolyter" },
  { title:"Sömn & Återhämtning", skus:["HF-004","HF-021","HF-026","HF-039","HF-040"], img:"assets/sleep.jpg",  desc:"Magnesium + L-teanin + kvällsritual" },
  { title:"Kickstart Vikt 30",   skus:["HF-009","HF-011","HF-013","HF-001","HF-031"], img:"assets/weight.jpeg",desc:"Fiber + protein + elektrolyter + plan" },
  { title:"Kickstart Vegan 30",  skus:["HF-009","HF-012","HF-013","HF-001","HF-031"], img:"assets/vegan.jpeg", desc:"Fiber + vegoprotein + elektrolyter + plan" }
];

// ---------- Helpers ----------
function money(ore){ return (ore/100).toLocaleString('sv-SE',{style:'currency',currency:'SEK'}).replace('SEK','kr'); }
const safe = (s)=> (s==null?'':String(s));

// ---------- Kundvagn ----------
function getCart(){ try { return JSON.parse(localStorage.getItem('cart')||'[]'); } catch { return []; } }
function saveCart(c){ localStorage.setItem('cart', JSON.stringify(c)); updateCartSummary(); renderCartDrawer(); }
function addToCartLine(name, price, qty=1, sku=null){
  const cart = getCart();
  const i = cart.findIndex(x => x.name===name && x.price===price && x.sku===sku);
  if (i>=0) cart[i].qty += qty; else cart.push({ name, price, qty, sku });
  saveCart(cart);
}
function addCustomToCart(pkg){ (pkg.items||[]).forEach(it => addToCartLine(it.name, it.price, 1, it.sku||null)); openDrawer(); }

function updateCartSummary(){
  const cart = getCart();
  const count = cart.reduce((a,c)=>a+(c.qty||1),0);
  const total = cart.reduce((a,c)=>a+(c.price||0)*(c.qty||1),0);
  const el = document.getElementById('cartSummary');
  if (el) el.textContent = `Kundvagn: ${count} ${count===1?'vara':'varor'} • ${money(total)}`;
}
function renderCartDrawer(){
  const list = document.getElementById('cartList');
  const subtotalEl = document.getElementById('cartSubtotal');
  const proceedBtn = document.getElementById('checkoutBtnDrawer');
  if (!list) return;

  const cart = getCart();
  list.innerHTML = '';
  if (!cart.length) list.innerHTML = '<div class="muted">Kundvagnen är tom.</div>';

  let subtotal = 0;
  cart.forEach((item, idx)=>{
    subtotal += (item.price||0) * (item.qty||1);
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div><strong>${item.name}</strong><br>${money(item.price)} x ${item.qty||1}</div>
      <div class="qty">
        <button onclick="updateQty(${idx},-1)">−</button>
        <span>${item.qty||1}</span>
        <button onclick="updateQty(${idx},1)">+</button>
        <button onclick="removeIndex(${idx})" title="Ta bort">🗑️</button>
      </div>
    `;
    list.appendChild(row);
  });

  if (subtotalEl) subtotalEl.textContent = money(subtotal);
  if (proceedBtn) proceedBtn.disabled = (cart.length===0);
}
function updateQty(index, delta){ const cart = getCart(); if (!cart[index]) return; cart[index].qty += delta; if (cart[index].qty <= 0) cart.splice(index,1); saveCart(cart); }
function removeIndex(index){ const cart = getCart(); cart.splice(index,1); saveCart(cart); }
function clearCart(){ saveCart([]); }

function openDrawer(){ document.getElementById('cartDrawer')?.classList.add('visible'); renderCartDrawer(); }
function closeDrawer(){ document.getElementById('cartDrawer')?.classList.remove('visible'); }

// Skapa kundvagns-drawer om den saknas
function mountDrawer(){
  if (document.getElementById('cartDrawer')) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="cartDrawer" class="drawer">
      <div class="drawer-head">
        <strong>Kundvagn</strong>
        <button class="icon-btn" id="closeDrawerBtn" aria-label="Stäng">✕</button>
      </div>
      <div class="drawer-body" id="cartList"></div>
      <div class="drawer-foot">
        <div class="row"><span>Delsumma</span><strong id="cartSubtotal">0 kr</strong></div>
        <div class="row2">
          <button class="btn ghost" id="clearCartBtn">Töm kundvagn</button>
          <button class="btn" id="checkoutBtnDrawer">Fortsätt till beställning</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrapper.firstElementChild);
  document.getElementById('closeDrawerBtn').addEventListener('click', closeDrawer);
  document.getElementById('clearCartBtn').addEventListener('click', clearCart);
  document.getElementById('checkoutBtnDrawer').addEventListener('click', goToCheckoutDummy);
}

// ---------- Produktkatalog ----------
let CATALOG_MAP = new Map();
async function fetchCatalog(){
  const r = await fetch('/.netlify/functions/catalog');
  if (!r.ok) throw new Error("Kunde inte hämta katalog ("+r.status+")");
  const j = await r.json();
  CATALOG_MAP = new Map(j.products.map(p => [p.sku, p]));
  return CATALOG_MAP;
}

// ---------- Visa paket + "Läs mer" ----------
function mountDetailsModal(){
  if (document.getElementById('detailsModal')) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="detailsModal" class="modal">
      <div class="modal-inner">
        <div class="modal-head">
          <h3 id="detailsTitle">Paketdetaljer</h3>
          <button class="icon-btn" id="detailsClose" aria-label="Stäng">✕</button>
        </div>
        <div id="detailsBody" class="modal-body"></div>
      </div>
    </div>`;
  document.body.appendChild(wrapper.firstElementChild);
  document.getElementById('detailsClose').addEventListener('click', ()=> document.getElementById('detailsModal').classList.remove('visible'));
  document.getElementById('detailsModal').addEventListener('click', (e)=>{ if(e.target.id==='detailsModal') e.currentTarget.classList.remove('visible'); });
}
function openDetailsModal(pkgTitle, items){
  mountDetailsModal();
  const m = document.getElementById('detailsModal');
  const body = document.getElementById('detailsBody');
  const title = document.getElementById('detailsTitle');
  title.textContent = `Paket: ${pkgTitle}`;
  body.innerHTML = `
    <table class="prod-table">
      <thead><tr><th>Produkt</th><th>Renhet & tester</th><th>Dosering & användning</th><th>Övrigt</th></tr></thead>
      <tbody>
      ${items.map(p=>{
        const purity = safe(p.purity) || safe(p.third_party_tests);
        const dose  = [safe(p.dosage), safe(p.usage_notes)].filter(Boolean).join('<br>');
        const misc  = [p.vegan?'Vegan':'', safe(p.allergens), safe(p.certifications), safe(p.source)]
          .filter(Boolean).map(x=>`<span class="badge">${x}</span>`).join(' ');
        const desc  = safe(p.description_short);
        const link  = safe(p.product_page_url);
        const img   = safe(p.image_url);
        const imgHtml = img ? `<div class="thumb"><img src="${img}" alt="${safe(p.name)}"></div>` : '';
        const linkHtml = link ? `<br><a href="${link}" target="_blank" rel="noopener">Produktlänk</a>` : '';
        return `<tr>
          <td><div class="prod-cell">${imgHtml}<div><strong>${safe(p.name)}</strong><br><span class="small muted">${safe(p.sku||'')}</span><br>${desc||''}${linkHtml}</div></div></td>
          <td>${purity || '-'}</td><td>${dose || '-'}</td><td>${misc || '-'}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>`;
  m.classList.add('visible');
}

async function renderStandardBundles(){
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  let map; try { map = await fetchCatalog(); } catch { grid.innerHTML = '<div class="muted">Kunde inte ladda produkter.</div>'; return; }

  grid.innerHTML = '';
  STANDARD_BUNDLES.forEach(b=>{
    const items = b.skus.map(sku => map.get(sku)).filter(Boolean);
    if (!items.length) return;
    const firstImage = items.find(p => p.image_url && String(p.image_url).trim().length)?.image_url;
    const coverImg = firstImage || b.img || 'assets/energy.jpeg';
    const total = items.reduce((s,p)=>s+(p.retail_price_ore||0),0);
    const lead  = items.reduce((m,p)=>Math.max(m, parseInt(p.lead_days||5,10)),0);

    const card = document.createElement('article');
    card.className = 'card product';
    card.innerHTML = `
      <div class="img" style="background:url('${coverImg}') center/cover;height:220px"></div>
      <div class="padded">
        <h3 class="title">${b.title}</h3>
        <p class="desc">${b.desc||''}</p>
        <ul class="contents">${items.map(p=>`<li>${p.name}</li>`).join('')}</ul>
        <div class="price-row"><span class="price">${money(total)}</span></div>
        <div class="row2" style="margin-top:8px;">
          <button class="btn add">Lägg i kundvagn</button>
          <button class="btn ghost more">Läs mer</button>
        </div>
        <div class="muted small">Leveranstid: ${lead||5} dagar</div>
      </div>`;
    card.querySelector('.add').addEventListener('click', ()=> addCustomToCart({
      title:b.title, items:items.map(p=>({name:p.name, price:p.retail_price_ore, sku:p.sku})), total_price:total
    }));
    card.querySelector('.more').addEventListener('click', ()=> openDetailsModal(b.title, items));
    grid.appendChild(card);
  });
}

// ---------- AI (smart prompt) ----------
function buildSystemPrompt(brief){
  return `
Du är en svensk hälsocoach på en e-handel. Anpassa svaret efter frågetyp:

1) Informationsfråga (t.ex. "varför är kollagen bra?"):
   - Ge ett tydligt, kortfattat men informativt svar om effekter på relevanta kroppssystem (hud/leder/skelett/immun/hjärna/mage/energi/sömn/inflammation m.fl.).
   - Beskriv kort mekanism och ev. dosering/användning samt säkerhetsnotis.
   - Avsluta med "Vill du att jag visar ett paket eller en produkt som passar detta?"

2) Mål/rekommendation (t.ex. "jag vill gå ner 5 kilo"):
   - Ge korta livsstilsråd.
   - Föreslå sedan ett paket/produkter ur katalogen med namn, innehåll, totalpris.

Använd katalogfakta när det passar (renhet, certifieringar, tester, dosering, vegan, allergener, källa).
Svara på svenska.

KATALOG (komprimerad):
${brief}`.trim();
}

function wireCoachForm(){
  const form = document.getElementById('coachForm');
  const resultEl = document.getElementById('coachResult');
  const textarea = document.getElementById('coachInput');
  if(!form || !textarea || !resultEl) return;

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = textarea.value.trim();
    if(!msg) return;
    resultEl.innerHTML = `<div class="muted small">Tänker…</div>`;

    try{
      const brief = Array.from(CATALOG_MAP.values()).map(p=>{
        const f = [
          `namn:${safe(p.name)}`, p.sku?`sku:${safe(p.sku)}`:'',
          p.purity?`renhet:${safe(p.purity)}`:'', p.third_party_tests?`tester:${safe(p.third_party_tests)}`:'',
          p.certifications?`cert:${safe(p.certifications)}`:'', p.allergens?`allergener:${safe(p.allergens)}`:'',
          (p.vegan!=null)?`vegan:${p.vegan?'ja':'nej'}`:'', p.dosage?`dosering:${safe(p.dosage)}`:'',
          p.usage_notes?`användning:${safe(p.usage_notes)}`:'', p.source?`källa:${safe(p.source)}`:''
        ].filter(Boolean).join('; ');
        return `- ${f}`;
      }).join('\n');

      const systemPrompt = buildSystemPrompt(brief);
      const res = await fetch('/.netlify/functions/assistant', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message: `${systemPrompt}\n\nKundens fråga:\n"${msg}"` })
      });
      const data = await res.json();

      let html = data.reply || 'Kunde inte generera svar just nu.';
      if (data.package) {
        const list = data.package.items.map(x => `• ${x.name} (${money(x.price)})`).join('<br>');
        const uid = 'pkg' + Math.random().toString(36).slice(2,8);
        html += `
          <div style="margin-top:10px;border-top:1px solid #e7efe9;padding-top:8px">
            <strong>${data.package.title}</strong><br>
            ${list}<br>
            <strong>Totalt: ${money(data.package.total_price)}</strong> • ETA: ${data.package.lead_days||5} d
            <div class="row2" style="margin-top:8px;">
              <button class="btn" id="${uid}_approve">Lägg i kundvagn</button>
              <button class="btn ghost" id="${uid}_more">Läs mer</button>
            </div>
          </div>`;
        setTimeout(()=>{
          document.getElementById(`${uid}_approve`)?.addEventListener('click', ()=>{
            addCustomToCart({
              title: data.package.title,
              items: data.package.items.map(i=>({name:i.name, price:i.price, sku:i.sku||null})),
              total_price: data.package.total_price
            });
          });
          const moreBtn = document.getElementById(`${uid}_more`);
          if (moreBtn){
            const items = (data.package.items||[])
              .map(i => (i.sku && CATALOG_MAP.get(i.sku)) || Array.from(CATALOG_MAP.values()).find(p=>p.name===i.name))
              .filter(Boolean);
            moreBtn.addEventListener('click', ()=> items.length ? openDetailsModal(data.package.title, items) : alert('Detaljer saknas just nu.'));
          }
        },0);
      }
      resultEl.innerHTML = `<div class="coach-proposal"><h3>AI-coach</h3><div>${html}</div></div>`;
      textarea.value = '';
      textarea.focus();

    }catch(err){
      console.error('[LF] AI-fel:', err);
      resultEl.innerHTML = '<div class="coach-proposal">Tekniskt fel – kontrollera API-nyckel / deploy och försök igen.</div>';
    }
  });
}

// ---------- Checkout (dummy) ----------
function getCustomerInfo(){ return { email:window.checkoutEmail||"test@example.com", name:window.checkoutName||"", phone:window.checkoutPhone||"" }; }
async function goToCheckoutDummy(){
  const cart=getCart(); if(!cart.length) return alert("Din kundvagn är tom.");
  const payload={ cart, customer:getCustomerInfo(), shipping:{lead_days:5} };
  try{
    const res=await fetch('/.netlify/functions/create-order',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const j=await res.json();
    if(j?.ok&&j.url){ saveCart([]); window.location=j.url; } else alert("Kunde inte skapa order just nu.");
  }catch(e){ alert("Tekniskt fel vid beställning."); }
}

// ---------- Om-oss-modal ----------
function openAbout(){ document.getElementById('aboutModal')?.classList.add('visible'); }
function closeAbout(){ document.getElementById('aboutModal')?.classList.remove('visible'); }

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', ()=>{
  mountDrawer();
  renderStandardBundles();
  wireCoachForm();
  updateCartSummary();

  document.getElementById('checkoutBtn')?.addEventListener('click', openDrawer);
  document.getElementById('checkoutBtnBottom')?.addEventListener('click', openDrawer);

  // Om-oss-öppnare
  document.getElementById('brandButton')?.addEventListener('click', openAbout);
  document.getElementById('openAboutLink')?.addEventListener('click', (e)=>{ e.preventDefault(); openAbout(); });

  // Om-oss-stängare
  document.getElementById('aboutClose')?.addEventListener('click', closeAbout);
  document.getElementById('aboutModal')?.addEventListener('click', (e)=>{ if(e.target.id==='aboutModal') closeAbout(); });
});
