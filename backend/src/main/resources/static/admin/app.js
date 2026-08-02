const TOKEN_KEY = 'plantalk_admin_token';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function api(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = getToken();
  if (token) headers['X-Admin-Token'] = token;
  const res = await fetch(path, Object.assign({}, options, { headers }));
  if (res.status === 401) {
    clearToken();
    showLogin();
    throw new Error('UNAUTHORIZED');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || '요청에 실패했습니다.');
  }
  return data;
}

/* ---------- 화면 전환 ---------- */
function showLogin() {
  $('#login-view').classList.remove('hidden');
  $('#app-view').classList.add('hidden');
}

function showApp() {
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  switchTab('dashboard');
}

function switchTab(tab) {
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab').forEach((s) => s.classList.add('hidden'));
  $('#tab-' + tab).classList.remove('hidden');
  if (tab === 'dashboard') loadStats();
  if (tab === 'users') loadUsers(0);
  if (tab === 'rooms') loadRooms(0);
  if (tab === 'agreements') loadAgreements(0);
  if (tab === 'friendships') loadFriendships();
  if (tab === 'direct-messages') loadDirectMessages();
  if (tab === 'announcements') { loadAnnRooms(); loadAnnHistory(); }
  if (tab === 'global-announcements') loadGlobalAnnHistory();
  if (tab === 'localized-content') loadUsageGuide();
}

/* ---------- 로그인 ---------- */
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = $('#login-error');
  errEl.classList.add('hidden');
  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: $('#login-username').value.trim(),
        password: $('#login-password').value,
      }),
    });
    setToken(data.token);
    $('#login-password').value = '';
    showApp();
  } catch (err) {
    errEl.textContent = err.message === 'UNAUTHORIZED' ? '아이디 또는 비밀번호가 올바르지 않습니다.' : err.message;
    errEl.classList.remove('hidden');
  }
});

$('#logout-btn').addEventListener('click', () => { clearToken(); showLogin(); });
$$('.nav-item').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
$$('.modal-close').forEach((b) => b.addEventListener('click', () => $('#' + b.dataset.close).classList.add('hidden')));
$$('.modal-overlay').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o) o.classList.add('hidden'); }));

/* ---------- 다국어 콘텐츠 ---------- */
async function loadUsageGuide() {
  const result = $('#usage-guide-result');
  result.textContent = '불러오는 중...';
  try {
    const data = await api('/api/admin/localized-content/usage-guide');
    $('#usage-guide-ko').value = data.ko || '';
    $('#usage-guide-en').value = data.en || '';
    $('#usage-guide-ja').value = data.ja || '';
    result.textContent = data.updatedAt ? `마지막 저장: ${fmtDate(data.updatedAt)}` : '기본 문구를 사용 중입니다.';
  } catch (err) {
    result.textContent = err.message;
  }
}

$('#usage-guide-save').addEventListener('click', async () => {
  const button = $('#usage-guide-save');
  const result = $('#usage-guide-result');
  button.disabled = true;
  result.textContent = '저장 중...';
  try {
    const data = await api('/api/admin/localized-content/usage-guide', {
      method: 'PUT',
      body: JSON.stringify({
        ko: $('#usage-guide-ko').value,
        en: $('#usage-guide-en').value,
        ja: $('#usage-guide-ja').value,
      }),
    });
    result.textContent = `저장 완료 · ${fmtDate(data.updatedAt)}`;
  } catch (err) {
    result.textContent = err.message;
  } finally {
    button.disabled = false;
  }
});

/* ---------- 대시보드 ---------- */
async function loadStats() {
  const grid = $('#stats-grid');
  grid.innerHTML = '<div class="empty">불러오는 중...</div>';
  try {
    const s = await api('/api/admin/stats');
    const items = [
      ['전체 회원', s.totalUsers],
      ['전체 채팅방', s.totalRooms],
      ['활성 채팅방', s.activeRooms],
      ['전체 메시지', s.totalMessages],
      ['약속/이벤트', s.totalAgreements],
      ['친구 관계', s.friendships],
      ['1:1 메시지', s.directMessages],
    ];
    grid.innerHTML = items.map(([label, value]) =>
      `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${Number(value).toLocaleString()}</div></div>`
    ).join('');
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') grid.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

/* ---------- 회원 관리 ---------- */
let userSearchTerm = '';

async function loadUsers(page) {
  const tbody = $('#users-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="empty">불러오는 중...</td></tr>';
  try {
    const q = userSearchTerm ? `&search=${encodeURIComponent(userSearchTerm)}` : '';
    const data = await api(`/api/admin/users?page=${page}&size=20${q}`);
    if (!data.users.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">회원이 없습니다.</td></tr>';
    } else {
      tbody.innerHTML = data.users.map((u) => `
        <tr>
          <td><strong>${esc(u.nickname)}</strong></td>
          <td>${u.isPremium ? '<span class="badge badge-purple">프리미엄</span>' : '<span class="badge badge-gray">무료</span>'}</td>
          <td>${fmtDate(u.createdAt)}</td>
          <td><button class="btn btn-sm" onclick="openUserDetail('${u.id}')">상세</button></td>
        </tr>`).join('');
    }
    renderPaging('#users-paging', data.page, data.totalPages, data.totalElements, loadUsers);
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') tbody.innerHTML = `<tr><td colspan="4" class="empty">${esc(e.message)}</td></tr>`;
  }
}

$('#user-search-btn').addEventListener('click', () => { userSearchTerm = $('#user-search').value.trim(); loadUsers(0); });
$('#user-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') { userSearchTerm = e.target.value.trim(); loadUsers(0); } });
$('#user-reset-btn').addEventListener('click', () => { userSearchTerm = ''; $('#user-search').value = ''; loadUsers(0); });

const STATUS_BADGE = {
  ACTIVE: 'badge-green', PENDING: 'badge-orange', IN_PROGRESS: 'badge-blue',
  COMPLETED: 'badge-green', CANCELLED: 'badge-red', DECLINED: 'badge-red',
  CLOSED: 'badge-gray', WAITING: 'badge-orange', ACCEPTED: 'badge-green', JOINED: 'badge-green', LEFT: 'badge-gray',
};
const STATUS_KO = {
  ACTIVE: '활성', PENDING: '대기', IN_PROGRESS: '진행 중', COMPLETED: '완료',
  CANCELLED: '취소', DECLINED: '거절', CLOSED: '종료', WAITING: '대기', ACCEPTED: '수락', JOINED: '참여', LEFT: '나감',
};
function statusBadge(s) {
  return `<span class="badge ${STATUS_BADGE[s] || 'badge-gray'}">${STATUS_KO[s] || esc(s)}</span>`;
}

window.openUserDetail = async function (id) {
  const body = $('#user-modal-body');
  body.innerHTML = '<div class="empty">불러오는 중...</div>';
  $('#user-modal').classList.remove('hidden');
  try {
    const u = await api(`/api/admin/users/${id}`);
    $('#user-modal-title').textContent = `회원 상세 — ${u.nickname}`;
    const rooms = (u.rooms || []).map((r) => `
      <div class="mini-item">
        <span>${esc(r.emoji || '💬')} ${esc(r.title)}</span>
        ${statusBadge(r.status)}
      </div>`).join('') || '<div class="empty">참여 중인 채팅방이 없습니다.</div>';
    const ags = (u.agreements || []).map((a) => `
      <div class="mini-item">
        <span>${esc(a.emoji || '🤝')} ${esc(a.title)} <small style="color:#7A8199">(${(a.participants || []).map((p) => esc(p.userName)).join(', ')})</small></span>
        ${statusBadge(a.status)}
      </div>`).join('') || '<div class="empty">약속이 없습니다.</div>';
    const friends = (u.friends || []).map((f) => `
      <div class="mini-item">
        <span><span class="presence-indicator ${f.online ? 'is-online' : ''}"></span> ${esc(f.nickname)}</span>
        <span class="badge ${f.online ? 'badge-green' : 'badge-gray'}">${f.online ? '접속 중' : '오프라인'}</span>
      </div>`).join('') || '<div class="empty">등록된 친구가 없습니다.</div>';
    body.innerHTML = `
      <div class="detail-row"><div class="k">닉네임</div><div><strong>${esc(u.nickname)}</strong></div></div>
      <div class="detail-row"><div class="k">회원 등급</div><div>${u.isPremium ? '<span class="badge badge-purple">프리미엄</span>' : '<span class="badge badge-gray">무료</span>'}</div></div>
      <div class="detail-row"><div class="k">가입일</div><div>${fmtDate(u.createdAt)}</div></div>
      <div class="detail-row"><div class="k">소개</div><div>${esc(u.bio) || '-'}</div></div>
      <div class="section-title">참여 중인 채팅방 (${(u.rooms || []).length})</div>
      <div class="mini-list">${rooms}</div>
      <div class="section-title">약속 / 이벤트 (${(u.agreements || []).length})</div>
      <div class="mini-list">${ags}</div>
      <div class="section-title">친구 관계 (${(u.friends || []).length})</div>
      <div class="mini-list">${friends}</div>`;
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') body.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
};

/* ---------- 채팅방 관리 ---------- */
async function loadRooms(page) {
  const tbody = $('#rooms-tbody');
  tbody.innerHTML = '<tr><td colspan="8" class="empty">불러오는 중...</td></tr>';
  try {
    const data = await api(`/api/admin/rooms?page=${page}&size=20`);
    if (!data.rooms.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">채팅방이 없습니다.</td></tr>';
    } else {
      tbody.innerHTML = data.rooms.map((r) => `
        <tr>
          <td><strong>${esc(r.emoji || '💬')} ${esc(r.title)}</strong></td>
          <td>${esc(r.category) || '-'}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${esc(r.creatorName) || '-'}</td>
          <td>${r.currentParticipants ?? 0}${r.maxParticipants ? ' / ' + r.maxParticipants : ''}</td>
          <td>${Number(r.messageCount).toLocaleString()}</td>
          <td>${fmtDate(r.createdAt)}</td>
          <td><button class="btn btn-sm" onclick="openRoomChat('${r.id}', 0)">대화 보기</button></td>
        </tr>`).join('');
    }
    renderPaging('#rooms-paging', data.page, data.totalPages, data.totalElements, loadRooms);
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') tbody.innerHTML = `<tr><td colspan="8" class="empty">${esc(e.message)}</td></tr>`;
  }
}

window.openRoomChat = async function (roomId, page) {
  const body = $('#room-modal-body');
  if (page === 0) {
    body.innerHTML = '<div class="empty">불러오는 중...</div>';
    $('#room-modal').classList.remove('hidden');
  }
  try {
    const data = await api(`/api/admin/rooms/${roomId}/messages?page=${page}&size=50`);
    $('#room-modal-title').textContent = `${data.roomEmoji || '💬'} ${data.roomTitle} — 대화 내역 (${Number(data.totalMessages).toLocaleString()}개)`;
    const joined = (data.participants || []).filter((p) => p.status === 'JOINED');
    const participantsLine = joined.length
      ? `<div class="participants-line"><strong>참여자 (${joined.length}명):</strong> ${joined.map((p) => esc(p.userName)).join(', ')}</div>`
      : '';
    const msgs = (data.messages || []).slice().reverse();
    const msgHtml = msgs.map((m) => `
      <div class="chat-msg ${m.messageType === 'SYSTEM' ? 'system' : ''}">
        <div class="chat-meta">${m.messageType === 'SYSTEM' ? '📢 ' : ''}<strong>${esc(m.senderName)}</strong> · ${fmtDate(m.createdAt)}</div>
        <div class="chat-text">${m.messageType === 'IMAGE' ? '🖼️ (사진)' : esc(m.content)}</div>
      </div>`).join('') || '<div class="empty">메시지가 없습니다.</div>';
    const totalPages = Math.ceil(data.totalMessages / 50);
    const moreBtn = page + 1 < totalPages
      ? `<button class="btn btn-sm" style="margin-bottom:10px" onclick="openRoomChat('${roomId}', ${page + 1})">이전 메시지 더 보기</button>`
      : '';
    const newContent = `${participantsLine}${moreBtn}<div class="chat-list">${msgHtml}</div>`;
    if (page === 0) {
      body.innerHTML = newContent;
      body.scrollTop = body.scrollHeight;
    } else {
      const existing = body.querySelector('.chat-list');
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `<div class="chat-list">${msgHtml}</div>`;
      existing.insertAdjacentHTML('afterbegin', wrapper.querySelector('.chat-list').innerHTML);
      const btn = body.querySelector('.btn.btn-sm');
      if (btn) {
        if (page + 1 < totalPages) btn.setAttribute('onclick', `openRoomChat('${roomId}', ${page + 1})`);
        else btn.remove();
      }
    }
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') body.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
};

/* ---------- 약속/이벤트 ---------- */
async function loadAgreements(page) {
  const tbody = $('#agreements-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="empty">불러오는 중...</td></tr>';
  try {
    const data = await api(`/api/admin/agreements?page=${page}&size=20`);
    if (!data.agreements.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">약속이 없습니다.</td></tr>';
    } else {
      tbody.innerHTML = data.agreements.map((a) => `
        <tr>
          <td><strong>${esc(a.emoji || '🤝')} ${esc(a.title)}</strong></td>
          <td>${esc(a.category) || '-'}</td>
          <td>${statusBadge(a.status)}</td>
          <td>${esc(a.creatorNickname) || '-'}</td>
          <td>${(a.participants || []).map((p) => `${esc(p.userName)}(${STATUS_KO[p.status] || p.status})`).join(', ')}</td>
          <td>${fmtDate(a.dateTime)}</td>
          <td>${fmtDate(a.createdAt)}</td>
        </tr>`).join('');
    }
    renderPaging('#agreements-paging', data.page, data.totalPages, data.totalElements, loadAgreements);
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') tbody.innerHTML = `<tr><td colspan="7" class="empty">${esc(e.message)}</td></tr>`;
  }
}

/* ---------- 친구 관계 ---------- */
async function loadFriendships() {
  const tbody = $('#friendships-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="empty">불러오는 중...</td></tr>';
  try {
    const rows = await api('/api/admin/friendships');
    tbody.innerHTML = rows.length ? rows.map((f) => `
      <tr>
        <td><strong>${esc(f.userOneNickname)}</strong></td>
        <td><strong>${esc(f.userTwoNickname)}</strong></td>
        <td>${statusBadge(f.status)}</td>
        <td>${esc(f.requestedBy) === esc(f.userOneId) ? esc(f.userOneNickname) + ' → ' + esc(f.userTwoNickname) : esc(f.userTwoNickname) + ' → ' + esc(f.userOneNickname)}</td>
        <td>${fmtDate(f.updatedAt)}</td>
      </tr>`).join('') : '<tr><td colspan="5" class="empty">친구 관계가 없습니다.</td></tr>';
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') tbody.innerHTML = `<tr><td colspan="5" class="empty">${esc(e.message)}</td></tr>`;
  }
}

/* ---------- 1:1 메시지 ---------- */
let directMessages = [];

function renderDirectMessages() {
  const term = ($('#dm-search').value || '').trim().toLowerCase();
  const filtered = !term ? directMessages : directMessages.filter((m) =>
    [m.senderNickname, m.recipientNickname, m.content].some((value) => String(value || '').toLowerCase().includes(term)));
  $('#direct-messages-tbody').innerHTML = filtered.length ? filtered.map((m) => `
    <tr>
      <td><strong>${esc(m.senderNickname)}</strong></td>
      <td>${esc(m.recipientNickname)}</td>
      <td class="message-content-cell">${esc(m.content)}</td>
      <td>${fmtDate(m.createdAt)}</td>
      <td>${m.readAt ? '<span class="badge badge-green">읽음</span>' : '<span class="badge badge-orange">안 읽음</span>'}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteDirectMessage('${m.id}')">삭제</button></td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty">표시할 메시지가 없습니다.</td></tr>';
}

async function loadDirectMessages() {
  $('#direct-messages-tbody').innerHTML = '<tr><td colspan="6" class="empty">불러오는 중...</td></tr>';
  try {
    directMessages = await api('/api/admin/direct-messages?limit=500');
    renderDirectMessages();
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') $('#direct-messages-tbody').innerHTML = `<tr><td colspan="6" class="empty">${esc(e.message)}</td></tr>`;
  }
}

window.deleteDirectMessage = async function (id) {
  if (!confirm('이 1:1 메시지를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.')) return;
  try {
    await api(`/api/admin/direct-messages/${id}`, { method: 'DELETE' });
    await loadDirectMessages();
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') alert(e.message);
  }
};

$('#dm-search').addEventListener('input', renderDirectMessages);
$('#dm-refresh-btn').addEventListener('click', loadDirectMessages);

/* ---------- 공지사항 ---------- */
$$('input[name="ann-target"]').forEach((r) => r.addEventListener('change', () => {
  $('#ann-room-select').classList.toggle('hidden', getAnnTarget() === 'ALL');
}));
function getAnnTarget() { return document.querySelector('input[name="ann-target"]:checked').value; }

async function loadAnnRooms() {
  try {
    const data = await api('/api/admin/rooms?page=0&size=200');
    const active = data.rooms.filter((r) => r.status === 'ACTIVE');
    $('#ann-room-select').innerHTML = active.length
      ? active.map((r) => `<option value="${r.id}">${esc(r.emoji || '💬')} ${esc(r.title)} (참여자 ${r.currentParticipants ?? 0}명)</option>`).join('')
      : '<option value="">활성 채팅방이 없습니다</option>';
  } catch (e) { /* 401은 api()에서 처리 */ }
}

$('#ann-send-btn').addEventListener('click', async () => {
  const content = $('#ann-content').value;
  const resultEl = $('#ann-result');
  resultEl.classList.remove('error');
  if (!content.trim()) {
    resultEl.textContent = '공지 내용을 입력해 주세요.';
    resultEl.classList.add('error');
    return;
  }
  const target = getAnnTarget();
  const roomId = target === 'ALL' ? 'ALL' : $('#ann-room-select').value;
  if (target === 'ONE' && !roomId) {
    resultEl.textContent = '채팅방을 선택해 주세요.';
    resultEl.classList.add('error');
    return;
  }
  const confirmMsg = target === 'ALL'
    ? '모든 활성 채팅방에 공지를 보내시겠습니까?'
    : '선택한 채팅방에 공지를 보내시겠습니까?';
  if (!confirm(confirmMsg)) return;
  const btn = $('#ann-send-btn');
  btn.disabled = true;
  resultEl.textContent = '전송 중...';
  try {
    const res = await api('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({ roomId, content }),
    });
    resultEl.textContent = `✅ ${res.roomCount}개 방에 공지 완료 (알림 ${res.notifiedUserCount}명)`;
    $('#ann-content').value = '';
    loadAnnHistory();
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') {
      resultEl.textContent = e.message;
      resultEl.classList.add('error');
    }
  } finally {
    btn.disabled = false;
  }
});

async function loadAnnHistory() {
  const wrap = $('#ann-history');
  wrap.innerHTML = '<div class="empty">불러오는 중...</div>';
  try {
    const list = await api('/api/admin/announcements');
    wrap.innerHTML = list.length
      ? list.map((h) => `
        <div class="ann-item">
          <div class="ann-item-head">
            <div class="ann-meta">${esc(h.roomTitle) || '(삭제된 방)'} · ${fmtDate(h.createdAt)}${h.editedAt ? ' · 수정됨' : ''}</div>
            <div class="ann-item-buttons">
              <button class="btn btn-sm ann-edit-btn" data-id="${h.id}">수정</button>
              <button class="btn btn-sm btn-danger ann-delete-btn" data-id="${h.id}">삭제</button>
            </div>
          </div>
          <div class="ann-text">${esc(h.content)}</div>
        </div>`).join('')
      : '<div class="empty">아직 보낸 공지가 없습니다.</div>';
    wrap.querySelectorAll('.ann-edit-btn').forEach((btn) => btn.addEventListener('click', () => {
      const item = list.find((h) => h.id === btn.dataset.id);
      openAnnEdit(item);
    }));
    wrap.querySelectorAll('.ann-delete-btn').forEach((btn) => btn.addEventListener('click', () => deleteAnn(btn.dataset.id)));
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') wrap.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

async function openAnnEdit(item) {
  if (!item) return;
  await loadAnnRooms();
  $('#ann-edit-room').innerHTML = $('#ann-room-select').innerHTML;
  $('#ann-edit-id').value = item.id;
  $('#ann-edit-room').value = item.roomId || '';
  $('#ann-edit-content').value = item.content || '';
  $('#ann-edit-modal').classList.remove('hidden');
}

$('#ann-edit-save').addEventListener('click', async () => {
  const id = $('#ann-edit-id').value;
  const roomId = $('#ann-edit-room').value;
  const content = $('#ann-edit-content').value;
  if (!roomId || !content.trim()) return alert('채팅방과 공지 내용을 입력해 주세요.');
  try {
    await api(`/api/admin/announcements/${encodeURIComponent(id)}`, {
      method: 'PUT', body: JSON.stringify({ roomId, content }),
    });
    $('#ann-edit-modal').classList.add('hidden');
    loadAnnHistory();
  } catch (e) { if (e.message !== 'UNAUTHORIZED') alert(e.message); }
});

async function deleteAnn(id) {
  if (!confirm('이 채팅방 공지를 삭제하시겠습니까? 채팅방에서도 사라집니다.')) return;
  try {
    await api(`/api/admin/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadAnnHistory();
  } catch (e) { if (e.message !== 'UNAUTHORIZED') alert(e.message); }
}

/* ---------- 전체 공지 ---------- */
let globalAnnItems = [];
let globalAnnFilter = 'ALL';

function bindDurationOptions(name, wrapSelector) {
  $$(`input[name="${name}"]`).forEach((radio) => radio.addEventListener('change', () => {
    $$(`input[name="${name}"]`).forEach((input) => {
      input.closest('.publication-option').classList.toggle('active', input.checked);
    });
    $(wrapSelector).classList.toggle('hidden',
      document.querySelector(`input[name="${name}"]:checked`).value === 'PERMANENT');
  }));
}
bindDurationOptions('global-ann-duration', '#global-expiry-wrap');
bindDurationOptions('global-ann-edit-duration', '#global-edit-expiry-wrap');

$('#global-ann-title').addEventListener('input', (e) => {
  $('#global-title-count').textContent = `${e.target.value.length} / 100`;
});
$('#global-ann-content').addEventListener('input', (e) => {
  $('#global-content-count').textContent = `${e.target.value.length} / 3000`;
});

function getExpiryValue(durationName, inputSelector) {
  const duration = document.querySelector(`input[name="${durationName}"]:checked`).value;
  if (duration === 'PERMANENT') return null;
  const value = $(inputSelector).value;
  if (!value) throw new Error('게시 종료 일시를 선택해 주세요.');
  if (new Date(value).getTime() <= Date.now()) throw new Error('게시 종료 일시는 현재보다 늦어야 합니다.');
  return value;
}

$('#global-ann-send-btn').addEventListener('click', async () => {
  const title = $('#global-ann-title').value;
  const content = $('#global-ann-content').value;
  const result = $('#global-ann-result');
  result.classList.remove('error');
  if (!title.trim() || !content.trim()) {
    result.textContent = '제목과 내용을 입력해 주세요.';
    result.classList.add('error');
    return;
  }
  let expiresAt;
  try {
    expiresAt = getExpiryValue('global-ann-duration', '#global-ann-expires');
  } catch (e) {
    result.textContent = e.message;
    result.classList.add('error');
    return;
  }
  const durationText = expiresAt ? `${fmtDate(expiresAt)}까지` : '영구 게시';
  if (!confirm(`전체 회원의 앱 알림함에 공지를 발행하시겠습니까?\n게시 기간: ${durationText}`)) return;
  const btn = $('#global-ann-send-btn');
  btn.disabled = true;
  result.textContent = '발행 중...';
  try {
    await api('/api/admin/global-announcements', {
      method: 'POST', body: JSON.stringify({ title, content, expiresAt }),
    });
    $('#global-ann-title').value = '';
    $('#global-ann-content').value = '';
    $('#global-ann-expires').value = '';
    $('#global-title-count').textContent = '0 / 100';
    $('#global-content-count').textContent = '0 / 3000';
    document.querySelector('input[name="global-ann-duration"][value="PERMANENT"]').click();
    result.textContent = '✅ 전체 공지가 발행되었습니다.';
    loadGlobalAnnHistory();
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') {
      result.textContent = e.message;
      result.classList.add('error');
    }
  } finally { btn.disabled = false; }
});

function globalAnnStatus(item) {
  if (!item.expiresAt) return { key: 'ACTIVE', label: '영구 게시', className: 'permanent' };
  if (new Date(item.expiresAt).getTime() <= Date.now()) {
    return { key: 'EXPIRED', label: '게시 종료', className: 'expired' };
  }
  return { key: 'ACTIVE', label: '게시 중', className: 'active' };
}

function renderGlobalAnnBoard() {
  const wrap = $('#global-ann-history');
  const activeCount = globalAnnItems.filter((item) => globalAnnStatus(item).key === 'ACTIVE').length;
  const expiredCount = globalAnnItems.length - activeCount;
  $('#global-count-all').textContent = globalAnnItems.length;
  $('#global-count-active').textContent = activeCount;
  $('#global-count-expired').textContent = expiredCount;

  const visibleItems = globalAnnFilter === 'ALL'
    ? globalAnnItems
    : globalAnnItems.filter((item) => globalAnnStatus(item).key === globalAnnFilter);

  wrap.innerHTML = visibleItems.length ? visibleItems.map((h) => {
    const status = globalAnnStatus(h);
    const period = h.expiresAt
      ? `${fmtDate(h.createdAt)} ~ ${fmtDate(h.expiresAt)}`
      : `${fmtDate(h.createdAt)}부터 계속`;
    return `
      <article class="global-post">
        <div class="global-post-status status-${status.className}">${status.label}</div>
        <div class="global-post-main">
          <div class="global-post-header">
            <div>
              <h4>${esc(h.title)}</h4>
              <div class="global-post-meta">
                <span>📅 ${period}</span>
                <span>작성 ${fmtDate(h.createdAt)}</span>
                ${h.updatedAt ? `<span>수정 ${fmtDate(h.updatedAt)}</span>` : ''}
              </div>
            </div>
            <div class="ann-item-buttons">
              <button class="btn btn-sm global-ann-edit-btn" data-id="${h.id}">✏️ 수정</button>
              <button class="btn btn-sm btn-danger global-ann-delete-btn" data-id="${h.id}">🗑️ 삭제</button>
            </div>
          </div>
          <div class="global-post-content">${esc(h.content)}</div>
          <div class="global-post-footer">
            <span>🔔 앱 홈 오른쪽 상단 종 아이콘의 알림함에 표시</span>
            <span>${h.expiresAt ? `종료: ${fmtDate(h.expiresAt)}` : '종료일 없음'}</span>
          </div>
        </div>
      </article>`;
  }).join('') : '<div class="board-empty">조건에 맞는 전체 공지가 없습니다.</div>';

  wrap.querySelectorAll('.global-ann-edit-btn').forEach((btn) => btn.addEventListener('click', () => {
    const item = globalAnnItems.find((h) => h.id === btn.dataset.id);
    openGlobalAnnEdit(item);
  }));
  wrap.querySelectorAll('.global-ann-delete-btn').forEach((btn) =>
    btn.addEventListener('click', () => deleteGlobalAnn(btn.dataset.id)));
}

async function loadGlobalAnnHistory() {
  const wrap = $('#global-ann-history');
  wrap.innerHTML = '<div class="empty">불러오는 중...</div>';
  try {
    globalAnnItems = await api('/api/admin/global-announcements');
    renderGlobalAnnBoard();
  } catch (e) {
    if (e.message !== 'UNAUTHORIZED') wrap.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

function openGlobalAnnEdit(item) {
  if (!item) return;
  $('#global-ann-edit-id').value = item.id;
  $('#global-ann-edit-title').value = item.title;
  $('#global-ann-edit-content').value = item.content;
  const duration = item.expiresAt ? 'UNTIL' : 'PERMANENT';
  document.querySelector(`input[name="global-ann-edit-duration"][value="${duration}"]`).click();
  $('#global-ann-edit-expires').value = item.expiresAt ? item.expiresAt.slice(0, 16) : '';
  $('#global-ann-edit-modal').classList.remove('hidden');
}

$$('[data-global-filter]').forEach((button) => button.addEventListener('click', () => {
  globalAnnFilter = button.dataset.globalFilter;
  $$('[data-global-filter]').forEach((item) => item.classList.toggle('active', item === button));
  renderGlobalAnnBoard();
}));

$('#global-ann-edit-save').addEventListener('click', async () => {
  const id = $('#global-ann-edit-id').value;
  const title = $('#global-ann-edit-title').value;
  const content = $('#global-ann-edit-content').value;
  if (!title.trim() || !content.trim()) return alert('제목과 내용을 입력해 주세요.');
  let expiresAt;
  try {
    expiresAt = getExpiryValue('global-ann-edit-duration', '#global-ann-edit-expires');
  } catch (e) {
    return alert(e.message);
  }
  try {
    await api(`/api/admin/global-announcements/${encodeURIComponent(id)}`, {
      method: 'PUT', body: JSON.stringify({ title, content, expiresAt }),
    });
    $('#global-ann-edit-modal').classList.add('hidden');
    loadGlobalAnnHistory();
  } catch (e) { if (e.message !== 'UNAUTHORIZED') alert(e.message); }
});

async function deleteGlobalAnn(id) {
  if (!confirm('이 전체 공지를 삭제하시겠습니까? 회원 알림에서도 제거됩니다.')) return;
  try {
    await api(`/api/admin/global-announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadGlobalAnnHistory();
  } catch (e) { if (e.message !== 'UNAUTHORIZED') alert(e.message); }
}

/* ---------- 페이징 ---------- */
function renderPaging(sel, page, totalPages, totalElements, loader) {
  const el = $(sel);
  if (!totalPages || totalPages <= 1) {
    el.innerHTML = totalElements ? `<span>총 ${Number(totalElements).toLocaleString()}건</span>` : '';
    return;
  }
  let html = '';
  const start = Math.max(0, page - 2);
  const end = Math.min(totalPages, start + 5);
  if (page > 0) html += `<button data-p="${page - 1}">이전</button>`;
  for (let i = start; i < end; i++) {
    html += `<button data-p="${i}" class="${i === page ? 'current' : ''}">${i + 1}</button>`;
  }
  if (page < totalPages - 1) html += `<button data-p="${page + 1}">다음</button>`;
  html += `<span>총 ${Number(totalElements).toLocaleString()}건</span>`;
  el.innerHTML = html;
  el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => loader(Number(b.dataset.p))));
}

/* ---------- 시작 ---------- */
if (getToken()) showApp(); else showLogin();
