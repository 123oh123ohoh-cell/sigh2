// --- Arts Section Logic ---

function renderArtsGallery(arts) {
    const gallery = document.getElementById('artsGallery');
    if (!gallery) return;
    if (!arts.length) {
        gallery.innerHTML = '<p style="color:#bbb;text-align:center;">No art posted yet.</p>';
        return;
    }
    // Always use backend data, but also sync to localStorage for offline/refresh support
    localStorage.setItem('arts', JSON.stringify(arts));
    const loggedInUser = localStorage.getItem('loggedInUser');
    const token = localStorage.getItem('token');
    let userPremiumTier = '';
    // Synchronously fetch own premiumTier from backend if logged in
    if (loggedInUser && token) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/profile', false);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        try {
            xhr.send();
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                userPremiumTier = data.premiumTier;
            }
        } catch {}
    }
    // Group arts by category
    const categories = [
        { key: 'Originals', label: 'Originals' },
        { key: 'Hijab', label: 'Hijab' },
        { key: 'Anime', label: 'Anime' }
    ];
    let html = '';
    categories.forEach((cat, idx) => {
        let catArts;
        if (cat.key === 'Originals') {
            // Show arts with category 'Originals' or missing/empty category (legacy data)
            catArts = arts.filter(a => !a.category || a.category.trim() === '' || a.category === 'Originals');
        } else {
            catArts = arts.filter(a => a.category === cat.key);
        }
        // Always show the category header, even if empty
        html += `
        <div style="width:100%;max-width:1100px;margin:0 auto 0 auto;">
            <h3 style="color:#ffb347;text-align:center;margin:48px 0 8px 0;font-size:1.7em;font-weight:800;letter-spacing:0.5px;">${cat.label}</h3>
            <hr style="border:0;border-top:2px solid #333;margin:0 auto 24px auto;width:60vw;">
            <div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center;align-items:center;min-height:60px;">`;
        if (catArts.length) {
            html += catArts.map(art => {
                let deleteBtn = '';
                if (loggedInUser && loggedInUser === art.username) {
                    deleteBtn = `<button class="delete-art-btn" data-artid="${art.id}" style="background:#ff4d4d;color:#fff;padding:6px 18px;border:none;border-radius:6px;font-weight:700;cursor:pointer;margin-top:10px;">Delete</button>`;
                }
                // Show premium badge if this is the logged-in user and they have premium (from backend)
                let premiumBadge = '';
                if (loggedInUser && art.username === loggedInUser && userPremiumTier) {
                    let color = '#ffd700';
                    if (userPremiumTier === 'Silver') color = '#c0c0c0';
                    if (userPremiumTier === 'Bronze') color = '#cd7f32';
                    premiumBadge = `<span style="margin-left:6px;padding:2px 8px;border-radius:8px;background:${color};color:#181818;font-size:0.85em;font-weight:bold;vertical-align:middle;">${userPremiumTier} Premium</span>`;
                }
                return `
                <div class="arts-card" style="background:#222;border-radius:12px;padding:16px;width:220px;box-shadow:0 2px 12px rgba(0,0,0,0.12);display:flex;flex-direction:column;align-items:center;">
                    <a href="art-view.html?id=${art.id}" style="display:block;"><img src="${art.image}" alt="Art" style="width:180px;height:180px;object-fit:cover;border-radius:8px;background:#333;cursor:pointer;"></a>
                    <div style="margin-top:10px;font-weight:bold;color:#ffb347;">${art.title}</div>
                    <div style="font-size:0.98em;color:#bbb;margin:4px 0 6px 0;">by <a href="public-profile.html?user=${encodeURIComponent(art.username)}" style="color:#ffb347;">@${art.username}</a> ${premiumBadge}</div>
                    <div style="font-size:0.97em;color:#eee;min-height:32px;text-align:center;">${art.description || ''}</div>
                    <div style="font-size:0.85em;color:#888;margin-top:6px;">${art.date}</div>
                    ${deleteBtn}
                </div>
                `;
            }).join('');
        } else {
            html += `<div style='color:#888;font-size:1.13em;text-align:center;width:100%;margin:18px 0 10px 0;font-weight:500;display:block;'>No art in this category yet.</div>`;
        }
        html += '</div></div>';
        // Add extra space between categories except after the last one
        if (idx < categories.length - 1) {
            html += `<div style='height:48px;'></div>`;
        }
    });
    gallery.innerHTML = html || '<p style="color:#bbb;text-align:center;">No art posted yet.</p>';
    // Add delete button event listeners
    document.querySelectorAll('.delete-art-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to delete this art?')) {
                const artId = btn.getAttribute('data-artid');
                const token = localStorage.getItem('token');
                try {
                    const res = await fetch('https://sigh2.onrender.com/api/arts/' + encodeURIComponent(artId), {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    if (res.ok) {
                        // Remove from localStorage if present (for any local cache)
                        let localArts = [];
                        try {
                            localArts = JSON.parse(localStorage.getItem('arts') || '[]');
                        } catch {}
                        const newLocalArts = localArts.filter(a => a.id != artId);
                        localStorage.setItem('arts', JSON.stringify(newLocalArts));
                        alert('Art deleted.');
                        fetchAndRenderArts();
                    } else {
                        alert('Failed to delete art.');
                    }
                } catch {
                    alert('Failed to delete art.');
                }
            }
        });
    });
}

async function fetchAndRenderArts() {
    try {
        const res = await fetch('https://sigh2.onrender.com/api/arts');
        const arts = await res.json();
        // Sync backend data to localStorage
        localStorage.setItem('arts', JSON.stringify(arts));
        renderArtsGallery(arts);
    } catch {
        // If backend fails, try to use localStorage data
        let localArts = [];
        try {
            localArts = JSON.parse(localStorage.getItem('arts') || '[]');
        } catch {}
        renderArtsGallery(localArts);
    }
}

function showPostArtForm() {
    const container = document.getElementById('postArtContainer');
    if (!container) return;
    const loggedInUser = localStorage.getItem('loggedInUser');
    const token = localStorage.getItem('token');
    if (!loggedInUser || !token) {
        container.innerHTML = '<p style="color:#bbb;">Log in to post your art!</p>';
        return;
    }
    container.innerHTML = `
        <form id="postArtForm" style="background:#222;padding:18px 18px 12px 18px;border-radius:12px;display:inline-block;max-width:340px;">
            <div style="margin-bottom:10px;font-weight:bold;color:#ffb347;">Post Your Art</div>
            <input type="file" id="artImage" accept="image/*" required style="margin-bottom:10px;width:100%;">
            <input type="text" id="artTitle" placeholder="Title" maxlength="40" required style="margin-bottom:10px;width:100%;padding:6px 8px;">
            <textarea id="artDesc" placeholder="Description (optional)" maxlength="120" rows="2" style="margin-bottom:10px;width:100%;padding:6px 8px;"></textarea>
            <select id="artCategory" required style="margin-bottom:10px;width:100%;padding:6px 8px;border-radius:6px;border:1px solid #444;background:#181818;color:#fff;">
                <option value="">Select Category</option>
                <option value="Originals">Originals</option>
                <option value="Hijab">Hijab</option>
                <option value="Anime">Anime</option>
            </select>
            <button type="submit" style="background:linear-gradient(90deg,#ffb347 0%,#ffcc80 100%);color:#181818;padding:8px 24px;border:none;border-radius:6px;font-weight:700;cursor:pointer;">Post Art</button>
        </form>
    `;
    document.getElementById('postArtForm').onsubmit = async function(e) {
        e.preventDefault();
        const imgInput = document.getElementById('artImage');
        const title = document.getElementById('artTitle').value.trim();
        const desc = document.getElementById('artDesc').value.trim();
        const category = document.getElementById('artCategory').value;
        if (!imgInput.files[0]) return alert('Please select an image.');
        if (!category) return alert('Please select a category.');
        const reader = new FileReader();
        reader.onload = async function(evt) {
            const image = evt.target.result;
            try {
                // Always send the selected category, and trim whitespace
                const res = await fetch('/api/arts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ image, title, description: desc, category: category.trim() })
                });
                const data = await res.json();
                if (res.ok && data.id) {
                    // Dynamically update arts gallery after posting
                    await fetchAndRenderArts();
                    document.getElementById('postArtForm').reset();
                    alert('Art posted!');
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

document.addEventListener('DOMContentLoaded', function() {
    fetchAndRenderArts();
    showPostArtForm();
});
