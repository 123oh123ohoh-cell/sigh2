// sex-arts.js
// Loads and displays only arts with category 'Sex'

function renderSexArtsGallery(arts) {
    const gallery = document.getElementById('artsGallery');
    if (!gallery) return;
    const sexArts = arts.filter(a => a.category && a.category === 'Sex');
    if (!sexArts.length) {
        gallery.innerHTML = '<p style="color:#bbb;text-align:center;">No sex art posted yet.</p>';
        return;
    }
    let html = '';
    sexArts.forEach(art => {
        html += `<div class="arts-card">
            <img src="${art.image}" alt="${art.title}">
            <div class="title">${art.title}</div>
            <div class="author">by ${art.username}</div>
            <div class="desc">${art.description || ''}</div>
            <div class="date">${art.date}</div>
        </div>`;
    });
    gallery.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', function() {
    fetchAndRenderSexArts();
    showSexPostArtForm();
});

async function fetchAndRenderSexArts() {
    try {
        const res = await fetch('/api/arts');
        const arts = await res.json();
        renderSexArtsGallery(arts);
    } catch {
        document.getElementById('artsGallery').innerHTML = '<p style="color:#bbb;text-align:center;">Failed to load arts.</p>';
    }
}

function showSexPostArtForm() {
    const container = document.getElementById('postArtContainer');
    if (!container) return;
    const loggedInUser = localStorage.getItem('loggedInUser');
    const token = localStorage.getItem('token');
    if (!loggedInUser || !token) {
        container.innerHTML = '<p style="color:#bbb;">Log in to post your sex art!</p>';
        return;
    }
    container.innerHTML = `
        <form id="postSexArtForm" style="background:#222;padding:18px 18px 12px 18px;border-radius:12px;display:inline-block;max-width:340px;">
            <div style="margin-bottom:10px;font-weight:bold;color:#ffb347;">Post Your Sex Art</div>
            <input type="file" id="sexArtImage" accept="image/*" required style="margin-bottom:10px;width:100%;">
            <input type="text" id="sexArtTitle" placeholder="Title" maxlength="40" required style="margin-bottom:10px;width:100%;padding:6px 8px;">
            <textarea id="sexArtDesc" placeholder="Description (optional)" maxlength="120" rows="2" style="margin-bottom:10px;width:100%;padding:6px 8px;"></textarea>
            <button type="submit" style="background:linear-gradient(90deg,#ffb347 0%,#ffcc80 100%);color:#181818;padding:8px 24px;border:none;border-radius:6px;font-weight:700;cursor:pointer;">Post Art</button>
        </form>
    `;
    document.getElementById('postSexArtForm').onsubmit = async function(e) {
        e.preventDefault();
        const imgInput = document.getElementById('sexArtImage');
        const title = document.getElementById('sexArtTitle').value.trim();
        const desc = document.getElementById('sexArtDesc').value.trim();
        if (!imgInput.files[0]) return alert('Please select an image.');
        const reader = new FileReader();
        reader.onload = async function(evt) {
            const image = evt.target.result;
            try {
                const res = await fetch('/api/arts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ image, title, description: desc, category: 'Sex' })
                });
                const data = await res.json();
                if (res.ok && data.id) {
                    await fetchAndRenderSexArts();
                    document.getElementById('postSexArtForm').reset();
                    alert('Sex art posted!');
                } else {
                    alert(data.error || 'Failed to post art.');
                }
            } catch {
                alert('Failed to post art.');
            }
        };
        reader.readAsDataURL(imgInput.files[0]);
    };
}
