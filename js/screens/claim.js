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

export function renderClaim(host, { onDone }) {
  const people = Object.values(USERS);
  host.innerHTML = `
    <div class="screen fade-in claim">
      <img class="logo-img" src="images/logo-mark.svg" alt="Fitness Journey" />
      <div class="claim-inner">
        <h1>Whose phone is this?</h1>
        <p class="muted">Pick once and this phone remembers. Your training is kept separate from anyone else's.</p>
        <div class="claim-grid">
          ${people.map(u => `
            <button class="claim-card" data-uid="${u.id}">
              <span class="cc-initial" style="--c:${u.accent}">${displayName(u.id).trim().charAt(0) || u.short}</span>
              <span class="cc-name">${displayName(u.id)}</span>
              <span class="cc-sub">${u.ui === 'beginner' ? 'Come Back Strong' : 'Foundation Block'}</span>
            </button>`).join('')}
        </div>
        <p class="claim-foot">You can change this later in Settings.</p>
      </div>
    </div>`;

  /* claimDevice writes through the adapter, so wait for it. Calling
     onDone() first would boot the app before the device knew who it
     belonged to, and it would ask again. */
  host.querySelectorAll('[data-uid]').forEach(el => el.addEventListener('click', async () => {
    try { navigator.vibrate?.(30); } catch (e) {}
    await claimDevice(el.dataset.uid);
    onDone();
  }));
}
