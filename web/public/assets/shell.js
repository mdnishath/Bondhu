/* ===== Bondhu shared shell: left rail with working nav ===== */
const HOME = "Bondhu - Chat Client.html";

const ACCOUNTS = [
  {av:"MS", g:"linear-gradient(145deg,#00A884,#015c4b)", on:true,  title:"Maya Sengupta · connected"},
  {av:"W",  g:"linear-gradient(145deg,#7c5cff,#4b2fb0)", on:true,  title:"Work · connected"},
  {av:"St", g:"linear-gradient(145deg,#f0883e,#b85c1f)", on:false, title:"Studio · disconnected"},
  {av:"F",  g:"linear-gradient(145deg,#ec4d8e,#a02360)", on:true,  title:"Family · connected"},
];

const ICONS = {
  logo:`<svg viewBox="0 0 24 24" fill="none"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h7A2.5 2.5 0 0 1 16 6.5v3A2.5 2.5 0 0 1 13.5 12H8l-4 3z" fill="#fff" opacity=".95"/><path d="M11 13.5A2.5 2.5 0 0 1 13.5 11H18a2.5 2.5 0 0 1 2.5 2.5v3A2.5 2.5 0 0 1 18 19v2l-2.5-2.2H13.5A2.5 2.5 0 0 1 11 16.3z" fill="#06291f" opacity=".55"/></svg>`,
  plus:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  gear:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  logout:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>`,
};

function renderRail(active){
  const el = document.querySelector('.rail');
  if(!el) return;
  el.innerHTML = `
    <a class="logo" href="${HOME}" title="Bondhu — Home">${ICONS.logo}</a>
    <div class="rail-sep"></div>
    <div class="accounts">
      ${ACCOUNTS.map((a,i)=>`
        <div class="acct ${i===0?'active':''}" title="${a.title}">
          <div class="av" style="background:${a.g}">${a.av}</div>
          <span class="dot ${a.on?'on':'off'}"></span>
        </div>`).join('')}
    </div>
    <a class="add-acct" href="login.html" title="Add account">${ICONS.plus}</a>
    <div class="rail-spacer"></div>
    <a class="rail-btn ${active==='settings'?'active':''}" href="settings.html" title="Settings">${ICONS.gear}</a>
    <a class="rail-btn" href="login.html" title="Log out">${ICONS.logout}</a>
  `;
}

function showTip(msg){
  let tip = document.querySelector('.tip');
  if(!tip){ tip = document.createElement('div'); tip.className='tip'; document.body.appendChild(tip); }
  tip.textContent = msg; tip.classList.add('show');
  clearTimeout(window._tipT);
  window._tipT = setTimeout(()=>tip.classList.remove('show'), 1900);
}

/* ===== Shared chat list (matches main screen) ===== */
const CHATS = [
  {n:"Anika Rahman", av:"AR", g:"linear-gradient(145deg,#00A884,#017a63)", t:"12:14", prev:"On it. Sending the final files tonight", tick:"gray2", sel:true, online:true},
  {n:"Design Team", av:"DT", g:"linear-gradient(145deg,#7c5cff,#4b2fb0)", t:"12:31", prev:"Rafael: let's sync at 3 📌", unread:5},
  {n:"Rafael Mendes", av:"RM", g:"linear-gradient(145deg,#f0883e,#b85c1f)", t:"11:57", prev:"Perfect, thanks!", tick:"blue2"},
  {n:"Mom ❤️", av:"M", g:"linear-gradient(145deg,#ec4d8e,#a02360)", t:"11:02", prev:"Call me when you're free 🌸", unread:2},
  {n:"Yuki Tanaka", av:"YT", g:"linear-gradient(145deg,#3aa0ff,#1a5fb4)", t:"10:45", prev:"ありがとう！ See you soon", tick:"gray2"},
  {n:"Priya Sharma", av:"PS", g:"linear-gradient(145deg,#e0479e,#8e1e63)", t:"09:30", prev:"typing…", typing:true, online:true},
  {n:"Tomás Herrera", av:"TH", g:"linear-gradient(145deg,#2bb3a3,#0c6e62)", t:"Yesterday", prev:"¿Nos vemos mañana? 🌮"},
  {n:"Aisha Khan", av:"AK", g:"linear-gradient(145deg,#f6b73c,#c2861a)", t:"Yesterday", prev:"Sent the invoice 📄", tick:"blue2"},
  {n:"Daniel O'Brien", av:"DO", g:"linear-gradient(145deg,#39c46e,#15803d)", t:"Yesterday", prev:"Haha that's hilarious 😂"},
  {n:"Lena Müller", av:"LM", g:"linear-gradient(145deg,#6c7cff,#3b3fb0)", t:"Tuesday", prev:"Danke schön! 🙏"},
];
function tickSVG(kind){
  if(!kind) return "";
  const cls = kind.startsWith("blue") ? "blue" : "gray";
  const dbl = kind.endsWith("2");
  const p = dbl ? '<path d="M1 6 4 9 11.5 1.5M6.5 9 13 9.2 16.8 1.5"/>' : '<path d="M1.5 6 4.5 9 13 1.5"/>';
  const w = dbl ? 18 : 15, vb = dbl ? "0 0 18 11" : "0 0 15 11";
  return `<svg class="tick ${cls}" width="${w}" height="11" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
function renderChatList(el, selName){
  el.innerHTML = CHATS.map(c=>{
    const sel = selName ? (c.n===selName) : c.sel;
    return `<a class="row ${sel?'sel':''} ${c.unread?'unread':''}" href="${HOME}">
      <div class="av" style="background:${c.g}">${c.av}${c.online?'<span class="pres"></span>':''}</div>
      <div class="row-main">
        <div class="row-l1"><div class="row-name">${c.n}</div><div class="row-time">${c.t}</div></div>
        <div class="row-l2">
          <div class="row-prev ${c.typing?'typing':''}">${c.tick?tickSVG(c.tick):''}<span class="txt">${c.prev}</span></div>
          ${c.unread?`<span class="badge">${c.unread}</span>`:''}
        </div>
      </div></a>`;
  }).join('');
}
