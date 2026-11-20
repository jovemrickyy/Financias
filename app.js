/* Violet Finance — dados salvos no próprio celular (localStorage) */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const CATS={
  out:{"Alimentação":"🍔","Transporte":"🚌","Combustível":"⛽","Moradia":"🏠","Lazer":"🎮","Saúde":"💊","Compras":"🛍️","Contas":"🧾","Outros":"📦"},
  in:{"Salário":"💼","Freelance":"💻","Investimentos":"📈","Presente":"🎁","Outros":"💰"}
};
const store={
  get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
};
let tx=store.get("tx",[]), trips=store.get("trips",[]), cfg=store.get("cfg",{kml:10,price:6.2});
let cur=new Date(); cur.setDate(1);
let filter="all", sheetType="out", editId=null;
const brl=v=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const mkey=d=>d.slice(0,7);
const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const save=()=>{store.set("tx",tx);store.set("trips",trips);store.set("cfg",cfg)};
const vibrate=(n=10)=>{try{navigator.vibrate&&navigator.vibrate(n)}catch{}};

/* ---------- Ilha dinâmica ---------- */
let islT;
function island(msg,kind=""){
  const el=$("#island");
  $("#islText").textContent=msg;
  el.className="";void el.offsetWidth;
  el.classList.add("open"); if(kind)el.classList.add(kind);
  clearTimeout(islT); islT=setTimeout(()=>el.classList.remove("open"),2400);
}

/* ---------- Splash ---------- */
window.addEventListener("load",()=>{
  setTimeout(()=>{$("#splash").classList.add("out");setTimeout(()=>{$("#splash").remove();island("Bem-vindo 💜")},800)},2600);
});

/* ---------- Abas ---------- */
function moveThumb(){
  const b=$("#tabbar button.active"),t=$(".tab-thumb");
  t.style.width=b.offsetWidth-4+"px";
  t.style.transform=`translateX(${b.offsetLeft+2}px)`;
}
$$("#tabbar button").forEach(b=>b.onclick=()=>{
  vibrate();
  $$("#tabbar button").forEach(x=>x.classList.toggle("active",x===b));
  $$(".tab").forEach(t=>t.classList.toggle("active",t.id==="tab-"+b.dataset.tab));
  moveThumb(); window.scrollTo({top:0,behavior:"smooth"});
  if(b.dataset.tab==="map"){initMap();setTimeout(()=>map.invalidateSize(),100)}
});
window.addEventListener("load",()=>setTimeout(moveThumb,50));
window.addEventListener("resize",moveThumb);

/* ---------- Segmentados ---------- */
function seg(el,onPick){
  const th=el.querySelector(".seg-thumb");
  const place=()=>{const b=el.querySelector("button.on");if(!b)return;th.style.width=b.offsetWidth+"px";th.style.transform=`translateX(${b.offsetLeft-4}px)`};
  el.querySelectorAll("button").forEach(b=>b.onclick=()=>{
    vibrate(); el.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); place(); onPick(b);
  });
  el._place=place; setTimeout(place,60);
}
seg($("#filterSeg"),b=>{filter=b.dataset.f;renderList()});
seg($("#typeSeg"),b=>{sheetType=b.dataset.t;fillCats()});

/* ---------- Mês ---------- */
$("#prevM").onclick=()=>{cur.setMonth(cur.getMonth()-1);render()};
$("#nextM").onclick=()=>{cur.setMonth(cur.getMonth()+1);render()};
const curKey=()=>`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`;

/* ---------- Render ---------- */
function itemHTML(t,i=0){
  const ico=(CATS[t.type]||{})[t.cat]||"💸";
  const d=t.date.split("-").reverse().slice(0,2).join("/");
  return `<div class="item" data-id="${t.id}" style="animation-delay:${i*40}ms"><div class="ico">${ico}</div><div class="info"><b>${esc(t.desc||t.cat)}</b><small>${t.cat} • ${d}</small></div><div class="val ${t.type}">${t.type==="in"?"+":"-"}${brl(t.value)}</div></div>`;
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function render(){
  const k=curKey();
  $("#monthLabel").textContent=cur.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const m=tx.filter(t=>mkey(t.date)===k).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  const tin=m.filter(t=>t.type==="in").reduce((s,t)=>s+t.value,0);
  const tout=m.filter(t=>t.type==="out").reduce((s,t)=>s+t.value,0);
  countTo($("#balance"),tin-tout); $("#totIn").textContent=brl(tin); $("#totOut").textContent=brl(tout);
  // categorias
  const by={}; m.filter(t=>t.type==="out").forEach(t=>by[t.cat]=(by[t.cat]||0)+t.value);
  const ents=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  $("#cats").innerHTML=ents.length?ents.map(([c,v])=>`<div class="cat"><div class="cat-h"><span>${CATS.out[c]||"📦"} ${c}</span><span>${brl(v)}</span></div><div class="bar"><i data-w="${(v/tout*100).toFixed(1)}"></i></div></div>`).join(""):`<div class="empty">Sem gastos neste mês</div>`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>$$(".bar i").forEach(b=>b.style.width=b.dataset.w+"%")));
  $("#recent").innerHTML=m.length?m.slice(0,5).map(itemHTML).join(""):`<div class="empty">Toque em + para lançar</div>`;
  renderChart(); renderList(); renderTrips(); bindItems();
}
function renderChart(){
  const months=[];
  for(let i=5;i>=0;i--){const d=new Date(cur.getFullYear(),cur.getMonth()-i,1);months.push({k:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,l:d.toLocaleDateString("pt-BR",{month:"short"}).replace(".",""),i:0,o:0})}
  tx.forEach(t=>{const m=months.find(x=>x.k===mkey(t.date));if(m){if(t.type==="in")m.i+=t.value;else m.o+=t.value}});
  const max=Math.max(...months.map(m=>Math.max(m.i,m.o)),1);
  const W=340,H=190,top=22,bot=26,ch=H-top-bot,slot=W/6,bw=15;
  const short=v=>v>=1000?(v/1000).toFixed(v>=10000?0:1).replace(".",",")+"k":Math.round(v);
  let s=`<svg viewBox="0 0 ${W} ${H}" class="chart-svg"><defs><linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ee7b7"/><stop offset="1" stop-color="#059669"/></linearGradient><linearGradient id="go" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4a1ff"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>`;
  for(let g=0;g<=3;g++){const y=top+ch-ch*g/3;s+=`<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#241b38" stroke-dasharray="3 5"/>`}
  months.forEach((m,n)=>{
    const cx=slot*n+slot/2, hi=m.i/max*ch, ho=m.o/max*ch, isCur=n===5;
    s+=`<g class="bargrp" style="animation-delay:${n*70}ms">`;
    s+=`<rect class="bar-in" x="${cx-bw-1.5}" y="${top+ch-hi}" width="${bw}" height="${Math.max(hi,m.i?3:0)}" rx="5" fill="url(#gi)"/>`;
    s+=`<rect class="bar-out" x="${cx+1.5}" y="${top+ch-ho}" width="${bw}" height="${Math.max(ho,m.o?3:0)}" rx="5" fill="url(#go)"/>`;
    s+=`</g>`;
    if(m.i)s+=`<text x="${cx-bw/2-1.5}" y="${top+ch-hi-5}" class="cv" fill="#6ee7b7">${short(m.i)}</text>`;
    if(m.o)s+=`<text x="${cx+bw/2+1.5}" y="${top+ch-ho-5}" class="cv" fill="#c4a1ff">${short(m.o)}</text>`;
    s+=`<text x="${cx}" y="${H-8}" class="cl${isCur?" cur":""}">${m.l}</text>`;
  });
  s+=`</svg>`;
  $("#chart").innerHTML=s;
}
function renderList(){
  const k=curKey();
  const m=tx.filter(t=>mkey(t.date)===k&&(filter==="all"||t.type===filter)).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  $("#allList").innerHTML=m.length?m.map(itemHTML).join(""):`<div class="empty">Nada por aqui</div>`;
  bindItems();
}
function bindItems(){$$(".item[data-id]").forEach(el=>el.onclick=()=>{vibrate();openSheet(+el.dataset.id)})}
function countTo(el,to){
  const from=el._v||0; el._v=to; const t0=performance.now();
  (function f(t){const p=Math.min((t-t0)/700,1),e=1-Math.pow(1-p,4);el.textContent=brl(from+(to-from)*e);if(p<1)requestAnimationFrame(f)})(t0);
}

/* ---------- Folha de lançamento ---------- */
function fillCats(sel){
  $("#fCat").innerHTML=Object.keys(CATS[sheetType]).map(c=>`<option>${c}</option>`).join("");
  if(sel)$("#fCat").value=sel;
}
function setType(t){
  sheetType=t; $$("#typeSeg button").forEach(b=>b.classList.toggle("on",b.dataset.t===t)); $("#typeSeg")._place();
}
function openSheet(id=null){
  editId=id; const t=id?tx.find(x=>x.id===id):null;
  $("#sheetTitle").textContent=t?"Editar lançamento":"Novo lançamento";
  $("#fDel").classList.toggle("hidden",!t);
  $("#sheet").classList.add("show"); $("#backdrop").classList.add("show"); $("#fab").classList.add("hide");
  setTimeout(()=>setType(t?t.type:"out"),30);
  fillCats(t&&t.cat);
  $("#fValue").value=t?t.value:""; $("#fDesc").value=t?t.desc:""; $("#fDate").value=t?t.date:today();
  if(!t)setTimeout(()=>$("#fValue").focus(),500);
}
function closeSheet(){$("#sheet").classList.remove("show");$("#backdrop").classList.remove("show");$("#fab").classList.remove("hide")}
$("#fab").onclick=()=>{vibrate();openSheet()};
$("#backdrop").onclick=closeSheet;
$("#fSave").onclick=()=>{
  const v=parseFloat($("#fValue").value);
  if(!(v>0)){island("Digite um valor válido");vibrate([30,40,30]);return}
  const o={type:sheetType,value:v,desc:$("#fDesc").value.trim(),cat:$("#fCat").value,date:$("#fDate").value||today()};
  if(editId){Object.assign(tx.find(x=>x.id===editId),o);island("Atualizado ✓")}
  else{tx.push({id:Date.now(),...o});island((o.type==="in"?"+ ":"− ")+brl(v),o.type)}
  vibrate(20); save(); closeSheet(); cur=new Date(o.date+"T12:00");cur.setDate(1); render();
};
$("#fDel").onclick=()=>{tx=tx.filter(x=>x.id!==editId);save();closeSheet();render();island("Excluído","out")};

/* ---------- Mapa ---------- */
let map,pts=[],markers=[],line=null,distKm=0,routeToken=0;
function initMap(){
  if(map||!window.L)return;
  map=L.map("map",{zoomControl:true}).setView([-23.55,-46.63],12);
  // Mapa gratuito, SEM chave de API (OpenStreetMap), escurecido por CSS. Se falhar, troca para outro servidor.
  const osm=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,className:"osm-dark",attribution:"© OpenStreetMap"}).addTo(map);
  let fell=false,errs=0;
  osm.on("tileerror",()=>{
    if(fell||++errs<3)return; fell=true; map.removeLayer(osm);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:19,attribution:"© OpenStreetMap © CARTO"}).addTo(map);
  });
  map.on("click",e=>addPoint(e.latlng.lat,e.latlng.lng));
  navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>map.setView([p.coords.latitude,p.coords.longitude],13),()=>{});
}
function addPoint(lat,lng,name){
  pts.push({lat,lng,name:name||`Ponto ${pts.length+1}`}); vibrate(12);
  drawRoute();
  if(!name)reverse(lat,lng).then(n=>{if(n){const p=pts.find(q=>q.lat===lat&&q.lng===lng);if(p)p.name=n}});
}
async function reverse(lat,lng){
  try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);const j=await r.json();return (j.display_name||"").split(",").slice(0,2).join(",")}catch{return null}
}
const hav=(a,b)=>{const R=6371,r=x=>x*Math.PI/180,dLa=r(b.lat-a.lat),dLo=r(b.lng-a.lng);const h=Math.sin(dLa/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
async function drawRoute(){
  markers.forEach(m=>m.remove()); markers=[];
  if(line){line.remove();line=null}
  pts.forEach((p,i)=>{
    const ic=L.divIcon({className:"",html:`<div class="pin"><b>${i+1}</b></div>`,iconSize:[30,30],iconAnchor:[15,30]});
    markers.push(L.marker([p.lat,p.lng],{icon:ic}).addTo(map));
  });
  const tok=++routeToken; distKm=0;
  if(pts.length>1){
    let coords=null;
    try{
      const path=pts.map(p=>`${p.lng},${p.lat}`).join(";");
      const r=await fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`);
      const j=await r.json();
      if(j.routes&&j.routes[0]){distKm=j.routes[0].distance/1000;coords=j.routes[0].geometry.coordinates.map(c=>[c[1],c[0]])}
    }catch{}
    if(tok!==routeToken)return;
    if(!coords){for(let i=1;i<pts.length;i++)distKm+=hav(pts[i-1],pts[i])*1.3;coords=pts.map(p=>[p.lat,p.lng])}
    line=L.polyline(coords,{color:"#a66bff",weight:5,opacity:.95,lineCap:"round"}).addTo(map);
    map.fitBounds(line.getBounds(),{padding:[40,40]});
  }
  calc();
}
function calc(){
  cfg.kml=parseFloat($("#kml").value)||cfg.kml; cfg.price=parseFloat($("#fuelPrice").value)||cfg.price;
  const l=cfg.kml>0?distKm/cfg.kml:0, cost=l*cfg.price;
  $("#tKm").textContent=distKm.toFixed(1).replace(".",",")+" km";
  $("#tL").textContent=l.toFixed(1).replace(".",",")+" L";
  $("#tCost").textContent=brl(cost); save(); return cost;
}
$("#kml").value=cfg.kml; $("#fuelPrice").value=cfg.price;
$("#kml").oninput=$("#fuelPrice").oninput=calc;
$("#undo").onclick=()=>{if(pts.length){pts.pop();drawRoute()}};
$("#clearPts").onclick=()=>{pts=[];drawRoute();island("Rota limpa")};
$("#locate").onclick=()=>{
  initMap(); island("Buscando GPS…");
  navigator.geolocation.getCurrentPosition(p=>{map.setView([p.coords.latitude,p.coords.longitude],15);addPoint(p.coords.latitude,p.coords.longitude,"Minha posição")},()=>island("GPS indisponível"),{enableHighAccuracy:true,timeout:10000});
};
async function doSearch(){
  const q=$("#search").value.trim(); if(!q)return; initMap(); island("Buscando…");
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
    const j=await r.json();
    if(!j[0]){island("Local não encontrado");return}
    const lat=+j[0].lat,lng=+j[0].lon; map.setView([lat,lng],15);
    addPoint(lat,lng,j[0].display_name.split(",").slice(0,2).join(",")); $("#search").value=""; island("Parada adicionada 📍");
  }catch{island("Sem conexão")}
}
$("#searchBtn").onclick=doSearch;
$("#search").onkeydown=e=>{if(e.key==="Enter")doSearch()};
$("#saveTrip").onclick=()=>{
  if(pts.length<2){island("Adicione 2+ pontos");vibrate([30,40,30]);return}
  const cost=calc(), name=$("#tripName").value.trim()||`${pts[0].name} → ${pts[pts.length-1].name}`;
  trips.unshift({id:Date.now(),name,km:distKm,cost,date:today(),pts:pts.map(p=>({...p}))});
  tx.push({id:Date.now()+1,type:"out",value:+cost.toFixed(2),desc:"⛽ "+name,cat:"Combustível",date:today()});
  save(); vibrate(25); island("Gasolina "+brl(cost)+" lançada","out");
  pts=[];$("#tripName").value="";drawRoute();render();
};
function renderTrips(){
  $("#trips").innerHTML=trips.length?trips.map((t,i)=>`<div class="item" data-trip="${t.id}" style="animation-delay:${i*40}ms"><div class="ico">🛣️</div><div class="info"><b>${esc(t.name)}</b><small>${t.km.toFixed(1).replace(".",",")} km • ${t.date.split("-").reverse().slice(0,2).join("/")}</small></div><div class="val out">${brl(t.cost)}</div></div>`).join(""):`<div class="empty">Nenhuma viagem ainda</div>`;
  $$("[data-trip]").forEach(el=>el.onclick=()=>{
    const t=trips.find(x=>x.id==el.dataset.trip); if(!t||!confirm("Carregar esta rota no mapa?"))return;
    initMap(); pts=t.pts.map(p=>({...p})); drawRoute(); window.scrollTo({top:0,behavior:"smooth"});
  });
}

/* ---------- PWA ---------- */
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
render();
