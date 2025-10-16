(async function(){
  const selSys = document.getElementById('selSystem');
  const selCat = document.getElementById('selCategory');
  const selEq  = document.getElementById('selEquipment');
  const btnShow = document.getElementById('btnShow');
  const btnClear = document.getElementById('btnClear');
  const btnCopy = document.getElementById('btnCopy');
  const resultCard = document.getElementById('resultCard');
  const resultArea = document.getElementById('resultArea');

  let data = null;
  try {
    const res = await fetch('assets/data.json', { cache: 'no-store' });
    data = await res.json();
  } catch {
    alert('Failed to load data.json'); return;
  }
  const rows = data.rows || [];
  const systems = data.systems || [];

  // Strip leading code like "1.3", "4a.1", "2b.", etc. from Equipment for display only
  function cleanEquip(name){
    if(!name) return name;
    const t = String(name);
    // regex: leading digits with optional letter segments separated by dots, optional trailing dot, then spaces
    return t.replace(/^\s*[0-9]+[a-zA-Z]?(\.[0-9a-zA-Z]+)*\.?\s+/, '');
  }

  selSys.innerHTML = '<option value="">All Systems</option>' + systems.map(s=>`<option value="${s}">${s}</option>`).join('');

  function uniq(arr){ return [...new Set(arr.filter(Boolean))]; }

  function populateCategory(){
    const sys = selSys.value;
    const filtered = sys ? rows.filter(r => r.system === sys) : rows;
    const cats = uniq(filtered.map(r => (r.category||'').trim()));
    selCat.innerHTML = '<option value="">-- All --</option>' + cats.map(c=>`<option value="${c}">${c}</option>`).join('');
    selEq.innerHTML = '<option value="">-- All --</option>';
  }

  function populateEquipment(){
    const sys = selSys.value;
    const cat = selCat.value;
    let filtered = sys ? rows.filter(r => r.system === sys) : rows;
    if (cat) filtered = filtered.filter(r => (r.category||'') === cat);
    const eqs = uniq(filtered.map(r => (r.equipment||'').trim()));
    // value = original, text = cleaned
    selEq.innerHTML = '<option value="">-- All --</option>' + eqs.map(e=>`<option value="${e}">${cleanEquip(e)}</option>`).join('');
  }

  selSys.addEventListener('change', ()=>{ populateCategory(); resultCard.classList.add('hidden'); });
  selCat.addEventListener('change', ()=>{ populateEquipment(); resultCard.classList.add('hidden'); });

  populateCategory();

  function dateOnly(val){
    if (!val) return '';
    const t = String(val).trim();
    const d = new Date(t);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
    const m = t.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m){
      const y=m[1], mm=('0'+m[2]).slice(-2), dd=('0'+m[3]).slice(-2);
      return `${y}-${mm}-${dd}`;
    }
    if (t.includes(' ')) return t.split(' ')[0];
    return t;
  }

  function remarkFormat(val){
    if(!val) return '';
    let txt = String(val).trim();
    const parts = txt.split(/[;，/。]+/).map(s=>s.trim()).filter(Boolean);
    if(parts.length===0) return txt;
    return `<div class='remark-block'><strong>Remark :</strong>` + parts.map(p=>`<span class='dot-line'>${p}</span>`).join('') + `</div>`;
  }

  function kv(label, value, emph=false){
    if (!value || String(value).trim()==='') return '';
    if(label==='Remark') return remarkFormat(value);
    return `<div class="kv"><strong>${label}</strong> : <span class="${emph?'emph':''}">${value}</span></div>`;
  }

  function render(){
    const sys = selSys.value;
    const cat = selCat.value;
    const eq  = selEq.value;

    let filtered = rows.slice();
    if (sys) filtered = filtered.filter(r => r.system === sys);
    if (cat) filtered = filtered.filter(r => (r.category||'') === cat);
    if (eq)  filtered = filtered.filter(r => (r.equipment||'') === eq);

    resultArea.innerHTML = '';
    if (!filtered.length){
      const none = document.createElement('div');
      none.textContent = 'No matching entry.';
      resultArea.appendChild(none);
      resultCard.classList.remove('hidden');
      return;
    }

    const first = filtered[0];
    const catVal = cat || (first.category || '');
    const eqVal  = eq  ? eq : (first.equipment || '');

    const header = document.createElement('div');
    header.className = 'header-block';
    header.innerHTML = (catVal ? kv('Category', catVal):'') + (eqVal ? kv('Equipment', cleanEquip(eqVal)) : '');
    resultArea.appendChild(header);

    filtered.forEach((r, idx)=>{
      const card = document.createElement('div');
      card.className = 'cred-card';
      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = `#${idx+1}`;
      card.appendChild(badge);
      const d = dateOnly(r.date);
      const slot = document.createElement('div');
      slot.innerHTML = [
        kv('Login ID', r.login, true),
        kv('Password', r.password, true),
        kv('Remark', r.remark, false),
        (d ? kv('Password Effective Date', d) : '')
      ].join('');
      card.appendChild(slot);
      resultArea.appendChild(card);
    });

    resultCard.classList.remove('hidden');
  }

  btnShow.addEventListener('click', (e)=>{ e.preventDefault(); render(); });
  btnClear.addEventListener('click', (e)=>{
    e.preventDefault();
    selSys.value=''; populateCategory(); selCat.value=''; populateEquipment();
    resultCard.classList.add('hidden');
  });
  btnCopy.addEventListener('click', async ()=>{
    const txt = resultArea.innerText || '';
    try{ await navigator.clipboard.writeText(txt); btnCopy.textContent='Copied'; setTimeout(()=>btnCopy.textContent='Copy',1000); }
    catch{ alert('Copy failed'); }
  });
})();