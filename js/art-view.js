// art-view.js
// Loads and displays a single art piece by ID from the URL

function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

async function loadArt() {
    const artId = getQueryParam('id');
    if (!artId) {
        document.getElementById('artViewContainer').innerHTML = '<p>Art not found.</p>';
        return;
    }
    try {
        const res = await fetch('https://ownshub.onrender.com/api/arts/' + encodeURIComponent(artId));
        if (!res.ok) throw new Error('Not found');
        const art = await res.json();
        document.getElementById('artViewImage').src = art.image;
        document.getElementById('artViewTitle').textContent = art.title;
        document.getElementById('artViewDesc').textContent = art.description || '';
        document.getElementById('artViewDate').textContent = art.date;

        // Fetch artist info for avatar and display name
        let artistHtml = '';
        try {
            const profileRes = await fetch('https://ownshub.onrender.com/api/profile?user=' + encodeURIComponent(art.username));
            let profile = await profileRes.json();
            if (!profile || Object.keys(profile).length === 0) {
                profile = { displayName: art.username, avatar: '' };
            }
            const avatar = profile.avatar ? `<img src="${profile.avatar}" alt="Avatar" style="width:48px;height:48px;border-radius:50%;vertical-align:middle;margin-right:10px;">` : '';
            artistHtml = `${avatar}<span style="vertical-align:middle;font-weight:bold;font-size:1.1em;">${profile.displayName || art.username}</span> <a href="public-profile.html?user=${encodeURIComponent(art.username)}" style="color:#ffb347;">@${art.username}</a>`;
        } catch {
            artistHtml = `<span style="font-weight:bold;">@${art.username}</span>`;
        }
        document.getElementById('artViewAuthor').innerHTML = artistHtml;

        // Show follow button if not own art
        const loggedInUser = localStorage.getItem('loggedInUser');
        if (loggedInUser && loggedInUser !== art.username) {
            document.getElementById('artViewAuthor').innerHTML += ` <button id="followBtn" style="background:#ffb347;color:#181818;padding:6px 18px;border:none;border-radius:6px;font-weight:700;cursor:pointer;">Follow</button>`;
            document.getElementById('followBtn').onclick = function() {
                alert('Follow feature coming soon!');
            };
        }

        // Show delete button if user owns the art
        if (loggedInUser && loggedInUser === art.username) {
            document.getElementById('artDeleteBtnContainer').innerHTML = '<button id="deleteArtBtn" style="background:#ff4d4d;color:#fff;padding:8px 24px;border:none;border-radius:6px;font-weight:700;cursor:pointer;margin-top:16px;">Delete Art</button>';
            document.getElementById('deleteArtBtn').onclick = async function() {
                if (confirm('Are you sure you want to delete this art?')) {
                    const token = localStorage.getItem('token');
                    const delRes = await fetch('https://ownshub.onrender.com/api/arts/' + encodeURIComponent(artId), {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    if (delRes.ok) {
                        alert('Art deleted.');
                        window.location.href = 'arts.html';
                    } else {
                        alert('Failed to delete art.');
                    }
                }
            };
        }
    } catch {
        document.getElementById('artViewContainer').innerHTML = '<p>Art not found.</p>';
    }
}

document.addEventListener('DOMContentLoaded', loadArt);
