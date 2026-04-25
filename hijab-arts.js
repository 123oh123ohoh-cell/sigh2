// hijab-arts.js
// Loads and displays only arts with category 'Hijab'

function renderHijabArtsGallery(arts) {
    const gallery = document.getElementById('artsGallery');
    if (!gallery) return;
    const hijabArts = arts.filter(a => a.category && a.category === 'Hijab');
    if (!hijabArts.length) {
        gallery.innerHTML = '<p style="color:#bbb;text-align:center;">No hijab art posted yet.</p>';
        return;
    }
    let html = '';
    hijabArts.forEach(art => {
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
    // No-op: logic moved to hijab-arts.html for unified fetch/post
});
