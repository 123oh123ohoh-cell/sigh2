// Handles model video player page logic
// Expects ?id=VIDEO_ID in URL

document.addEventListener('DOMContentLoaded', async function() {
	const urlParams = new URLSearchParams(window.location.search);
	const videoId = urlParams.get('id');
	if (!videoId) {
		document.querySelector('.video-player-box').innerHTML = '<p style="color:red">No video selected.</p>';
		return;
	}

	// Fetch video info
	let video = await fetch(`/api/videos/${videoId}`).then(r=>r.json()).catch(()=>null);
	if (!video || !video.url) {
		document.querySelector('.video-player-box').innerHTML = '<p style="color:red">Video not found.</p>';
		return;
	}
	document.getElementById('mainVideo').src = video.url;
	document.getElementById('mainVideo').poster = video.thumbnail || '';
	document.getElementById('videoTitle').textContent = video.title || 'Untitled';
	document.getElementById('videoCreator').textContent = video.creator || 'Unknown';
	document.getElementById('videoLikes').textContent = `${video.likes||0} Likes`;
	document.getElementById('creatorAvatar').src = video.avatar || 'logos_and_profileicons/defaultpfp.webp';
	document.getElementById('videoDescription').textContent = video.description || 'No description.';
	// Tags (array or comma string)
	let tags = video.tags || [];
	if (typeof tags === 'string') tags = tags.split(',').map(t=>t.trim());
	const tagsDiv = document.getElementById('videoTags');
	tagsDiv.innerHTML = '';
	tags.forEach(tag => {
		if(tag) {
			const span = document.createElement('span');
			span.textContent = tag;
			tagsDiv.appendChild(span);
		}
	});

	// Recommended videos
	let rec = await fetch(`/api/videos/recommended/${videoId}`).then(r=>r.json()).catch(()=>[]);
	const recDiv = document.getElementById('recommendedVideos');
	recDiv.innerHTML = '';
	rec.forEach(v => {
		const el = document.createElement('div');
		el.className = 'rec-video-card';
		el.style.cursor = 'pointer';
		el.innerHTML = `<img src="${v.thumbnail}" alt="${v.title}" style="width:100%;border-radius:10px;object-fit:cover;max-height:110px;">`
			+ `<div style='color:#ffd700;font-weight:700;margin-top:6px;'>${v.title}</div>`;
		el.onclick = () => window.location = `model-video-player.html?id=${v.id}`;
		recDiv.appendChild(el);
	});

	// Comments
	async function loadComments() {
		let comments = await fetch(`/api/comments/${videoId}`).then(r=>r.json()).catch(()=>[]);
		const cDiv = document.getElementById('comments');
		cDiv.innerHTML = comments.map(c =>
			`<div class='comment-row' style='display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;'>
				<img src='${c.avatar||'logos_and_profileicons/defaultpfp.webp'}' alt='pfp' style='width:38px;height:38px;border-radius:50%;object-fit:cover;'>
				<div>
					<div style='color:#ffd700;font-weight:700;'>${c.username||'Anon'} <span style='color:#aaa;font-size:0.9em;font-weight:400;margin-left:8px;'>${c.timestamp||''}</span></div>
					<div style='color:#fff;'>${c.text}</div>
				</div>
			</div>`
		).join('');
	}
	loadComments();

	// Post comment
	document.getElementById('commentForm').onsubmit = async function(e) {
		e.preventDefault();
		const text = document.getElementById('commentInput').value.trim();
		if (!text) return;
		await fetch('/api/comments', {
			method: 'POST',
			headers: {'Content-Type':'application/json'},
			body: JSON.stringify({ videoId, text })
		});
		document.getElementById('commentInput').value = '';
		loadComments();
	};
});
