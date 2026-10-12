/* Maths Tracker app logic. Needs data.js loaded first (DATA, ATT). */
const KEY = "mm3_overrides_v1", CKEY = "mm3_conquered_v1", MKEY = "mm3_mode_v1";
let overrides = {};
try { overrides = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch(e) { overrides = {}; }
function save(){ try { localStorage.setItem(KEY, JSON.stringify(overrides)); } catch(e) {} }
let conq = new Set();
try { conq = new Set(JSON.parse(localStorage.getItem(CKEY) || "[]")); } catch(e) { conq = new Set(); }
function saveConq(){ try { localStorage.setItem(CKEY, JSON.stringify([...conq])); } catch(e) {} }
let mode = "kid"; /* always opens in Kid mode; the grown-up view is one tap away */
function saveMode(){}

const qid = d => d.a + "-" + d.t + "-" + d.p + "-" + d.q;
const res = d => overrides[qid(d)] || d.r;
const isTodo = d => res(d) === "Wrong" || res(d) === "Blank";
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pct = (n, t) => t ? Math.round(n * 100 / t) : 0;
const attempts = [...new Set(DATA.map(d => d.a))].sort((x, y) => x - y);
const skills = [...new Set(DATA.map(d => d.s))].sort();
const sections = [...new Set(DATA.map(d => d.t + " " + d.p))];
const KS = {
  "Place value & words":["🧙","Place Value Wizard"], "Number operations":["🥷","Number Ninja"],
  "Brackets & order":["🧠","Brackets Boss"], "Missing numbers":["🔍","Mystery Number Hunter"],
  "Units & measures":["📏","Measuring Master"], "Money":["💰","Money Master"],
  "Time":["⏰","Time Traveller"], "Fractions":["🍕","Fraction Hero"],
  "Rounding":["🏁","Rounding Racer"], "Other":["🎁","Bonus Challenges"]
};
const kname = s => KS[s] || ["🎁", s];

let tab = "overview";
let hideAns = false;
const revealed = new Set();
let F = { a: "all", r: "all", s: "all", sec: "all" };
let K = { f: "todo", s: "all", a: "all" };
const shown = new Set(), rehint = new Set();
const hints = new Map(), sims = new Map(), picked = new Set(); /* hints: id -> how many hint lines are showing; sims: id -> similar-question state */
let selecting = false;

function mins(a){
  const m = ATT[a]; if (!m || !m.start || !m.end) return null;
  const f = x => { const [h, mm] = x.split(":").map(Number); return h * 60 + mm; };
  let d = f(m.end) - f(m.start); if (d < 0) d += 720; return d;
}
function tally(rows){
  const t = { Correct: 0, Wrong: 0, Blank: 0, n: rows.length };
  rows.forEach(d => { t[res(d)]++; });
  return t;
}
function topbar(){
  return '<div class="topbar"><button class="modebtn" data-mode="1">' + (mode === "kid" ? "👤 Grown-up mode" : "🎮 Kid mode") + '</button></div>';
}

/* ================= Grown-up mode ================= */
function overview(){
  let h = topbar() + '<h1>Maths tracker</h1><p class="sub">Schofield &amp; Sims Mental Arithmetic 3 &middot; timed attempts</p>';
  let prev = null;
  attempts.forEach(a => {
    const rows = DATA.filter(d => d.a === a), t = tally(rows), p = pct(t.Correct, t.n), m = mins(a);
    const secq = m != null ? Math.round(m * 60 / t.n) : null;
    let delta = "";
    if (prev !== null){ const dd = p - prev; delta = '<span class="' + (dd >= 0 ? "up" : "down") + '">' + (dd >= 0 ? "+" : "") + dd + ' pts</span> <span class="muted small">vs previous</span>'; }
    prev = p;
    h += '<div class="card"><div class="row"><div><span class="pill">Attempt ' + a + '</span> <span class="small muted">' + esc((ATT[a] || {}).label || "") + '</span></div><div>' + delta + '</div></div>'
      + '<div class="row" style="margin-top:8px"><div class="big">' + p + '%</div><div class="muted">' + t.Correct + ' of ' + t.n + ' correct</div></div>'
      + '<div class="bar"><i class="seg-ok" style="width:' + pct(t.Correct, t.n) + '%"></i><i class="seg-bad" style="width:' + pct(t.Wrong, t.n) + '%"></i><i class="seg-blank" style="width:' + pct(t.Blank, t.n) + '%"></i></div>'
      + '<div class="legend"><span><i class="dot seg-ok"></i>' + t.Correct + ' correct</span><span><i class="dot seg-bad"></i>' + t.Wrong + ' wrong</span><span><i class="dot seg-blank"></i>' + t.Blank + ' blank</span></div>'
      + '<div class="stats"><div class="stat"><span class="small muted">Time</span><b>' + (m != null ? m + ' min' : '&ndash;') + '</b></div>'
      + '<div class="stat"><span class="small muted">Per question</span><b>' + (secq != null ? secq + ' s' : '&ndash;') + '</b></div>'
      + '<div class="stat"><span class="small muted">Questions</span><b>' + t.n + '</b></div></div>'
      + '<div class="foot" style="margin-top:12px"><button data-go="a" data-v="' + a + '" data-r="Wrong,Blank">Review mistakes</button></div></div>';
  });
  const lost = skills.map(s => { const r = DATA.filter(d => d.s === s); const t = tally(r); return { s, lost: t.Wrong + t.Blank, n: t.n }; })
    .filter(x => x.lost > 0).sort((x, y) => y.lost - x.lost).slice(0, 4);
  h += '<h2>Where marks were lost</h2><div class="card">';
  lost.forEach(x => {
    h += '<button class="skill" style="margin:0 0 8px;border:0;padding:6px 0;border-bottom:1px solid var(--line);border-radius:0" data-go="s" data-v="' + esc(x.s) + '" data-r="Wrong,Blank"><div class="row"><b>' + esc(x.s) + '</b><span class="muted">' + x.lost + ' of ' + x.n + ' lost</span></div></button>';
  });
  const todo = DATA.filter(isTodo), done = todo.filter(d => conq.has(qid(d))).length;
  h += '</div><p class="small muted">Tap any item to see those questions. Blank = skipped (she circles these).</p>';
  h += '<p class="small muted">Her practice progress (Kid mode): ' + done + ' of ' + todo.length + ' missions conquered.</p>';
  return h;
}

function filtered(){
  return DATA.filter(d => {
    if (F.a !== "all" && String(d.a) !== String(F.a)) return false;
    if (F.s !== "all" && d.s !== F.s) return false;
    if (F.sec !== "all" && (d.t + " " + d.p) !== F.sec) return false;
    if (F.r !== "all" && !F.r.split(",").includes(res(d))) return false;
    return true;
  });
}
function chip(group, val, label){
  return '<button class="chip' + (String(F[group]) === String(val) ? " on" : "") + '" data-f="' + group + '" data-v="' + esc(val) + '">' + label + '</button>';
}
function questions(){
  const rows = filtered();
  let h = topbar() + '<div class="filters">';
  h += '<div class="chips">' + chip("a", "all", "All attempts") + attempts.map(a => chip("a", a, "Attempt " + a)).join("") + '</div>';
  h += '<div class="chips">' + chip("r", "all", "All") + chip("r", "Correct", "Correct") + chip("r", "Wrong", "Wrong") + chip("r", "Blank", "Blank") + chip("r", "Wrong,Blank", "Needs review") + '</div>';
  h += '<div class="sel"><select data-sel="sec"><option value="all">All sections</option>' + sections.map(s => '<option' + (F.sec === s ? " selected" : "") + '>' + s + '</option>').join("") + '</select>';
  h += '<select data-sel="s"><option value="all">All skills</option>' + skills.map(s => '<option' + (F.s === s ? " selected" : "") + '>' + esc(s) + '</option>').join("") + '</select></div>';
  const t = tally(rows);
  h += '<div class="count"><span>Showing ' + rows.length + ' of ' + DATA.length + (rows.length ? ' &middot; ' + pct(t.Correct, t.n) + '% correct' : '') + '</span><span><button class="link" data-hide="1">Hide answers: ' + (hideAns ? 'on' : 'off') + '</button> &nbsp; <button class="link" data-clear="1">Clear filters</button></span></div></div>';
  if (!rows.length) h += '<div class="empty">No questions match these filters.</div>';
  rows.forEach(d => {
    const r = res(d), id = qid(d), hid = hideAns && !revealed.has(id);
    const ed = (overrides[id] ? '<span class="edited">edited</span>' : "") + (conq.has(id) ? '<span class="edited">practised ✓</span>' : "");
    h += '<div class="q ' + r + '" data-id="' + id + '"><div class="top"><span class="tag">A' + d.a + ' &middot; ' + d.t + ' ' + d.p + ' &middot; Q' + d.q + ' &middot; ' + esc(d.s) + '</span><span><span class="badge ' + r + '">' + r + '</span>' + ed + '</span></div>'
      + (d.k ? '<div class="qtext">' + esc(d.k) + '</div>' : '')
      + (d.img ? '<div class="qimg">' + d.img + '</div>' : '')
      + '<div class="ans"><div><span>Her answer</span>' + (d.h ? esc(d.h) : "&mdash; blank") + '</div><div><span>Correct</span>' + (hid ? '<button class="reveal" data-reveal="' + id + '">Tap to reveal</button>' : esc(d.c)) + '</div></div>'
      + (d.n && !hid ? '<div class="note">' + esc(d.n) + '</div>' : '')
      + (d.wp && !hid ? '<div class="tip what"><b>What she did and why it was not quite right</b>' + d.wp.split('\n').map(x => '<div>' + esc(x) + '</div>').join('') + '</div>' : '')
      + (d.m && !hid ? '<div class="tip"><b>How to work it out</b>' + d.m.split('\n').map(x => '<div>' + esc(x) + '</div>').join('') + '</div>' : '')
      + '<div class="edit">' + ["Correct", "Wrong", "Blank"].map(x => '<button class="' + (r === x ? "cur" : "") + '" data-set="' + x + '" data-id="' + id + '">' + x + '</button>').join("") + '</div></div>';
  });
  h += '<div class="foot"><button data-export="1">Export CSV</button><button data-reset="1">Reset my edits</button></div>';
  h += '<div class="foot" style="margin-top:8px"><button data-resetkid="1">Reset her Kid-mode progress</button></div>';
  h += '<p class="small muted">Tap a question to change its result. Edits stay on this device only.</p>';
  return h;
}

function skillsView(){
  let h = topbar() + '<h1>Skills</h1><p class="sub">Accuracy by topic. Tap one to see its questions.</p>';
  skills.forEach(s => {
    const rows = DATA.filter(d => d.s === s), t = tally(rows), p = pct(t.Correct, t.n);
    const col = p >= 75 ? "var(--ok)" : p >= 50 ? "var(--blank)" : "var(--bad)";
    const per = attempts.map(a => { const r = rows.filter(d => d.a === a); if (!r.length) return ""; const tt = tally(r); return '<span class="pill">A' + a + ' ' + pct(tt.Correct, tt.n) + '%</span>'; }).join(" ");
    h += '<button class="skill" data-go="s" data-v="' + esc(s) + '" data-r="all"><div class="row"><b>' + esc(s) + '</b><b style="color:' + col + '">' + p + '%</b></div>'
      + '<div class="meter"><i style="width:' + p + '%;background:' + col + '"></i></div>'
      + '<div class="row small muted"><span>' + t.Correct + ' of ' + t.n + ' correct' + (t.Blank ? ' &middot; ' + t.Blank + ' blank' : '') + '</span><span>' + per + '</span></div></button>';
  });
  return h;
}

/* ================= Kid mode ================= */
function skillStats(){
  return skills.map(s => { const t = tally(DATA.filter(d => d.s === s)); return { s, n: t.n, ok: t.Correct, p: pct(t.Correct, t.n), lost: t.Wrong + t.Blank }; });
}
function kidOverview(){
  const todo = DATA.filter(isTodo), T = todo.length, c = todo.filter(d => conq.has(qid(d))).length;
  const titles = ["Maths Explorer 🧭", "Number Ninja 🥷", "Brain Booster 🧠", "Maths Wizard 🧙", "Maths Legend 🏆"];
  const stage = T && c >= T ? 4 : T ? Math.floor(c * 4 / T) : 0;
  const msg = !T ? "No missions right now - amazing! 🎉" : c === 0 ? "Your first mission is waiting!" : c < T ? (T - c) + " to go - you've got this!" : "Every mission conquered! You're a legend!";
  let h = topbar() + '<h1>Hi superstar! 🌟</h1><p class="sub">Ready to beat your best?</p>';
  h += '<div class="kcard hero"><div class="row"><span class="lvl">' + titles[stage] + '</span><span>⭐ ' + c + '</span></div>'
    + '<div class="kbig">' + c + ' <small>of ' + T + '</small></div><div>missions conquered</div>'
    + '<div class="kprog"><i style="width:' + pct(c, T) + '%"></i></div><p class="kmsg">' + msg + '</p>'
    + (c < T ? '<button class="kbtn" data-kgo="todo">🚀 Start a mission</button>' : '<button class="kbtn" data-kgo="done">🏆 See my trophies</button>') + '</div>';
  h += '<h2>My rounds</h2>';
  let prev = null;
  attempts.forEach(a => {
    const t = tally(DATA.filter(d => d.a === a)), p = pct(t.Correct, t.n), m = mins(a);
    const secq = m != null ? Math.round(m * 60 / t.n) : null;
    const stars = Math.max(1, Math.round(p / 20));
    let note = "";
    if (prev !== null) note = p > prev ? "📈 Up " + (p - prev) + "% since last round!" : "💪 Keep practising - every round makes you stronger!";
    prev = p;
    h += '<div class="kcard"><div class="row"><b>Round ' + a + '</b><span class="small muted">' + esc((ATT[a] || {}).label || "") + '</span></div>'
      + '<div class="kmid">' + t.Correct + ' right out of ' + t.n + '!</div>'
      + '<div class="stars">' + "⭐".repeat(stars) + '<span class="dim">' + "⭐".repeat(5 - stars) + '</span></div>'
      + (secq != null ? '<div class="small">⏱️ About ' + secq + ' seconds per question</div>' : '')
      + (note ? '<div class="small" style="margin-top:4px">' + note + '</div>' : '') + '</div>';
  });
  const st = skillStats();
  const best = st.filter(x => x.n >= 2 && x.p >= 60).sort((x, y) => y.p - x.p || y.n - x.n).slice(0, 3);
  const next = st.filter(x => x.lost > 0).sort((x, y) => y.lost - x.lost).slice(0, 2);
  if (best.length){
    h += '<h2>⚡ My best superpowers</h2><div class="kchips">' + best.map(x => '<button class="kchip" data-ks="' + esc(x.s) + '" data-kf="all">' + kname(x.s)[0] + ' ' + esc(kname(x.s)[1]) + '</button>').join("") + '</div>';
  }
  if (next.length){
    h += '<h2>🌱 Ready to power up</h2><div class="kchips">' + next.map(x => '<button class="kchip" data-ks="' + esc(x.s) + '" data-kf="todo">' + kname(x.s)[0] + ' ' + esc(kname(x.s)[1]) + '</button>').join("") + '</div>';
  }
  return h;
}

function kidFiltered(a){
  const A = a === undefined ? K.a : a;
  return DATA.filter(d => {
    if (K.s !== "all" && d.s !== K.s) return false;
    if (A !== "all" && String(d.a) !== String(A)) return false;
    if (K.f === "todo") return isTodo(d) && !conq.has(qid(d));
    if (K.f === "done") return isTodo(d) && conq.has(qid(d));
    return true;
  });
}
const hintLines = d => (d.h2 || d.m2 || d.m || "").split("\n").filter(Boolean);
function hintBox(lines, n, id, full){
  let h = '<div class="tip"><b>💡 Hint' + (full || lines.length < 2 ? "" : " " + n + " of " + lines.length) + (full ? "" : " - have another go!") + '</b>'
    + lines.slice(0, n).map(x => '<div>' + esc(x) + '</div>').join("") + '<div class="hrow">';
  if (!full && n < lines.length) h += '<button class="hidebtn more" data-morehint="' + id + '">🆘 I need another hint</button>';
  h += '<button class="hidebtn" data-' + (full ? "rehint" : "unhint") + '="' + id + '">🙈 Hide hint</button></div>';
  if (!full && lines.length > 1 && n >= lines.length) h += '<div class="small muted">That\'s all the hints - show the answer when you\'re ready!</div>';
  return h + '</div>';
}
function simPanel(id){
  const S = SIM[id], st = sims.get(id), tried = st.tried;
  let h = '<div class="simbox"><b class="simh">🧩 Try a similar one!</b><div class="qtext sq">' + esc(S.q) + '</div>' + (S.img ? '<div class="qimg">' + S.img + '</div>' : '') + '<div class="sopts">';
  S.o.forEach((o, i) => {
    const cls = st.ok && i === S.a ? " good" : tried.indexOf(i) >= 0 ? " bad" : "";
    h += '<button class="sopt' + cls + '" data-sopt="' + id + '" data-i="' + i + '"' + (st.ok || tried.indexOf(i) >= 0 ? " disabled" : "") + '>' + esc(o) + '</button>';
  });
  h += '</div>';
  const n = Math.min(st.hint, S.h.length);
  if (n > 0 && !st.ok) h += '<div class="tip"><b>💡 Hint' + (S.h.length > 1 ? " " + n + " of " + S.h.length : "") + '</b>' + S.h.slice(0, n).map(x => '<div>' + esc(x) + '</div>').join("") + '</div>';
  if (tried.length && !st.ok) h += '<div class="small simmsg">Not quite - have another go! 💪</div>';
  if (st.ok) h += '<div class="ansbox">🎉 Yes! <b>' + esc(S.o[S.a]) + '</b></div><div class="tip"><b>✏️ How it works</b><div>' + esc(S.e) + '</div></div>';
  h += '<div class="row2">';
  if (!st.ok && st.hint < S.h.length) h += '<button class="kbtn ghost" data-shint="' + id + '">' + (st.hint ? "🆘 Another hint" : "💡 Hint") + '</button>';
  h += '<button class="kbtn ghost" data-simclose="' + id + '">✖ Close</button></div></div>';
  return h;
}
function kidCard(d){
  const id = qid(d), sk = kname(d.s), tag = "Round " + d.a + " · " + d.t + " " + d.p + " · Q" + d.q;
  if (!isTodo(d)){
    return '<div class="kq"><div class="top"><span class="tag">' + tag + '</span><span class="badge Correct">Nailed it ✅</span></div>'
      + '<div class="small muted" style="margin-top:6px">' + sk[0] + ' ' + esc(sk[1]) + ' - you wrote: <b>' + esc(d.h) + '</b></div></div>';
  }
  const done = conq.has(id), showAns = shown.has(id) || done, on = picked.has(id);
  if (selecting){
    return '<div class="kq' + (done ? " done" : "") + (on ? " picked" : "") + '"><div class="top"><span class="tag">' + tag + '</span>'
      + '<button class="kpick' + (on ? " on" : "") + '" data-pick="' + id + '" aria-pressed="' + on + '" aria-label="Select this mission">' + (on ? "✓" : "") + '</button></div>'
      + '<div class="small muted" style="margin-top:6px">' + sk[0] + ' ' + esc(sk[1]) + (done ? " · 🏆 Conquered" : "") + '</div><div class="qtext">' + esc(d.k) + '</div></div>';
  }
  const wrote = d.h ? 'You wrote: <b>' + esc(d.h) + '</b>' : "You skipped this one - have a go now! 💪";
  const tip = d.m2 || d.m, lines = hintLines(d), n = Math.min(hints.get(id) || 0, lines.length);
  let h = '<div class="kq' + (done ? " done" : "") + '"><div class="top"><span class="tag">' + tag + '</span>' + (done ? '<span class="badge Correct">🏆 Conquered</span>' : "") + '</div>'
    + '<div class="small muted" style="margin-top:6px">' + sk[0] + ' ' + esc(sk[1]) + '</div>'
    + '<div class="qtext">' + esc(d.k) + '</div>' + (d.img ? '<div class="qimg">' + d.img + '</div>' : '') + '<div class="small">' + wrote + '</div>';
  if (n > 0 && !showAns) h += hintBox(lines, n, id, false);
  if (showAns) h += '<div class="ansbox">✅ The answer is: <b>' + esc(d.c) + '</b></div>';
  if (showAns && d.w) h += '<div class="tip what"><b>🔎 What happened</b>' + d.w.split("\n").map(x => '<div>' + esc(x) + '</div>').join("") + '</div>';
  if (showAns && tip) h += '<div class="tip"><b>✏️ How it works</b>' + tip.split("\n").map(x => '<div>' + esc(x) + '</div>').join("") + '</div>';
  if (showAns && rehint.has(id) && lines.length) h += hintBox(lines, lines.length, id, true);
  if (showAns && sims.has(id) && SIM[id]) h += simPanel(id);
  h += '<div class="row2">';
  if (!showAns && n === 0 && lines.length) h += '<button class="kbtn ghost" data-hint="' + id + '">💡 Hint</button>';
  if (!showAns) h += '<button class="kbtn ghost" data-show="' + id + '">👀 Show answer</button>';
  if (showAns && lines.length && !rehint.has(id)) h += '<button class="kbtn ghost" data-rehint="' + id + '">💡 See the hint again</button>';
  if (showAns && SIM[id] && !sims.has(id)) h += '<button class="kbtn ghost" data-sim="' + id + '">🧩 Try a similar one</button>';
  if (!done && shown.has(id)) h += '<button class="kbtn" data-conq="' + id + '">🎉 I get it now!</button>';
  if (done) h += '<button class="kbtn ghost" data-unconq="' + id + '">↩️ Put back in To do</button>';
  h += '</div></div>';
  return h;
}
function kidMissions(){
  const rows = kidFiltered();
  const todo = DATA.filter(isTodo), nTodo = todo.filter(d => !conq.has(qid(d))).length, nDone = todo.length - nTodo;
  const kc = (v, label) => '<button class="kchip' + (K.f === v ? " on" : "") + '" data-kf="' + v + '">' + label + '</button>';
  const rc = (v, label) => '<button class="kchip' + (String(K.a) === String(v) ? " on" : "") + '" data-ka="' + v + '">' + label + '</button>';
  let h = topbar() + '<h1>Missions 🎯</h1><p class="sub">Have a go in your head first, then tap for help!</p>'
    + '<div class="kchips">' + kc("todo", "🎯 To do (" + nTodo + ")") + kc("done", "✅ Conquered (" + nDone + ")") + kc("all", "📚 Everything") + '</div>'
    + '<div class="klabel">Which round?</div><div class="kchips">' + rc("all", "🔁 All rounds") + attempts.map(a => rc(a, "Round " + a + " (" + kidFiltered(a).length + ")")).join("") + '</div>'
    + '<div class="sel" style="margin:12px 0 10px"><select data-ksel="1"><option value="all">All superpowers</option>'
    + skills.map(s => '<option value="' + esc(s) + '"' + (K.s === s ? " selected" : "") + '>' + kname(s)[0] + ' ' + esc(kname(s)[1]) + '</option>').join("") + '</select></div>'
    + '<div class="selrow"><button class="kchip' + (selecting ? " on" : "") + '" data-select="1">' + (selecting ? "✖ Stop selecting" : "☑️ Select several") + '</button></div>';
  if (selecting){
    const ids = rows.filter(isTodo).map(qid), all = ids.length > 0 && ids.every(i => picked.has(i)), np = picked.size;
    const undo = K.f === "done";
    h += '<div class="bulkbar"><span class="cnt"><b>' + np + '</b> selected</span>'
      + '<button class="kbtn ghost" data-pickall="1"' + (ids.length ? "" : " disabled") + '>' + (all ? "Clear" : "Select all (" + ids.length + ")") + '</button>'
      + '<button class="kbtn" data-bulk="' + (undo ? "undo" : "done") + '"' + (np ? "" : " disabled") + '>' + (undo ? "↩️ Put back in To do" : "🎉 Mark as done") + '</button></div>';
  }
  if (!rows.length){
    h += '<div class="empty">' + (K.f === "todo" ? "🎉 No missions left here - you conquered them all!" : K.f === "done" ? "Nothing here yet - conquer a mission to see it here!" : "Nothing to show.") + '</div>';
  }
  rows.forEach(d => { h += kidCard(d); });
  return h;
}
function kidSkills(){
  let h = topbar() + '<h1>Superpowers ⚡</h1><p class="sub">Tap one to practise it!</p>';
  skillStats().forEach(x => {
    const nm = kname(x.s), stars = x.p >= 75 ? 3 : x.p >= 50 ? 2 : 1;
    const label = x.p >= 75 ? "Superpower unlocked! ⚡" : x.p >= 50 ? "Getting strong 💪" : "Ready to level up 🌱";
    const col = x.p >= 75 ? "var(--ok)" : x.p >= 50 ? "var(--blank)" : "var(--accent)";
    h += '<button class="ksk" data-ks="' + esc(x.s) + '" data-kf="' + (x.lost > 0 ? "todo" : "all") + '"><div class="row"><span class="nm">' + nm[0] + ' ' + esc(nm[1]) + '</span><span class="stars" style="margin:0;font-size:18px">' + "⭐".repeat(stars) + '</span></div>'
      + '<div class="meter"><i style="width:' + Math.max(x.p, 6) + '%;background:' + col + '"></i></div>'
      + '<div class="row small"><span>' + x.ok + ' of ' + x.n + ' right</span><span>' + label + '</span></div></button>';
  });
  return h;
}

/* ================= shared ================= */
function csv(){
  const head = ["Attempt","Test","Part","Q","Skill","Her answer","Correct answer","Result","Note"];
  const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const lines = [head.map(q).join(",")].concat(DATA.map(d => [d.a, d.t, d.p, d.q, d.s, d.h, d.c, res(d), d.n].map(q).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "maths_tracker.csv"; document.body.appendChild(a); a.click(); a.remove();
}
function toast(msg){
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}
function render(){
  const app = document.getElementById("app"), nav = document.getElementById("nav");
  const y = window.scrollY, kid = mode === "kid";
  document.documentElement.dataset.mode = mode;
  app.innerHTML = kid ? (tab === "overview" ? kidOverview() : tab === "questions" ? kidMissions() : tab === "quests" ? nvView() : kidSkills())
                      : (tab === "overview" ? overview() : tab === "questions" ? questions() : tab === "quests" ? nvView() : skillsView());
  const labels = kid ? [["overview","🏠","Home"],["questions","🎯","Missions"],["skills","⚡","Superpowers"],["quests","🗺️","Side quests"]]
                     : [["overview","■","Overview"],["questions","☰","Questions"],["skills","▲","Skills"],["quests","◈","Reasoning"]];
  nav.innerHTML = labels.map(l => '<button data-tab="' + l[0] + '" class="' + (l[0] === tab ? "on" : "") + '"><b>' + l[1] + '</b>' + l[2] + '</button>').join("");
  window.scrollTo(0, y);
}

/* ===================== Reasoning engine: puzzle generators ===================== */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash32(){let h=2166136261;for(const x of arguments){const s=String(x);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}h^=124;h=Math.imul(h,16777619)}return h>>>0}
const RI=(r,a,b)=>a+Math.floor(r()*(b-a+1));
const PK=(r,a)=>a[Math.floor(r()*a.length)];
function SHF(r,a){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(r()*(i+1));const t=b[i];b[i]=b[j];b[j]=t}return b}

const FNAME=['white','light grey','dark'], ZNAME=['small','medium','big'];
const SHN={sq:'square',cir:'circle',tri:'triangle',dia:'diamond',pent:'pentagon',hex:'hexagon',ell:'oval',arrow:'arrow',semi:'half-circle',flag:'flag'};
const PG=(n,rad)=>Array.from({length:n},(_,i)=>{const a=(-90+360*i/n)*Math.PI/180;return (rad*Math.cos(a)).toFixed(2)+','+(rad*Math.sin(a)).toFixed(2)}).join(' ');
const SHP={
  sq:'<rect x="-.82" y="-.82" width="1.64" height="1.64"/>',
  cir:'<circle r=".92"/>',
  tri:'<polygon points="0,-.95 .95,.8 -.95,.8"/>',
  dia:'<polygon points="0,-1 .85,0 0,1 -.85,0"/>',
  pent:'<polygon points="'+PG(5,.97)+'"/>',
  hex:'<polygon points="'+PG(6,.97)+'"/>',
  arrow:'<polygon points="0,-1 .85,-.05 .32,-.05 .32,.95 -.32,.95 -.32,-.05 -.85,-.05"/>',
  semi:'<path d="M-.95,.5 A.95,.95 0 0 1 .95,.5 Z"/>',
  ell:'<ellipse rx=".98" ry=".6"/>',
  flag:'<polygon points="-.55,-.95 -.35,-.95 .85,-.52 -.35,-.1 -.35,.95 -.55,.95"/>'
};
const SYMO={sq:90,dia:180,pent:72,hex:60,ell:180,cir:1,tri:360,arrow:360,semi:360,flag:360};
const SZF=[.5,.72,.95];
const NPOS={1:[[0,0]],2:[[-.52,0],[.52,0]],3:[[-.55,.38],[.55,.38],[0,-.5]],4:[[-.52,-.52],[.52,-.52],[-.52,.52],[.52,.52]],5:[[-.64,-.52],[0,-.52],[.64,-.52],[-.32,.52],[.32,.52]],6:[[-.64,-.52],[0,-.52],[.64,-.52],[-.64,.52],[0,.52],[.64,.52]]};
const NSC={1:1,2:.5,3:.46,4:.42,5:.34,6:.34};
const SVGO=(w,h,inner,cls)=>'<svg class="nv '+(cls||'')+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-hidden="true">'+inner+'</svg>';
const BOX=(x,y,w,h,dash)=>'<rect class="bx'+(dash?' dash':'')+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="9"/>';

function fig(f,cx,cy,S){
  const n=f.n||1, sz=f.sz==null?1:f.sz;
  const one=(x,y,rad,withMk)=>{
    const tr='translate('+x.toFixed(1)+' '+y.toFixed(1)+') rotate('+(f.rot||0)+') '+(f.mir?'scale(-1 1) ':'')+'scale('+rad.toFixed(2)+')';
    return '<g class="nvf g'+(f.fi||0)+'" transform="'+tr+'">'+SHP[f.sh]+((withMk&&f.mk)?'<circle class="mk" cx="0" cy="-.5" r=".15"/>':'')+(f.dot?'<circle class="mk" r=".17"/>':'')+'</g>';
  };
  if(f.pos!=null){const P=[[-.52,-.52],[.52,-.52],[.52,.52],[-.52,.52]][f.pos];return one(cx+P[0]*S,cy+P[1]*S,S*SZF[sz]*.5,true);}
  if(n===1) return one(cx,cy,S*SZF[sz],true);
  return NPOS[n].map(p=>one(cx+p[0]*S,cy+p[1]*S,S*SZF[sz]*NSC[n],false)).join('');
}
function visSig(f){
  const o=(f.mk||f.dot)?360:(SYMO[f.sh]||360);
  const n=f.n||1;
  const rot=n>1?0:((((f.rot||0)%360)+360)%360);
  const rn=o===1?0:rot%o;
  return [f.sh,f.fi||0,f.sz==null?1:f.sz,n,f.mk?1:0,f.dot?1:0,f.pos==null?-1:f.pos,f.mir?1:0,rn].join('|');
}
const optSvg=f=>SVGO(100,100,BOX(2,2,96,96)+fig(f,50,50,34));

function perturb(r,f,attr){
  const g=Object.assign({},f);
  switch(attr){
    case 'fi':g.fi=PK(r,[0,1,2].filter(x=>x!==f.fi));break;
    case 'sz':g.sz=PK(r,[0,1,2].filter(x=>x!==(f.sz==null?1:f.sz)));break;
    case 'rot':g.rot=(f.rot||0)+PK(r,[45,90,-45,-90,180]);break;
    case 'n':g.n=PK(r,[(f.n||1)-1,(f.n||1)+1].filter(x=>x>=1&&x<=6));break;
    case 'sh':g.sh=PK(r,['sq','cir','tri','dia','pent','hex'].filter(x=>x!==f.sh));break;
    case 'pos':g.pos=PK(r,[0,1,2,3].filter(x=>x!==f.pos));break;
    case 'mir':g.mir=f.mir?0:1;break;
  }
  return g;
}
function assemble(r,ans,cands,fallback){
  const seen=new Set([visSig(ans)]); const out=[];
  const add=(f,tag)=>{const s=visSig(f);if(!seen.has(s)){seen.add(s);out.push({f:f,tag:tag});}};
  SHF(r,cands).forEach(c=>add(c.f,c.tag));
  let g=0; while(out.length<4&&g++<80){const at=PK(r,fallback);add(perturb(r,ans,at),at);}
  const opts=out.slice(0,4).concat([{f:ans,tag:'ok'}]);
  const order=SHF(r,opts);
  return {opts:order.map(o=>({svg:optSvg(o.f),tag:o.tag,sig:visSig(o.f)})),ans:order.findIndex(o=>o.tag==='ok')};
}
function noiseVec(r,vals,n){
  if(r()<.35){const v=PK(r,vals);return Array(n).fill(v);}
  const a=PK(r,vals), b=PK(r,vals.filter(x=>x!==a)); const idx=SHF(r,[0,1,2,3,4]); const v=Array(n).fill(a);
  idx.slice(0,2).forEach(i=>{v[i]=b;}); return v;
}

/* ---------- polyomino helpers ---------- */
const NB=[[1,0],[-1,0],[0,1],[0,-1]];
const cKey=cs=>cs.map(x=>x[0]+','+x[1]).sort().join(';');
function norm(cs){const mr=Math.min.apply(null,cs.map(x=>x[0])),mc=Math.min.apply(null,cs.map(x=>x[1]));return cs.map(x=>[x[0]-mr,x[1]-mc]);}
const rot90=cs=>norm(cs.map(x=>[x[1],-x[0]]));
const mirH=cs=>norm(cs.map(x=>[x[0],-x[1]]));
function rotK(cs,k){let a=norm(cs);for(let i=0;i<k;i++)a=rot90(a);return a;}
function symmetries(cs){const out=[];let a=norm(cs);for(let i=0;i<4;i++){out.push(a);a=rot90(a);}let m=mirH(cs);for(let i=0;i<4;i++){out.push(m);m=rot90(m);}return out;}
function isChiral(cs){const mk=cKey(mirH(cs));for(let i=0,a=norm(cs);i<4;i++,a=rot90(a)){if(cKey(a)===mk)return false;}return true;}
function connected(cs){if(!cs.length)return false;const seen=new Set([cs[0][0]+','+cs[0][1]]),st=[cs[0]];const has=(a,b)=>cs.some(x=>x[0]===a&&x[1]===b);while(st.length){const c=st.pop();NB.forEach(d=>{const a=c[0]+d[0],b=c[1]+d[1],k=a+','+b;if(has(a,b)&&!seen.has(k)){seen.add(k);st.push([a,b]);}});}return seen.size===cs.length;}
function randPoly(r,k,n){
  for(let t=0;t<400;t++){
    const cells=[[RI(r,0,n-1),RI(r,0,n-1)]]; let g=0;
    while(cells.length<k&&g++<300){const c=PK(r,cells),d=PK(r,NB),a=c[0]+d[0],b=c[1]+d[1];if(a<0||b<0||a>=n||b>=n||cells.some(x=>x[0]===a&&x[1]===b))continue;cells.push([a,b]);}
    if(cells.length===k) return cells;
  }
  return null;
}
function changedPoly(r,cs,n){
  const sy=symmetries(cs).map(cKey);
  for(let t=0;t<300;t++){
    const rem=PK(r,cs), rest=cs.filter(x=>x!==rem); if(!connected(rest))continue;
    const cand=[]; rest.forEach(c=>NB.forEach(d=>{const a=c[0]+d[0],b=c[1]+d[1];if(a>=0&&b>=0&&a<n&&b<n&&!rest.some(x=>x[0]===a&&x[1]===b)&&!(a===rem[0]&&b===rem[1]))cand.push([a,b]);}));
    if(!cand.length)continue; const ncs=rest.concat([PK(r,cand)]);
    if(!sy.includes(cKey(norm(ncs)))) return ncs;
  }
  return null;
}
function isSym(cs){
  const n=norm(cs),H=Math.max.apply(null,n.map(x=>x[0]))+1,W=Math.max.apply(null,n.map(x=>x[1]))+1,k=cKey(n);
  if(cKey(n.map(x=>[x[0],W-1-x[1]]))===k)return true;
  if(cKey(n.map(x=>[H-1-x[0],x[1]]))===k)return true;
  if(H===W){ if(cKey(n.map(x=>[x[1],x[0]]))===k)return true; if(cKey(n.map(x=>[W-1-x[1],H-1-x[0]]))===k)return true; }
  return false;
}
function symPoly(r,k,H,W){
  for(let t=0;t<800;t++){
    const cs=[]; for(let rr=0;rr<H;rr++)for(let c=0;c<Math.ceil(W/2);c++){if(r()<.55){cs.push([rr,c]);const mc=W-1-c;if(mc!==c)cs.push([rr,mc]);}}
    if(cs.length!==k||!connected(cs))continue;
    const n=norm(cs); if(Math.max.apply(null,n.map(x=>x[1]))+1!==W)continue; if(Math.max.apply(null,n.map(x=>x[0]))+1<3)continue;
    return cs;
  }
  return null;
}
function polySvg(cs,cell){
  const n=norm(cs),H=Math.max.apply(null,n.map(x=>x[0]))+1,W=Math.max.apply(null,n.map(x=>x[1]))+1;
  const ox=50-W*cell/2, oy=50-H*cell/2;
  return SVGO(100,100,BOX(2,2,96,96)+n.map(x=>'<rect class="nvf g1 cellp" x="'+(ox+x[1]*cell).toFixed(1)+'" y="'+(oy+x[0]*cell).toFixed(1)+'" width="'+cell+'" height="'+cell+'"/>').join(''));
}

/* ---------- 1. ODD ONE OUT ---------- */
function genOdd(r,L){
  const ALL=['sq','cir','tri','dia','pent','hex'], STR=['sq','tri','pent','hex','dia'], CUR=['cir','ell'];
  const oddIdx=RI(r,0,4); let opts=[],why=[];
  const fromFigs=figs=>figs.map((f,i)=>({svg:optSvg(f),tag:i===oddIdx?'ok':'noise',sig:visSig(f)}));
  if(L===1){
    const s=SHF(r,ALL), fi=PK(r,[0,1,2]), sz=PK(r,[1,2]);
    opts=fromFigs(Array.from({length:5},(_,i)=>({sh:i===oddIdx?s[1]:s[0],fi:fi,sz:sz})));
    why=['Four are '+SHN[s[0]]+'s. One is a '+SHN[s[1]]+'.'];
  }else if(L===2){
    const f=SHF(r,[0,1,2]), shv=noiseVec(r,SHF(r,ALL).slice(0,3),5), szv=noiseVec(r,[0,1,2],5);
    opts=fromFigs(Array.from({length:5},(_,i)=>({sh:shv[i],fi:i===oddIdx?f[1]:f[0],sz:szv[i]})));
    why=['Four have '+FNAME[f[0]]+' shading. One has '+FNAME[f[1]]+' shading.','Shape and size change in lots of them, so they are not the clue.'];
  }else if(L===3){
    if(r()<.5){
      const majS=r()<.6, maj=majS?STR:CUR, od=majS?CUR:STR, fiv=noiseVec(r,[0,1,2],5), szv=noiseVec(r,[0,1,2],5);
      const majShapes=majS?null:PK(r,[['cir','cir','cir','cir'],['ell','ell','ell','ell'],SHF(r,['cir','cir','ell','ell'])]); let mi=0;
      opts=fromFigs(Array.from({length:5},(_,i)=>({sh:i===oddIdx?PK(r,od):(majS?PK(r,maj):majShapes[mi++]),fi:fiv[i],sz:szv[i]})));
      why=majS?['Four shapes have only straight sides. One has a curved edge.']:['Four shapes are curved all the way round. One has straight sides.'];
    }else{
      const dotMaj=r()<.5, shv=noiseVec(r,SHF(r,ALL).slice(0,3),5), fiv=noiseVec(r,[0,1,2],5), szv=noiseVec(r,[1,2],5);
      opts=fromFigs(Array.from({length:5},(_,i)=>({sh:shv[i],fi:fiv[i],sz:szv[i],dot:(i===oddIdx)?(dotMaj?0:1):(dotMaj?1:0)})));
      why=dotMaj?['Four have a dot in the middle. One has no dot.']:['Four have no dot. One has a dot in the middle.'];
    }
  }else{
    const kc=PK(r,[8,9,10]), sym=[], seen=new Set(); let g=0;
    while(sym.length<4&&g++<600){const W=(kc%2===0)?PK(r,[3,4]):3;const cs=symPoly(r,kc,4,W);if(cs){const k=symmetries(cs).map(cKey).sort()[0];if(!seen.has(k)){seen.add(k);sym.push(cs);}}}
    let as=null; g=0; while(g++<800){const c=randPoly(r,kc,4);const nn=c&&norm(c);if(c&&!isSym(c)&&connected(c)&&Math.max.apply(null,nn.map(x=>x[1]))>=2&&Math.max.apply(null,nn.map(x=>x[0]))>=2){as=c;break;}}
    const cells=[]; let si=0; for(let i=0;i<5;i++)cells.push(i===oddIdx?as:sym[si++]);
    var cellsDbg=cells;
    opts=cells.map((cs,i)=>({svg:polySvg(rotK(cs,RI(r,0,3)),18),tag:i===oddIdx?'ok':'noise',sig:'p'+i}));
    why=['Four shapes are symmetrical: you could fold each one along a line and the two halves would match.','One shape has no line of symmetry.'];
  }
  return {stem:'',opts:opts,ans:oddIdx,why:why,meta:{polyCells:typeof cellsDbg!=='undefined'?cellsDbg:null},
    hint:['Check one feature at a time: shape, shading, size, any dots, curved or straight edges.','Which picture breaks the group?']};
}

/* ---------- 2. SERIES ---------- */
const mkRule=(attr,fn,say)=>({attr:attr,fn:fn,say:say});
const R_FILL_ALT=(a,b)=>mkRule('fi',i=>i%2?b:a,'The shading swaps between '+FNAME[a]+' and '+FNAME[b]+'.');
const R_SIZE_ALT=(a,b)=>mkRule('sz',i=>i%2?b:a,'The size swaps between '+ZNAME[a]+' and '+ZNAME[b]+'.');
const R_COUNT=()=>mkRule('n',i=>i+1,'One more shape is added each time.');
const R_ROT=st=>mkRule('rot',i=>i*st,'The shape turns '+st+'° clockwise each time.');
const R_SHAPE3=l=>mkRule('sh',i=>l[i%3],'The shapes repeat in a cycle of three: '+l.map(s=>SHN[s]).join(', ')+'.');
const R_SHAPE2=(a,b)=>mkRule('sh',i=>i%2?b:a,'The shape swaps between '+SHN[a]+' and '+SHN[b]+'.');
const R_FILL3=()=>mkRule('fi',i=>i%3,'The shading cycles: white, light grey, dark, then white again.');
const R_POS=()=>mkRule('pos',i=>i%4,'The shape hops clockwise to the next corner each time.');
function genSeries(r,L){
  const ASY=['arrow','tri','semi'], ANY=['sq','cir','tri','dia','pent','hex'];
  let rules=[],nShow=4,base={sh:PK(r,ANY),fi:0,sz:1,rot:0,n:1};
  const pf=()=>PK(r,[[0,2],[2,0],[0,1],[1,2]]);
  if(L===1){
    const t=PK(r,['fill','size','count']);
    if(t==='fill'){const p=pf();rules=[R_FILL_ALT(p[0],p[1])];}
    else if(t==='size'){const p=PK(r,[[0,2],[2,0],[0,1]]);rules=[R_SIZE_ALT(p[0],p[1])];}
    else{rules=[R_COUNT()];base.sz=2;}
  }else if(L===2){
    const t=PK(r,['rot','shape3','fill3','pos']);
    if(t==='rot'){base.sh=PK(r,ASY);rules=[R_ROT(45)];}
    else if(t==='shape3'){rules=[R_SHAPE3(SHF(r,ANY).slice(0,3))];nShow=5;}
    else if(t==='fill3'){rules=[R_FILL3()];nShow=5;}
    else{rules=[R_POS()];}
  }else if(L===3){
    nShow=5; const t=PK(r,['rotfill','countfill','rotsize','posfill']);
    if(t==='rotfill'){base.sh=PK(r,ASY);const p=pf();rules=[R_ROT(90),R_FILL_ALT(p[0],p[1])];}
    else if(t==='countfill'){base.sz=2;const p=pf();rules=[R_COUNT(),R_FILL_ALT(p[0],p[1])];}
    else if(t==='rotsize'){base.sh=PK(r,ASY);rules=[R_ROT(45),R_SIZE_ALT(0,2)];}
    else{const p=pf();rules=[R_POS(),R_FILL_ALT(p[0],p[1])];}
  }else{
    nShow=5; const t=PK(r,['A','B','C']);
    if(t==='A'){base.sh=PK(r,ASY);rules=[R_ROT(45),R_FILL3(),R_SIZE_ALT(1,2)];}
    else if(t==='B'){const s=SHF(r,ANY).slice(0,3);rules=[R_SHAPE3(s),R_FILL_ALT(0,2),R_POS()];}
    else{const s=SHF(r,ANY);base.sz=2;rules=[R_COUNT(),R_SHAPE2(s[0],s[1]),R_FILL3()];}
  }
  const items=Array.from({length:nShow+1},(_,i)=>{const f=Object.assign({},base);rules.forEach(rl=>{f[rl.attr]=rl.fn(i);});return f;});
  const ans=items[nShow], last=items[nShow-1];
  const cands=[{f:last,tag:'repeat'},{f:items[nShow-2],tag:'repeat'}];
  rules.forEach(rl=>{const st=Object.assign({},ans);st[rl.attr]=last[rl.attr];cands.push({f:st,tag:'stall'});cands.push({f:perturb(r,ans,rl.attr),tag:rl.attr});cands.push({f:perturb(r,ans,rl.attr),tag:rl.attr});});
  const as=assemble(r,ans,cands,rules.map(x=>x.attr).concat(['sh','fi']));
  const bw=50,gap=6,w=(nShow+1)*(bw+gap)-gap;
  let st=''; for(let i=0;i<=nShow;i++){const x=i*(bw+gap);st+=BOX(x+1,1,bw-2,bw-2,i===nShow);st+=(i<nShow)?fig(items[i],x+bw/2,bw/2,21):'<text class="svgtxt" x="'+(x+bw/2)+'" y="'+(bw/2+8)+'" text-anchor="middle">?</text>';}
  return {stem:SVGO(w,bw,st),opts:as.opts,ans:as.ans,why:rules.map(x=>x.say),meta:{items:items,nShow:nShow,attrs:rules.map(x=>x.attr)},
    hint:['Say what changes from picture 1 to 2, then from 2 to 3.','Keep going with the same changes for the empty box.']};
}

/* ---------- 3. ANALOGY ---------- */
function genAnalogy(r,L){
  const ANY=['sq','cir','tri','dia','pent','hex'], ASY=['arrow','tri','semi'];
  const PP=[[0,2],[2,0],[0,1],[1,2],[2,1]];
  const E={
    fill:(a,b)=>({attr:'fi',start:f=>{f.fi=a;},apply:f=>Object.assign({},f,{fi:b}),wrong:f=>Object.assign({},f,{fi:[0,1,2].find(x=>x!==a&&x!==b)}),say:'The shading changes from '+FNAME[a]+' to '+FNAME[b]+'.'}),
    size:(a,b)=>({attr:'sz',start:f=>{f.sz=a;},apply:f=>Object.assign({},f,{sz:b}),wrong:f=>Object.assign({},f,{sz:[0,1,2].find(x=>x!==a&&x!==b)}),say:'The size changes from '+ZNAME[a]+' to '+ZNAME[b]+'.'}),
    rot:d=>({attr:'rot',start:f=>{f.rot=0;},apply:f=>Object.assign({},f,{rot:(f.rot||0)+d}),wrong:f=>Object.assign({},f,{rot:(f.rot||0)+(Math.abs(d)===180?90:-d)}),say:Math.abs(d)===180?'The shape is turned upside down (a half turn).':'The shape turns '+Math.abs(d)+'° '+(d>0?'clockwise':'anticlockwise')+'.'}),
    mirror:()=>({attr:'mir',start:f=>{f.mir=0;},apply:f=>Object.assign({},f,{mir:1}),wrong:f=>Object.assign({},f,{rot:180}),say:'The shape is flipped over like a mirror image (left and right swap).'}),
    count:()=>({attr:'n',start:f=>{f.n=1;},apply:f=>Object.assign({},f,{n:(f.n||1)+1}),wrong:f=>Object.assign({},f,{n:(f.n||1)+2}),say:'One more shape is added.'}),
    swap:(s1,s2,s3)=>({attr:'sh',start:f=>{f.sh=s1;},apply:f=>Object.assign({},f,{sh:s2}),wrong:f=>Object.assign({},f,{sh:s3}),say:'The '+SHN[s1]+' changes into a '+SHN[s2]+'.'})
  };
  let edits=[],shA,shC,bothSame=false,sizeFix=false;
  const diffShapes=pool=>{const s=SHF(r,pool);shA=s[0];shC=s[1];};
  if(L===1){const p=PK(r,PP);edits=[r()<.5?E.fill(p[0],p[1]):E.size(p[0],p[1])];diffShapes(ANY);}
  else if(L===2){edits=[E.rot(PK(r,[90,180,-90]))];diffShapes(ASY);}
  else if(L===3){if(r()<.5){edits=[E.mirror()];shA=shC='flag';bothSame=true;}else{edits=[E.count()];diffShapes(ANY);sizeFix=true;}}
  else{
    const t=PK(r,['rotfill','mirrorsize','swapfill','countfill']); const p=PK(r,PP);
    if(t==='rotfill'){edits=[E.rot(PK(r,[90,-90,180])),E.fill(p[0],p[1])];diffShapes(ASY);}
    else if(t==='mirrorsize'){edits=[E.mirror(),E.size(PP[0][0],PP[0][1])];shA=shC='flag';bothSame=true;}
    else if(t==='swapfill'){const s=SHF(r,ANY);edits=[E.swap(s[0],s[1],s[2]),E.fill(p[0],p[1])];shA=shC=s[0];bothSame=true;}
    else{edits=[E.count(),E.fill(p[0],p[1])];diffShapes(ANY);sizeFix=true;}
  }
  const A={sh:shA,fi:0,sz:1,rot:0,n:1}; edits.forEach(e=>e.start(A)); if(sizeFix)A.sz=2;
  const C=Object.assign({},A,{sh:shC});
  if(bothSame){
    const hasSize=edits.some(e=>e.attr==='sz'), hasFill=edits.some(e=>e.attr==='fi');
    if(!hasSize&&!hasFill){C.fi=PK(r,[1,2]);}
    else if(!hasSize){C.sz=PK(r,[0,2]);}
    else{C.fi=PK(r,[1,2]);}
  }
  const B=edits.reduce((f,e)=>e.apply(f),A), ans=edits.reduce((f,e)=>e.apply(f),C);
  const cands=[{f:C,tag:'nochange'},{f:B,tag:'copyB'}];
  edits.forEach((e,i)=>{
    cands.push({f:edits.filter((_,j)=>j!==i).reduce((f,x)=>x.apply(f),C),tag:'partial'});
    cands.push({f:edits.reduce((f,x,j)=>j===i?x.wrong(f):x.apply(f),C),tag:e.attr});
  });
  const as=assemble(r,ans,cands,['fi','sz','sh']);
  const bw=60;
  let st=BOX(1,1,bw-2,bw-2)+fig(A,31,30,25)+'<text class="svgtxt" x="77" y="38" text-anchor="middle">→</text>'
    +BOX(92,1,bw-2,bw-2)+fig(B,122,30,25)
    +'<text class="svgtxt" x="164" y="38" text-anchor="middle">:</text>'
    +BOX(176,1,bw-2,bw-2)+fig(C,206,30,25)+'<text class="svgtxt" x="251" y="38" text-anchor="middle">→</text>'
    +BOX(266,1,bw-2,bw-2,true)+'<text class="svgtxt" x="296" y="40" text-anchor="middle">?</text>';
  return {stem:SVGO(328,bw,st),opts:as.opts,ans:as.ans,meta:{A:A,B:B,C:C,ans:ans},why:edits.map(e=>e.say).concat(['Do exactly the same change to the third picture.']),
    hint:['What changed between the first two pictures? Name each change.','Make the very same change(s) to the third picture.']};
}

/* ---------- 4. MATRIX ---------- */
function genMatrix(r,L){
  const shapes=SHF(r,['sq','cir','tri','dia','pent','hex']);
  const s3=shapes.slice(0,3), fo=SHF(r,[0,1,2]); let N=3,cell,why=[];
  if(L===1){N=2;const fl=PK(r,[[0,2],[2,0]]);cell=(a,b)=>({sh:s3[a],fi:fl[b],sz:1});why=['Each row has its own shape.','The shading changes along the row in the same way each time.'];}
  else if(L===2){cell=(a,b)=>({sh:s3[a],fi:fo[b],sz:1});why=['Each row has its own shape.','Each column has its own shading.'];}
  else if(L===3){cell=(a,b)=>({sh:s3[(a+b)%3],fi:fo[a],sz:1});why=['Each row has its own shading.','The three shapes shift along one place in each row, so every row and column has each shape once.'];}
  else{cell=(a,b)=>({sh:s3[(a+b)%3],fi:fo[(a+2*b)%3],sz:1});why=['Every row and every column has each of the three shapes exactly once.','Every row and every column also has each of the three shadings exactly once.','So the missing square is the shape and shading not yet used in its row and column.'];}
  const m=N-1, ans=cell(m,m);
  const psh=()=>Object.assign({},ans,{sh:PK(r,s3.slice(0,N===2?2:3).filter(x=>x!==ans.sh))});
  const cands=[{f:cell(m,m-1),tag:'copyrow'},{f:cell(m-1,m),tag:'copycol'},{f:psh(),tag:'sh'},{f:psh(),tag:'sh'},{f:psh(),tag:'sh'},{f:perturb(r,ans,'fi'),tag:'fi'},{f:perturb(r,ans,'fi'),tag:'fi'},{f:perturb(r,ans,'sz'),tag:'sz'}];
  if(N===3){cands.push({f:cell(0,m),tag:'copycol'});cands.push({f:cell(m,0),tag:'copyrow'});}
  const as=assemble(r,ans,cands,['fi','sz']);
  const cs=56,w=N*cs+4; let st='';
  for(let a=0;a<N;a++)for(let b=0;b<N;b++){const x=2+b*cs,y=2+a*cs;if(a===m&&b===m){st+=BOX(x+1,y+1,cs-4,cs-4,true)+'<text class="svgtxt" x="'+(x+cs/2-1)+'" y="'+(y+cs/2+8)+'" text-anchor="middle">?</text>';}else{st+=BOX(x+1,y+1,cs-4,cs-4)+fig(cell(a,b),x+cs/2-1,y+cs/2-1,21);}}
  return {stem:SVGO(w,w,st,'sq'),opts:as.opts,ans:as.ans,why:why,meta:{N:N,L:L,grid:Array.from({length:N},(_,a)=>Array.from({length:N},(_,b)=>cell(a,b))),optSigs:as.opts.map(o=>o.sig)},
    hint:['Look at one row, then one column. What stays the same? What changes?','Which picture is missing from its row and column?']};
}

/* ---------- 5. TURN OR FLIP ---------- */
function genTurn(r,L){
  const cfg={1:{k:4,n:3,cs:26,nm:2,nc:1},2:{k:5,n:3,cs:24,nm:2,nc:1},3:{k:6,n:4,cs:20,nm:2,nc:2},4:{k:7,n:4,cs:18,nm:2,nc:2}}[L];
  let cs=null,rcs=[]; for(let t=0;t<900&&!cs;t++){const c=randPoly(r,cfg.k,cfg.n);if(c&&isChiral(c)&&connected(c)){const ok0=cKey(norm(c));const rr=[1,2,3].filter(q=>cKey(rotK(c,q))!==ok0);if(rr.length){cs=c;rcs=rr;}}}
  const keys=new Set(); const opts=[];
  const addOpt=(cells,tag)=>{const k=cKey(norm(cells));if(keys.has(k))return false;keys.add(k);opts.push({cells:cells,tag:tag});return true;};
  const orig=norm(cs); keys.add(cKey(orig)); // the original orientation is shown in the stem, never as an option
  const rc=PK(r,rcs); addOpt(rotK(cs,rc),'ok');
  let g=0; const rots=SHF(r,[0,1,2,3]); let ri=0;
  while(opts.filter(o=>o.tag==='mirror').length<cfg.nm&&g++<40){addOpt(rotK(mirH(cs),rots[ri++%4]),'mirror');}
  g=0; while(opts.filter(o=>o.tag==='changed').length<cfg.nc&&g++<60){const ch=changedPoly(r,cs,cfg.n);if(ch)addOpt(rotK(ch,RI(r,0,3)),'changed');}
  g=0; while(opts.length<(L<=2?4:5)&&g++<60){const ch=changedPoly(r,cs,cfg.n);if(ch)addOpt(rotK(ch,RI(r,0,3)),'changed');}
  const order=SHF(r,opts);
  return {stem:SVGO(100,100,BOX(2,2,96,96)+norm(cs).map(x=>{const H=Math.max.apply(null,norm(cs).map(y=>y[0]))+1,W=Math.max.apply(null,norm(cs).map(y=>y[1]))+1;return '<rect class="nvf g1 cellp" x="'+(50-W*cfg.cs/2+x[1]*cfg.cs).toFixed(1)+'" y="'+(50-H*cfg.cs/2+x[0]*cfg.cs).toFixed(1)+'" width="'+cfg.cs+'" height="'+cfg.cs+'"/>';}).join(''),'one'),
    opts:order.map(o=>({svg:polySvg(o.cells,cfg.cs),tag:o.tag,sig:cKey(norm(o.cells))})),ans:order.findIndex(o=>o.tag==='ok'),meta:{orig:cs,cells:order.map(o=>o.cells)},
    why:['The correct one is the original shape turned round, like turning a steering wheel.','A flipped (mirror) shape can never be turned to match.','Some options have a square moved to a different place, so they are a different shape.'],
    hint:['Pick one odd-looking part, like the longest arm, and follow it as you turn the shape in your head.','Remember: turning is OK, flipping over is not.']};
}

/* ---------- 6. CODE BREAKER ---------- */
function genCode(r,L){
  const letters=SHF(r,'ABCDEFGH'.split('')); let li=0; const take=()=>letters[li++];
  const useSz=L>=3, nSh=(L===2||L===4)?3:2;
  const shapes=SHF(r,['sq','tri','cir','dia']).slice(0,nSh), fills=[0,2], sizes=[0,2];
  const code={sh:shapes.map(()=>take()),fi:fills.map(()=>take())}; if(useSz)code.sz=sizes.map(()=>take());
  const attrs=useSz?['sh','fi','sz']:['sh','fi'];
  const vals={sh:shapes,fi:fills,sz:sizes};
  const baseIdx={sh:0,fi:0,sz:0};
  const figOf=ix=>({sh:shapes[ix.sh],fi:fills[ix.fi],sz:useSz?sizes[ix.sz]:1});
  const codeOf=ix=>attrs.map(a=>code[a][ix[a]]).join('');
  const exIx=[Object.assign({},baseIdx)];
  attrs.forEach(a=>{for(let v=1;v<vals[a].length;v++){const e=Object.assign({},baseIdx);e[a]=v;exIx.push(e);}});
  const test={}; attrs.forEach(a=>{test[a]=1+(vals[a].length>2?RI(r,0,1):0);});
  const exs=SHF(r,exIx); const ans=codeOf(test), tf=figOf(test);
  const cset=new Set([ans]); const cands=[];
  const allL=[].concat.apply([],attrs.map(a=>code[a]));
  const rev=ans.split('').reverse().join(''); if(rev!==ans)cands.push({t:rev,tag:'order'});
  ans.split('').forEach((ch,pos)=>{allL.forEach(l=>{if(l!==ch){const s=ans.split('');s[pos]=l;cands.push({t:s.join(''),tag:'letter'});}});});
  const pickd=[]; SHF(r,cands).forEach(c=>{if(!cset.has(c.t)&&pickd.length<4){cset.add(c.t);pickd.push(c);}});
  if(rev!==ans&&!pickd.some(c=>c.t===rev)){pickd[0]={t:rev,tag:'order'};}
  const order=SHF(r,pickd.map(c=>({t:c.t,tag:c.tag})).concat([{t:ans,tag:'ok'}]));
  const cw=104,bh=66,rowH=92,n=exs.length+1;
  let st=''; for(let i=0;i<n;i++){const col=i%3,row=Math.floor(i/3),x=col*cw+8,y=row*rowH+2;
    if(i<exs.length){st+=BOX(x,y,bh,bh)+fig(figOf(exs[i]),x+bh/2,y+bh/2,26)+'<text class="svgtxt code" x="'+(x+bh/2)+'" y="'+(y+bh+19)+'" text-anchor="middle">'+codeOf(exs[i])+'</text>';}
    else{st+=BOX(x,y,bh,bh,true)+fig(tf,x+bh/2,y+bh/2,26)+'<text class="svgtxt code" x="'+(x+bh/2)+'" y="'+(y+bh+19)+'" text-anchor="middle">?</text>';}}
  const rows=Math.ceil(n/3);
  const why=['Compare the examples. When only one thing changes, only one letter changes.'].concat(attrs.map(a=>vals[a].map((v,i)=>code[a][i]+' = '+(a==='sh'?SHN[v]:a==='fi'?FNAME[v]:ZNAME[v])).join(', ')+'.'));
  return {stem:SVGO(324,rows*rowH,st),opts:order.map(o=>({text:o.t,tag:o.tag,sig:o.t})),ans:order.findIndex(o=>o.tag==='ok'),why:why,meta:{exs:exs.map(ix=>({fig:figOf(ix),code:codeOf(ix)})),test:tf,ans:ans,attrs:attrs},
    hint:['Find two examples that are almost the same. The letter that is different matches the thing that is different.','Build the last code one letter at a time.']};
}

const NV_GEN={odd:genOdd,series:genSeries,analogy:genAnalogy,matrix:genMatrix,turn:genTurn,code:genCode};
function nvSeed(runSeed,type,level,k){return hash32(runSeed,type,level,k);}
function nvGen(type,level,seed){const r=mulberry32(seed);const it=NV_GEN[type](r,level);it.type=type;it.level=level;it.seed=seed;return it;}

/* ===================== Reasoning side quests: assessment, results, practice ===================== */
const NVK="mm3_nvr_v1";
let nv={runs:[],practice:[],start:{}};
try{const s=JSON.parse(localStorage.getItem(NVK)||"null");if(s&&s.runs)nv=Object.assign({runs:[],practice:[],start:{}},s);}catch(e){}
function nvSave(){try{localStorage.setItem(NVK,JSON.stringify(nv));}catch(e){}}
let nvUI={screen:"home",pick:null,cur:null,pr:null,review:false,justDone:false};

const NV_TYPES=[
 {id:"odd",name:"Odd One Out",kid:"Odd One Out Detective",em:"🕵️",src:"CAT4 Figure Classification; 11+ Odd One Out",prompt:"Which one is the odd one out?",
  how:["Four of these pictures follow the same pattern. One doesn't!","Look at the shapes, shading, size and details. Find what the four have in common."]},
 {id:"series",name:"What Comes Next",kid:"Pattern Pathfinder",em:"🧭",src:"11+ Missing Sequence",prompt:"What comes next in the pattern?",
  how:["Look along the row. The pictures change in the same way each step.","Work out the changes, then pick the picture for the empty box."]},
 {id:"analogy",name:"Shape Match-Up",kid:"Shape Match-Up",em:"🔗",src:"CAT4 Figure Matrices; 11+ Like Shapes",prompt:"The first picture changes into the second. What does the third picture change into?",
  how:["The first picture changes into the second one in a certain way.","Make exactly the same change to the third picture."]},
 {id:"matrix",name:"Missing Square",kid:"Missing Square Mystery",em:"🧩",src:"11+ Missing Square; CAT4 Figure Matrices",prompt:"Which picture finishes the grid?",
  how:["Every row and every column follows rules.","Work out the rules, then find the picture for the empty square."]},
 {id:"turn",name:"Turn or Flip",kid:"Turn or Flip?",em:"🔄",src:"11+ Rotations",prompt:"Which one is the SAME shape, just turned around? (Not flipped over!)",
  how:["You can turn a shape round, like a steering wheel, and it is still the same shape.","A flipped shape, like a mirror image, is different.","Find the one that is the original shape, just turned."]},
 {id:"code",name:"Code Breaker",kid:"Code Breaker",em:"🔐",src:"11+ Code Breaker",prompt:"Crack the code! What is the code for the last shape?",
  how:["Each shape has a secret code made of letters.","Compare the examples to find out what each letter means.","Then write the code for the last shape."]}
];
const TAGCAT={repeat:"copying the last picture",stall:"applying only part of the rule",fi:"shading",sz:"size",rot:"turning / direction",n:"counting",sh:"shape",pos:"position",mir:"flip vs turn",mirror:"flip vs turn",changed:"spotting small differences",noise:"getting distracted by details",nochange:"copying without changing",copyB:"copying the example",partial:"applying only part of the rule",copyrow:"copying a neighbour",copycol:"copying a neighbour",letter:"what each letter means",order:"letter order",skip:"unsure",other:"other"};
const NVLEV=["Not yet established","Starting out","Developing","Secure","Strong (stretch level)"];
const NVLEVK=["Great place to start! 🌱","Warming up 🔥","Getting strong 💪","Super sharp ⚡","Superstar! 🏆"];
const NVLTXT=["","Warm-up","Core","Challenge","Stretch (11+ style)"];

function nvRun(){const r=nv.runs[nv.runs.length-1];return r&&!r.end?r:null;}
function nvLastDone(skip){let seen=0;for(let i=nv.runs.length-1;i>=0;i--){if(nv.runs[i].end){if(seen>=(skip||0))return nv.runs[i];seen++;}}return null;}
function nvNew(){
  const seed=(Date.now()%2147483647)>>>0, tp={};
  NV_TYPES.forEach(t=>{tp[t.id]={lvl:1,k:0,consec:0,n:0,l4ok:0,done:false};});
  nv.runs.push({id:nv.runs.length+1,seed:seed,start:Date.now(),end:null,items:[],tp:tp,intro:{},breakSeen:false});
  nvSave(); nvUI.screen="run"; nvUI.pick=null; nvUI.cur=null; nvUI.justDone=false;
}
function nvStep(run){
  const open=NV_TYPES.filter(t=>!run.tp[t.id].done);
  if(!open.length)return {screen:"done"};
  if(NV_TYPES.slice(0,3).every(t=>run.tp[t.id].done)&&!run.breakSeen)return {screen:"break"};
  const t=open[0]; if(!run.intro[t.id])return {screen:"intro",type:t.id};
  return {screen:"item",type:t.id};
}
function nvCurItem(run,type){
  const tp=run.tp[type], key=run.id+"-"+type+"-"+tp.lvl+"-"+tp.k;
  if(!nvUI.cur||nvUI.cur.key!==key){nvUI.cur={key:key,item:nvGen(type,tp.lvl,nvSeed(run.seed,type,tp.lvl,tp.k)),t0:Date.now()};nvUI.pick=null;}
  return nvUI.cur;
}
function nvRecord(run,skip){
  const st=nvStep(run); if(st.screen!=="item")return;
  const type=st.type, tp=run.tp[type], cur=nvCurItem(run,type), it=cur.item;
  const pk=skip?null:nvUI.pick, ok=!skip&&pk===it.ans, ms=Math.min(180000,Date.now()-cur.t0);
  run.items.push({t:type,l:tp.lvl,k:tp.k,pi:pk,ok:ok,skip:!!skip,ms:ms,tag:skip?"skip":(pk==null?"other":it.opts[pk].tag)});
  tp.n++; tp.k++;
  if(ok){tp.consec=0;if(tp.lvl<4)tp.lvl++;else{tp.l4ok++;if(tp.l4ok>=2)tp.done=true;}}
  else{tp.consec++;if(tp.consec>=2)tp.done=true;}
  if(tp.n>=7)tp.done=true;
  if(NV_TYPES.every(t=>run.tp[t.id].done))run.end=Date.now();
  nvUI.pick=null; nvUI.cur=null; nvSave();
}
function nvAnalyse(run){
  const out={};
  NV_TYPES.forEach(T=>{
    const its=run.items.filter(x=>x.t===T.id), okBy={};
    its.forEach(x=>{if(x.ok)okBy[x.l]=(okBy[x.l]||0)+1;});
    let eff=0; for(let L=1;L<=4;L++){if((okBy[L]||0)>=(L===4?2:1))eff=L;}
    const ms=its.filter(x=>!x.skip).map(x=>x.ms).sort((a,b)=>a-b);
    const errs={}; its.filter(x=>!x.ok).forEach(x=>{const c=TAGCAT[x.tag]||"other";errs[c]=(errs[c]||0)+1;});
    out[T.id]={eff:eff,n:its.length,ok:its.filter(x=>x.ok).length,skips:its.filter(x=>x.skip).length,med:ms.length?ms[Math.floor(ms.length/2)]:null,errs:errs,stretch:okBy[4]===1,items:its};
  });
  return out;
}
function nvPlan(an){
  const ids=NV_TYPES.map(t=>t.id), acc=id=>an[id].n?an[id].ok/an[id].n:0;
  const strong=ids.slice().sort((a,b)=>an[b].eff-an[a].eff||acc(b)-acc(a))[0];
  const rest=ids.filter(i=>i!==strong).sort((a,b)=>an[a].eff-an[b].eff||acc(a)-acc(b));
  return {warm:strong,focus:rest.slice(0,3),keep:rest.slice(3)};
}
const nvT=id=>NV_TYPES.find(t=>t.id===id);
const nvName=id=>mode==="kid"?nvT(id).kid:nvT(id).name;
const nvSecs=ms=>ms==null?"-":Math.round(ms/1000)+" s";

/* ---------- item rendering ---------- */
function nvOpts(it,o){
  const cols=it.opts.length===4?"c2":"c3";
  return '<div class="opts '+cols+'">'+it.opts.map((op,i)=>{
    let cls="opt"; if(o.reveal){if(i===it.ans)cls+=" good";else if(i===o.pick)cls+=" bad";}else if(i===o.sel)cls+=" sel";
    return '<button class="'+cls+'" '+(o.interactive?'data-nv="pick" data-v="'+i+'"':'disabled')+' aria-label="Option '+"ABCDE"[i]+'">'+(op.svg||'<span class="codeopt">'+esc(op.text)+'</span>')+'<span class="lt">'+"ABCDE"[i]+'</span></button>';
  }).join("")+'</div>';
}
const nvList=a=>a.map(x=>'<div>'+esc(x)+'</div>').join("");

/* ---------- progress shown while doing the check-up ---------- */
function nvDots(n,max){
  let h='<span class="pdots" aria-hidden="true">';
  for(let i=0;i<max;i++) h+='<i class="'+(i<n?'on':i===n?'cur':'')+'"></i>';
  return h+'</span>';
}
function nvProgress(run,type){
  const tp=run.tp[type], kid=mode==="kid", open=NV_TYPES.filter(t=>!run.tp[t.id].done&&t.id!==type);
  const doneN=NV_TYPES.filter(t=>run.tp[t.id].done).length, next=open[0];
  const grp=(label,from)=>'<div class="grp"><div class="gl">'+label+'</div><div class="steps">'+NV_TYPES.slice(from,from+3).map(t=>{
    const d=run.tp[t.id].done, cur=t.id===type;
    return '<span class="step'+(d?' done':cur?' cur':'')+'" title="'+esc(nvName(t.id))+'">'+(d?'✓':t.em)+'</span>';
  }).join("")+'</div></div>';
  const left=open.length;
  return '<div class="nvprog" role="group" aria-label="Progress: '+doneN+' of 6 puzzle types finished">'
    +'<div class="nvparts">'+grp(kid?"Part 1":"Part 1 of 2",0)+'<span class="stepgap" title="Break between the parts">☕</span>'+grp(kid?"Part 2":"Part 2 of 2",3)+'</div>'
    +'<div class="nvline"><span>'+(kid?"Puzzle ":"Puzzle ")+'<b>'+(tp.n+1)+'</b> of up to 7 in this section</span>'+nvDots(tp.n,7)+'</div>'
    +'<div class="small muted">'+(kid?"It can finish sooner - that is fine! ":"The section can end early, so this is a maximum. ")
    +(next?'Up next: '+next.em+' '+esc(nvName(next.id))+(left>1?' (then '+(left-1)+' more)':''):'This is the last section!')+'</div></div>';
}

/* ---------- assessment screens ---------- */
function nvIntroScreen(type,run){
  const T=nvT(type), idx=NV_TYPES.findIndex(t=>t.id===type), ex=nvGen(type,1,9100+idx);
  return topbar()+'<h1>'+T.em+' '+nvName(type)+'</h1>'+(run?nvProgress(run,type):'')+'<div class="kcard"><b>How it works</b><div class="tip" style="margin-top:6px">'+nvList(T.how)+'</div>'
    +'<div class="nvprompt" style="margin-top:12px">Example</div><div class="small muted">'+esc(T.prompt)+'</div>'
    +(ex.stem?'<div class="nvstem">'+ex.stem+'</div>':'')+nvOpts(ex,{reveal:true,pick:null})
    +'<div class="tip what" style="border-left-color:var(--ok)"><b style="color:var(--ok)">✅ The answer is '+"ABCDE"[ex.ans]+'</b>'+nvList(ex.why)+'</div>'
    +'<button class="kbtn" style="margin-top:14px" data-nv="begin">🚀 Let\'s go!</button></div>'
    +'<p class="small muted">The puzzles start easy and get trickier. You will not be told if answers are right until the end.</p>';
}
function nvBreakScreen(){
  return topbar()+'<h1>🍎 Part 1 done!</h1><div class="kcard"><p style="font-size:18px;margin-top:0">Brilliant focus. Time for a stretch and a drink if you want one.</p>'
    +'<p>Part 2 has three more puzzle types. You can carry on now, or come back later - your answers are saved.</p>'
    +'<button class="kbtn" data-nv="cont">▶️ Keep going</button><div style="height:10px"></div><button class="kbtn ghost" data-nv="later">💾 Save and finish later</button></div>';
}
function nvItemScreen(run,type){
  const T=nvT(type), cur=nvCurItem(run,type), it=cur.item, part=NV_TYPES.findIndex(x=>x.id===type)<3?1:2;
  return topbar()+'<div class="nvhead">Part '+part+' of 2 &middot; '+nvName(type)+' '+T.em+'</div>'+nvProgress(run,type)
    +'<div class="kcard"><div class="nvprompt">'+esc(T.prompt)+'</div>'+(it.stem?'<div class="nvstem">'+it.stem+'</div>':'')
    +nvOpts(it,{sel:nvUI.pick,interactive:true})
    +'<div class="nvbtns"><button class="kbtn ghost" data-nv="unsure">🤔 I\'m not sure</button><button class="kbtn" data-nv="confirm"'+(nvUI.pick==null?' disabled':'')+'>✅ That\'s my answer</button></div></div>'
    +'<p class="small muted">Do your best. If it feels too tricky, tap "I\'m not sure" - that is fine!</p><button class="link" data-nv="later">Save and finish later</button>';
}

/* ---------- results ---------- */
function nvGrown(run){
  const an=nvAnalyse(run), plan=nvPlan(an), prev=nvLastDone(1)&&nvLastDone(1)!==run?nvLastDone(1):null, pa=prev?nvAnalyse(prev):null;
  const dt=new Date(run.end).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
  let h='<p class="sub">Completed '+dt+' &middot; '+run.items.length+' puzzles &middot; about '+Math.max(1,Math.round((run.items.reduce((s,x)=>s+x.ms,0))/60000))+' min of puzzle time</p>';
  h+='<div class="card"><b>Where to start</b><div class="small" style="margin-top:6px">'
    +'Warm-up with <b>'+esc(nvT(plan.warm).name)+'</b> (strongest). Then focus on '+plan.focus.map(i=>'<b>'+esc(nvT(i).name)+'</b>').join(', ')+'.'
    +(plan.keep.length?' Keep ticking over: '+plan.keep.map(i=>esc(nvT(i).name)).join(', ')+'.':'')+'</div></div>';
  NV_TYPES.forEach(T=>{
    const a=an[T.id], acc=a.n?Math.round(a.ok*100/a.n):0, col=a.eff>=3?"var(--ok)":a.eff===2?"var(--blank)":"var(--bad)";
    const errs=Object.keys(a.errs).sort((x,y)=>a.errs[y]-a.errs[x]).slice(0,2).map(k=>k+' ('+a.errs[k]+')').join(', ');
    const delta=pa?(a.eff>pa[T.id].eff?' <span class="up">&#9650; from '+pa[T.id].eff+'</span>':a.eff<pa[T.id].eff?' <span class="down">&#9660; from '+pa[T.id].eff+'</span>':' <span class="muted">(unchanged)</span>'):'';
    h+='<div class="card"><div class="row"><b>'+T.em+' '+esc(T.name)+'</b><b style="color:'+col+'">Level '+a.eff+' of 4'+delta+'</b></div>'
      +'<div class="meter"><i style="width:'+(a.eff*25)+'%;background:'+col+'"></i></div>'
      +'<div class="small"><b>'+NVLEV[a.eff]+'</b>'+(a.stretch?' &middot; tried one stretch puzzle correctly (needs two to count)':'')+'</div>'
      +'<div class="small muted" style="margin-top:4px">'+a.ok+' of '+a.n+' correct &middot; median '+nvSecs(a.med)+' per puzzle'+(a.skips?' &middot; '+a.skips+' "not sure"':'')+'</div>'
      +(errs?'<div class="small" style="margin-top:4px">Slips to watch: '+esc(errs)+'</div>':'')
      +'<div class="small muted" style="margin-top:4px">Format reference: '+esc(T.src)+'</div></div>';
  });
  h+='<h2>Suggested practice</h2><div class="card"><div class="small">'
    +'Start each area at the level shown (never below Level 1). Short sessions of about 10 minutes, a few times a week, usually work better for this age than long ones. Retest in a few weeks with fresh puzzles to see progress.</div>'
    +'<div class="stats" style="grid-template-columns:repeat(2,1fr)">'+[plan.warm].concat(plan.focus).concat(plan.keep).map(id=>'<button class="chip" data-nv="practice" data-v="'+id+'">'+nvT(id).em+' '+esc(nvT(id).name)+' - L'+Math.max(1,nv.start[id]||an[id].eff)+'</button>').join("")+'</div></div>';
  h+='<div class="foot"><button data-nv="review">'+(nvUI.review?'Hide':'Review')+' every puzzle</button><button data-nv="start">Retest with new puzzles</button></div>';
  h+='<div class="foot" style="margin-top:8px"><button data-nv="export">Export puzzle log (CSV)</button><button data-nv="reset">Reset reasoning data</button></div>';
  if(nvUI.review)h+=nvReview(run);
  h+='<details class="card" style="margin-top:14px"><summary><b>How this check-up works, and its limits</b></summary><div class="small" style="margin-top:8px">'
    +'<div>&bull; Six non-verbal reasoning types, each a four-level ladder: Warm-up, Core, Challenge, Stretch (11+ style). Types and formats follow the published CAT4 non-verbal descriptions and common 11+ question types.</div>'
    +'<div>&bull; Each type starts at Level 1 and moves up after a correct answer. A miss gets one retry with a new puzzle at the same level. Two misses in a row stops that type, so she is never stuck on puzzles that are too hard.</div>'
    +'<div>&bull; Level 4 needs two correct answers to count, because with five options one correct answer can be a guess. "Not sure" counts as a miss.</div>'
    +'<div>&bull; Untimed by design, with each puzzle time recorded. No feedback is shown during the check-up. A break is offered halfway.</div>'
    +'<div>&bull; Limits: this is about 15-25 puzzles in total, so treat levels as a starting point, not a score. Difficulty levels are my own design, not calibrated against norms. All puzzles are original, in the style of those formats, and are not real test items. It does not predict test results or banding.</div></div></details>';
  return h;
}
function nvKidResults(run){
  const an=nvAnalyse(run), plan=nvPlan(an);
  let h='<h1>'+(nvUI.justDone?'Check-up complete! 🎉':'My Explorer Map 🗺️')+'</h1><p class="sub">Look what you found out about your brain power!</p>';
  NV_TYPES.forEach(T=>{const a=an[T.id];
    h+='<div class="kcard"><div class="row"><b>'+T.em+' '+esc(T.kid)+'</b><span class="stars" style="margin:0;font-size:18px">'+"⭐".repeat(a.eff)+'<span class="dim">'+"⭐".repeat(4-a.eff)+'</span></span></div><div class="small">'+NVLEVK[a.eff]+'</div></div>';});
  h+='<h2>🎯 Your quest plan</h2><div class="kcard"><div class="small" style="margin-bottom:8px">Start with a warm-up you are good at, then power up the rest!</div>';
  h+='<button class="kbtn" data-nv="practice" data-v="'+plan.warm+'">🔥 Warm-up: '+nvT(plan.warm).em+' '+esc(nvT(plan.warm).kid)+'</button>';
  plan.focus.forEach(id=>{h+='<div style="height:10px"></div><button class="kbtn alt" data-nv="practice" data-v="'+id+'">🌱 Power up: '+nvT(id).em+' '+esc(nvT(id).kid)+'</button>';});
  h+='</div><p class="small muted">Try the check-up again in a few weeks and watch your stars grow!</p>';
  return h;
}
function nvReview(run){
  let h='<h2>Every puzzle</h2>';
  run.items.forEach((x,i)=>{
    const it=nvGen(x.t,x.l,nvSeed(run.seed,x.t,x.l,x.k)), T=nvT(x.t);
    h+='<div class="card"><div class="row"><b>'+(i+1)+'. '+T.em+' '+esc(T.name)+' &middot; '+NVLTXT[x.l]+'</b><span class="badge '+(x.ok?'Correct':x.skip?'Blank':'Wrong')+'">'+(x.ok?'Correct':x.skip?'Not sure':'Wrong')+'</span></div>'
      +'<div class="small muted">'+nvSecs(x.ms)+(x.ok?'':(x.skip?'':' &middot; '+esc(TAGCAT[x.tag]||'other')))+'</div>'
      +(it.stem?'<div class="nvstem">'+it.stem+'</div>':'')+nvOpts(it,{reveal:true,pick:x.pi})
      +'<div class="tip"><b>The rule</b>'+nvList(it.why)+'</div></div>';
  });
  return h;
}
function nvCSV(){
  const q=v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"', rows=[["Run","Date","Type","Level","Instance","Result","Seconds","Wrong-pick style"].map(q).join(",")];
  nv.runs.forEach(r=>r.items.forEach(x=>rows.push([r.id,new Date(r.start).toISOString().slice(0,10),nvT(x.t).name,x.l,x.k+1,x.ok?"Correct":x.skip?"Not sure":"Wrong",Math.round(x.ms/1000),x.ok?"":(TAGCAT[x.tag]||x.tag)].map(q).join(","))));
  const b=new Blob([rows.join("\n")],{type:"text/csv"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="reasoning_log.csv";document.body.appendChild(a);a.click();a.remove();
}

/* ---------- practice ---------- */
function nvPracticeStart(type){
  const last=nvLastDone(), an=last?nvAnalyse(last):null;
  const lvl=Math.max(1,Math.min(4,nv.start[type]||(an?an[type].eff:1)||1));
  nvUI.pr={type:type,lvl:lvl,n:0,ok:0,k:0,seed:(Date.now()%2147483647)>>>0,fb:false,item:null,pick:null,hint:false,up:0,down:0,done:false};
  nvUI.screen="practice";
}
function nvPracticeItem(p){
  const key=p.type+"-"+p.lvl+"-"+p.k;
  if(!p.item||p.item.key!==key)p.item={key:key,it:nvGen(p.type,p.lvl,hash32(p.seed,"pr",p.type,p.lvl,p.k))};
  return p.item.it;
}
function nvPracticeView(){
  const p=nvUI.pr; if(!p){nvUI.screen="home";return nvView();}
  const T=nvT(p.type), kid=mode==="kid";
  if(p.done){
    const msg=p.ok>=5?"Wow - brilliant! 🌟":p.ok>=3?"Great effort! 💪":"Good try - every puzzle makes you stronger! 🌱";
    return topbar()+'<h1>'+T.em+' Round done!</h1><div class="kcard"><div class="kmid">'+p.ok+' right out of '+p.n+'</div><p>'+msg+'</p><p class="small">Next time you will start at <b>Level '+p.lvl+'</b> ('+NVLTXT[p.lvl]+').</p>'
      +'<button class="kbtn" data-nv="practice" data-v="'+p.type+'">🔁 Another round</button><div style="height:10px"></div><button class="kbtn ghost" data-nv="pend">🗺️ Back to my map</button></div>';
  }
  const it=nvPracticeItem(p);
  let h=topbar()+'<div class="nvhead">Practice &middot; '+nvName(p.type)+' '+T.em+' &middot; Level '+p.lvl+' ('+NVLTXT[p.lvl]+') &middot; puzzle '+(p.n+1)+' of 6</div><div class="nvprog"><div class="nvline"><span>Puzzle <b>'+(p.n+1)+'</b> of 6</span>'+nvDots(p.n,6)+'</div></div>'
    +'<div class="kcard"><div class="nvprompt">'+esc(T.prompt)+'</div>'+(it.stem?'<div class="nvstem">'+it.stem+'</div>':'')
    +nvOpts(it,{sel:p.pick,interactive:!p.fb,reveal:p.fb,pick:p.pick});
  if(p.fb){
    const ok=p.pick===it.ans;
    h+='<div class="ansbox" style="'+(ok?'':'background:var(--blank-bg);color:var(--blank)')+'">'+(ok?'🎉 Yes! Well done!':'Not quite - have a look at the trick below 👇')+'</div>'
      +'<div class="tip"><b>🔎 The rule</b>'+nvList(it.why)+'</div>'
      +'<button class="kbtn" style="margin-top:12px" data-nv="pnext">'+(p.n+1>=6?'🏁 Finish round':'➡️ Next puzzle')+'</button>';
  }else{
    if(p.hint)h+='<div class="tip"><b>💡 Hint</b>'+nvList(it.hint)+'<button class="hidebtn" data-nv="phide">🙈 Hide hint</button></div>';
    h+='<div class="nvbtns">'+(p.hint?'':'<button class="kbtn ghost" data-nv="phint">💡 Hint</button>')+'<button class="kbtn" data-nv="pcheck"'+(p.pick==null?' disabled':'')+'>✅ Check</button></div>';
  }
  return h+'</div><button class="link" data-nv="pend">Leave practice</button>';
}
function nvPracticeAfter(){
  const p=nvUI.pr, it=nvPracticeItem(p), ok=p.pick===it.ans;
  nv.practice.push({t:p.type,l:p.lvl,ok:ok,ts:Date.now()}); if(nv.practice.length>600)nv.practice=nv.practice.slice(-600);
  p.n++; p.k++; if(ok){p.ok++;p.up++;p.down=0;if(p.up>=2&&p.lvl<4){p.lvl++;p.up=0;}}else{p.down++;p.up=0;if(p.down>=2&&p.lvl>1){p.lvl--;p.down=0;}}
  p.fb=false;p.pick=null;p.hint=false;p.item=null;
  if(p.n>=6){p.done=true;nv.start[p.type]=p.lvl;}
  nvSave();
}

/* ---------- home + routing ---------- */
function nvStartCard(){
  const kid=mode==="kid";
  return kid
   ? '<div class="kcard hero"><div class="lvl" style="font-size:20px;font-weight:800">🧭 Explorer Check-up</div><p class="kmsg" style="font-size:17px">Let\'s find your starting point on the brain-power map!</p>'
     +'<div class="small" style="margin-bottom:12px;color:#fff;opacity:.95">6 puzzle types &middot; about 15 minutes &middot; 2 parts. No pass or fail - it just shows us where to start. It starts easy and gets trickier. If a puzzle is too tricky, tap "I\'m not sure".</div>'
     +'<button class="kbtn" data-nv="start">🚀 Start the check-up</button></div>'
   : '<div class="card"><b>Starting-point assessment</b><div class="small" style="margin:6px 0 10px">Six non-verbal reasoning types, adaptive four-level ladder per type, about 15-25 puzzles in two sittings. Untimed, with no feedback during the test. It produces a level per type and a practice plan.</div><button class="kbtn alt" data-nv="start">Start the check-up</button></div>';
}
function nvHome(){
  const run=nvRun(), last=nvLastDone(), kid=mode==="kid";
  let h=topbar()+(kid?'<h1>Side quests 🗺️</h1><p class="sub">Brain-power puzzles for sharp thinkers!</p>':'<h1>Reasoning check-up</h1><p class="sub">Non-verbal reasoning &middot; starting point and practice plan</p>');
  if(run){
    const st=nvStep(run), n=run.items.length;
    h+='<div class="kcard hero"><div class="lvl" style="font-size:19px;font-weight:800">🧭 Check-up in progress</div><p class="kmsg">'+(kid?'You have done '+n+' puzzle'+(n===1?'':'s')+' so far. Ready to carry on?':n+' puzzles answered so far.')+'</p><button class="kbtn" data-nv="resume">▶️ Continue</button></div>';
  }else if(!last){
    h+=nvStartCard();
  }
  if(last)h+=kid?nvKidResults(last):nvGrown(last);
  return h;
}
function nvView(){
  if(nvUI.screen==="practice")return nvPracticeView();
  if(nvUI.screen==="run"){
    const run=nvRun(); if(!run){nvUI.screen="home";return nvHome();}
    const st=nvStep(run);
    if(st.screen==="intro")return nvIntroScreen(st.type,run);
    if(st.screen==="break")return nvBreakScreen();
    if(st.screen==="item")return nvItemScreen(run,st.type);
    nvUI.screen="home";
  }
  return nvHome();
}
function nvAct(a,v){
  const go=()=>{window.scrollTo(0,0);render();};
  const run=nvRun(), p=nvUI.pr;
  switch(a){
    case "start": nvNew(); return go();
    case "resume": nvUI.screen="run"; nvUI.cur=null; return go();
    case "begin": if(run){const st=nvStep(run);if(st.screen==="intro"){run.intro[st.type]=true;nvSave();nvUI.cur=null;}} return go();
    case "cont": if(run){run.breakSeen=true;nvSave();} return go();
    case "later": nvUI.screen="home"; nvUI.cur=null; return go();
    case "pick": if(nvUI.screen==="practice"&&p){if(!p.fb)p.pick=+v;}else nvUI.pick=+v; return render();
    case "confirm": if(run&&nvUI.pick!=null){nvRecord(run,false);if(run.end){nvUI.justDone=true;nvUI.screen="home";}} return go();
    case "unsure": if(run){nvRecord(run,true);if(run.end){nvUI.justDone=true;nvUI.screen="home";}} return go();
    case "practice": nvPracticeStart(v); return go();
    case "phint": if(p)p.hint=true; return render();
    case "phide": if(p)p.hint=false; return render();
    case "pcheck": if(p&&p.pick!=null)p.fb=true; return render();
    case "pnext": if(p)nvPracticeAfter(); return go();
    case "pend": nvUI.screen="home"; nvUI.pr=null; return go();
    case "review": nvUI.review=!nvUI.review; return render();
    case "export": return nvCSV();
    case "reset": if(confirm("Delete all check-up results and practice history on this device?")){nv={runs:[],practice:[],start:{}};nvSave();nvUI={screen:"home",pick:null,cur:null,pr:null,review:false,justDone:false};render();} return;
  }
}

document.addEventListener("click", e => {
  const t = e.target.closest("button, .q"); if (!t) return;
  if (t.dataset.nv){ return nvAct(t.dataset.nv, t.dataset.v); }
  if (t.dataset.mode){ mode = mode === "kid" ? "parent" : "kid"; saveMode(); tab = "overview"; selecting = false; picked.clear(); window.scrollTo(0, 0); return render(); }
  if (t.dataset.tab){ tab = t.dataset.tab; window.scrollTo(0, 0); return render(); }
  /* kid mode actions */
  if (t.dataset.kgo){ K = { f: t.dataset.kgo, s: "all", a: "all" }; selecting = false; picked.clear(); tab = "questions"; window.scrollTo(0, 0); return render(); }
  if (t.dataset.ks){ K = { f: t.dataset.kf || "todo", s: t.dataset.ks, a: "all" }; selecting = false; picked.clear(); tab = "questions"; window.scrollTo(0, 0); return render(); }
  if (t.dataset.kf){ K.f = t.dataset.kf; picked.clear(); return render(); }
  if (t.dataset.ka){ K.a = t.dataset.ka; picked.clear(); return render(); }
  if (t.dataset.select){ selecting = !selecting; picked.clear(); return render(); }
  if (t.dataset.pick){ const i = t.dataset.pick; if (picked.has(i)) picked.delete(i); else picked.add(i); return render(); }
  if (t.dataset.pickall){
    const ids = kidFiltered().filter(isTodo).map(qid);
    if (ids.length && ids.every(i => picked.has(i))) picked.clear(); else ids.forEach(i => picked.add(i));
    return render();
  }
  if (t.dataset.bulk){
    const n = picked.size;
    if (t.dataset.bulk === "done"){ picked.forEach(i => conq.add(i)); toast("🎉 " + n + " mission" + (n === 1 ? "" : "s") + " conquered!"); }
    else { picked.forEach(i => { conq.delete(i); shown.delete(i); hints.delete(i); rehint.delete(i); sims.delete(i); }); toast("↩️ " + n + " put back in To do"); }
    saveConq(); picked.clear(); selecting = false; return render();
  }
  if (t.dataset.hint){ hints.set(t.dataset.hint, 1); return render(); }
  if (t.dataset.morehint){ const i = t.dataset.morehint; hints.set(i, (hints.get(i) || 1) + 1); return render(); }
  if (t.dataset.rehint){ const i = t.dataset.rehint; if (rehint.has(i)) rehint.delete(i); else rehint.add(i); return render(); }
  if (t.dataset.sim){ sims.set(t.dataset.sim, { tried: [], ok: false, hint: 0 }); return render(); }
  if (t.dataset.simclose){ sims.delete(t.dataset.simclose); return render(); }
  if (t.dataset.shint){ const st = sims.get(t.dataset.shint); if (st) st.hint = Math.min(st.hint + 1, SIM[t.dataset.shint].h.length); return render(); }
  if (t.dataset.sopt){
    const st = sims.get(t.dataset.sopt), i = +t.dataset.i;
    if (st && !st.ok && st.tried.indexOf(i) < 0){ if (i === SIM[t.dataset.sopt].a) st.ok = true; else { st.tried.push(i); st.hint = Math.max(st.hint, 1); } }
    return render();
  }
  if (t.dataset.unhint){ hints.delete(t.dataset.unhint); return render(); }
  if (t.dataset.show){ shown.add(t.dataset.show); return render(); }
  if (t.dataset.conq){ conq.add(t.dataset.conq); saveConq(); toast("🎉 Mission conquered! +1 ⭐"); return render(); }
  if (t.dataset.unconq){ conq.delete(t.dataset.unconq); shown.delete(t.dataset.unconq); hints.delete(t.dataset.unconq); rehint.delete(t.dataset.unconq); sims.delete(t.dataset.unconq); saveConq(); return render(); }
  /* grown-up mode actions */
  if (t.dataset.go){
    F = { a: "all", r: "all", s: "all", sec: "all" };
    if (t.dataset.go === "a") F.a = t.dataset.v; else F.s = t.dataset.v;
    F.r = t.dataset.r || "all"; tab = "questions"; window.scrollTo(0, 0); return render();
  }
  if (t.dataset.f){ F[t.dataset.f] = t.dataset.v; return render(); }
  if (t.dataset.clear){ F = { a: "all", r: "all", s: "all", sec: "all" }; return render(); }
  if (t.dataset.set){ const id = t.dataset.id, d = DATA.find(x => qid(x) === id);
    if (t.dataset.set === d.r) delete overrides[id]; else overrides[id] = t.dataset.set; save(); return render(); }
  if (t.dataset.hide){ hideAns = !hideAns; revealed.clear(); return render(); }
  if (t.dataset.reveal){ revealed.add(t.dataset.reveal); return render(); }
  if (t.dataset.export){ return csv(); }
  if (t.dataset.reset){ if (confirm("Reset all your edits back to the original results?")){ overrides = {}; save(); render(); } return; }
  if (t.dataset.resetkid){ if (confirm("Reset her Kid-mode progress (conquered missions)?")){ conq.clear(); hints.clear(); shown.clear(); rehint.clear(); sims.clear(); picked.clear(); selecting = false; saveConq(); render(); } return; }
  if (t.classList.contains("q")){ t.classList.toggle("open"); }
});
document.addEventListener("change", e => {
  if (e.target.dataset.sel){ F[e.target.dataset.sel] = e.target.value; render(); }
  if (e.target.dataset.ksel){ K.s = e.target.value; picked.clear(); render(); }
});

render();
try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist(); }catch(e){}
try{ if("serviceWorker" in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(()=>{}); }catch(e){}
