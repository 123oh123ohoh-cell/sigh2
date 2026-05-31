// Helper: show toast and notification for incoming messages
function showIncomingMsgToast(msg, chatId) {
   try {
      // Show toast
      toast('New message from ' + (msg.sender || msg.group || 'unknown'));
      // Browser notification
      if (window.Notification && Notification.permission === 'granted') {
         new Notification('New message', {
            body: (msg.sender ? msg.sender + ': ' : '') + msg.content,
            icon: msg.avatar || '/favicon.ico'
         });
      }
      // Play sound if available
      if (window.playNotificationSound) playNotificationSound();
      // Badge
      if (window.setAppBadge) setAppBadge(1);
   } catch (e) { /* ignore */ }
}
// ── ULTRA SMART: AVATAR POLLING, PRESENCE PREDICTION, READ RECEIPTS, ADAPTIVE UI ──

// 1. Poll for avatar updates every 10 minutes
setInterval(() => {
   allUsers.forEach(u => fetchAvatarSmart(u.username, u.email));
}, 10 * 60 * 1000);

// 2. Predict presence for users not reporting status (based on recent activity)
function predictPresence(username) {
   // If user sent/received a message in last 10 min, assume online
   const key = `chatHistory_${myUsername}_${username}`;
   const msgs = JSON.parse(localStorage.getItem(key) || '[]');
   if (!msgs.length) return 'offline';
   const last = msgs[msgs.length - 1];
   if (last && Date.now() - new Date(last.timestamp).getTime() < 10 * 60 * 1000) return 'online';
   return 'offline';
}
window.predictPresence = predictPresence;

// Patch statusColor/statusLabel to use prediction if missing
const origStatusColor = window.statusColor;
window.statusColor = function(username) {
   const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : predictPresence(username));
   return { online: '#3ecf8e', dnd: '#ff4d6d', away: '#fbbf24' }[st] || 'var(--text-3)';
};
const origStatusLabel = window.statusLabel;
window.statusLabel = function(username) {
   const st = userStatusMap[username] || (onlineUsers.has(username) ? 'online' : predictPresence(username));
   return { online: 'Online', dnd: 'Do Not Disturb', away: 'Away' }[st] || 'Offline';
};

// 3. Message read receipts (local only, demo)
function markMessagesRead(chatId) {
   const key = `chatHistory_${myUsername}_${chatId}`;
   const msgs = JSON.parse(localStorage.getItem(key) || '[]');
   msgs.forEach(m => { m.read = true; });
   localStorage.setItem(key, JSON.stringify(msgs));
   // Update UI
   if (chatHistoryCache[chatId]) {
      chatHistoryCache[chatId].forEach(m => { m.read = true; });
   }
   reloadMessages();
}
window.markMessagesRead = markMessagesRead;
// Mark as read when chat is opened
const origSelectUser = window.selectUser;
window.selectUser = async function(username) {
   if (origSelectUser) await origSelectUser(username);
   markMessagesRead(username);
};
const origSelectGroup = window.selectGroup;
window.selectGroup = async function(groupId) {
   if (origSelectGroup) await origSelectGroup(groupId);
   markMessagesRead(groupId);
};

// 4. Adaptive UI for slow connections
function isConnectionSlow() {
   return navigator.connection && (navigator.connection.downlink < 1 || navigator.connection.effectiveType === '2g');
}
function showSlowConnectionBanner() {
   if (!document.getElementById('slowConnBanner')) {
      const div = document.createElement('div');
      div.id = 'slowConnBanner';
      div.textContent = '⚠️ Slow connection detected. Some features may be limited.';
      div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#fbbf24;color:#222;padding:8px 0;text-align:center;z-index:2000;font-size:1em;';
      document.body.appendChild(div);
   }
}
function hideSlowConnectionBanner() {
   const div = document.getElementById('slowConnBanner');
   if (div) div.remove();
}
if (isConnectionSlow()) showSlowConnectionBanner();
if (navigator.connection) {
   navigator.connection.addEventListener('change', () => {
      if (isConnectionSlow()) showSlowConnectionBanner();
      else hideSlowConnectionBanner();
   });
}
// ── EVEN SMARTER: AVATAR CACHING, GRAVATAR FALLBACK, PREFETCH, HISTORY DIFF ──

// 1. Avatar caching and Gravatar fallback
const avatarCache = {};
function getGravatarUrl(emailOrUsername) {
   // Use email if available, else username as hash
   const hash = md5((emailOrUsername || '').trim().toLowerCase());
   return `https://www.gravatar.com/avatar/${hash}?d=identicon`;
}
function md5(str) {
   // Simple MD5 for Gravatar fallback (browser safe, not crypto-secure)
   return CryptoJS ? CryptoJS.MD5(str).toString() : '';
}
async function fetchAvatarSmart(username, email) {
   if (!username) return DEFAULT_AVATAR;
   if (avatarCache[username]) return avatarCache[username];
   let url = await fetchAvatar(username);
   if (!url || url === DEFAULT_AVATAR) {
      url = getGravatarUrl(email || username);
   }
   avatarCache[username] = url;
   return url;
}


// Patch makeUserLi to always use backend avatar if available, else DEFAULT_AVATAR (never Gravatar)
window.makeUserLi = function(u, isNew = false) {
   const li = origMakeUserLi ? origMakeUserLi(u, isNew) : (function() {
      const li = document.createElement('li');
      li.textContent = u.username;
      return li;
   })();
   fetchAvatar(u.username).then(avatarUrl => {
      const img = li.querySelector('.avatar');
      if (img) {
         img.onerror = () => { img.src = DEFAULT_AVATAR; };
         img.src = avatarUrl || DEFAULT_AVATAR;
      }
   });
   return li;
};

// When searching users, always fetch and show their profile picture if available
const origRenderUserList = window.renderUserList;
window.renderUserList = function() {
   if (origRenderUserList) origRenderUserList();
   // For all .list-item in #userList, ensure avatar loads with fallback
   const ul = document.getElementById('userList');
   if (!ul) return;
   ul.querySelectorAll('.list-item').forEach(li => {
      const name = li.querySelector('.item-name');
      if (!name) return;
      const username = name.textContent.replace(/^@/, '').split(' ')[0];
      fetchAvatar(username).then(avatarUrl => {
         const img = li.querySelector('.avatar');
         if (img) {
            img.onerror = () => { img.src = DEFAULT_AVATAR; };
            img.src = avatarUrl || DEFAULT_AVATAR;
         }
      });
   });
};

// 2. Prefetch avatars and chat history for likely contacts (top 5 recents)
async function prefetchLikelyContacts() {
   const recents = getRecents().slice(0, 5);
   for (const username of recents) {
      await fetchAvatarSmart(username);
      await loadMessages(username, false);
   }
}
if (document.readyState === 'complete' || document.readyState === 'interactive') {
   prefetchLikelyContacts();
} else {
   window.addEventListener('DOMContentLoaded', prefetchLikelyContacts);
}

// 3. Chat history diffing to avoid redundant loads
const chatHistoryCache = {};
async function loadMessagesSmart(chatId, isGroup) {
   const prev = chatHistoryCache[chatId];
   const msgs = await fetchMsgs(chatId, isGroup);
   if (!prev || JSON.stringify(prev) !== JSON.stringify(msgs)) {
      chatHistoryCache[chatId] = msgs;
      // Only reload UI if changed
      const area = document.getElementById('messagesArea');
      if (area) {
         area.innerHTML = '';
         msgs.forEach(appendMessage);
      }
   }
   return msgs;
}
window.loadMessages = loadMessagesSmart;

// 4. Load CryptoJS for MD5 if not present
if (typeof CryptoJS === 'undefined') {
   const script = document.createElement('script');
   script.src = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js';
   document.head.appendChild(script);
}
// ── SMARTER AVATAR & RECENT DMs/CHAT HISTORY LOADING ──

// 1. Fetch avatar from backend if not present locally
async function fetchAvatar(username) {
   if (!username) return;
   const user = allUsers.find(u => u.username === username);
   if (user && user.avatar) return user.avatar;
   try {
      const res = await fetch(`${CHAT_SERVER_URL}/api/users/${encodeURIComponent(username)}`, {
         headers: { 'Authorization': token ? 'Bearer ' + token : '' }
      });
      if (res.ok) {
         const data = await res.json();
         if (data.avatar) {
            // Update in-memory and UI
            let u = allUsers.find(u => u.username === username);
            if (u) u.avatar = data.avatar;
            else allUsers.push({ username, avatar: data.avatar });
            // Update avatar in chat header if current
            if (currentChatUser === username) {
               const chAvatar = document.getElementById('chAvatar');
               if (chAvatar) chAvatar.src = data.avatar;
            }
            return data.avatar;
         }
      }
   } catch (_) {}
   return DEFAULT_AVATAR;
}

// Patch makeUserLi to always call fetchAvatar and update avatar
const origMakeUserLi = window.makeUserLi;
window.makeUserLi = function(u, isNew = false) {
   const li = origMakeUserLi ? origMakeUserLi(u, isNew) : (function() {
      // fallback to original code if not found
      const li = document.createElement('li');
      li.textContent = u.username;
      return li;
   })();
   // Always try to fetch avatar
   fetchAvatar(u.username).then(avatarUrl => {
      const img = li.querySelector('.avatar');
      if (img && avatarUrl) img.src = avatarUrl;
   });
   return li;
};

// 2. On startup, fetch and display recent DMs and chat history
async function loadRecentDMsAndHistory() {
   // Fetch users for recents
   await fetchUsers();
   // Load recents
   const recents = getRecents();
   for (const username of recents) {
      await fetchAvatar(username);
      // Preload chat history for each recent DM
      await loadMessages(username, false);
   }
   renderUserList();
}
if (document.readyState === 'complete' || document.readyState === 'interactive') {
   loadRecentDMsAndHistory();
} else {
   window.addEventListener('DOMContentLoaded', loadRecentDMsAndHistory);
}
// ── ADVANCED ENHANCEMENTS ──

// 1. Offline message queueing (send when reconnected)
let offlineQueue = JSON.parse(localStorage.getItem('offlineMsgQueue') || '[]');
function queueMessage(msg, chatId, isGroup) {
   offlineQueue.push({ msg, chatId, isGroup });
   localStorage.setItem('offlineMsgQueue', JSON.stringify(offlineQueue));
   toast('Message queued (offline)');
}
function flushOfflineQueue() {
   if (!window.socket?.connected || !offlineQueue.length) return;
   offlineQueue.forEach(({ msg, chatId, isGroup }) => {
      if (isGroup) window.socket.emit('group_message', msg);
      else window.socket.emit('private_message', msg);
      saveMsgLocally(msg, chatId);
   });
   offlineQueue = [];
   localStorage.setItem('offlineMsgQueue', '[]');
   toast('Queued messages sent!');
}

if (window.socket) {
   window.socket.on('connect', flushOfflineQueue);
}


// (All message sending/receiving logic is now handled in chat3-copy.html)

// Ensure retry/cancel always works and errors are caught
window.appendMessage = function(msg) {
   try {
      origAppendMessage(msg);
      const area = document.getElementById('messagesArea');
      if (!area) return;
      const msgId = String(msg.id || msg.timestamp || '').replace(/[:.]/g, '-');
      const wrapper = area.querySelector(`[data-msg-id='${msgId}']`);
      if (wrapper) {
         let statusEl = wrapper.querySelector('.msg-status');
         if (!statusEl) {
            statusEl = document.createElement('span');
            statusEl.className = 'msg-status';
            wrapper.appendChild(statusEl);
         }
         if (msg.read) statusEl.textContent = 'Read';
         else if (msg.delivered) statusEl.textContent = 'Delivered';
         else if (msg.sent) statusEl.textContent = 'Sent';
         else statusEl.textContent = 'Failed';
         // Retry/cancel
         let retryBtn = wrapper.querySelector('.msg-retry');
         if (!retryBtn) {
            retryBtn = document.createElement('button');
            retryBtn.className = 'msg-retry';
            retryBtn.textContent = 'Retry';
            retryBtn.onclick = () => {
               try { sendMessageSmart(msg, msg.receiver || msg.group, !!msg.group); } catch (e) { toast('Retry failed: ' + (e.message || e)); }
            };
            wrapper.appendChild(retryBtn);
         }
         let cancelBtn = wrapper.querySelector('.msg-cancel');
         if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.className = 'msg-cancel';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = () => {
               try { removeMsgLocally(msg, msg.receiver || msg.group); wrapper.remove(); } catch (e) { toast('Cancel failed: ' + (e.message || e)); }
            };
            wrapper.appendChild(cancelBtn);
         }
      }
   } catch (err) {
      console.error('appendMessage error:', err);
      toast('Failed to update message UI: ' + (err.message || err));
   }
};

// Remove message from local history
function removeMsgLocally(msg, chatId) {
   const key = `chatHistory_${myUsername}_${chatId}`;
   let msgs = [];
   try {
      msgs = JSON.parse(safeGetItem(key) || '[]');
   } catch (e) {}
   msgs = msgs.filter(m => String(m.timestamp) !== String(msg.timestamp));
   try {
      safeSetItem(key, JSON.stringify(msgs));
   } catch (e) {}
   if (chatHistoryCache[chatId]) {
      chatHistoryCache[chatId] = chatHistoryCache[chatId].filter(m => String(m.timestamp) !== String(msg.timestamp));
   }
}

// Smarter offline detection and local echo for failed messages
window.addEventListener('offline', () => {
   toast('You are offline. Messages will be queued.');
});
window.addEventListener('online', () => {
   toast('You are back online. Queued messages will be sent.');
   flushOfflineQueue && flushOfflineQueue();
});

function updateMsgStatus(chatId, timestamp, status) {
   const key = `chatHistory_${myUsername}_${chatId}`;
   let msgs = [];
   try {
      msgs = JSON.parse(safeGetItem(key) || '[]');
   } catch (e) {}
   msgs.forEach(m => {
      if (String(m.timestamp) === String(timestamp)) {
         m[status] = true;
      }
   });
   try {
      safeSetItem(key, JSON.stringify(msgs));
   } catch (e) {}
   // Update UI
   if (chatHistoryCache[chatId]) {
      chatHistoryCache[chatId].forEach(m => {
         if (String(m.timestamp) === String(timestamp)) {
            m[status] = true;
         }
      });
   }
   reloadMessages && reloadMessages();
}
