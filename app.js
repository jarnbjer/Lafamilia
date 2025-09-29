const PRODUCTS = [
  {id:'daily', name:'Daily Essentials', img:'assets/daily.jpg', desc:'Bas för vardagshälsa.', contents:['Multivitamin','Omega‑3','D‑vitamin','Magnesium'], price:59500, compare:69500, lt:'2–4 dagar'},
  {id:'energy', name:'Energiboost', img:'assets/energy.jpg', desc:'Mer energi i vardagen.', contents:['Adaptogener','B‑komplex','Grönt te‑extrakt (koffein)'], price:84500, compare:99500, lt:'2–4 dagar'},
  {id:'kickstart', name:'Kickstart 30', img:'assets/kickstart.jpg', desc:'30 dagars start för viktnedgång.', contents:['Måltidsersättning','Fiber (psyllium)','Koffeinfritt stöd','Digital guide'], price:129500, compare:149500, lt:'3–5 dagar'},
  {id:'sleep', name:'Sleep Deep', img:'assets/sleep.jpg', desc:'Magnesiumglycinat + L‑teanin + örtté.', contents:['Magnesiumglycinat','L‑teanin','Örtte'], price:89500, compare:109500, lt:'2–5 dagar'}
];

const state={cart:[]};
const money=ore=>(ore/100).toLocaleString('sv-SE',{style:'currency',currency:'SEK'}).replace('SEK','kr');

function renderProducts(){
  const grid=document.getElementById('productGrid');
  const tmpl=document.getElementById('productCardTmpl');
  PRODUCTS.forEach(p=>{
    const node=tmpl.content.cloneNode(true);
    const art=node.querySelector('.product'); art.dataset.id=p.id;
    const img=node.querySelector('.img'); img.style.backgroundImage=`url(${p.img})`; img.style.backgroundSize='cover'; img.style.backgroundPosition='center'; img.style.height='220px';
    node.querySelector('.title').textContent=p.name;
    node.querySelector('.desc').textContent=p.desc;
    const ul=node.querySelector('.contents'); p.contents.forEach(c=>{ const li=document.createElement('li'); li.textContent=c; ul.appendChild(li); });
    node.querySelector('.price').textContent=money(p.price);
    node.querySelector('.compare').textContent=money(p.compare);
    node.querySelector('.leadtime').textContent='Leveranstid: '+p.lt;
    node.querySelector('.add').addEventListener('click',()=>{ addToCart({id:p.id,name:p.name,price:p.price}); openDrawer(); });
    grid.appendChild(node);
  });
}

function addToCart(item){
  const ex = state.cart.find(i=>i.id===item.id && !i.custom);
  if(ex){ ex.qty++; } else { state.cart.push({ ...item, qty:1 }); }
  renderCart();
}

function addCustomToCart(pkg){
  const id='custom-'+Date.now();
  state.cart.push({ id, name:pkg.title+' (skrddarsytt)', price:pkg.total_price, qty:1, custom:true, details:pkg });
  renderCart(); openDrawer();
}

function renderCart(){
  const items=document.getElementById('cartItems'); const subtotal=document.getElementById('subtotal'); const count=document.getElementById('cartCount');
  items.innerHTML=''; let sum=0, n=0;
  state.cart.forEach((it,idx)=>{
    const row=document.createElement('div'); row.className='cart-item';
    const left=document.createElement('div');
    left.innerHTML = `<div class="name">${it.name}</div>` + (it.custom ? `<div class="muted small">${it.details.items.map(x=>x.name).join(', ')}</div>` : '');
    const right=document.createElement('div'); const unit=it.price; sum+=unit*it.qty; n+=it.qty;
    right.innerHTML=`<div>${money(unit)}</div>`;
    const qty=document.createElement('div'); qty.className='qty';
    const minus=document.createElement('button'); minus.textContent='–';
    const plus=document.createElement('button'); plus.textContent='+';
    const q=document.createElement('span'); q.textContent=it.qty;
    minus.addEventListener('click',()=>{ if(it.qty>1){ it.qty--; } else { state.cart.splice(idx,1);} renderCart(); });
    plus.addEventListener('click',()=>{ it.qty++; renderCart(); });
    qty.append(minus,q,plus); right.appendChild(qty);
    row.append(left,right); items.appendChild(row);
  });
  subtotal.textContent=money(sum); count.textContent=n;
}

function openDrawer(){ document.getElementById('cartDrawer').classList.add('visible'); }
function closeDrawer(){ document.getElementById('cartDrawer').classList.remove('visible'); }
document.getElementById('cartBtn').addEventListener('click', openDrawer);
document.getElementById('closeDrawer').addEventListener('click', closeDrawer);
document.getElementById('checkoutBtn').addEventListener('click',()=>alert('Demo: betalning kopplas in senare.'));

renderProducts();

// Real AI call
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
    let html = `<div class="coach-proposal"><h3>AI‑coach</h3><p>${reply}</p>`;
    if(data.package){
      const list = data.package.items.map(x => `• ${x.name} (${money(x.price)})`).join('<br>');
      html += `<p><strong>${data.package.title}</strong></p><p>${list}</p><p><strong>Totalt: ${money(data.package.total_price)}</strong></p>
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
