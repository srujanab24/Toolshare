// ── STATE ──
const API = '/api';
let currentUser = null;
let currentToken = localStorage.getItem('ts_token');
let selectedRole = 'customer';
let allTools = [];
let socket = null;
let activeChat = null;
let calendarState = { year: new Date().getFullYear(), month: new Date().getMonth(), startDate: null, endDate: null, bookedDates: [] };

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  if (currentToken) await loadCurrentUser();
  await loadFeaturedTools();
  loadCategories();
  loadStats();
  showPage('home');
});

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── AUTH ──
async function loadCurrentUser() {
  try {
    currentUser = await apiFetch('/auth/me');
    updateNavForUser();
    initSocket();
  } catch { logout(true); }
}

function updateNavForUser() {
  if (!currentUser) return;
  document.getElementById('navAuth').style.display = 'none';
  document.getElementById('navUser').style.display = 'flex';
  document.getElementById('navUserName').textContent = currentUser.name.split(' ')[0];
  document.getElementById('navUserRole').textContent = currentUser.role;
  document.getElementById('dashLink').style.display = '';
  document.getElementById('chatNavBtn').style.display = '';
}

async function login() {
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  try {
    const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: pass }) });
    currentToken = data.token;
    currentUser = data.user;
    localStorage.setItem('ts_token', currentToken);
    updateNavForUser();
    initSocket();
    showDashboard();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

async function register() {
  const role = selectedRole;
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const phone = document.getElementById('regPhone').value;
  const address = document.getElementById('regAddress').value;
  const password = document.getElementById('regPass').value;
  const errEl = document.getElementById('registerError');
  const succEl = document.getElementById('registerSuccess');
  errEl.style.display = 'none'; succEl.style.display = 'none';

  try {
    const data = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, role, phone, address }) });
    currentToken = data.token;
    currentUser = data.user;
    localStorage.setItem('ts_token', currentToken);
    updateNavForUser();
    initSocket();
    succEl.textContent = `Welcome, ${currentUser.name}! Redirecting to dashboard...`;
    succEl.style.display = 'block';
    setTimeout(showDashboard, 1200);
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

function logout(silent = false) {
  currentToken = null;
  currentUser = null;
  localStorage.removeItem('ts_token');
  document.getElementById('navAuth').style.display = 'flex';
  document.getElementById('navUser').style.display = 'none';
  document.getElementById('dashLink').style.display = 'none';
  document.getElementById('chatNavBtn').style.display = 'none';
  if (socket) { socket.disconnect(); socket = null; }
  if (!silent) showPage('home');
}

function selectRole(role) {
  selectedRole = role;
  document.getElementById('btnRoleOwner').classList.toggle('active', role === 'owner');
  document.getElementById('btnRoleCust').classList.toggle('active', role === 'customer');
  document.getElementById('roleOwnerCard')?.classList.toggle('active', role === 'owner');
  document.getElementById('roleCustomerCard')?.classList.toggle('active', role === 'customer');
}
selectRole('customer');

// ── SOCKET ──
function initSocket() {
  if (!currentUser || socket) return;
  socket = io();
  socket.emit('user_connected', String(currentUser.id));
  socket.on('receive_message', (msg) => {
    if (activeChat && (msg.sender_id === activeChat || msg.receiver_id === activeChat)) {
      appendMessage(msg, false);
    }
    loadConversations();
    updateChatBadge();
  });
  socket.on('message_sent', (msg) => {
    if (activeChat) appendMessage(msg, true);
  });
}

// ── PAGES ──
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);

  if (page === 'tools') loadTools();
  if (page === 'chat') { loadConversations(); }
}

function showDashboard() {
  if (!currentUser) { showPage('login'); return; }
  showPage('dashboard');
  loadDashboard();
}

function toggleMenu() {
  ['navLinks','navAuth','navUser'].forEach(id => {
    document.getElementById(id).classList.toggle('open');
  });
}

// ── STATS ──
async function loadStats() {
  try {
    const tools = await apiFetch('/tools');
    const owners = new Set(tools.map(t => t.owner_id)).size;
    const bookings = await apiFetch('/bookings').catch(() => []);
    animateCounter('statTools', tools.length);
    animateCounter('statOwners', owners);
    animateCounter('statRentals', bookings.length || 12);
  } catch {}
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let n = 0; const step = Math.ceil(target / 30);
  const iv = setInterval(() => {
    n = Math.min(n + step, target);
    el.textContent = n + '+';
    if (n >= target) clearInterval(iv);
  }, 40);
}

// ── TOOLS ──
async function loadFeaturedTools() {
  try {
    const tools = await apiFetch('/tools?available=true');
    const grid = document.getElementById('homeFeaturedTools');
    const featured = tools.slice(0, 4);
    grid.innerHTML = featured.map(renderToolCard).join('');
  } catch {}
}

async function loadTools() {
  const tools = await apiFetch('/tools');
  allTools = tools;
  renderTools(tools);
}

async function loadCategories() {
  try {
    const cats = await apiFetch('/tools/meta/categories');
    const sel = document.getElementById('catFilter');
    if (!sel) return;
    sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  } catch {}
}

function filterTools() {
  const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const cat = document.getElementById('catFilter')?.value || 'All';
  const maxPrice = parseInt(document.getElementById('priceFilter')?.value || 500);
  const location = document.getElementById('locationFilter')?.value.toLowerCase() || '';
  const availOnly = document.getElementById('availableFilter')?.checked || false;

  let filtered = allTools.filter(t => {
    if (search && !t.title.toLowerCase().includes(search) && !t.description?.toLowerCase().includes(search)) return false;
    if (cat !== 'All' && t.category !== cat) return false;
    if (t.price_per_day > maxPrice) return false;
    if (location && !t.location?.toLowerCase().includes(location)) return false;
    if (availOnly && !t.is_available) return false;
    return true;
  });
  renderTools(filtered);
}

function updatePriceLabel() {
  const val = document.getElementById('priceFilter').value;
  document.getElementById('priceLabel').textContent = '₹' + val;
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('catFilter').value = 'All';
  document.getElementById('priceFilter').value = 500;
  document.getElementById('priceLabel').textContent = '₹500';
  document.getElementById('locationFilter').value = '';
  document.getElementById('availableFilter').checked = false;
  renderTools(allTools);
}

function renderTools(tools) {
  const grid = document.getElementById('toolsGrid');
  const cnt = document.getElementById('toolCount');
  if (cnt) cnt.textContent = `${tools.length} tool${tools.length !== 1 ? 's' : ''} found`;
  if (!grid) return;
  if (!tools.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fa-solid fa-magnifying-glass"></i><p>No tools match your filters</p></div>`;
    return;
  }
  grid.innerHTML = tools.map(renderToolCard).join('');
}

function renderToolCard(t) {
  const stars = renderStars(t.avg_rating);
  const imgEl = t.image
    ? `<img class="card-img" src="${t.image}" alt="${t.title}" loading="lazy" onerror="this.style.display='none';">`
    : `<div class="card-img-placeholder"><i class="fa-solid fa-wrench"></i></div>`;
  return `
    <div class="tool-card" onclick="showTool(${t.id})">
      ${imgEl}
      <div class="card-body">
        <div class="card-cat">${t.category}</div>
        <div class="card-title">${t.title}</div>
        <div class="card-meta">
          <div class="card-price">₹${t.price_per_day}<span>/day</span></div>
          <div class="card-rating">${stars} <small>(${t.review_count || 0})</small></div>
        </div>
        <div class="card-footer">
          <div class="card-location"><i class="fa-solid fa-location-dot"></i>${t.location || 'N/A'}</div>
          <span class="avail-badge ${t.is_available ? 'avail-yes' : 'avail-no'}">${t.is_available ? 'Available' : 'Rented'}</span>
        </div>
      </div>
    </div>`;
}

function renderStars(avg) {
  const full = Math.round(avg);
  return Array.from({length:5}, (_,i) =>
    `<i class="fa-${i < full ? 'solid' : 'regular'} fa-star" style="color:${i < full ? '#f59e0b' : '#444'}; font-size:12px;"></i>`
  ).join('');
}

// ── TOOL DETAIL ──
async function showTool(id) {
  showPage('tool-detail');
  const el = document.getElementById('toolDetailContent');
  el.innerHTML = `<div class="tool-detail-wrap"><div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
  try {
    const t = await apiFetch(`/tools/${id}`);
    const stars = renderStars(t.avg_rating);
    const bookedList = t.bookedDates || [];

    el.innerHTML = `
      <div class="tool-detail-wrap">
        <div class="back-btn" onclick="showPage('tools')"><i class="fa-solid fa-arrow-left"></i> Back to Tools</div>
        <div class="tool-detail-grid">
          <div>
            ${t.image ? `<img class="tool-detail-img" src="${t.image}" alt="${t.title}">` : `<div class="tool-detail-img" style="background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:80px;color:var(--text3);"><i class="fa-solid fa-wrench"></i></div>`}
            <div class="reviews-section">
              <h3><i class="fa-solid fa-star" style="color:#f59e0b"></i> Reviews (${t.reviews?.length || 0})</h3>
              ${t.reviews?.length ? t.reviews.map(r => `
                <div class="review-card">
                  <div class="review-header"><span class="review-author">${r.reviewer_name}</span><span class="review-date">${formatDate(r.created_at)}</span></div>
                  <div class="stars-display">${renderStars(r.rating)}</div>
                  <div class="review-text">${r.comment || ''}</div>
                </div>
              `).join('') : `<div class="empty-state"><p>No reviews yet</p></div>`}
            </div>
          </div>
          <div>
            <div class="tool-info-panel">
              <div style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">${t.category}</div>
              <h1>${t.title}</h1>
              <div style="margin:8px 0">${stars} <small style="color:var(--text3)">${t.avg_rating.toFixed(1)} (${t.review_count} reviews)</small></div>
              <div class="tool-price-big">₹${t.price_per_day}<span>/day</span></div>
              ${t.description ? `<p style="font-size:14px;color:var(--text2);margin-bottom:16px">${t.description}</p>` : ''}
              <div class="info-row"><span class="label">Condition</span><span class="value">${t.condition}</span></div>
              <div class="info-row"><span class="label">Security Deposit</span><span class="value">₹${t.deposit || 0}</span></div>
              <div class="info-row"><span class="label">Location</span><span class="value">${t.location}</span></div>
              <div class="info-row"><span class="label">Availability</span><span class="value ${t.is_available ? 'avail-yes' : 'avail-no'}" style="font-size:13px;font-weight:600;padding:2px 8px;border-radius:6px;">${t.is_available ? 'Available Now' : 'Currently Rented'}</span></div>
              <div class="owner-box">
                <h4>Tool Owner</h4>
                <div class="owner-info">
                  <div class="owner-avatar">${t.owner_name[0]}</div>
                  <div>
                    <div style="font-weight:600">${t.owner_name}</div>
                    <div style="font-size:13px;color:var(--text3)">${t.owner_address || 'Chennai, TN'}</div>
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:10px;margin-top:16px">
                ${currentUser && currentUser.role === 'customer' && t.is_available
                  ? `<button class="btn-primary full" onclick="openBooking(${t.id}, ${t.price_per_day}, '${t.title}', ${JSON.stringify(bookedList).replace(/"/g,'&quot;')})">
                      <i class="fa-solid fa-calendar-check"></i> Rent This Tool
                    </button>`
                  : !currentUser
                  ? `<button class="btn-primary full" onclick="showPage('login')"><i class="fa-solid fa-right-to-bracket"></i> Login to Rent</button>`
                  : `<button class="btn-ghost full" disabled>Not Available</button>`
                }
                ${currentUser && currentUser.id !== t.owner_id
                  ? `<button class="btn-ghost" onclick="startChat(${t.owner_id}, '${t.owner_name}', ${t.id})"><i class="fa-solid fa-comment"></i></button>`
                  : ''}
              </div>
            </div>
          </div>
        </div>
      </div>`;
  } catch (e) {
    el.innerHTML = `<div class="tool-detail-wrap"><div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>Failed to load tool: ${e.message}</p></div></div>`;
  }
}

// ── BOOKING MODAL ──
function openBooking(toolId, pricePerDay, title, bookedDates) {
  if (!currentUser) { showPage('login'); return; }
  calendarState = { year: new Date().getFullYear(), month: new Date().getMonth(), startDate: null, endDate: null, bookedDates };
  document.getElementById('bookingModalContent').innerHTML = `
    <p style="color:var(--text3);margin-bottom:20px">Renting: <strong style="color:var(--text)">${title}</strong> — ₹${pricePerDay}/day</p>
    <div class="form-group">
      <label>Select Rental Dates</label>
      <div class="calendar-wrap" id="bookingCal"></div>
    </div>
    <div class="form-group">
      <label>Selected: <span id="dateRangeLabel" style="color:var(--accent)">Click a start date</span></label>
    </div>
    <div class="form-group">
      <label>Notes (optional)</label>
      <textarea id="bookingNotes" rows="2" placeholder="Any special requirements..."></textarea>
    </div>
    <div id="bookingTotal" style="margin:16px 0;font-size:18px;font-weight:700;color:var(--accent)"></div>
    <div id="bookingErr" class="form-error" style="display:none"></div>
    <button class="btn-primary full" id="confirmBookBtn" onclick="confirmBooking(${toolId}, ${pricePerDay})">
      <i class="fa-solid fa-check"></i> Confirm Booking
    </button>`;
  renderCalendar('bookingCal');
  document.getElementById('bookingModal').style.display = 'flex';
}

function renderCalendar(containerId) {
  const { year, month, startDate, endDate, bookedDates } = calendarState;
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  const getBlockedDates = () => {
    const blocked = new Set();
    bookedDates.forEach(b => {
      let d = new Date(b.start_date);
      const end = new Date(b.end_date);
      while (d <= end) { blocked.add(d.toISOString().split('T')[0]); d.setDate(d.getDate()+1); }
    });
    return blocked;
  };
  const blocked = getBlockedDates();

  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dateObj = new Date(year, month, d);
    const isPast = dateObj < today;
    const isBooked = blocked.has(dateStr);
    const isToday = dateObj.getTime() === today.getTime();
    const isStart = dateStr === startDate;
    const isEnd = dateStr === endDate;
    const isInRange = startDate && endDate && dateStr > startDate && dateStr < endDate;
    let cls = 'cal-day';
    if (isPast || isBooked) cls += isPast ? ' past' : ' booked';
    else if (isStart || isEnd) cls += ' selected';
    else if (isInRange) cls += ' in-range';
    if (isToday && !isStart && !isEnd) cls += ' today';
    const clickable = !isPast && !isBooked;
    cells += `<div class="${cls}" ${clickable ? `onclick="calClick('${dateStr}')"` : ''}>${d}</div>`;
  }

  document.getElementById(containerId).innerHTML = `
    <div class="cal-header">
      <button class="cal-nav" onclick="calNav(-1)">‹</button>
      <span>${monthNames[month]} ${year}</span>
      <button class="cal-nav" onclick="calNav(1)">›</button>
    </div>
    <div class="cal-grid">
      ${days.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
      ${cells}
    </div>`;
}

function calNav(dir) {
  calendarState.month += dir;
  if (calendarState.month > 11) { calendarState.month = 0; calendarState.year++; }
  if (calendarState.month < 0) { calendarState.month = 11; calendarState.year--; }
  renderCalendar('bookingCal');
}

function calClick(dateStr) {
  if (!calendarState.startDate || (calendarState.startDate && calendarState.endDate)) {
    calendarState.startDate = dateStr; calendarState.endDate = null;
  } else if (dateStr > calendarState.startDate) {
    calendarState.endDate = dateStr;
  } else {
    calendarState.startDate = dateStr; calendarState.endDate = null;
  }
  renderCalendar('bookingCal');
  const lbl = document.getElementById('dateRangeLabel');
  if (calendarState.startDate && calendarState.endDate) {
    const days = Math.ceil((new Date(calendarState.endDate) - new Date(calendarState.startDate)) / 86400000);
    lbl.textContent = `${calendarState.startDate} → ${calendarState.endDate} (${days} days)`;
  } else if (calendarState.startDate) {
    lbl.textContent = `Start: ${calendarState.startDate} — now pick end date`;
  }
}

async function confirmBooking(toolId, pricePerDay) {
  const { startDate, endDate } = calendarState;
  if (!startDate || !endDate) { showErr('bookingErr', 'Please select start and end dates'); return; }
  const notes = document.getElementById('bookingNotes').value;
  try {
    const data = await apiFetch('/bookings', { method: 'POST', body: JSON.stringify({ tool_id: toolId, start_date: startDate, end_date: endDate, notes }) });
    closeModal('bookingModal');
    alert(`Booking confirmed! ${data.total_days} days × ₹${pricePerDay} = ₹${data.total_amount}. Waiting for owner confirmation.`);
    showDashboard();
  } catch (e) { showErr('bookingErr', e.message); }
}

// ── CHAT ──
async function startChat(userId, userName, toolId) {
  if (!currentUser) { showPage('login'); return; }
  showPage('chat');
  await loadConversations();
  openConversation(userId, userName);
}

async function loadConversations() {
  if (!currentUser) return;
  try {
    const convs = await apiFetch('/chat/conversations');
    const list = document.getElementById('conversationList');
    if (!convs.length) { list.innerHTML = `<div class="empty-state" style="padding:40px"><i class="fa-solid fa-comments"></i><p>No messages yet</p></div>`; return; }
    list.innerHTML = convs.map(c => `
      <div class="conversation-item ${activeChat === c.other_user_id ? 'active' : ''}" onclick="openConversation(${c.other_user_id}, '${c.other_user_name}')">
        <div class="conv-avatar">${c.other_user_name[0]}</div>
        <div class="conv-info">
          <div class="conv-name">${c.other_user_name} <small style="color:var(--text3);font-size:11px">(${c.other_user_role})</small></div>
          <div class="conv-preview">${c.last_message}</div>
        </div>
        ${c.unread_count > 0 ? `<div class="conv-unread">${c.unread_count}</div>` : ''}
      </div>`).join('');
  } catch {}
}

async function openConversation(userId, userName) {
  activeChat = userId;
  const main = document.getElementById('chatMain');
  main.innerHTML = `
    <div class="chat-header">
      <div class="conv-avatar" style="width:36px;height:36px;font-size:14px">${userName[0]}</div>
      <div class="name">${userName}</div>
    </div>
    <div class="messages-area" id="messagesArea"></div>
    <div class="chat-input-wrap">
      <input type="text" id="chatInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMsg()">
      <button class="chat-send-btn" onclick="sendMsg()"><i class="fa-solid fa-paper-plane"></i></button>
    </div>`;

  try {
    const msgs = await apiFetch(`/chat/${userId}`);
    const area = document.getElementById('messagesArea');
    msgs.forEach(m => appendMessage(m, m.sender_id === currentUser.id));
    area.scrollTop = area.scrollHeight;
  } catch {}
  loadConversations();
}

function appendMessage(msg, isSent) {
  const area = document.getElementById('messagesArea');
  if (!area) return;
  const div = document.createElement('div');
  div.className = `msg ${isSent ? 'sent' : 'received'}`;
  div.innerHTML = `<div><div class="msg-bubble">${msg.message}</div><div class="msg-time">${formatTime(msg.created_at)}</div></div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function sendMsg() {
  if (!socket || !activeChat) return;
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('send_message', { senderId: currentUser.id, receiverId: activeChat, message: msg });
  input.value = '';
}

async function updateChatBadge() {
  try {
    const convs = await apiFetch('/chat/conversations');
    const total = convs.reduce((s, c) => s + (c.unread_count || 0), 0);
    const badge = document.getElementById('chatBadge');
    badge.textContent = total;
    badge.style.display = total > 0 ? 'flex' : 'none';
  } catch {}
}

// ── DASHBOARD ──
async function loadDashboard() {
  if (!currentUser) return;
  const el = document.getElementById('dashboardContent');
  try {
    if (currentUser.role === 'owner') {
      const d = await apiFetch('/dashboard/owner');
      renderOwnerDashboard(d, el);
    } else {
      const d = await apiFetch('/dashboard/customer');
      renderCustomerDashboard(d, el);
    }
  } catch (e) {
    el.innerHTML = `<div class="dashboard-wrap"><div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>${e.message}</p></div></div>`;
  }
}

function renderOwnerDashboard(d, el) {
  el.innerHTML = `
    <div class="dashboard-wrap">
      <div class="dash-header">
        <div><h1>Owner Dashboard</h1><p style="color:var(--text3)">Welcome back, ${currentUser.name}</p></div>
        <button class="btn-primary" onclick="showPage('add-tool')"><i class="fa-solid fa-plus"></i> List New Tool</button>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Total Tools</div><div class="value">${d.totalTools}</div></div>
        <div class="stat-card"><div class="label">Active Listings</div><div class="value green">${d.activeTools}</div></div>
        <div class="stat-card"><div class="label">Total Bookings</div><div class="value">${d.totalBookings}</div></div>
        <div class="stat-card"><div class="label">Pending Requests</div><div class="value ${d.pendingBookings > 0 ? 'accent' : ''}">${d.pendingBookings}</div></div>
        <div class="stat-card"><div class="label">Total Revenue</div><div class="value accent">₹${d.totalRevenue.toLocaleString()}</div></div>
        <div class="stat-card"><div class="label">Avg. Rating</div><div class="value">${d.avgRating.toFixed(1)} ⭐</div></div>
      </div>
      <div class="dash-tabs">
        <button class="dash-tab active" onclick="switchTab(this,'tab-bookings')">Booking Requests</button>
        <button class="dash-tab" onclick="switchTab(this,'tab-tools')">My Tools</button>
        <button class="dash-tab" onclick="switchTab(this,'tab-revenue')">Revenue</button>
      </div>
      <div id="tab-bookings" class="dash-tab-content">
        <div class="dash-section">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Tool</th><th>Customer</th><th>Dates</th><th>Days</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                ${d.recentBookings.length ? d.recentBookings.map(b => `
                  <tr>
                    <td><strong>${b.tool_title}</strong></td>
                    <td>${b.customer_name}<br><small style="color:var(--text3)">${b.customer_phone||''}</small></td>
                    <td style="font-size:13px">${b.start_date}<br>→ ${b.end_date}</td>
                    <td>${b.total_days}</td>
                    <td style="color:var(--accent);font-weight:600">₹${b.total_amount}</td>
                    <td><span class="status-badge status-${b.status}">${b.status}</span></td>
                    <td>
                      ${b.status === 'pending' ? `
                        <button class="btn-success" style="margin-right:6px" onclick="updateBooking(${b.id},'confirmed')">Confirm</button>
                        <button class="btn-danger" onclick="updateBooking(${b.id},'cancelled')">Decline</button>
                      ` : b.status === 'confirmed' ? `
                        <button class="btn-success" onclick="updateBooking(${b.id},'completed')">Mark Done</button>
                      ` : '—'}
                    </td>
                  </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:40px">No bookings yet</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div id="tab-tools" class="dash-tab-content" style="display:none">
        <div class="dash-section">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Tool</th><th>Price/Day</th><th>Bookings</th><th>Revenue</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                ${d.topTools.map(t => `
                  <tr>
                    <td><strong>${t.title}</strong></td>
                    <td>₹${t.price_per_day}</td>
                    <td>${t.bookings}</td>
                    <td style="color:var(--accent)">₹${t.revenue}</td>
                    <td><span class="avail-badge avail-yes">Active</span></td>
                    <td><button class="btn-ghost" style="font-size:12px;padding:6px 12px" onclick="showPage('add-tool')">Edit</button></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div id="tab-revenue" class="dash-tab-content" style="display:none">
        <div class="dash-section">
          <h3>Monthly Revenue (Last 6 Months)</h3>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
            ${d.monthlyRevenue.map(m => {
              const maxRev = Math.max(...d.monthlyRevenue.map(r => r.revenue), 1);
              const pct = Math.round((m.revenue / maxRev) * 100);
              return `<div style="display:flex;align-items:center;gap:16px">
                <span style="width:80px;font-size:13px;color:var(--text3)">${m.month}</span>
                <div style="flex:1;background:var(--bg3);border-radius:6px;height:28px;overflow:hidden">
                  <div style="width:${pct}%;background:var(--accent);height:100%;border-radius:6px;transition:width 0.5s;display:flex;align-items:center;padding-left:10px">
                    <span style="font-size:12px;font-weight:600;color:#000">₹${m.revenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

function renderCustomerDashboard(d, el) {
  el.innerHTML = `
    <div class="dashboard-wrap">
      <div class="dash-header">
        <div><h1>My Rentals</h1><p style="color:var(--text3)">Welcome back, ${currentUser.name}</p></div>
        <button class="btn-primary" onclick="showPage('tools')"><i class="fa-solid fa-search"></i> Find Tools</button>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Total Rentals</div><div class="value">${d.totalRentals}</div></div>
        <div class="stat-card"><div class="label">Active Rentals</div><div class="value green">${d.activeRentals}</div></div>
        <div class="stat-card"><div class="label">Total Spent</div><div class="value accent">₹${d.totalSpent.toLocaleString()}</div></div>
        <div class="stat-card"><div class="label">Pending Reviews</div><div class="value ${d.pendingReviews > 0 ? 'accent' : ''}">${d.pendingReviews}</div></div>
      </div>
      <div class="dash-section">
        <h3>My Bookings</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Tool</th><th>Owner</th><th>Dates</th><th>Days</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${d.recentRentals.length ? d.recentRentals.map(b => `
                <tr>
                  <td><div style="display:flex;align-items:center;gap:10px">
                    ${b.tool_image ? `<img src="${b.tool_image}" style="width:40px;height:40px;border-radius:8px;object-fit:cover">` : ''}
                    <strong>${b.tool_title}</strong></div></td>
                  <td>${b.owner_name}<br><small style="color:var(--text3)">${b.owner_phone||''}</small></td>
                  <td style="font-size:13px">${b.start_date}<br>→ ${b.end_date}</td>
                  <td>${b.total_days}</td>
                  <td style="color:var(--accent);font-weight:600">₹${b.total_amount}</td>
                  <td><span class="status-badge status-${b.status}">${b.status}</span></td>
                  <td>
                    ${b.status === 'completed' ? `<button class="btn-primary" style="font-size:12px;padding:6px 12px" onclick="openReview(${b.id},${b.tool_id},'${b.tool_title}')"><i class="fa-solid fa-star"></i> Review</button>` : ''}
                    ${['pending','confirmed'].includes(b.status) ? `<button class="btn-danger" onclick="updateBooking(${b.id},'cancelled')">Cancel</button>` : ''}
                    <button class="btn-ghost" style="font-size:12px;padding:6px 12px" onclick="startChat(${b.owner_id || 1},'${b.owner_name}',${b.tool_id})"><i class="fa-solid fa-comment"></i></button>
                  </td>
                </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:40px">No rentals yet. <a href="#" onclick="showPage('tools')" style="color:var(--accent)">Browse tools</a></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function switchTab(btn, tabId) {
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dash-tab-content').forEach(t => t.style.display = 'none');
  btn.classList.add('active');
  document.getElementById(tabId).style.display = 'block';
}

async function updateBooking(id, status) {
  try {
    await apiFetch(`/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    loadDashboard();
  } catch (e) { alert(e.message); }
}

// ── REVIEW MODAL ──
function openReview(bookingId, toolId, toolTitle) {
  let selectedRating = 5;
  document.getElementById('reviewModalContent').innerHTML = `
    <p style="color:var(--text3);margin-bottom:20px">Review for: <strong style="color:var(--text)">${toolTitle}</strong></p>
    <div class="form-group">
      <label>Rating</label>
      <div id="starPicker" style="display:flex;gap:8px;font-size:28px;cursor:pointer">
        ${[1,2,3,4,5].map(n => `<span onclick="setRating(${n})" id="star${n}" style="color:${n<=5?'#f59e0b':'#444'}">★</span>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Comment</label>
      <textarea id="reviewComment" rows="3" placeholder="Share your experience..."></textarea>
    </div>
    <div id="reviewErr" class="form-error" style="display:none"></div>
    <button class="btn-primary full" onclick="submitReview(${bookingId},${toolId})">Submit Review</button>`;
  document.getElementById('reviewModal').style.display = 'flex';
}

function setRating(n) {
  window._reviewRating = n;
  [1,2,3,4,5].forEach(i => {
    document.getElementById('star'+i).style.color = i <= n ? '#f59e0b' : '#444';
  });
}
window._reviewRating = 5;

async function submitReview(bookingId, toolId) {
  const rating = window._reviewRating || 5;
  const comment = document.getElementById('reviewComment').value;
  try {
    await apiFetch('/reviews', { method: 'POST', body: JSON.stringify({ tool_id: toolId, booking_id: bookingId, rating, comment }) });
    closeModal('reviewModal');
    alert('Review submitted! Thank you.');
    loadDashboard();
  } catch (e) { showErr('reviewErr', e.message); }
}

// ── ADD TOOL ──
async function addTool() {
  const title = document.getElementById('toolTitle').value;
  const category = document.getElementById('toolCategory').value;
  const price_per_day = parseFloat(document.getElementById('toolPrice').value);
  const deposit = parseFloat(document.getElementById('toolDeposit').value) || 0;
  const condition = document.getElementById('toolCondition').value;
  const location = document.getElementById('toolLocation').value;
  const image = document.getElementById('toolImage').value;
  const description = document.getElementById('toolDesc').value;
  const errEl = document.getElementById('addToolError');
  errEl.style.display = 'none';

  if (!title || !category || !price_per_day) {
    showErr('addToolError', 'Title, category and price are required');
    return;
  }
  try {
    await apiFetch('/tools', { method: 'POST', body: JSON.stringify({ title, category, price_per_day, deposit, condition, location, image, description }) });
    alert('Tool listed successfully!');
    showDashboard();
  } catch (e) { showErr('addToolError', e.message); }
}

// ── UTILS ──
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showErr(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.style.display = 'block'; }

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function formatTime(str) {
  if (!str) return '';
  return new Date(str).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
});
