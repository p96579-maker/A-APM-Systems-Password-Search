(async function(){
  const $=s=>document.querySelector(s);
  const selSys=$("#selSystem"), selCat=$("#selCategory"), selEqp=$("#selEquipment");
  const showBtn=$("#showBtn"), results=$("#results"), count=$("#count"), meta=$("#meta");
  const loader=document.querySelector('.loader');

  // ===== Utilities =====
  const uniq = (arr)=> Array.from(new Set((arr||[]).filter(Boolean)))
    .sort((x,y)=> String(x).localeCompare(String(y),'en',{sensitivity:'base'}));
  const esc=s=>String(s||'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function fill(sel,vals,placeholder){
    const list = uniq(vals||[]);
    const prev = sel.value;
    sel.innerHTML = '';
    const mk=(v,l)=>{ const o=document.createElement('option'); o.value=v; o.textContent=v||l; return o; };
    sel.appendChild(mk('', placeholder));
    list.forEach(v=> sel.appendChild(mk(v, placeholder)));
    sel.value = list.includes(prev) ? prev : '';
  }

  // ===== Data load =====
async function loadData(force=false){
  const key='apm_data_json_cache_v1';
  const opt = force? {cache:'no-store'} : {cache:'reload'};
  try{
    const r=await fetch('assets/data.json?_='+(force?Date.now():''), opt);
    if(!r.ok) throw new Error('HTTP '+r.status);
    const j=await r.json();
    try{ localStorage.setItem(key, JSON.stringify(j)); }catch(e){}
    return j;
  }catch(e){
    console.warn('Network fetch failed, fallback to cache', e);
    const cached = localStorage.getItem(key);
    if(cached){ try{ return JSON.parse(cached); }catch(_){} }
    return [];
  }
}

  let DATA = await loadData(false);
  meta.textContent = (DATA?.length||0)+' rows';
  if(loader) setTimeout(()=>loader.classList.add('hidden'), 300);

  // ===== Cascading selects =====
  function changeSystem(){
    const sys=selSys.value;
    const subset=sys?DATA.filter(d=>d.System===sys):DATA;
    fill(selCat, subset.map(d=>d.Category), 'All categories');
    selCat.disabled=false;
    changeCategory();
  }
  function changeCategory(){
    const sys=selSys.value, cat=selCat.value;
    let subset=DATA.slice();
    if(sys) subset=subset.filter(d=>d.System===sys);
    if(cat) subset=subset.filter(d=>d.Category===cat);
    fill(selEqp, subset.map(d=>d.Equipment), 'All equipment');
    selEqp.disabled=false;
    showBtn.disabled = !(selSys.value||selCat.value||selEqp.value);
  }
  function buildSystem(){
    fill(selSys, DATA.map(d=>d.System), 'All systems');
    selSys.disabled=false;
    changeSystem();
  }

  // ---- Remark overrides (RAW mode to keep exact line breaks) ----
  const RAW_PREFIX = '!!RAW!!\n';
  const OVERRIDE_REMARKS = [
  // CCTV
  { cat:/^cctv$/i, eq:/^cctv camera$/i, remark:`Use onboard CCTV camera IP address to login:
4-Car Train - 192.168.1xx.11-18
2-Car Train - 192.168.1xx.11-14
**Remarks: xx = car number e.g. xx = 16 for V#16 and xx = 05 for V#5` },
  { cat:/^cctv$/i, eq:/^(decoder|decoder platform)$/i, remark:`Use respective IP address to login:
4-Car Train - 192.168.1xx.51-58
2-Car Train - 192.168.1xx.51-54
**Remarks: xx = car number e.g. xx = 16 for V#16 and xx = 05 for V#5` },

  // Platform PIS/PAS · Wayside interface server 1 / 2
  { cat:/^(pis\/pas|platform pis\/pas)$/i, eq:/^wayside interface server\s*1$/i, remark:`For T1L / RRL Located at CR40 SER, Old Depot IP address: 192.168.7.3 
For SPL Located at 1P005 SPL SER (New SER), Old Depot IP address: 192.168.8.3` },
  { cat:/^(pis\/pas|platform pis\/pas)$/i, eq:/^wayside interface server\s*2$/i, remark:`For T1L / RRL Located at CR40 SER, Old Depot IP address: 192.168.7.4 
For SPL Located at 1P005 SPL SER (New SER), Old Depot IP address: 192.168.8.4` },

  // Comms items
  { cat:/^comms$/i, eq:/^pei$/i, remark:`Please refer to the onboard comms equipment IP address list: 
4-Car Train - 192.168.1xx.21-28 
2-Car Train - 192.168.1xx.21-24 
**Remarks: xx = car number e.g. xx = 16 for V#16 and xx = 05 for V#5` },
  { cat:/^comms$/i, eq:/^onboard dms$/i, remark:`Please refer to the onboard comms equipment IP address list: 
4-CarTrain - 192.168.1xx.31-38 
2-CarTrain - 192.168.1xx.31-34 
**Remarks: xx = car number e.g. xx = 16 for V#16 and xx = 05 for V#5` },
  { cat:/^comms$/i, eq:/^onboard ethernet network switch$/i, remark:`Please refer to the onboard comms equipment IP address list: 
4-CarTrain - 192.168.1xx.41-44 
2-CarTrain - 192.168.1xx.41-42 
Remarks: xx = car number e.g. xx = 16 for V#16 and xx = 05 for V#5` },
];
  function getOverriddenRemark(category, equipment, fallback){
    const c = String(category||''); const e = String(equipment||'');
    for(const r of OVERRIDE_REMARKS){
      if(r.cat.test(c) && r.eq.test(e)) return RAW_PREFIX + r.remark;
    }
    return fallback;
  }

  // ---------- Smart split helpers ----------
  const ipv4Re = /\b(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\.(?:25[0-5]|2[0-4]\d|1?\d{1,2})){3}\b/g;

  function splitIPs(s){
    if(!s) return [];
    const ips = (String(s).match(ipv4Re)||[]);
    if(ips.length>1) return ips;
    const parts = String(s).split(/[,;&]+/).map(x=>x.trim()).filter(Boolean);
    const valid = parts.filter(p=>ipv4Re.test(p));
    return ips.length?ips:valid.length?valid:parts.length?parts:[String(s)];
  }

  function splitNumbered(s){
    s = String(s||'').replace(/\r/g,'').trim();
    if(!s) return [];
    const lines=[];
    const mFirst = s.match(/\b1\)\s*/);
    if(mFirst){
      const prefix = s.slice(0, mFirst.index).trim();
      if(prefix) lines.push(prefix);
      const regex = /(\d+\))\s*([^]+?)(?=(?:\s*\d+\))|$)/g;
      let m; while((m=regex.exec(s))){ lines.push((m[1]+' '+m[2]).trim()); }
      return lines;
    }
    if(/\s{2,}/.test(s)) return s.split(/\s{2,}/).map(x=>x.trim()).filter(Boolean);
    if(s.includes(' & ')) return s.split(/\s*&\s*/).map(x=>x.trim()).filter(Boolean);
    const commaParts = s.split(/\s*,\s*/).map(x=>x.trim()).filter(Boolean);
    if (commaParts.length>1) return commaParts;
    return [s];
  }

  const labelColonRe = /(?:^|\s)((?:[A-Za-z0-9#&/]+(?:\s+[A-Za-z0-9#&/]+){0,12})\s*:)/g;
  const labelHyphenRe = /(?:^|\s)((?:[A-Za-z][A-Za-z0-9 /&]+?)\s*-\s+)/g;

  function preprocessRemark(s){
    if(!s) return s;
    let t = String(s);
    t = t.replace(/Name:\s*?\n?\s*("?[^"\n]+?"?)\s+Management\s*IP:\s*/gi, (m, name) => {
      return `Name: ${name} | Management IP: `;
    });
    return t;
  }

  function splitLabeled(s){
    if(!s) return [];
    s = String(s).replace(/\r/g,'').trim();
    if(!s) return [];
    let marked = s.replace(labelColonRe, (m,g,offset)=> (offset===0? g : '|'+g))
                  .replace(labelHyphenRe, (m,g)=>'|'+g);
    let parts = marked.split('|').map(x=>x.trim()).filter(Boolean);
    const merged=[];
    for(let i=0;i<parts.length;i++){
      const cur = parts[i].replace(/\s*\n\s*/g,' ').trim();
      const next = (i+1<parts.length) ? parts[i+1].trim() : '';
      const curIsLabelOnly = /:\s*$|-\s*$/.test(cur);
      const nextStartsWithLabel = /^.{0,40}:\s|-\s/.test(next);
      if(curIsLabelOnly && next && !nextStartsWithLabel){
        merged.push((cur+' '+next).replace(/\s*\n\s*/g,' ').trim());
        i++;
      }else{
        merged.push(cur);
      }
    }
    const finalParts=[];
    for(const p of merged){
      let again = p.replace(labelColonRe, (m,g)=> (p.indexOf(m)===0 ? g : '||'+g))
                   .replace(labelHyphenRe, (m,g)=> (p.indexOf(m)===0 ? g : '||'+g));
      if(again.indexOf('||')>=0){
        finalParts.push(...again.split('||').map(t=>t.trim()).filter(Boolean));
      }else{
        finalParts.push(p);
      }
    }
    return finalParts;
  }

  function splitRemark(s){
    if(!s) return [];
    const txt = String(s);
    if (txt.startsWith(RAW_PREFIX)) {
      return txt.slice(RAW_PREFIX.length)
        .split(/\n+/)
        .map(t => t.trim())
        .filter(Boolean);
    }
    const pre = preprocessRemark(txt);
    let parts = splitLabeled(pre);
    if(!parts.length) parts = [pre].filter(Boolean);
    parts = parts.map(p => splitNumbered(p)).flat();
    return parts;
  }

  function getFiltered(){
    const sys=selSys.value, cat=selCat.value, eqp=selEqp.value;
    let s=DATA.slice();
    if(sys) s=s.filter(d=>d.System===sys);
    if(cat) s=s.filter(d=>d.Category===cat);
    if(eqp) s=s.filter(d=>d.Equipment===eqp);
    return s.filter(d=>(d['Login ID']||d['Password']||d['IP']||d['Remark']||d['Category']||d['Equipment']));
  }

  function render(){
    const rows=getFiltered();
    results.innerHTML='';
    if(!rows.length){ results.classList.add('hidden'); count.classList.add('hidden'); return; }
    results.classList.remove('hidden'); count.classList.remove('hidden');
    count.textContent=rows.length+' result'+(rows.length>1?'s':'');
    rows.forEach(r=>{
      const card=document.createElement('div'); card.className='card';
      const title=document.createElement('div'); title.className='title';
      const pill=document.createElement('span'); pill.className='badge'; pill.textContent=r.System||'—';
      const label=document.createElement('div'); label.innerHTML=`<b>${esc(r.Category||'Uncategorized')}</b> · ${esc(r.Equipment||'Unnamed')}`;
      title.appendChild(pill); title.appendChild(label); card.appendChild(title);

      const kv=document.createElement('div'); kv.className='kvs';
      const add=(k,v,kind)=>{ v=String(v||'').trim(); if(!v||v.toLowerCase()==='nan')return;
        let parts=[v];
        if(kind==='ip') parts=splitIPs(v);
        else if(kind==='login' || kind==='password') parts=splitNumbered(v);
        else if(kind==='remark') parts=splitRemark(v);
        const K=document.createElement('div'); K.className='k'; K.textContent=k;
        const V=document.createElement('div');
        V.innerHTML=parts.map(p=>`<div class="vline">${esc(p).replace(ipv4Re, m=>'<code>'+m+'</code>')}</div>`).join('');
        kv.appendChild(K); kv.appendChild(V);
      };
      add('Login ID', r['Login ID'], 'login');
      add('Password', r['Password'], 'password');
      add('IP', r['IP'], 'ip');
      const remark = getOverriddenRemark(r['Category'], r['Equipment'], r['Remark']);
      add('Remark', remark, 'remark');

      card.appendChild(kv);
      results.appendChild(card);
    });
  }

  selSys.addEventListener('change',()=>{ changeSystem(); results.classList.add('hidden'); count.classList.add('hidden'); showBtn.disabled=!(selSys.value||selCat.value||selEqp.value); });
  selCat.addEventListener('change',()=>{ changeCategory(); results.classList.add('hidden'); count.classList.add('hidden'); showBtn.disabled=!(selSys.value||selCat.value||selEqp.value); });
  selEqp.addEventListener('change',()=>{ showBtn.disabled=!(selSys.value||selCat.value||selEqp.value); });
  showBtn.addEventListener('click',render);
  document.addEventListener('click',e=>{ if(e.target && e.target.id==='clearBtn'){ selSys.value=''; changeSystem(); selCat.value=''; changeCategory(); selEqp.value=''; results.classList.add('hidden'); count.classList.add('hidden'); showBtn.disabled=true; } });

  buildSystem();
  document.getElementById('updateBtn')?.addEventListener('click', async ()=>{
    const btn = document.getElementById('updateBtn');
    const old = btn.textContent; btn.textContent='Updating…'; btn.disabled=true;
    const loader=document.querySelector('.loader'); loader?.classList.remove('hidden');
    const data = await loadData(true);
    window.DATA = DATA = data;
    meta.textContent = (DATA?.length||0)+' rows';
    changeSystem(); selCat.value=''; changeCategory(); selEqp.value='';
    results.classList.add('hidden'); count.classList.add('hidden');
    setTimeout(()=>loader?.classList.add('hidden'), 250);
    btn.textContent='Updated'; setTimeout(()=>{btn.textContent=old; btn.disabled=false;}, 1200);
  });
})();