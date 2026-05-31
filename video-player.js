// Handles video player page logic
// Expects ?id=VIDEO_ID in URL

document.addEventListener('DOMContentLoaded', async function() {
  // Top nav bar dropdown/profile logic (copied from index.html)
  try {
    const username = localStorage.getItem('loggedInUser');
    if (username) {
      let avatar = null;
      let sources = [
        localStorage.getItem('profileAvatar:' + username.toLowerCase()),
        sessionStorage.getItem('profileAvatar:' + username.toLowerCase())
      ];
      try {
        let last = JSON.parse(localStorage.getItem('lastSavedProfile'));
        if (last && last.avatar && last.avatar.startsWith('data:image/')) sources.push(last.avatar);
      } catch {}
      try {
        let last = JSON.parse(sessionStorage.getItem('lastSavedProfile'));
        if (last && last.avatar && last.avatar.startsWith('data:image/')) sources.push(last.avatar);
      } catch {}
      if (typeof getUserProfile === 'function') {
        try {
          let userjs = getUserProfile(username);
          if (userjs && userjs.avatar && userjs.avatar.startsWith('data:image/')) sources.push(userjs.avatar);
        } catch {}
      }
      avatar = sources.find(a => a && a.startsWith('data:image/'));
      if (avatar) {
        var navIcon = document.getElementById('profileAvatarIcon');
        if (navIcon) {
          navIcon.src = avatar;
          navIcon.style.display = '';
          var fallback = document.getElementById('profileAvatarFallback');
          if (fallback) fallback.style.display = 'none';
        }
      }
    }
  } catch {}

  // Video logic
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('id');
  if (!videoId) {
    const main = document.querySelector('.ph-content') || document.getElementById('videoSection');
    if (main) main.innerHTML = '<p style="color:red">No video selected.</p>';
    return;
  }

  // Use local mock data for demo
  let video = null;
  if (window.videos) {
    video = window.videos.find(v => v.id == videoId || v.id === videoId);
  }
  if (!video) {
    try {
      let mod = await import('./video-mock-data.js');
      if (mod && mod.videos) video = mod.videos.find(v => v.id == videoId || v.id === videoId);
    } catch {}
  }
  if (!video) {
    const main = document.querySelector('.ph-content') || document.getElementById('videoSection');
    if (main) main.innerHTML = '<p style="color:red">Video not found.</p>';
    return;
  }
  var mainVideo = document.getElementById('mainVideo');
  if (mainVideo) {
    mainVideo.src = video.url;
    mainVideo.autoplay = true;
    mainVideo.load();
    mainVideo.play().catch(()=>{});
  }
  document.getElementById('videoTitle').textContent = video.title || 'Untitled';
  document.getElementById('videoCreator').textContent = video.creator || 'Unknown';
  document.getElementById('videoLikes').textContent = `👍 ${video.likes||0}`;

  // Recommended videos (show more, sidebar card style)
  let rec = [];
  if (window.videos) {
    rec = window.videos.filter(v => v.id !== videoId && v.id != videoId).slice(0, 6);
  }
  const recDiv = document.getElementById('recommendedVideos');
  if (recDiv) {
    recDiv.innerHTML = '';
    rec.forEach(v => {
      const el = document.createElement('div');
      el.className = 'ph-rec-card';
      el.innerHTML = `
        <img src="${v.thumbnail}" alt="${v.title}" class="ph-rec-thumb">
        <div class="ph-rec-info">
          <div class="ph-rec-title">${v.title}</div>
          <div class="ph-rec-meta">
            <span class="ph-rec-uploader">${v.creator||'Unknown'}</span>
            <span class="ph-rec-views">${v.views||'0'} views</span>
            <span class="ph-rec-badge">${v.badge||'HD'}</span>
          </div>
          <span class="ph-rec-duration">${v.duration||'--:--'}</span>
        </div>
      `;
      el.onclick = () => window.location = `video-player.html?id=${v.id}`;
      recDiv.appendChild(el);
    });
  }

  // Comments
  async function loadComments() {
    let comments = [];
    const cDiv = document.getElementById('comments');
    if (cDiv) cDiv.innerHTML = comments.map(c => `<div style='margin-bottom:10px;'><b style='color:#ffd700;'>${c.username||'Anon'}</b>: <span style='color:#fff;'>${c.text}</span></div>`).join('');
  }
  loadComments();

  // Post comment
  const commentForm = document.getElementById('commentForm');
  if (commentForm) commentForm.onsubmit = async function(e) {
    e.preventDefault();
    const text = document.getElementById('commentInput').value.trim();
    if (!text) return;
    // No-op for demo
  };
      body: JSON.stringify({ videoId, text })
    });
    document.getElementById('commentInput').value = '';
    loadComments();
  };
});
