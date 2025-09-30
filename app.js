// ======================
// La Familia Health - app.js (smartare AI + paket + kundvagn + Läs mer + chatt + bildstöd)
// ======================

// ---------- Standardpaket ----------
const STANDARD_BUNDLES = [
  { title:"Daily Essentials+", skus:["HF-001","HF-003","HF-014"], img:"assets/daily.jpg", desc:"Bas + omega-3 + kollagen" },
  { title:"Immun Boost",       skus:["HF-006","HF-018","HF-002","HF-008"], img:"assets/boost.jpg",  desc:"C + selen + D + probiotika" },
  { title:"Energi & Fokus",    skus:["HF-005","HF-022","HF-023","HF-013"], img:"assets/energy.jpeg",desc:"B-komplex + rhodiola + grönt te + elektrolyter" },
  { title:"Sömn & Återhämtning", skus:["HF-004","HF-021","HF-026","HF-039","HF-040"], img:"assets/sleep.jpg", desc:"Magnesium + L-teanin + kvällsritual" },
  { title:"Kickstart Vikt 30", skus:["HF-009","HF-011","HF-013","HF-001","HF-031"], img:"assets/weight.jpeg",desc:"Fiber + protein + elektrolyter + plan" },
  { title:"Kickstart Vegan 30", skus:["HF-009","HF-012","HF-013","HF-001","HF-031"], img:"assets/vegan.jpeg", desc:"Fiber + vegoprotein + elektrolyter + plan" }
];

// ---------- Helpers ----------
function money(ore){ return (ore/100).toLocaleString('sv-SE',{style:'currency',currency:'SEK'}).replace('SEK','kr'); }
const safe = (s)=> (s==null?'':String(s));
const nowTime = ()=> new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});

// ---------- Kundvagn i localStorage ----------
function getCart(){ try { return JSON.parse(localStorage.getItem('cart')||'[]'); } catch { return []; } }
function saveCart(c){ localStorage.setItem('cart', JSON.stringify(c)); updateCartSummary(); renderCartDrawer(); }
function addToCartLine(name, price, qty=1, sku=null){
  const cart = getCart();
  const i = cart.findIndex(x => x.name===name && x.price===price && x.sku===sku);
  if (i>=0) cart[i].qty += qty; else cart.push({ name, price, qty, sku });
  saveCart(cart);
}
function addCustomToCart(pkg){
  (pkg.items||[]).forEach(it => addToCartLine(it.name, it.price, 1, it.sku||null));
  openDrawer();
}

// ---------- Cart UI ----------
function updateCartSummary(){
  const cart = getCart();
  const count = cart.reduce((a,c)=>a+(c.qty||1),0);
  const total = cart.reduce((a,c)=>a+(c.price||0)*(c.qty||1),0);
  const el = document.getElementById('cartSummary');
  if (el) el.textContent = `Kundvagn: ${count} ${count===1?'vara':'varor'} • ${money(total)}`;
}
function renderCartDrawer(){
  const cart = getCart();
  const list = document.getElementById('cartList');
  const subtotalEl = document.getElementById('cartSubtotal');
  const proceedBtn = document.getElementById('checkoutBtnDrawer');
  if (!list) return;

  list.innerHTML = '';
  if (!cart.length) list.innerHTML = '<div class="muted">Kundvagnen är tom.</div>';

  let subtotal = 0;
  cart.forEach((item, idx)=>{
    subtotal += (item.price||0) * (item.qty||1);
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong><br>
        ${money(item.price)} x ${item.qty||1}
      </div>
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
function updateQty(index, delta){
  const cart = getCart();
  if (!cart[index]) return;
  cart[index].qty += delta;
  if (cart[index].qty <= 0) cart.splice(index,1);
  saveCart(cart);
}
function removeIndex(index){
  const cart = getCart();
  cart.splice(index,1);
  saveCart(cart);
}
function clearCart(){ saveCart([]); }

// ---------- Drawer öppna/stäng ----------
function openDrawer(){ document.getElementById('cartDrawer')?.classList.add('visible'); renderCartDrawer(); }
function closeDrawer(){ document.getElementById('cartDrawer')?.classList.remove('visible'); }

// ---------- Data / API ----------
let CATALOG_MAP = new Map();
async function fetchCatalog(){
  const r = await fetch('/.netlify/functions/catalog');
  if (!r.ok) throw new Error("Kunde inte hämta katalog ("+r.status+")");
  const j = await r.json();
  CATALOG_MAP = new Map(j.products.map(p => [p.sku, p]));
  return CATALOG_MAP;
}

// ---------- Modal för “Läs mer” ----------
function openDetailsModal(pkgTitle, items){
  const m = document.getElementById('detailsModal');
  const body = document.getElementById('detailsBody');
  const title = document.getElementById('detailsTitle');
  if (!m || !body || !title) return;

  title.textContent = `Paket: ${pkgTitle}`;
  body.innerHTML = `
    <table class="prod-table">
      <thead>
        <tr>
          <th>Produkt</th>
          <th>Renhet & tester</th>
          <th>Dosering & användning</th>
          <th>Övrigt</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(p=>{
          const purity = safe(p.purity) || safe(p.third_party_tests);
          const dose  = [safe(p.dosage), safe(p.usage_notes)].filter(Boolean).join('<br>');
          const misc  = [
            p.vegan ? 'Vegan' : '',
            safe(p.allergens),
            safe(p.certifications),
            safe(p.source)
          ].filter(Boolean).map(x=>`<span class="badge">${x}</span>`).join(' ');
          const desc  = safe(p.description_short);
          const link  = safe(p.product_page_url);
          const linkHtml = link ? `<br><a href="${link}" target="_blank" rel="noopener">Produktlänk</a>` : '';
          const img   = safe(p.image_url);
          const imgHtml = img ? `<div class="thumb"><img src="${img}" alt="${safe(p.name)}"></div>` : '';
          return `
            <tr>
              <td>
                <div class="prod-cell">
                  ${imgHtml}
                  <div>
                    <strong>${safe(p.name)}</strong><br>
                    <span class="small muted">${safe(p.sku||'')}</span><br>
                    ${desc||''}${linkHtml}
                  </div>
                </div>
              </td>
              <td>${purity || '-'}</td>
              <td>${dose || '-'}</td>
              <td>${misc || '-'}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  m.classList.add('visible');
}
function closeDetailsModal(){ document.getElementById('detailsModal')?.classList.remove('visible'); }

// ---------- Visa standardpaket ----------
async function renderStandardBundles(){
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  let map;
  try { map = await fetchCatalog(); }
  catch (e) {
    grid.innerHTML = `<div class="muted">Kunde inte ladda produkter.</div>`;
    return;
  }

  grid.innerHTML = '';
  STANDARD_BUNDLES.forEach(b => {
    const items = b.skus.map(sku => map.get(sku)).filter(Boolean);
    if (!items.length) return;

    // Paketbild: försök ta första produktens image_url, annars b.img, annars fallback
    const firstImage = items.find(p => p.image_url && String(p.image_url).trim().length)?.image_url;
    const coverImg = firstImage || b.img || 'assets/energy.jpeg';

    let total = 0, lead=0;
    items.forEach(p=>{ total+=p.retail_price_ore; lead=Math.max(lead, parseInt(p.lead_days||5,10)); });

    const card = document.createElement('article');
    card.className = 'card product';
    card.innerHTML = `
      <div class="img" style="background:url('${coverImg}') center/cover;height:220px"></div>
      <div class="padded">
        <h3 class="title">${b.title}</h3>
        <p class="desc">${b.desc || ''}</p>
        <ul class="contents">${items.map(p=>`<li>${p.name}</li>`).join('')}</ul>
        <div class="price-row"><span class="price">${money(total)}</span></div>
        <div class="row2" style="margin-top:8px;">
          <button class="btn add">Lägg i kundvagn</button>
          <button class="btn ghost more">Läs mer</button>
        </div>
        <div class="leadtime muted">Leveranstid: ${lead||5} dagar</div>
      </div>`;

    card.querySelector('.add').addEventListener('click', ()=>{
      const pkg = { title:b.title, items:items.map(p=>({name:p.name, price:p.retail_price_ore, sku:p.sku})), total_price:total };
      addCustomToCart(pkg);
    });

    card.querySelector('.more').addEventListener('click', ()=>{
      openDetailsModal(b.title, items);
    });

    grid.appendChild(card);
  });
}

// ---------- Chatt-UI ----------
function addChat(role, html){
  const log = document.getElementById('chatLog');
  if(!log) return;
  const line = document.createElement('div');
  line.className = `chat-msg ${role}`;
  line.innerHTML = `
    <div class="bubble">${html}</div>
    <div class="meta">${nowTime()}</div>
  `;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

// ---------- AI: smartare system-prompt (informera först, sälj sen) ----------
function buildSystemPrompt(catalogBrief){
  return `
Du är en svensk hälsocoach på en e-handels-sida. Anpassa svaret efter frågetypen:

1) Informationsfråga (t.ex. "varför är kollagen bra?", "hur funkar magnesium?"):
   - Svara först pedagogiskt med fysiologiska effekter, relevanta kroppssystem (hud/leder/skelett/immun/hjärna/mage/sömn/energi/inflammation m.fl.) och kort mekanism.
   - Ta med typisk dosering/användning och säkerhetsnotiser om relevant.
   - Avsluta med en mjuk fråga: "Vill du att jag visar ett paket eller en produkt som passar detta?"

2) Mål/rekommendationsfråga (t.ex. "jag vill gå ner 5 kilo", "vad rekommenderar du mot sömnproblem?"):
   - Ge först korta livsstilsråd (kost/träning/sömn/stress) om relevant.
   - Föreslå sedan ett paket eller individuella produkter från katalogen. Presentera tydligt namn, innehåll och totalpris.
   - Fråga om användaren vill lägga till i kundvagnen eller justera.

Viktigt:
- Blanda inte ihop: besvara alltid själva frågan först innan ev. rekommendation.
- Använd produktfakta från katalogen när det passar: renhet, certifieringar, tester, dosering, vegan, allergener, källa.
- Svara alltid på svenska.

KATALOG (komprimerad):
${catalogBrief}
`.trim();
}

// ---------- AI-coach (detaljerat svar + historik + enter/shift-enter) ----------
function wireCoachForm(){
  const form = document.getElementById('coachForm');
  const input = document.getElementById('coachInput');
  if(!form || !input) return;

  // Enter skickar; Shift+Enter = ny rad
  input.addEventListener('keydown', (e)=>{
    if(e.key==='Enter' && !e.shiftKey){
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = input.value.trim();
    if(!msg) return;

    addChat('user', msg);
    input.value = '';
    input.focus();

    try{
      // kondensera katalogen för kontext
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
        body: JSON.stringify({
          // vi kapslar systeminstruktionerna ihop med kundens fråga
          message: `${systemPrompt}\n\nKundens fråga:\n"${msg}"`
        })
      });
      const data = await res.json();

      // Bygg svar – lägg endast köp-UI om ett paket faktiskt föreslogs
      let html = data.reply ? data.reply : 'Kunde inte generera svar just nu.';
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
          </div>
        `;
        setTimeout(()=>{
          const approve = document.getElementById(`${uid}_approve`);
          const more = document.getElementById(`${uid}_more`);
          if (approve) approve.onclick = ()=>{
            addCustomToCart({
              title: data.package.title,
              items: data.package.items.map(i=>({name:i.name, price:i.price, sku:i.sku||null})),
              total_price: data.package.total_price
            });
          };
          if (more){
            const items = (data.package.items||[])
              .map(i => (i.sku && CATALOG_MAP.get(i.sku)) || Array.from(CATALOG_MAP.values()).find(p=>p.name===i.name))
              .filter(Boolean);
            if (items.length) more.onclick = ()=> openDetailsModal(data.package.title, items);
            else more.onclick = ()=> alert('Detaljer saknas just nu.');
          }
        }, 0);
      }

      addChat('assistant', html);

    }catch(err){
      console.error('[LF] AI-fel:', err);
      addChat('assistant', 'Tekniskt fel – kontrollera API-nyckel / deploy och försök igen.');
    }
  });
}

// ---------- Checkout (dummy) ----------
function getCustomerInfo(){
  return { email:window.checkoutEmail||"test@example.com", name:window.checkoutName||"", phone:window.checkoutPhone||"" };
}
async function goToCheckoutDummy(){
  const cart=getCart();
  if(!cart.length) return alert("Din kundvagn är tom.");
  const payload={ cart, customer:getCustomerInfo(), shipping:{lead_days:5} };
  try{
    const res=await fetch('/.netlify/functions/create-order',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    const j=await res.json();
    if(j?.ok&&j.url){ saveCart([]); window.location=j.url; } else alert("Kunde inte skapa order just nu.");
  }catch(e){ alert("Tekniskt fel vid beställning."); }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', ()=>{
  renderStandardBundles();
  wireCoachForm();
  updateCartSummary();

  document.getElementById('checkoutBtn')?.addEventListener('click', openDrawer);
  document.getElementById('checkoutBtnDrawer')?.addEventListener('click', goToCheckoutDummy);
  document.getElementById('clearCartBtn')?.addEventListener('click', clearCart);
  document.getElementById('closeDrawerBtn')?.addEventListener('click', closeDrawer);

  document.getElementById('detailsClose')?.addEventListener('click', closeDetailsModal);
  document.getElementById('detailsModal')?.addEventListener('click', (e)=>{ if(e.target.id==='detailsModal') closeDetailsModal(); });
});
