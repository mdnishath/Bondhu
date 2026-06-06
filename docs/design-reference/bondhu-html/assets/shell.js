/* ===== Bondhu shared shell: data-driven rail + chat list ===== */
const HOME = "Bondhu - Chat Client.html";

const ICONS = {
  logo:`<svg viewBox="0 0 24 24" fill="none"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h7A2.5 2.5 0 0 1 16 6.5v3A2.5 2.5 0 0 1 13.5 12H8l-4 3z" fill="#fff" opacity=".95"/><path d="M11 13.5A2.5 2.5 0 0 1 13.5 11H18a2.5 2.5 0 0 1 2.5 2.5v3A2.5 2.5 0 0 1 18 19v2l-2.5-2.2H13.5A2.5 2.5 0 0 1 11 16.3z" fill="#06291f" opacity=".55"/></svg>`,
  plus:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  gear:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  logout:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>`,
};

function showTip(msg){
  let tip = document.querySelector('.tip');
  if(!tip){ tip = document.createElement('div'); tip.className='tip'; document.body.appendChild(tip); }
  tip.textContent = msg; tip.classList.add('show');
  clearTimeout(window._tipT);
  window._tipT = setTimeout(()=>tip.classList.remove('show'), 1900);
}

function tickSVG(kind){
  if(!kind) return "";
  const cls = kind.startsWith("blue") ? "blue" : "gray";
  const dbl = kind.endsWith("2");
  const p = dbl ? '<path d="M1 6 4 9 11.5 1.5M6.5 9 13 9.2 16.8 1.5"/>' : '<path d="M1.5 6 4.5 9 13 1.5"/>';
  const w = dbl ? 18 : 15, vb = dbl ? "0 0 18 11" : "0 0 15 11";
  return `<svg class="tick ${cls}" width="${w}" height="11" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
function ackTick(ack){ // 0 pending,1 sent,2 delivered,3 read,4 played
  if (ack >= 3) return 'blue2';
  if (ack === 2) return 'gray2';
  if (ack === 1) return 'gray1';
  return '';
}
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

const Shell = {
  accounts: [],
  chats: [],

  async boot(activeNav){
    if (!API.requireAuth()) return;
    await Shell.loadAccounts();
    Shell.renderRail(activeNav);
    const rows = document.querySelector('.rows');
    if (rows) await Shell.loadChats();
  },

  async loadAccounts(){
    try {
      const res = await API.accounts();
      Shell.accounts = res.accounts || [];
    } catch (e) { Shell.accounts = []; }
    let active = API.account();
    if (!Shell.accounts.find(a => a.id === active)) {
      const conn = Shell.accounts.find(a => a.status === 'connected') || Shell.accounts[0];
      active = conn ? conn.id : '';
      if (active) API.setAccount(active);
    }
  },

  renderRail(active){
    const el = document.querySelector('.rail');
    if(!el) return;
    const cur = API.account();
    el.innerHTML = `
      <a class="logo" href="${HOME}" title="Bondhu — Home">${ICONS.logo}</a>
      <div class="rail-sep"></div>
      <div class="accounts">
        ${Shell.accounts.map(a=>{
          const on = a.status === 'connected';
          const nm = a.label || (a.phone ? '+'+a.phone : 'Account');
          return `<div class="acct ${a.id===cur?'active':''}" title="${escapeHtml(nm)} · ${a.status}" data-acc="${a.id}">
            <div class="av" style="background:${avatarGradient(a.id)}">${initials(nm)}</div>
            <span class="dot ${on?'on':'off'}"></span>
          </div>`;
        }).join('')}
      </div>
      <a class="add-acct" href="link-device.html" title="Add account">${ICONS.plus}</a>
      <div class="rail-spacer"></div>
      <a class="rail-btn ${active==='settings'?'active':''}" href="settings.html" title="Settings">${ICONS.gear}</a>
      <a class="rail-btn" href="#" id="railLogout" title="Log out">${ICONS.logout}</a>
    `;
    el.querySelectorAll('.acct').forEach(node=>{
      node.addEventListener('click', ()=>{
        const id = node.getAttribute('data-acc');
        if (id && id !== API.account()) { API.setAccount(id); API.setSelectedChat(''); location.href = HOME; }
      });
    });
    const lo = el.querySelector('#railLogout');
    if (lo) lo.addEventListener('click', (e)=>{ e.preventDefault(); API.logout(); location.href='login.html'; });
  },

  async loadChats(){
    const rows = document.querySelector('.rows');
    if (!rows) return;
    const acc = API.account();
    if (!acc) { rows.innerHTML = Shell.emptyChatsHtml('No account linked'); return; }
    try {
      const res = await API.chats(acc);
      Shell.chats = res.chats || [];
    } catch (e) { Shell.chats = []; }
    Shell.renderChats(rows);
  },

  emptyChatsHtml(msg){
    return `<div style="padding:40px 20px;text-align:center;color:var(--muted);font-size:13.5px">${msg}<br><br>
      <a href="link-device.html" style="color:var(--teal);font-weight:600">+ Link a WhatsApp account</a></div>`;
  },

  renderChats(el){
    const sel = API.selectedChat();
    if (!Shell.chats.length) { el.innerHTML = Shell.emptyChatsHtml('No chats yet'); return; }
    el.innerHTML = Shell.chats.map(c=>{
      const nm = displayName(c.jid, c.name);
      const isSel = c.jid === sel;
      const prev = (c.lastMessagePreview || '').slice(0, 42);
      return `<a class="row ${isSel?'sel':''} ${c.unreadCount?'unread':''}" href="#" data-jid="${escapeHtml(c.jid)}">
        <div class="av" style="background:${avatarGradient(c.jid)}">${initials(nm)}</div>
        <div class="row-main">
          <div class="row-l1"><div class="row-name">${escapeHtml(nm)}</div><div class="row-time">${fmtTime(c.lastMessageAt)}</div></div>
          <div class="row-l2">
            <div class="row-prev"><span class="txt">${escapeHtml(prev)}</span></div>
            ${c.unreadCount?`<span class="badge">${c.unreadCount}</span>`:''}
          </div>
        </div></a>`;
    }).join('');
    el.querySelectorAll('.row').forEach(node=>{
      node.addEventListener('click', (e)=>{
        e.preventDefault();
        const jid = node.getAttribute('data-jid');
        API.setSelectedChat(jid);
        if (typeof window.onChatSelected === 'function') window.onChatSelected(jid);
        else location.href = HOME;
      });
    });
  },
};
window.Shell = Shell;
