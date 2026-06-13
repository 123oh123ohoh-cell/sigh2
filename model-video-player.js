// Start fetching video data immediately — before DOMContentLoaded — so the
// network round-trip overlaps with remaining HTML parsing.
const _vpParams = new URLSearchParams(window.location.search);
const _vpId = _vpParams.get('id');

const _videoPromise = _vpId
  ? fetch(`/api/videos/${_vpId}`).then(r => r.json()).catch(() => null)
  : Promise.resolve(null);

const _recPromise = _vpId
  ? fetch(`/api/videos/recommended/${_vpId}`).then(r => r.json()).catch(() => [])
  : Promise.resolve([]);

const _commentsPromise = _vpId
  ? fetch(`/api/comments/${_vpId}`).then(r => r.json()).catch(() => [])
  : Promise.resolve([]);

document.addEventListener('DOMContentLoaded', async function () {
  const videoId = _vpId;
  if (!videoId) {
    const box = document.querySelector('.ph-video-box');
    if (box) box.innerHTML = '<p style="color:red">No video selected.</p>';
    return;
  }

  const [video, rec, comments] = await Promise.all([_videoPromise, _recPromise, _commentsPromise]);

  if (!video || !video.url) {
    const box = document.querySelector('.ph-video-box');
    if (box) box.innerHTML = '<p style="color:red">Video not found.</p>';
    return;
  }

  const mainVideo = document.getElementById('mainVideo');
  mainVideo.src = video.url;
  mainVideo.poster = video.thumbnail || '';
  mainVideo.load();
  mainVideo.play().catch(() => {});

  document.getElementById('videoTitle').textContent = video.title || 'Untitled';
  document.getElementById('videoCreator').textContent = video.creator || 'Unknown';
  document.getElementById('videoLikes').textContent = `👍 ${video.likes || 0}`;
  document.getElementById('creatorAvatar').src = video.avatar || 'logos_and_profileicons/defaultpfp.webp';
  document.getElementById('videoDescription').textContent = video.description || 'No description.';

  let tags = video.tags || [];
  if (typeof tags === 'string') tags = tags.split(',').map(t => t.trim());
  const tagsDiv = document.getElementById('videoTags');
  tagsDiv.innerHTML = '';
  tags.forEach(tag => {
    if (tag) {
      const span = document.createElement('span');
      span.textContent = tag;
      tagsDiv.appendChild(span);
    }
  });

  // Recommended videos
  const recDiv = document.getElementById('recommendedVideos');
  recDiv.innerHTML = '';
  rec.forEach(v => {
    const el = document.createElement('div');
    el.className = 'ph-rec-card';
    el.innerHTML =
      `<img src="${v.thumbnail}" alt="${v.title}" class="ph-rec-thumb">` +
      `<div class="ph-rec-info">` +
        `<div class="ph-rec-title">${v.title}</div>` +
        `<div class="ph-rec-meta"><span class="ph-rec-uploader">${v.creator || ''}</span><span class="ph-rec-duration">${v.duration || ''}</span></div>` +
      `</div>`;
    el.onclick = () => { window.location = `video-player.html?id=${v.id}`; };
    recDiv.appendChild(el);
  });

  // Comments (already fetched in parallel)
  renderComments(comments);

  // Post comment
  document.getElementById('commentForm').onsubmit = async function (e) {
    e.preventDefault();
    const text = document.getElementById('commentInput').value.trim();
    if (!text) return;
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, text })
    });
    document.getElementById('commentInput').value = '';
    const fresh = await fetch(`/api/comments/${videoId}`).then(r => r.json()).catch(() => []);
    renderComments(fresh);
  };
});

function renderComments(comments) {
  const cDiv = document.getElementById('comments');
  cDiv.innerHTML = comments.map(c =>
    `<div class="comment-row" style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;">
      <img src="${c.avatar || 'logos_and_profileicons/defaultpfp.webp'}" alt="pfp" style="width:38px;height:38px;border-radius:50%;object-fit:cover;">
      <div>
        <div style="color:#ffd700;font-weight:700;">${c.username || 'Anon'} <span style="color:#aaa;font-size:0.9em;font-weight:400;margin-left:8px;">${c.timestamp || ''}</span></div>
        <div style="color:#fff;">${c.text}</div>
      </div>
    </div>`
  ).join('');
}
