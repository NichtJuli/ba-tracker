// ===== FIREBASE CONFIG =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD4N2ttAQ-vikybyVQUp5dG_lccB2Z0wkU",
  authDomain: "ba-tracker-julian.firebaseapp.com",
  projectId: "ba-tracker-julian",
  storageBucket: "ba-tracker-julian.firebasestorage.app",
  messagingSenderId: "231583309592",
  appId: "1:231583309592:web:04a84152c5c6c0e2b3886d"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const STATE_DOC = doc(db, 'tracker', 'state');

// ===== STATE =====
let MODE = null;

let S = {
  progress: 7,
  currentWeek: 1,
  pin: '1234',
  moodData: [],
  backlog: [],
  personal: { text: '', excuse: '', motivation: '' },
  activeFilters: ['stress', 'health', 'motivation', 'overall'],
  currentDone: [],
  currentNext: [],
  currentIssues: [],
  currentNote: ''
};

const COLORS = {
  stress: '#ff4466',
  health: '#00e5a0',
  motivation: '#0090ff',
  overall: '#c77dff'
};

// ===== FIREBASE LOAD/SAVE =====
async function loadState() {
  showLoadingOverlay(true);
  try {
    const snap = await getDoc(STATE_DOC);
    if (snap.exists()) {
      S = { ...S, ...snap.data() };
    }
    if (!S.activeFilters) S.activeFilters = ['stress', 'health', 'motivation', 'overall'];
    if (!S.personal) S.personal = { text: '', excuse: '', motivation: '' };
    if (!S.moodData) S.moodData = [];
    if (!S.backlog) S.backlog = [];
  } catch (e) {
    console.warn('Firebase load failed:', e);
  }
  showLoadingOverlay(false);
}

async function saveState() {
  try {
    await setDoc(STATE_DOC, JSON.parse(JSON.stringify(S)));
  } catch (e) {
    console.warn('Firebase save failed:', e);
    alert('Speichern fehlgeschlagen. Prüfe deine Internetverbindung.');
    return;
  }
  showToast();
}

function showLoadingOverlay(show) {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.style.cssText = `position:fixed;inset:0;background:rgba(8,11,14,.92);display:flex;
      align-items:center;justify-content:center;z-index:99999;
      font-family:'Space Mono',monospace;font-size:11px;color:#00e5a0;
      letter-spacing:.2em;text-transform:uppercase;gap:10px;`;
    el.innerHTML = `<span style="width:8px;height:8px;background:#00e5a0;border-radius:50%;animation:pulse 1s infinite"></span> Lade Daten...`;
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

// ===== LOGIN =====
function selectMode(mode) {
  if (mode === 'admin') {
    document.getElementById('mode-select').style.display = 'none';
    document.getElementById('pin-area').classList.add('show');
    document.getElementById('pin-input').focus();
  }
}

function checkPin() {
  const v = document.getElementById('pin-input').value;
  if (v === S.pin) {
    enterApp('admin');
  } else {
    document.getElementById('pin-error').classList.add('show');
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-input').focus();
  }
}

function cancelPin() {
  document.getElementById('pin-area').classList.remove('show');
  document.getElementById('mode-select').style.display = 'grid';
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-error').classList.remove('show');
}

function enterApp(mode) {
  MODE = mode;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  if (mode === 'admin') {
    document.body.classList.add('is-admin');
    document.getElementById('mode-badge').textContent = '🔐 Admin';
    document.getElementById('mode-badge').className = 'mode-badge admin';
  } else {
    document.body.classList.remove('is-admin');
    document.getElementById('mode-badge').textContent = '👁 Zuschauer';
    document.getElementById('mode-badge').className = 'mode-badge viewer';
  }
  initApp();
}

function logout() {
  MODE = null;
  document.body.classList.remove('is-admin');
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('mode-select').style.display = 'grid';
  document.getElementById('pin-area').classList.remove('show');
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-error').classList.remove('show');
}

// ===== APP INIT =====
function initApp() {
  updateProgress(S.progress);
  updateCountdown();
  buildWaveform();
  restoreCurrentWeek();
  restorePersonal();
  renderBacklog();
  renderMoodTable();

  const wn = S.currentWeek;
  document.getElementById('week-display').textContent = 'W' + String(wn).padStart(2, '0');
  document.getElementById('update-num').textContent = '#' + String(wn).padStart(2, '0');

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', S.activeFilters.includes(btn.dataset.key));
  });

  setTimeout(drawGraph, 100);
  setInterval(updateCountdown, 60000);
}

// Restore current week's editable content from saved state
function restoreCurrentWeek() {
  // Done list
  const ul = document.getElementById('done-list');
  if (S.currentDone && S.currentDone.length > 0) {
    ul.innerHTML = '';
    S.currentDone.forEach(item => {
      const li = document.createElement('li');
      li.dataset.state = item.state || 'open';
      const stateClass = item.state === 'done' ? 'done' : item.state === 'partial' ? 'partial' : '';
      const liClass = item.state === 'done' ? 'is-done' : item.state === 'partial' ? 'is-partial' : '';
      if (liClass) li.classList.add(liClass);
      li.innerHTML = `
        <span class="chk ${stateClass}" onclick="toggleCheck(this)"></span>
        <span contenteditable="true">${item.text}</span>
        <button class="delete-item admin-btn" onclick="removeItem(this)">✕</button>
      `;
      ul.appendChild(li);
    });
  } else {
    // Default items (first week)
    ul.querySelectorAll('.chk').forEach(chk => {
      chk.onclick = () => toggleCheck(chk);
    });
  }

  // Next list
  if (S.currentNext && S.currentNext.length > 0) {
    const nl = document.getElementById('next-list');
    nl.innerHTML = '';
    S.currentNext.forEach((text, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="snum">${String(i + 1).padStart(2, '0')}</span>
        <span contenteditable="true">${text}</span>
        <button class="delete-item admin-btn" onclick="removeItem(this)">✕</button>
      `;
      nl.appendChild(li);
    });
  }

  // Issues
  if (S.currentIssues && S.currentIssues.length > 0) {
    const il = document.getElementById('issues-list');
    il.innerHTML = '';
    S.currentIssues.forEach(text => {
      const d = document.createElement('div');
      d.className = 'issue';
      d.contentEditable = 'true';
      d.textContent = text;
      il.appendChild(d);
    });
  }

  // Note
  if (S.currentNote) {
    document.getElementById('note-to-sebastian').textContent = S.currentNote;
  }
}

// ===== PROGRESS =====
function updateProgress(val) {
  val = parseInt(val);
  S.progress = val;
  document.getElementById('pbar').style.width = val + '%';
  document.getElementById('progress-display').textContent = val + '%';
  const sl = document.getElementById('progress-slider');
  if (sl) sl.value = val;
  const lbl = document.getElementById('slider-label');
  if (lbl) lbl.textContent = val + '%';
}

// ===== COUNTDOWN =====
function updateCountdown() {
  const deadline = new Date('2026-08-06');
  const now = new Date();
  const diff = deadline - now;
  if (diff < 0) return;
  const days = Math.ceil(diff / 86400000);
  const weeks = Math.ceil(days / 7);
  let work = 0;
  const c = new Date(now);
  while (c <= deadline) {
    const d = c.getDay();
    if (d > 0 && d < 6) work++;
    c.setDate(c.getDate() + 1);
  }
  document.getElementById('cd-weeks').textContent = weeks;
  document.getElementById('cd-days').textContent = days;
  document.getElementById('cd-work').textContent = work;
}

// ===== CHECKLIST TOGGLE =====
function toggleCheck(chkEl) {
  if (MODE !== 'admin') return;
  const li = chkEl.parentElement;
  if (chkEl.classList.contains('done')) {
    chkEl.classList.remove('done', 'partial');
    li.classList.remove('is-done', 'is-partial');
    li.dataset.state = 'open';
  } else if (chkEl.classList.contains('partial')) {
    chkEl.classList.remove('partial');
    chkEl.classList.add('done');
    li.classList.remove('is-partial');
    li.classList.add('is-done');
    li.dataset.state = 'done';
  } else {
    chkEl.classList.add('partial');
    li.classList.add('is-partial');
    li.dataset.state = 'partial';
  }
}

// ===== LIST MANAGEMENT =====
function addDoneItem() {
  const ul = document.getElementById('done-list');
  const li = document.createElement('li');
  li.dataset.state = 'open';
  li.innerHTML = `
    <span class="chk" onclick="toggleCheck(this)"></span>
    <span contenteditable="true">Neuer Punkt...</span>
    <button class="delete-item admin-btn" onclick="removeItem(this)">✕</button>
  `;
  ul.appendChild(li);
  li.querySelector('[contenteditable]').focus();
}

function addNextItem() {
  const ul = document.getElementById('next-list');
  const n = ul.children.length + 1;
  const li = document.createElement('li');
  li.innerHTML = `
    <span class="snum">${String(n).padStart(2, '0')}</span>
    <span contenteditable="true">Neuer Schritt...</span>
    <button class="delete-item admin-btn" onclick="removeItem(this)">✕</button>
  `;
  ul.appendChild(li);
  li.querySelector('[contenteditable]').focus();
}

function addIssue() {
  const c = document.getElementById('issues-list');
  const d = document.createElement('div');
  d.className = 'issue';
  d.contentEditable = 'true';
  d.textContent = 'Neue offene Frage...';
  c.appendChild(d);
  d.focus();
}

function addSource() {
  const c = document.getElementById('sources-list');
  const n = c.children.length + 1;
  const d = document.createElement('div');
  d.className = 'src';
  d.innerHTML = `<span class="src-n">[${n}]</span><span contenteditable="true">Neue Quelle...</span>`;
  c.appendChild(d);
  d.querySelector('[contenteditable]').focus();
}

function removeItem(btn) { btn.parentElement.remove(); }

// ===== SAVE =====
async function saveData() {
  S.personal.text = document.getElementById('personal-text').textContent;
  S.personal.excuse = document.getElementById('excuse-text').textContent;
  S.personal.motivation = document.getElementById('motivation-text').textContent;
  S.currentDone = [...document.querySelectorAll('#done-list li')].map(li => ({
    text: li.querySelector('[contenteditable]')?.textContent?.trim() || '',
    state: li.dataset.state || 'open'
  }));
  S.currentNext = [...document.querySelectorAll('#next-list li')]
    .map(li => li.querySelector('[contenteditable]')?.textContent?.trim()).filter(Boolean);
  S.currentIssues = [...document.querySelectorAll('#issues-list .issue')]
    .map(d => d.textContent?.trim()).filter(Boolean);
  S.currentNote = document.getElementById('note-to-sebastian').textContent?.trim();
  await saveState();
}

// ===== ARCHIVE WEEK =====
async function archiveWeek() {
  const done = [...document.querySelectorAll('#done-list li')].map(li => ({
    text: li.querySelector('[contenteditable]')?.textContent?.trim(),
    state: li.dataset.state || 'open'
  })).filter(i => i.text);
  const next = [...document.querySelectorAll('#next-list li')]
    .map(li => li.querySelector('[contenteditable]')?.textContent?.trim()).filter(Boolean);
  const issues = [...document.querySelectorAll('#issues-list .issue')]
    .map(d => d.textContent?.trim()).filter(Boolean);
  const note = document.getElementById('note-to-sebastian').textContent?.trim();

  S.backlog.unshift({
    week: S.currentWeek,
    date: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }),
    progress: S.progress, done, next, issues, note
  });
  S.currentWeek += 1;
  S.currentDone = [];
  S.currentNext = [];
  S.currentIssues = [];
  S.currentNote = '';

  document.getElementById('week-display').textContent = 'W' + String(S.currentWeek).padStart(2, '0');
  document.getElementById('update-num').textContent = '#' + String(S.currentWeek).padStart(2, '0');
  document.getElementById('done-list').innerHTML = '';
  document.getElementById('next-list').innerHTML = '';
  document.getElementById('issues-list').innerHTML = `<div class="issue" contenteditable="true">Neue offene Frage...</div>`;
  document.getElementById('note-to-sebastian').textContent = '';

  await saveState();
  renderBacklog();
  alert(`Woche ${S.currentWeek - 1} archiviert! Woche ${S.currentWeek} beginnt.`);
}

// ===== BACKLOG =====
function renderBacklog() {
  const c = document.getElementById('backlog-list');
  if (!S.backlog?.length) {
    c.innerHTML = `<div class="empty-state">Noch keine archivierten Wochen.<br>Archiviere eine Woche auf der Hauptseite.</div>`;
    return;
  }
  c.innerHTML = S.backlog.map(w => {
    const doneItems = (w.done || []).map(item => {
      const text = typeof item === 'string' ? item : item.text;
      const state = typeof item === 'string' ? 'done' : (item.state || 'done');
      const icon = state === 'done' ? '✓' : state === 'partial' ? '–' : '○';
      return `<span style="color:${state==='done'?'var(--accent)':state==='partial'?'var(--accent3)':'var(--text-dim)'}">${icon}</span> ${text}`;
    }).join('<br>');
    return `
      <div class="backlog-entry">
        <div class="backlog-header">
          <span class="backlog-week">Woche ${String(w.week).padStart(2,'0')}</span>
          <span class="backlog-date">${w.date} · ${w.progress}%</span>
        </div>
        <div class="bl-mini"><div class="bl-mini-inner" style="width:${w.progress}%"></div></div>
        <div class="bl-body">
          ${doneItems ? `<strong style="font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:var(--text-dim);">Erledigt:</strong><br>${doneItems}` : ''}
          ${w.issues?.length ? `<br><br><strong style="font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:var(--accent3);">Offene Fragen:</strong><br>${w.issues.map(i=>`• ${i}`).join('<br>')}` : ''}
          ${w.note ? `<br><br><em style="color:var(--text-dim);">"${w.note.substring(0,150)}${w.note.length>150?'…':''}"</em>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ===== PERSONAL =====
function restorePersonal() {
  if (S.personal.text) document.getElementById('personal-text').textContent = S.personal.text;
  if (S.personal.excuse) document.getElementById('excuse-text').textContent = S.personal.excuse;
  if (S.personal.motivation) document.getElementById('motivation-text').textContent = S.personal.motivation;
}

async function savePersonal() {
  S.personal.text = document.getElementById('personal-text').textContent;
  S.personal.excuse = document.getElementById('excuse-text').textContent;
  S.personal.motivation = document.getElementById('motivation-text').textContent;
  await saveState();
}

// ===== MOOD ENTRY =====
async function saveMoodEntry() {
  const stress = parseInt(document.getElementById('sl-stress').value);
  const health = parseInt(document.getElementById('sl-health').value);
  const motivation = parseInt(document.getElementById('sl-motivation').value);
  const overall = parseInt(document.getElementById('sl-overall').value);
  const note = document.getElementById('mood-note-input').value.trim();
  const today = new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'2-digit' });
  const entry = { date: today, stress, health, motivation, overall, note };
  const idx = S.moodData.findIndex(e => e.date === today);
  if (idx >= 0) S.moodData[idx] = entry; else S.moodData.push(entry);
  S.moodData.sort((a, b) => a.date.split('.').reverse().join('').localeCompare(b.date.split('.').reverse().join('')));
  await saveState();
  renderMoodTable();
  drawGraph();
  document.getElementById('mood-note-input').value = '';
}

// ===== MOOD TABLE =====
function renderMoodTable() {
  const tbody = document.getElementById('mood-table-body');
  if (!S.moodData.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:20px;">Noch keine Einträge</td></tr>`;
    return;
  }
  tbody.innerHTML = [...S.moodData].reverse().map(e => `
    <tr>
      <td>${e.date}</td>
      <td class="val-cell" style="color:var(--c-stress)">${e.stress}</td>
      <td class="val-cell" style="color:var(--c-health)">${e.health}</td>
      <td class="val-cell" style="color:var(--c-motivation)">${e.motivation}</td>
      <td class="val-cell" style="color:var(--c-overall)">${e.overall}</td>
      <td style="font-size:10px;color:var(--text-dim);">${e.note || '–'}</td>
    </tr>`).join('');
}

// ===== GRAPH =====
function toggleFilter(btn) {
  const key = btn.dataset.key;
  const idx = S.activeFilters.indexOf(key);
  if (idx >= 0) S.activeFilters.splice(idx, 1); else S.activeFilters.push(key);
  btn.classList.toggle('active', S.activeFilters.includes(key));
  drawGraph();
}

function drawGraph() {
  const canvas = document.getElementById('moodCanvas');
  if (!canvas) return;
  const W = Math.max(canvas.parentElement.clientWidth - 16, 200);
  const H = 260;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const PAD = { top:16, right:20, bottom:44, left:38 };
  const gW = W - PAD.left - PAD.right, gH = H - PAD.top - PAD.bottom;
  ctx.clearRect(0,0,W,H); ctx.fillStyle='#0f1318'; ctx.fillRect(0,0,W,H);
  for (let i=1;i<=10;i++) {
    const y = PAD.top + gH - ((i-1)/9)*gH;
    ctx.beginPath(); ctx.moveTo(PAD.left,y); ctx.lineTo(PAD.left+gW,y);
    ctx.strokeStyle = i%5===0?'rgba(255,255,255,.08)':'rgba(255,255,255,.03)'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#5a6875'; ctx.font='9px monospace'; ctx.textAlign='right'; ctx.fillText(i,PAD.left-6,y+3);
  }
  const data = S.moodData;
  if (!data.length) {
    ctx.fillStyle='#5a6875'; ctx.font='11px monospace'; ctx.textAlign='center';
    ctx.fillText('Noch keine Daten – trag deinen ersten Eintrag ein!', W/2, H/2); return;
  }
  const n=data.length, xStep=n>1?gW/(n-1):0;
  const labelStep=Math.max(1,Math.floor(n/Math.min(n,10)));
  data.forEach((e,i) => {
    if (i%labelStep!==0&&i!==n-1) return;
    ctx.fillStyle='#5a6875'; ctx.font='9px monospace'; ctx.textAlign='center';
    ctx.fillText(e.date, PAD.left+i*xStep, H-10);
  });
  ['stress','health','motivation','overall'].forEach(key => {
    if (!S.activeFilters.includes(key)) return;
    const col=COLORS[key];
    const pts=data.map((e,i)=>({x:PAD.left+i*xStep,y:PAD.top+gH-((e[key]-1)/9)*gH}));
    ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
    ctx.lineTo(pts[pts.length-1].x,PAD.top+gH); ctx.lineTo(pts[0].x,PAD.top+gH); ctx.closePath();
    const g=ctx.createLinearGradient(0,PAD.top,0,PAD.top+gH);
    g.addColorStop(0,col+'30'); g.addColorStop(1,col+'00'); ctx.fillStyle=g; ctx.fill();
    ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
    ctx.strokeStyle=col; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();
    pts.forEach(p=>{
      ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();
      ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,Math.PI*2);ctx.fillStyle='#080b0e';ctx.fill();
    });
  });
}

// ===== NAV =====
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  if (btn) btn.classList.add('active');
  if (id==='graph') setTimeout(drawGraph,50);
}

// ===== WAVEFORM =====
function buildWaveform() {
  const wf = document.getElementById('waveform');
  if (!wf) return;
  wf.innerHTML='';
  for(let i=0;i<80;i++){
    const b=document.createElement('div'); b.className='wbar';
    b.style.height=(Math.random()*16+4)+'px';
    b.style.animationDelay=(Math.random()*1.2)+'s';
    b.style.animationDuration=(0.7+Math.random()*0.8)+'s';
    wf.appendChild(b);
  }
}

// ===== TOAST =====
function showToast() {
  const t=document.getElementById('toast');
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2000);
}

window.addEventListener('resize',()=>{
  if(document.getElementById('page-graph')?.classList.contains('active')) drawGraph();
});

// ===== EXPOSE GLOBALS (required for ES module + inline onclick) =====
window.selectMode=selectMode; window.checkPin=checkPin; window.cancelPin=cancelPin;
window.enterApp=enterApp; window.logout=logout; window.showPage=showPage;
window.updateProgress=updateProgress; window.toggleCheck=toggleCheck;
window.addDoneItem=addDoneItem; window.addNextItem=addNextItem;
window.addIssue=addIssue; window.addSource=addSource; window.removeItem=removeItem;
window.saveData=saveData; window.archiveWeek=archiveWeek; window.savePersonal=savePersonal;
window.saveMoodEntry=saveMoodEntry; window.toggleFilter=toggleFilter;

// ===== BOOT =====
loadState();
