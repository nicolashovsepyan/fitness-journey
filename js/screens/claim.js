/* ============================================================
   SCREEN — WHOSE PHONE IS THIS?
   Shown once, only when the device has never been told who it belongs to.

   This exists because guessing was wrong. An installed iOS app gets its own
   storage container, separate from Safari — so a profile chosen in the
   browser is simply absent the first time the installed app runs, and any
   silent default lands someone on the wrong program.
   Asking once removes the whole class of problem.
   ============================================================ */
import { USERS, claimDevice, displayName } from '../users.js';
import { applySurveyPayload } from '../intake.js';
import { t } from '../i18n.js';

export function renderClaim(host, { onDone }) {
  const people = Object.values(USERS);
  /* THE SUBTITLE USED TO BE A GUESS. It read `ui === 'beginner' ?
     'Come Back Strong' : 'Foundation Block'` — two hardcoded program
     names, printed under whoever happened to be listed, whatever they
     were actually training. Two strangers were being offered on a new
     phone with confident program names attached to them. If we do not
     know what somebody is on, the honest thing is to say nothing. */
  const sub = u => u.status === 'pending' ? 'waiting on a program' : '';

  /* AN EMPTY DEVICE IS THE NORMAL CASE NOW, not an error. The survey runs
     in Safari and an installed app has its own storage, so a freshly
     installed app legitimately knows nobody — and the way in is the link
     the survey produced. */
  const box = `
    <div class="claim-paste">
      <p class="muted">${people.length
        ? 'Someone else? Paste the link Nico sent you.'
        : 'This phone does not know you yet. Paste the link Nico sent you and your program opens here.'}</p>
      <textarea id="claimLink" rows="3" placeholder="Paste your link here"></textarea>
      <button class="btn" id="claimGo">Use this link</button>
      <p class="claim-err" id="claimErr"></p>
    </div>`;

  host.innerHTML = `
    <div class="screen fade-in claim">
      <img class="logo-img" src="images/logo-mark.svg" alt="Fitness Journey" />
      <div class="claim-inner">
        <button class="claim-timer" id="claimTimer">
          <img src="images/timer-icon/timer-180.png" alt="" />
          <span><b>${t('Just need the timer?')}</b><small>${t('Open it. No sign-in needed.')}</small></span>
          <i>›</i>
        </button>
        <h1>${people.length ? 'Whose phone is this?' : 'Let us find you'}</h1>
        <p class="muted">${people.length
          ? 'Pick once and this phone remembers. Your training is kept separate from anyone else\'s.'
          : 'One link and this phone is yours. Your training stays on it.'}</p>
        <div class="claim-grid">
          ${people.map(u => `
            <button class="claim-card" data-uid="${u.id}">
              <span class="cc-initial" style="--c:${u.accent}">${displayName(u.id).trim().charAt(0) || u.short}</span>
              <span class="cc-name">${displayName(u.id)}</span>
              ${sub(u) ? `<span class="cc-sub">${sub(u)}</span>` : ''}
            </button>`).join('')}
        </div>
        ${box}
        <p class="claim-foot">You can change this later in Settings.</p>
      </div>
    </div>`;

  /* THE TIMER NEEDS NOBODY. A home-screen app can land here with no way to
     know who installed it; the timer works without that. Remembered on the
     device, so this app opens straight onto the timer from now on (the
     timer has a "Sign in to your program" link to undo it). */
  if (!document.getElementById('claim-timer-style')) {
    const st = document.createElement('style'); st.id = 'claim-timer-style';
    st.textContent = `.claim-timer { width: 100%; display: flex; align-items: center; gap: 14px; text-align: left; cursor: pointer;
        margin: 4px 0 26px; padding: 14px 16px; border-radius: 20px; color: #ECEFF3;
        background: linear-gradient(135deg, rgba(255,95,162,.16), rgba(62,203,168,.12)); border: 1.5px solid rgba(255,95,162,.55);
        box-shadow: 0 0 24px rgba(255,95,162,.22); }
      .claim-timer img { width: 58px; height: 58px; border-radius: 14px; flex: none; }
      .claim-timer span { flex: 1; display: flex; flex-direction: column; }
      .claim-timer b { font-size: 20px; letter-spacing: -0.01em; }
      .claim-timer small { color: #A9B2BC; font-size: 14px; margin-top: 3px; }
      .claim-timer i { font-style: normal; font-size: 30px; color: #FF5FA2; }`;
    document.head.appendChild(st);
  }
  host.querySelector('#claimTimer')?.addEventListener('click', () => {
    try { localStorage.setItem('fj.launchTimer', '1'); } catch (e) {}
    location.href = 'index.html?quick';
  });

  const go = host.querySelector('#claimGo');
  if (go) go.addEventListener('click', async () => {
    const err = host.querySelector('#claimErr');
    const val = host.querySelector('#claimLink').value;
    err.textContent = '';
    if (!val.trim()) { err.textContent = 'Paste the link first.'; return; }
    go.disabled = true; go.textContent = 'Reading it…';
    let id = null;
    try { id = await applySurveyPayload(val); } catch (e) { id = null; }
    if (!id) {
      go.disabled = false; go.textContent = 'Use this link';
      /* The payloads are long and message bubbles break lines in them,
         which is the most likely failure here by a distance. */
      err.textContent = 'That link could not be read. Copy the whole thing — they are long and easy to cut short.';
      return;
    }
    onDone();
  });

  /* claimDevice writes through the adapter, so wait for it. Calling
     onDone() first would boot the app before the device knew who it
     belonged to, and it would ask again. */
  host.querySelectorAll('[data-uid]').forEach(el => el.addEventListener('click', async () => {
    try { navigator.vibrate?.(30); } catch (e) {}
    await claimDevice(el.dataset.uid);
    onDone();
  }));
}
