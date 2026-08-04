/* ============================================================
   SCREEN — HIS HISTORY (beginner).
   Two ways in, because they answer different questions:
     "By exercise" — what did I lift last time, and am I going up?
                     This is the one that matters at the start of a week.
     "By session"  — what did a given workout actually look like.
   Read-only over the store.
   ============================================================ */
import { store } from '../store.js';
import { EXERCISES } from '../data/exercises.js';

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fmtDate = iso => {
  try { return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
  catch (e) { return ''; }
};
const shortDate = iso => {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch (e) { return ''; }
};
const exName = id => EXERCISES[id]?.name || id;

/* Is he moving up? Compare the most recent entry to the one before it.
   Weight wins over reps — going heavier at fewer reps is still progress. */
function trend(hist) {
  if (hist.length < 2) return null;
  const [now, prev] = hist;
  if (now.weight != null && prev.weight != null) {
    if (now.weight > prev.weight) return { dir: 'up', text: `+${+(now.weight - prev.weight).toFixed(1)} lb` };
    if (now.weight < prev.weight) return { dir: 'down', text: `−${+(prev.weight - now.weight).toFixed(1)} lb` };
  }
  if (now.best > prev.best) return { dir: 'up', text: `+${now.best - prev.best} ${now.unit}` };
  if (now.best < prev.best) return { dir: 'down', text: `−${prev.best - now.best} ${now.unit}` };
  return { dir: 'same', text: 'same' };
}

export function renderBHistory(host, { onBack }) {
  let tab = 'exercises';
  const open = new Set();

  function draw() {
    const all = store.all;
    host.innerHTML = `
      <div class="screen fade-in bgn">
        <div class="topbar" style="margin-bottom:6px;">
          <button class="histbtn" id="back">‹ Back</button>
          <h1 style="margin:0;font-size:22px;">My history</h1>
          <span style="width:54px;"></span>
        </div>
        <div class="hist-tabs">
          <button class="${tab === 'exercises' ? 'on' : ''}" id="tEx">By exercise</button>
          <button class="${tab === 'sessions' ? 'on' : ''}" id="tSe">By session</button>
        </div>
        ${tab === 'exercises' ? exercisesHtml() : sessionsHtml([...all.sessions].reverse())}
        <div class="spacer" style="height:40px;"></div>
      </div>`;

    host.querySelector('#back').addEventListener('click', onBack);
    host.querySelector('#tEx').addEventListener('click', () => { tab = 'exercises'; draw(); });
    host.querySelector('#tSe').addEventListener('click', () => { tab = 'sessions'; draw(); });
    host.querySelectorAll('[data-key]').forEach(el => el.addEventListener('click', () => {
      const k = el.dataset.key;
      open.has(k) ? open.delete(k) : open.add(k);
      draw();
    }));
  }

  /* ---- by exercise: the "what do I need to beat" view ---- */
  function exercisesHtml() {
    const list = store.loggedExercises();
    if (!list.length) {
      return `<div class="hist-empty">Nothing logged yet.<br>Finish a workout and every exercise shows up here with what you lifted.</div>`;
    }
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return list.map(x => {
      const hist = store.exerciseHistory(x.exId, 12);
      if (!hist.length) return '';
      const t = trend(hist);
      const isOpen = open.has('e' + x.exId);
      const body = isOpen ? `<div class="hist-body">
        ${hist.map((h, i) => `<div class="eh-row ${i === 0 ? 'recent' : ''}">
            <span class="eh-d">${esc(shortDate(h.date))}</span>
            <span class="eh-v">${esc(h.setsText)} <span class="u">${esc(h.unit)}</span></span>
          </div>`).join('')}
      </div>` : '';
      return `
        <div class="hist-card">
          <div class="htop" data-key="e${x.exId}">
            <div><div class="hname">${esc(x.name || exName(x.exId))}</div>
              <div class="hmeta">${hist.length} session${hist.length > 1 ? 's' : ''} · last ${esc(shortDate(hist[0].date))}</div></div>
            <div class="hlast">
              <span class="hv">${esc(hist[0].text)}</span>
              ${t ? `<span class="trend ${t.dir}">${t.dir === 'up' ? '▲' : t.dir === 'down' ? '▼' : '='} ${esc(t.text)}</span>` : ''}
            </div>
          </div>${body}
        </div>`;
    }).join('');
  }

  /* ---- by session ---- */
  function sessionsHtml(sessions) {
    if (!sessions.length) return `<div class="hist-empty">No workouts logged yet.</div>`;
    return sessions.map((s, i) => {
      const isOpen = open.has('s' + i);
      const mins = Math.round((s.seconds || 0) / 60);
      const exCount = (s.blocks || []).reduce((n, b) =>
        n + (b.entries || []).filter(e => (e.sets || []).some(x => x.value != null && x.value !== '')).length, 0);
      const body = isOpen ? `<div class="hist-body">${(s.blocks || []).map(b => {
        const ents = (b.entries || []).filter(e => (e.sets || []).some(x => x.value != null && x.value !== ''));
        if (!ents.length) return '';
        return `<div class="blkhead"><span class="bh-name">${esc(b.name || '')}</span></div>` +
          ents.map(e => {
            const sets = (e.sets || []).filter(x => x.value != null && x.value !== '')
              .map(x => `${x.side ? x.side : ''}${x.value}${x.weight ? `@${x.weight}` : ''}`).join(' · ');
            return `<div class="hist-ex"><div class="en">${esc(e.name)}</div><div class="es">${esc(sets)} <span class="u">${esc(e.unit || '')}</span></div></div>`;
          }).join('');
      }).join('')}</div>` : '';
      return `
        <div class="hist-card">
          <div class="htop" data-key="s${i}">
            <div><div class="hname">${esc(s.name)}</div>
              <div class="hmeta">${exCount} exercises · ⏱ ${mins} min</div></div>
            <div class="hdate">${esc(fmtDate(s.date))}</div>
          </div>${body}
        </div>`;
    }).join('');
  }

  draw();
}
