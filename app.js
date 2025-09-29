// ======================
// La Familia Health - app.js (med kundvagnsfönster & nytt checkoutflöde)
// ======================

// ---------- Standardpaket ----------
const STANDARD_BUNDLES = [
  { title:"Daily Essentials+", skus:["HF-001","HF-003","HF-014"], img:"assets/daily.jpg", desc:"Bas + omega-3 + kollagen" },
  { title:"Immun Boost", skus:["HF-006","HF-018","HF-002","HF-008"], img:"assets/boost.jpg", desc:"C + selen + D + probiotika" },
  { title:"Energi & Fokus", skus:["HF-005","HF-022","HF-023","HF-013"], img:"assets/energy.jpeg", desc:"B-komplex + rhodiola + grönt te + elektrolyter" },
  { title:"Sömn & Återhämtning", skus:["HF-004","HF-021","HF-026","HF-039","HF-040"], img:"assets/sleep.jpg", desc:"Magnesium + L-teanin + kvällsritual" },
  { title:"Kickstart Vikt 30", skus:["HF-009","HF-011","HF-013","HF-001","HF-031"], img:"assets/weight.jpeg", desc:"Fiber + protein + elektrolyter + plan" },
  { title:"Kickstart Vegan 30", skus:["HF-009","HF-012","HF-013","HF-001","HF-031"], img:"assets/vegan.jpeg", desc:"Fiber + vegoprotein + elektrolyter + plan" }
];

// ---------- Helpers ----------
function money(ore){
  return (ore/100).toLocaleString('sv-SE',{style:'currency',currency:'SEK'}).replace('SEK','kr');
}

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
  const count = cart.reduce((a,c)=>a+c.qty,0);
  const total = cart.reduce((a,c)=>a+c.price*c.qty,0);
  const el = document.getElementById('cartSummary');
  if (el) el.textContent = `Kundvagn: ${count} varor • ${money(total)}`;
}
function renderCartDrawer(){
  const cart = getCart();
  const list = document.getElementById('cartList');
  const subtotalEl = document.getElementById('cartSubtotal');
  const proceedBtn = document.getElementById('checkoutBtnDrawer');
  if (!list) return;

  list.innerHTML = '';
  let subtotal = 0;

  cart.forEach((item, idx)=>{
    subtotal += item.price * item.qty;
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong><br>
        ${money(item.price)} x ${item.qty}
      </div>
      <div class="qty">
        <button onclick="updateQty(${idx},-1)">−</button>
        <span>${item.qty}</span>
        <button onclick="updateQty(${idx},1)">+</button>
        <button onclick="removeIndex(${idx})">🗑️</button>
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
  if (cart[index].qty<=0) cart.splice(index,1);
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
async function fetchCatalog(){
  const r = await fetch('/.netlify/functions/catalog');
  if (!r.ok) throw new Error("Kunde inte hämta katalog ("+r.status+")");
  const j = await r.json();
  return new Map(j.products.map(p => [p.sku, p]));
}

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
    if (items.length===0) return;
    let total = 0, lead=0;
    items.forEach(p=>{ total+=p.retail_price_ore; lead=Math.max(lead, parseInt(p.lead_days||5,10)); });

    const card = document.createElement('article');
    card.className = 'card product';
    const imgUrl = b.img || 'assets/energy.jpeg';
    card.innerHTML = `
      <div class="img" style="background:url('${imgUrl}') center/cover;height:220px"></div>
      <div class="padded">
        <h3 class="title">${b.title}</h3>
        <p class="desc">${b.desc || ''}</p>
        <ul class="contents">${items.map(p=>`<li>${p.name}</li>`).join('')}</ul>
        <div class="price-row"><span class="price">${money(total)}</span></div>
        <button class="btn add">Lägg i kundvagn</button>
        <div class="leadtime muted">Leveranstid: ${lead||5} dagar</div>
      </div>`;
    card.querySelector('.add').addEventListener('click', ()=>{
      const pkg = { title:b.title, items:items.map(p=>({name:p.name, price:p.retail_price_ore, sku:p.sku})), total_price:total };
      addCustomToCart(pkg);
    });
    grid.appendChild(card);
  });
}

// ---------- AI-coach ----------
function wireCoachForm(){
  const form=document.getElementById('coachForm');
  const resultEl=document.getElementById('coachResult');
  if(!form||!resultEl) return;

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const msg=new FormData(form).get('msg');
    resultEl.innerHTML='<div class="muted small">Tänker…</div>';

    try{
      const res=await fetch('/.netlify/functions/assistant',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:msg})
      });
      const data=await res.json();
      const reply=data.reply||'Kunde inte generera svar.';
      let html=`<div class="coach-proposal"><h3>AI-coach</h3><p>${reply}</p>`;
      if(data.package){
        const list=data.package.items.map(x=>`• ${x.name} (${money(x.price)})`).join('<br>');
        html+=`
          <p><strong>${data.package.title}</strong></p>
          <p>${list}</p>
          <p><strong>Totalt: ${money(data.package.total_price)}</strong></p>
          <div class="row2">
            <button id="approveBtn" class="btn">Godkänn & lägg i kundvagn</button>
            <button id="tweakBtn" class="btn ghost">Justera</button>
          </div>`;
      }
      resultEl.innerHTML=html+'</div>';

      document.getElementById('approveBtn')?.addEventListener('click',()=>{
        addCustomToCart({
          title:data.package.title,
          items:data.package.items.map(i=>({name:i.name,price:i.price,sku:i.sku||null})),
          total_price:data.package.total_price
        });
      });
      document.getElementById('tweakBtn')?.addEventListener('click',()=>alert('Säg vad du vill ändra: "koffeinfritt", "max 900 kr", "lägg till sömn" osv.'));
    }catch(err){
      console.error("[LF] AI-fel:",err);
      resultEl.innerHTML='<div class="coach-proposal">Tekniskt fel – kontrollera API-nyckel / deploy.</div>';
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
  const res=await fetch('/.netlify/functions/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const j=await res.json();
  if(j?.ok&&j.url){ saveCart([]); window.location=j.url; } else alert("Kunde inte skapa order.");
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', ()=>{
  renderStandardBundles();
  wireCoachForm();
  updateCartSummary();

  // Klick för att öppna/stänga kundvagn
  document.getElementById('checkoutBtn')?.addEventListener('click', openDrawer);
  document.getElementById('checkoutBtnDrawer')?.addEventListener('click', goToCheckoutDummy);
  document.getElementById('clearCartBtn')?.addEventListener('click', clearCart);
  document.getElementById('closeDrawerBtn')?.addEventListener('click', closeDrawer);
});
