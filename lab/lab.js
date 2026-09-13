/* ============================================================
   THE LAB SCRIPT.

   Runs ONLY in dashboard-lab.html, after everything else on the page.
   Use it to try behaviour the real dashboard does not have yet.

   Anything that earns its place moves into dashboard.html properly and
   comes out of here.

   IT MUST NEVER BREAK THE PAGE IT IS EXPERIMENTING ON. An error thrown
   from here would take the dashboard down with it and the bug would
   look like the dashboard's, so everything runs inside a try and says
   so in the console when it fails.
   ============================================================ */
(function () {
  try {
    document.documentElement.dataset.lab = '1';
    // ---- experiments below this line ----

  } catch (e) {
    console.warn('[lab] an experiment failed, the dashboard is unaffected:', e);
  }
})();
