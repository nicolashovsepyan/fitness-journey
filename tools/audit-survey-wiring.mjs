/* ============================================================
   AUDIT SURVEY WIRING

   Run:  node tools/audit-survey-wiring.mjs

   Every answer the survey writes, and everything that reads it back. A
   question nobody reads is a question nobody should be asked, and by eye
   that is invisible — the answer is stored, the screen looks finished, and
   it goes nowhere.

   It found two of those the first time it ran: training age and the aerobic
   question, both written and read by nothing at all, in the survey or in
   the coach console.

   Re-run it after adding or removing a question. See
   FOR NICOLAS/SURVEY WIRING AUDIT.md for what to do with the output.
   ============================================================ */
import {readFileSync} from "fs";
const h=readFileSync("onboarding.html","utf8");
const src=h.slice(h.indexOf("const FLOW = ["), h.indexOf("];", h.indexOf("const FLOW = [")))+"]";
const FLOW=eval(src.replace("const FLOW = ",""));
const coach=readFileSync("coach.html","utf8");

const asked=new Set(); FLOW.forEach(f=>{ if(f.key) asked.add(f.key); });
const written=new Set([...h.matchAll(/\bA\.([a-zA-Z][a-zA-Z0-9]*)\s*=/g)].map(m=>m[1]));
const all=[...new Set([...asked,...written])].sort();

const rows=[];
for(const k of all){
  const uses=[...h.matchAll(new RegExp("A\\."+k+"\\b","g"))].length;
  const assigns=[...h.matchAll(new RegExp("A\\."+k+"\\s*=","g"))].length;
  const reads=uses-assigns;
  const inCoach=new RegExp("\\b"+k+"\\b").test(coach);
  rows.push({key:k, asked:asked.has(k), reads, inCoach});
}
console.log("key            asked  reads-in-survey  named-in-coach");
for(const r of rows) console.log(r.key.padEnd(15), (r.asked?"Y":"-").padEnd(6),
  String(r.reads).padStart(6).padEnd(17), r.inCoach?"Y":"-");
console.log("\n--- ASKED BUT NEVER READ BACK (dead ends) ---");
console.log(rows.filter(r=>r.asked && r.reads===0).map(r=>r.key).join(", ")||"none");
console.log("\n--- ASKED, READ NOWHERE IN SURVEY, NOT IN COACH ---");
console.log(rows.filter(r=>r.asked && r.reads===0 && !r.inCoach).map(r=>r.key).join(", ")||"none");
