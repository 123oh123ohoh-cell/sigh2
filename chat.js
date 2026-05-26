// --- Recent DMs tracking ---
function getRecentDMs() {
  return JSON.parse(localStorage.getItem('recentDMs') || '[]');
}
function saveRecentDMs(list) {
  localStorage.setItem('recentDMs', JSON.stringify(list));
}
function touchRecentDM(username) {
  if (!username || username === myUsername) return;
  let recents = getRecentDMs();
  recents = recents.filter(u => u !== username);
  recents.unshift(username);
  saveRecentDMs(recents.slice(0, 30));
}
// --- Listen for avatar/profile changes and update chat UI ---
window.addEventListener('storage', function (e) {
  if (e.key === 'profileAvatar' && e.newValue) {
    updateMyAvatar(e.newValue);
  }
});

function updateMyAvatar(newAvatar) {
  // Update in allUsers
  const idx = allUsers.findIndex(u => u.username === myUsername);
  if (idx !== -1) {
    allUsers[idx].avatar = newAvatar;
    renderUserList();
    // If current chat is self, update header
    if (currentChatUser === myUsername) {
      const headerAvatar = document.getElementById('chatHeaderAvatar');
      if (headerAvatar) headerAvatar.src = newAvatar || DEFAULT_AVATAR;
    }
  }
}
// OwnsHub Chat Client - Upgraded
// Requires: loggedInUser + token in localStorage, Socket.io backend

const DEFAULT_AVATAR = 'logos_and_profileicons/defaultpfp.webp';
const myUsername = localStorage.getItem('loggedInUser');
const token = localStorage.getItem('token');

const scheme = window.location.protocol === 'https:' ? 'https' : 'http';
const host = window.location.hostname || 'localhost';
const CHAT_SERVER_URL = localStorage.getItem('chatServerUrl') || 'https://sigh2.onrender.com';

// ─── AUTH GUARD ──────────────────────────────────────────────
if (!myUsername || !token) {
  const area = document.getElementById('messagesArea');
  if (area) area.innerHTML = '<div style="color:var(--text-muted);text-align:center;margin-top:40px;">Please log in to use chat.</div>';
  const header = document.getElementById('chatHeader');
  if (header) header.textContent = 'Login Required';
  throw new Error('Chat requires a logged-in user');
}

// ─── SOCKET ──────────────────────────────────────────────────
const socket = typeof window.io === 'function'
  ? io(CHAT_SERVER_URL, { transports: ['websocket'] })
  : null;

// ─── STATE ───────────────────────────────────────────────────
let currentChatUser = null;
let currentChatUserObj = null;
let allUsers = [];
let onlineUsers = new Set();
let userStatusMap = {};
let userSearch = '';
let unreadCounts = JSON.parse(localStorage.getItem('chatUnreadCounts') || '{}');
let pendingImageDataUrl = null;
let typingTimeout = null;
let typingIndicatorTimeout = null;

// ─── SOCKET EVENTS ───────────────────────────────────────────
if (socket) {
  socket.emit('join', myUsername);

  socket.on('connect', () => updateConnectionStatus('connected'));
  socket.on('disconnect', () => updateConnectionStatus('disconnected'));
  socket.on('connect_error', () => updateConnectionStatus('error'));

  socket.on('online_users', list => {
    onlineUsers = new Set(list);
    renderUserList();
    updateChatHeaderStatus();
  });

  socket.on('user_status', statusObj => {
    userStatusMap = statusObj;
    renderUserList();
    updateChatHeaderStatus();
  });

  socket.on('typing', data => {
    if (data.from === currentChatUser) showTypingIndicator(data.from);
  });

  socket.on('private_message', msg => {
    // Always touch recents for sender/receiver and update list
    const otherUser = msg.sender === myUsername ? msg.receiver : msg.sender;
    // Dynamically add new user to allUsers if not present
    if (!allUsers.some(u => u.username === otherUser)) {
      allUsers.push({ username: otherUser, displayName: otherUser });
    }
    touchRecentDM(otherUser);
    if (msg.sender === currentChatUser || (msg.sender === myUsername && msg.receiver === currentChatUser)) {
      appendMessage(msg, msg.sender === myUsername);
      scrollToBottom();
    } else if (msg.receiver === myUsername) {
      unreadCounts[msg.sender] = (unreadCounts[msg.sender] || 0) + 1;
      saveUnread();
    }
    renderUserList();
  });

  socket.emit('get_online_users');
} else {
  updateConnectionStatus('error');
}

// ─── CONNECTION STATUS ────────────────────────────────────────
function updateConnectionStatus(state) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (!dot || !text) return;
  const map = {
    connected:    { color: 'var(--green)',  label: 'Connected' },
    disconnected: { color: 'var(--red)',    label: 'Disconnected' },
    error:        { color: 'var(--yellow)', label: 'Reconnecting…' },
  };
  const s = map[state] || map.error;
  dot.style.background = s.color;
  text.textContent = s.label;
}

// ─── USER LIST ────────────────────────────────────────────────
function getStatusColor(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'var(--green)';
  if (st === 'dnd')    return 'var(--red)';
  if (st === 'away')   return 'var(--yellow)';
  return 'var(--text-dim)';
}

function getStatusLabel(username) {
  const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : 'offline');
  if (st === 'online') return 'Online';
  if (st === 'dnd')    return 'Do Not Disturb';
  if (st === 'away')   return 'Away';
  return 'Offline';
}

function renderUserList() {
  const userList = document.getElementById('userList');
  if (!userList) return;
  userList.innerHTML = '';

  let recents = getRecentDMs();
  let usersByName = Object.fromEntries(allUsers.map(u => [u.username, u]));
  let filtered = allUsers.filter(u => u.username !== myUsername);

  // If searching, show search results at top, else show recents at top
  if (userSearch.startsWith('@')) {
    const term = userSearch.slice(1).toLowerCase();
    filtered = filtered.filter(u =>
      u.username.toLowerCase().includes(term) ||
      (u.displayName && u.displayName.toLowerCase().includes(term))
    );
    // If not found, allow quick start
    if (filtered.length === 0) {
      const typed = userSearch.slice(1).trim();
      if (typed && typed !== myUsername) {
        const li = makeUserLi({ username: typed, displayName: typed }, true);
        userList.appendChild(li);
      }
      return;
    }
    filtered.forEach(u => userList.appendChild(makeUserLi(u)));
    return;
  }

  // Stack recents at top
  let stacked = [];
  recents.forEach(username => {
    if (usersByName[username]) stacked.push(usersByName[username]);
  });
  // Add the rest (not in recents)
  filtered.forEach(u => {
    if (!recents.includes(u.username)) stacked.push(u);
  });

  if (stacked.length === 0) {
    const li = document.createElement('li');
    li.style.cssText = 'opacity:0.5;cursor:default;font-size:0.9em;';
    li.textContent = 'No users found. Type @username to start a chat.';
    userList.appendChild(li);
    return;
  }
  stacked.forEach(u => userList.appendChild(makeUserLi(u)));
}

function makeUserLi(u, isQuickStart = false) {
  const li = document.createElement('li');
  if (currentChatUser === u.username) li.classList.add('active');

  // Avatar wrap
  const wrap = document.createElement('div');
  wrap.className = 'user-avatar-wrap';

  const avatar = document.createElement('img');
  avatar.src = u.avatar || DEFAULT_AVATAR;
  avatar.onerror = () => { avatar.src = DEFAULT_AVATAR; };
  avatar.className = 'avatar';
  wrap.appendChild(avatar);

  const dot = document.createElement('span');
  dot.className = 'avatar-status-dot';
  dot.style.background = isQuickStart ? 'var(--text-dim)' : getStatusColor(u.username);
  wrap.appendChild(dot);
  li.appendChild(wrap);

  // Info
  const info = document.createElement('div');
  info.className = 'user-info';

  const nameSpan = document.createElement('div');
  nameSpan.className = 'user-display-name';
  nameSpan.textContent = u.displayName || u.username;
  info.appendChild(nameSpan);

  const usernameSpan = document.createElement('div');
  usernameSpan.className = 'user-username';
  usernameSpan.textContent = '@' + u.username;
  info.appendChild(usernameSpan);
  li.appendChild(info);

  // Unread badge
  if (unreadCounts[u.username] > 0) {
    const badge = document.createElement('span');
    badge.className = 'unread-badge';
    badge.textContent = unreadCounts[u.username];
    li.appendChild(badge);
  }

  li.onclick = () => selectUser(u.username, li);
  return li;
}

// ─── SELECT USER ──────────────────────────────────────────────
function selectUser(username, liElem) {
    touchRecentDM(username);
  currentChatUser = username;
  currentChatUserObj = allUsers.find(u => u.username === username) || { username, displayName: username };

  // Highlight
  document.querySelectorAll('.user-list li').forEach(li => li.classList.remove('active'));
  liElem.classList.add('active');

  // Reset unread
  unreadCounts[username] = 0;
  saveUnread();
  renderUserList();

  // Show chat panels
  document.getElementById('emptyState').style.display = 'none';
  const chatHeader = document.getElementById('chatHeader');
  const messagesArea = document.getElementById('messagesArea');
  const inputArea = document.getElementById('chatInputArea');
  chatHeader.style.display = 'flex';
  messagesArea.style.display = 'flex';
  inputArea.style.display = 'block';

  // Update header
  document.getElementById('chatHeaderName').textContent =
    (currentChatUserObj.displayName || username) + ' (@' + username + ')';
  const headerAvatar = document.getElementById('chatHeaderAvatar');
  headerAvatar.src = currentChatUserObj.avatar || DEFAULT_AVATAR;
  headerAvatar.style.display = 'block';
  updateChatHeaderStatus();

  // Clear messages, fetch history
  messagesArea.innerHTML = '';
  fetch(`${CHAT_SERVER_URL}/api/messages?user=${encodeURIComponent(username)}`, {
    headers: {
      'Authorization': token ? 'Bearer ' + token : '',
      'X-Chat-User': myUsername
    }
  })
    .then(r => r.json())
    .then(messages => {
      if (messages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'transient-notice';
        empty.textContent = 'No messages yet. Say hi! 👋';
        messagesArea.appendChild(empty);
      } else {
        messages.forEach(msg => appendMessage(msg, msg.sender === myUsername));
        scrollToBottom();
      }
    })
    .catch(() => showNotice('Could not load message history.', 'var(--red)'));

  document.getElementById('chatInput').focus();
}

function updateChatHeaderStatus() {
  const el = document.getElementById('chatHeaderStatus');
  if (!el || !currentChatUser) return;
  el.textContent = getStatusLabel(currentChatUser);
}

// ─── SEND MESSAGE ─────────────────────────────────────────────
function sendMessage() {
  const input = document.getElementById('chatInput');
  const content = input ? input.value.trim() : '';

  if (!currentChatUser) { showNotice('Select a user first.', 'var(--yellow)'); return; }
  if (!content && !pendingImageDataUrl) return;

  const msg = {
    sender: myUsername,
    receiver: currentChatUser,
    content: content || '',
    image: pendingImageDataUrl || null,
    timestamp: new Date().toISOString()
  };

  if (socket && socket.connected) {
    socket.emit('private_message', msg);
    // Do NOT append locally; wait for server echo to avoid double texting
  } else {
    fetch(`${CHAT_SERVER_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : '',
        'X-Chat-User': myUsername
      },
      body: JSON.stringify({ receiver: currentChatUser, content, image: pendingImageDataUrl })
    })
      .then(() => appendMessage(msg, true))
      .catch(() => showNotice('Message failed. Check server.', 'var(--red)'));
  }
  // Always touch recents and update list on send
  touchRecentDM(currentChatUser);
  renderUserList();
  if (input) input.value = '';
  clearImagePreview();
  scrollToBottom();
  autoResizeTextarea();
}

// ─── APPEND MESSAGE ───────────────────────────────────────────
function appendMessage(msg, isMine) {
  const area = document.getElementById('messagesArea');
  if (!area) return;

  // Remove empty-state notice if present
  const notice = area.querySelector('.transient-notice');
  if (notice) notice.remove();

  const userObj = allUsers.find(u => u.username === msg.sender) || { username: msg.sender };

  const div = document.createElement('div');
  div.className = 'message ' + (isMine ? 'me' : 'them');

  // Avatar (only for others)
  if (!isMine) {
    const av = document.createElement('img');
    av.className = 'msg-avatar';
    av.src = userObj.avatar || DEFAULT_AVATAR;
    av.onerror = () => { av.src = DEFAULT_AVATAR; };
    div.appendChild(av);
  }

  const body = document.createElement('div');
  body.className = 'msg-body';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  // Text content
  if (msg.content) {
    const text = document.createElement('span');
    text.textContent = msg.content;
    bubble.appendChild(text);
  }

  // Image attachment
  if (msg.image) {
    const img = document.createElement('img');
    img.className = 'msg-image';
    img.src = msg.image;
    img.alt = 'attachment';
    img.onclick = () => window.open(msg.image, '_blank');
    bubble.appendChild(img);
  }

  // GIF
  if (msg.gif) {
    const gif = document.createElement('img');
    gif.className = 'msg-gif';
    gif.src = msg.gif;
    gif.alt = 'GIF';
    bubble.appendChild(gif);
  }

  body.appendChild(bubble);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = (isMine ? 'You' : (userObj.displayName || msg.sender)) + ' · ' + formatTime(msg.timestamp);
  body.appendChild(meta);

  div.appendChild(body);
  area.appendChild(div);
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  const area = document.getElementById('messagesArea');
  if (area) area.scrollTop = area.scrollHeight;
}

// ─── TYPING INDICATOR ─────────────────────────────────────────
function showTypingIndicator(user) {
  const el = document.getElementById('typingIndicator');
  const txt = document.getElementById('typingText');
  if (!el) return;
  if (txt) {
    const u = allUsers.find(x => x.username === user);
    txt.textContent = (u ? u.displayName : user) + ' is typing…';
  }
  el.style.display = 'flex';
  if (typingIndicatorTimeout) clearTimeout(typingIndicatorTimeout);
  typingIndicatorTimeout = setTimeout(() => { el.style.display = 'none'; }, 2500);
}

// ─── IMAGE ATTACHMENT ─────────────────────────────────────────
document.getElementById('imageFileInput').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    pendingImageDataUrl = e.target.result;
    const preview = document.getElementById('imagePreview');
    const wrap = document.getElementById('imagePreviewWrap');
    preview.src = pendingImageDataUrl;
    wrap.style.display = 'flex';
  };
  reader.readAsDataURL(file);
  this.value = '';
});

document.getElementById('removeImageBtn').addEventListener('click', clearImagePreview);

function clearImagePreview() {
  pendingImageDataUrl = null;
  document.getElementById('imagePreview').src = '';
  document.getElementById('imagePreviewWrap').style.display = 'none';
}

// ─── GIF PICKER ───────────────────────────────────────────────
const TENOR_KEY = 'AIzaSyAHwMvhpSwKQMLmx7JMBKmikCqq3mXvRHc'; // public demo key

document.getElementById('gifToggleBtn').addEventListener('click', () => {
  const picker = document.getElementById('gifPicker');
  const emojiPicker = document.getElementById('emojiPicker');
  emojiPicker.classList.remove('open');
  picker.classList.toggle('open');
  if (picker.classList.contains('open')) {
    document.getElementById('gifSearch').focus();
    loadGifs('hello');
  }
});

document.getElementById('gifSearch').addEventListener('input', debounce(function () {
  loadGifs(this.value || 'hello');
}, 400));

function loadGifs(query) {
  const results = document.getElementById('gifResults');
  results.innerHTML = '<span style="color:var(--text-muted);font-size:0.9em;padding:10px;">Loading…</span>';
  fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=12&media_filter=gif`)
    .then(r => r.json())
    .then(data => {
      results.innerHTML = '';
      (data.results || []).forEach(item => {
        const url = item.media_formats?.gif?.url || item.media_formats?.tinygif?.url;
        if (!url) return;
        const div = document.createElement('div');
        div.className = 'gif-item';
        const img = document.createElement('img');
        img.src = item.media_formats?.tinygif?.url || url;
        img.alt = item.content_description || 'GIF';
        div.appendChild(img);
        div.onclick = () => sendGif(url);
        results.appendChild(div);
      });
      if (!results.children.length) {
        results.innerHTML = '<span style="color:var(--text-muted);font-size:0.9em;padding:10px;">No results.</span>';
      }
    })
    .catch(() => {
      results.innerHTML = '<span style="color:var(--red);font-size:0.9em;padding:10px;">Failed to load GIFs.</span>';
    });
}

function sendGif(url) {
  if (!currentChatUser) { showNotice('Select a user first.', 'var(--yellow)'); return; }
  document.getElementById('gifPicker').classList.remove('open');
  const msg = {
    sender: myUsername,
    receiver: currentChatUser,
    content: '',
    gif: url,
    timestamp: new Date().toISOString()
  };
  if (socket && socket.connected) socket.emit('private_message', msg);
  appendMessage(msg, true);
  scrollToBottom();
}

// ─── EMOJI PICKER ─────────────────────────────────────────────
const EMOJIS = ['😀','😂','🥰','😎','🤔','😭','🔥','👀','💀','🙏','👍','❤️','✨','🎉','😤','🥲','😈','💯','🫡','👏','🤣','😅','🫶','💪','🤯','😴','🤡','👋','🙄','😬'];

const emojiPicker = document.getElementById('emojiPicker');
EMOJIS.forEach(em => {
  const btn = document.createElement('button');
  btn.className = 'emoji-btn';
  btn.textContent = em;
  btn.onclick = () => {
    const input = document.getElementById('chatInput');
    if (input) {
      input.value += em;
      input.focus();
    }
    emojiPicker.classList.remove('open');
  };
  emojiPicker.appendChild(btn);
});

document.getElementById('emojiToggleBtn').addEventListener('click', () => {
  document.getElementById('gifPicker').classList.remove('open');
  emojiPicker.classList.toggle('open');
});

// Close pickers on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('#gifPicker') && !e.target.closest('#gifToggleBtn'))
    document.getElementById('gifPicker').classList.remove('open');
  if (!e.target.closest('#emojiPicker') && !e.target.closest('#emojiToggleBtn'))
    emojiPicker.classList.remove('open');
});

// ─── INPUT EVENTS ─────────────────────────────────────────────
document.getElementById('sendBtn').addEventListener('click', sendMessage);

document.getElementById('chatInput').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  } else if (currentChatUser && socket) {
    if (typingTimeout) clearTimeout(typingTimeout);
    socket.emit('typing', { to: currentChatUser, from: myUsername });
    typingTimeout = setTimeout(() => {}, 1500);
  }
});

document.getElementById('chatInput').addEventListener('input', autoResizeTextarea);

function autoResizeTextarea() {
  const ta = document.getElementById('chatInput');
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
}

// ─── STATUS SELECT ────────────────────────────────────────────
document.getElementById('statusSelect').addEventListener('change', function () {
  const status = this.value;
  if (socket) socket.emit('set_status', { username: myUsername, status });
  const dot = document.getElementById('myStatusDot');
  const label = document.getElementById('myStatusLabel');
  const colors = { online: 'var(--green)', away: 'var(--yellow)', dnd: 'var(--red)' };
  const labels = { online: 'Online', away: 'Away', dnd: 'Do Not Disturb' };
  if (dot) dot.style.background = colors[status] || 'var(--text-dim)';
  if (label) label.textContent = labels[status] || status;
});

// ─── SEARCH ───────────────────────────────────────────────────
document.getElementById('userSearchInput').addEventListener('input', function () {
  userSearch = this.value;
  renderUserList();
});

// ─── LOAD USERS ───────────────────────────────────────────────
fetch(`${CHAT_SERVER_URL}/api/users`)
  .then(r => r.json())
  .then(users => {
    allUsers = users;
    // If we have a locally updated avatar, use it for self
    const localAvatar = localStorage.getItem('profileAvatar');
    if (localAvatar) {
      const idx = allUsers.findIndex(u => u.username === myUsername);
      if (idx !== -1) allUsers[idx].avatar = localAvatar;
    }
    renderUserList();

    // Auto-select from ?user= param
    const preselectUser = new URL(window.location.href).searchParams.get('user');
    if (preselectUser && preselectUser !== myUsername) {
      const li = document.createElement('li');
      li.style.display = 'none';
      document.getElementById('userList').appendChild(li);
      selectUser(preselectUser, li);
    }
  })
  .catch(() => showNotice('Could not load users.', 'var(--yellow)'));

// ─── HELPERS ──────────────────────────────────────────────────
function showNotice(text, color) {
  const area = document.getElementById('messagesArea');
  if (!area) return;
  const el = document.createElement('div');
  el.className = 'transient-notice';
  el.style.color = color || 'var(--accent)';
  el.textContent = text;
  area.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function saveUnread() {
  localStorage.setItem('chatUnreadCounts', JSON.stringify(unreadCounts));
}

function viewProfile() {
  if (currentChatUser) window.location.href = `profile.html?user=${encodeURIComponent(currentChatUser)}`;
}

function debounce(fn, delay) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  };
}
