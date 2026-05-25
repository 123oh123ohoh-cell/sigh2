// --- User Auth & Comments Logic ---

function detectLoginDevice() {
    const ua = navigator.userAgent || '';
    // iPadOS 13+ can report as MacIntel, so include a touch-point fallback.
    const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMobilePhone = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isTablet = /Tablet|PlayBook|Silk/i.test(ua) || isIPad;

    let deviceType = 'desktop';
    if (isIPad) deviceType = 'ipad';
    else if (isTablet) deviceType = 'tablet';
    else if (isMobilePhone) deviceType = 'mobile';

    return {
        deviceType,
        isIPad,
        isMobile: isMobilePhone,
        userAgent: ua
    };
}

// User registration (backend)
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = document.getElementById('signupUsername').value.trim();
        const password = document.getElementById('signupPassword').value;
        if (!username || !password) return alert('Please fill all fields.');
        try {
            const res = await fetch('https://ownshub.onrender.com/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) return alert(data.error || 'Signup failed');
            localStorage.setItem('token', data.token);
            localStorage.setItem('loggedInUser', data.username);
            alert('Account created! You are now logged in.');
            window.location.href = 'index.html';
        } catch (err) {
            alert('Signup failed. Backend not reachable?');
        }
    });
}

// User login (backend)
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const loginDevice = detectLoginDevice();
        try {
            const res = await fetch('https://ownshub.onrender.com/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, loginDevice })
            });
            const data = await res.json();
            if (!res.ok) return alert(data.error || 'Login failed');
            localStorage.setItem('token', data.token);
            localStorage.setItem('loggedInUser', data.username);
            localStorage.setItem('lastLoginDevice', loginDevice.deviceType);
            localStorage.setItem('lastLoginIsIPad', String(loginDevice.isIPad));
            localStorage.setItem('lastLoginIsMobile', String(loginDevice.isMobile));
            alert('Login successful!');
            window.location.href = 'index.html';
        } catch (err) {
            alert('Login failed. Backend not reachable?');
        }
    });
}

// Profile dropdown logic
document.addEventListener('DOMContentLoaded', function() {
    // theme-mode.js wires this dropdown on pages where it is loaded.
    if (typeof window.applySavedAppearance === 'function') {
        return;
    }
    const dropdown = document.querySelector('.profile-dropdown');
    const btn = document.getElementById('profileDropdownBtn');
    if (dropdown && btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });
        document.addEventListener('click', function() {
            dropdown.classList.remove('show');
        });
    }
});

// --- Comments ---
// Fetch comments from backend
async function getComments(videoId) {
    try {
        const res = await fetch(`https://ownshub.onrender.com/api/comments/${videoId}`);
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}
// Post comment to backend (anonymous allowed)
async function saveComment(videoId, text) {
    // Allow anonymous comments, but send token if logged in
    let username = localStorage.getItem('loggedInUser') || 'Anonymous';
    let token = localStorage.getItem('token');
    let headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    try {
        const res = await fetch('https://ownshub.onrender.com/api/comments', {
            method: 'POST',
            headers,
            body: JSON.stringify({ videoId, text, username })
        });
        return await res.json();
    } catch {
        return { error: 'Network error' };
    }
}
// Render comments from backend
async function renderComments(videoId) {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;
    const comments = await getComments(videoId);
    commentsList.innerHTML = comments.length ? comments.map(c => {
        if (c.username === 'Anonymous') {
            return `<div class="comment"><b><span class="username-link" style="color:#888">Anonymous</span></b> <span class="comment-date">${c.date}</span><br>${c.text}</div>`;
        } else {
            return `<div class="comment"><b><a href="public-profile.html?user=${encodeURIComponent(c.username)}" class="username-link" data-username="${c.username}">${c.username}</a></b> <span class="comment-date">${c.date}</span><br>${c.text}</div>`;
        }
    }).join('') : '<p>No comments yet.</p>';
}

// Attach comment form logic when player opens
function attachCommentForm(videoId) {
    const commentForm = document.getElementById('commentForm');
    const commentInput = document.getElementById('commentInput');
    if (!commentForm || !commentInput) return;
    // Allow anyone to comment as anonymous
    commentInput.disabled = false;
    commentInput.placeholder = 'Add a comment...';
    commentForm.querySelector('button[type="submit"]').disabled = false;
    commentForm.onsubmit = async function(e) {
        e.preventDefault();
        const text = commentInput.value.trim();
        if (!text) return;
        const result = await saveComment(videoId, text);
        if (result.error) {
            alert(result.error);
            return;
        }
        commentInput.value = '';
        renderComments(videoId);
    };
    // Always render comments for everyone
    renderComments(videoId);
}

// --- Patch openPlayer to show comments ---
const origOpenPlayer = openPlayer;
openPlayer = function(videoId) {
    origOpenPlayer(videoId);
    attachCommentForm(videoId);
};

function getAllVideos() {
    // Default videos
    const defaultVideos = [
        { id: 1, title: "Mia Rose - Private Show", youtubeId: "xhF9cTUAw_Y", description: "Hot blonde bombshell Mia Rose in an exclusive private show. Watch her tease and please in this steamy session.", category: "Private", duration: "45 min", rating: 4.8, views: 15420, isLive: true },
        { id: 2, title: "Luna Star - Interactive Fun", youtubeId: "JTnveiEnX-s", description: "Seductive Latina Luna Star takes control in this interactive experience. Your requests become reality.", category: "Latin", duration: "2 hrs", rating: 4.9, views: 28540, isLive: false },
        { id: 3, title: "Sophie Dee - Mature Seduction", youtubeId: "Bm1x9-XxCWQ", description: "Experienced MILF Sophie Dee shows you what real pleasure feels like. Pure seduction and passion.", category: "Mature", duration: "1 hr", rating: 4.7, views: 12800, isLive: true },
        { id: 4, title: "Abella Danger - Rough Play", youtubeId: "y11X5a-nASU", description: "Wild and adventurous Abella Danger brings the heat in this intense rough play session.", category: "HD Shows", duration: "3 hrs", rating: 4.6, views: 35200, isLive: false },
        { id: 5, title: "Angela White - Sensual Massage", youtubeId: "AuZAmdNSG2w", description: "Gorgeous Angela White gives you the ultimate sensual massage experience. Relax and enjoy.", category: "Couples", duration: "2.5 hrs", rating: 4.8, views: 22100, isLive: true },
        { id: 6, title: "Riley Reid - Naughty Adventures", youtubeId: "5UOudVxQsE8", description: "Playful Riley Reid takes you on naughty adventures. Full of surprises and pleasure.", category: "New Girls", duration: "1.5 hrs", rating: 4.7, views: 18900, isLive: false },
        { id: 7, title: "Jenna Haze - Classic Beauty", youtubeId: "xhF9cTUAw_Y", description: "Timeless beauty Jenna Haze in a classic performance. Elegance meets passion.", category: "Live Now", duration: "2 hrs", rating: 4.6, views: 16500, isLive: true },
        { id: 8, title: "Lena Paul - Natural Curves", youtubeId: "eQ9DSSa96f8", description: "All-natural beauty Lena Paul showcases her amazing curves in this intimate session.", category: "Ebony", duration: "3.5 hrs", rating: 4.9, views: 42300, isLive: false },
        { id: 9, title: "Kendra Lust - MILF Experience", youtubeId: "xhF9cTUAw_Y", description: "Confident MILF Kendra Lust delivers an unforgettable experience. Pure pleasure guaranteed.", category: "Mature", duration: "2.5 hrs", rating: 4.7, views: 19800, isLive: true },
        { id: 10, title: "Eva Elfie - Teen Fantasy", youtubeId: "PHVTgwVYnpE", description: "Sweet and innocent Eva Elfie fulfills your teen fantasies. Playful and passionate.", category: "Asian", duration: "3 hrs", rating: 4.8, views: 26700, isLive: false },
        { id: 11, title: "Phoenix Marie - Dominatrix", youtubeId: "yiA2NZBf198", description: "Powerful dominatrix Phoenix Marie takes control. Submit to her commands.", category: "HD Shows", duration: "1 hr", rating: 4.6, views: 21400, isLive: true },
        { id: 12, title: "Brandi Love - Cougar Hunt", youtubeId: "5UOudVxQsE8", description: "Huntress Brandi Love stalks her prey in this intense cougar session. Raw and wild.", category: "Couples", duration: "2 hrs", rating: 4.8, views: 33200, isLive: false }
    ];
    let uploaded = [];
    try {
        uploaded = JSON.parse(localStorage.getItem('uploadedVideos') || '[]');
    } catch {}
    return [...uploaded.reverse(), ...defaultVideos];
}

// Use getAllVideos() everywhere instead of videos


let currentFilter = 'All';
let currentVideo = null;


const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        renderAllSections();
    });
}

function filterByCategory(category) {
    currentFilter = category;
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === category || (category === 'All' && btn.textContent === 'All')) {
            btn.classList.add('active');
        }
    });
    renderAllSections();
}

function getFilteredVideos(category = null) {
    let filtered = getAllVideos();

    if (category && category !== 'All') {
        filtered = filtered.filter(v => v.category === category);
    }

    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(video =>
            video.title.toLowerCase().includes(searchTerm) ||
            video.description.toLowerCase().includes(searchTerm) ||
            video.category.toLowerCase().includes(searchTerm)
        );
    }

    return filtered;
}

function renderVideoRow(videos, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = videos.map(video => {
        let thumb = '';
        let embedUrl = video.embedUrl;
        // If embedUrl is an iframe HTML, extract src
        if (embedUrl && embedUrl.startsWith('<iframe')) {
            const match = embedUrl.match(/src=["']([^"']+)["']/i);
            if (match && match[1]) {
                embedUrl = match[1];
            }
        }
        // If no embedUrl but a direct Pornhub link, convert to embed
        let pornhubId = '';
        if (!embedUrl && video.youtubeId == null && video.title && video.description && video.category && video.duration && video.rating && video.views !== undefined) {
            // Try to detect Pornhub direct link in description or title (for default videos)
            if (video.description && /pornhub\.com\/view_video\.php\?viewkey=([a-zA-Z0-9]+)/.test(video.description)) {
                const match = video.description.match(/pornhub\.com\/view_video\.php\?viewkey=([a-zA-Z0-9]+)/);
                if (match && match[1]) {
                    embedUrl = `https://www.pornhub.com/embed/${match[1]}`;
                    pornhubId = match[1];
                }
            }
        }
        // Also, if embedUrl is a Pornhub view_video.php link, convert to embed
        if (embedUrl && /pornhub\.com\/view_video\.php\?viewkey=([a-zA-Z0-9]+)/.test(embedUrl)) {
            const match = embedUrl.match(/pornhub\.com\/view_video\.php\?viewkey=([a-zA-Z0-9]+)/);
            if (match && match[1]) {
                pornhubId = match[1];
                embedUrl = `https://www.pornhub.com/embed/${pornhubId}`;
            }
        }
        // Always auto-generate thumbnail for known providers if missing
        if (video.thumbnail) {
            thumb = `<img src="${video.thumbnail}" alt="${video.title}" loading="lazy">`;
        } else if (video.youtubeId) {
            thumb = `<img src="https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg" alt="${video.title}" loading="lazy">`;
        } else if (embedUrl && /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/.test(embedUrl)) {
            const ytId = embedUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/)[1];
            thumb = `<img src="https://img.youtube.com/vi/${ytId}/maxresdefault.jpg" alt="${video.title}" loading="lazy">`;
        } else if (embedUrl) {
            let match;
            // Pornhub direct embed
            if ((match = embedUrl.match(/pornhub\.com\/embed\/([a-zA-Z0-9]+)/))) {
                const phId = match[1];
                // Try main thumbnail, fallback to alternate pattern if error
                thumb = `<img src="https://di.phncdn.com/videos/${phId}/thumbs_15/(thumb)00001.jpg" alt="${video.title}" loading="lazy" onerror="this.onerror=null;this.src='https://ei.phncdn.com/videos/${phId}/thumbs_15/(thumb)00001.jpg';if(this.src===event.target.src){this.src='https://via.placeholder.com/320x180?text=No+Thumb'}">`;
            }
            // Vimeo
            else if ((match = embedUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/))) {
                const vimeoId = match[1];
                thumb = `<img src="https://vumbnail.com/${vimeoId}.jpg" alt="${video.title}" loading="lazy">`;
            }
            // Dailymotion
            else if ((match = embedUrl.match(/dailymotion\.com\/embed\/video\/([a-zA-Z0-9]+)/))) {
                const dmId = match[1];
                thumb = `<img src='https://www.dailymotion.com/thumbnail/video/${dmId}' alt="${video.title}" loading="lazy">`;
            }
            // Eporner
            else if ((match = embedUrl.match(/eporner\.com\/embed\/(\w+)/))) {
                const epId = match[1];
                thumb = `<img src="https://static.eporner.com/thumbs/${epId}.jpg" alt="${video.title}" loading="lazy">`;
            }
            // SpankBang
            else if ((match = embedUrl.match(/spankbang\.com\/embed\/(\w+)/))) {
                const sbId = match[1];
                thumb = `<img src="https://thumbs.spankbang.com/${sbId}/original/1.jpg" alt="${video.title}" loading="lazy">`;
            }
            // Xvideos
            else if ((match = embedUrl.match(/xvideos\.com\/embedframe\/(\d+)/))) {
                thumb = `<img src="https://via.placeholder.com/320x180?text=Embed" alt="${video.title}" loading="lazy">`;
            }
            // If no match, fallback
            else {
                thumb = `<img src="https://via.placeholder.com/320x180?text=Embed" alt="${video.title}" loading="lazy">`;
            }
        } else {
            // Try to auto-generate thumbnail for uploaded videos with only a raw embed link
            if (video.embedUrl) {
                let match;
                // Pornhub
                if ((match = video.embedUrl.match(/pornhub\.com\/embed\/([a-zA-Z0-9]+)/))) {
                    const phId = match[1];
                    thumb = `<img src="https://di.phncdn.com/videos/${phId}/thumbs_15/(thumb)00001.jpg" alt="${video.title}" loading="lazy" onerror="this.onerror=null;this.src='https://ei.phncdn.com/videos/${phId}/thumbs_15/(thumb)00001.jpg';if(this.src===event.target.src){this.src='https://via.placeholder.com/320x180?text=No+Thumb'}">`;
                }
                // Vimeo
                else if ((match = video.embedUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/))) {
                    const vimeoId = match[1];
                    thumb = `<img src="https://vumbnail.com/${vimeoId}.jpg" alt="${video.title}" loading="lazy">`;
                }
                // Dailymotion
                else if ((match = video.embedUrl.match(/dailymotion\.com\/embed\/video\/([a-zA-Z0-9]+)/))) {
                    const dmId = match[1];
                    thumb = `<img src='https://www.dailymotion.com/thumbnail/video/${dmId}' alt="${video.title}" loading="lazy">`;
                }
                // Eporner
                else if ((match = video.embedUrl.match(/eporner\.com\/embed\/(\w+)/))) {
                    const epId = match[1];
                    thumb = `<img src="https://static.eporner.com/thumbs/${epId}.jpg" alt="${video.title}" loading="lazy">`;
                }
                // SpankBang
                else if ((match = video.embedUrl.match(/spankbang\.com\/embed\/(\w+)/))) {
                    const sbId = match[1];
                    thumb = `<img src="https://thumbs.spankbang.com/${sbId}/original/1.jpg" alt="${video.title}" loading="lazy">`;
                }
                // Xvideos
                else if ((match = video.embedUrl.match(/xvideos\.com\/embedframe\/(\d+)/))) {
                    thumb = `<img src="https://via.placeholder.com/320x180?text=Embed" alt="${video.title}" loading="lazy">`;
                }
                // Fallback
                else {
                    thumb = `<img src="https://via.placeholder.com/320x180?text=Embed" alt="${video.title}" loading="lazy">`;
                }
            } else {
                thumb = `<img src="https://via.placeholder.com/320x180?text=Embed" alt="${video.title}" loading="lazy">`;
            }
        }
        return `
        <div class="video-card" onclick="openPlayer(${video.id})">
            <div class="video-thumbnail">
                ${thumb}
                <span class="play-icon">▶️</span>
                ${video.isLive ? '<span class="live-badge">🔴 LIVE</span>' : ''}
            </div>
            <div class="video-overlay">
                <div class="video-title">${video.title}</div>
                <div class="video-meta">
                    <span>${video.duration}</span>
                    <span class="video-rating">⭐ ${video.rating}</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function renderAllSections() {
    if (currentFilter === 'All') {
        // Show all sections when no filter is applied
        const allModels = getFilteredVideos().slice(0, 8);
        renderVideoRow(allModels, 'trendingRow');

        const newGirls = getFilteredVideos('New Girls');
        renderVideoRow(newGirls, 'programmingRow');

        const mature = getFilteredVideos('Mature');
        renderVideoRow(mature, 'webdevRow');

        const hdShows = getFilteredVideos('HD Shows');
        renderVideoRow(hdShows, 'datascienceRow');
    } else {
        // Show filtered videos in the main trending section when a category is selected
        const filteredVideos = getFilteredVideos(currentFilter);
        renderVideoRow(filteredVideos, 'trendingRow');

        // Clear other sections
        document.getElementById('programmingRow').innerHTML = '';
        document.getElementById('webdevRow').innerHTML = '';
        document.getElementById('datascienceRow').innerHTML = '';
    }
}

function openPlayer(videoId) {
    const allVideos = getAllVideos();
    currentVideo = allVideos.find(v => v.id === videoId);
    if (!currentVideo) return;

    document.getElementById('playerTitle').textContent = currentVideo.title;
    document.getElementById('playerViews').textContent = currentVideo.views.toLocaleString() + ' views';
    document.getElementById('playerRating').textContent = '⭐ ' + currentVideo.rating;
    document.getElementById('playerDuration').textContent = currentVideo.duration;
    document.getElementById('playerDescription').textContent = currentVideo.description;

    const playerIframe = document.getElementById('playerIframe');
    if (currentVideo.embedUrl && currentVideo.embedUrl !== '') {
        // If it's a YouTube link, convert to embed if needed
        if (/youtube\.com|youtu\.be/.test(currentVideo.embedUrl)) {
            let embedSrc = currentVideo.embedUrl;
            // Convert youtu.be short links to embed
            if (/youtu\.be\//.test(embedSrc)) {
                const id = embedSrc.split('youtu.be/')[1].split(/[?&]/)[0];
                embedSrc = `https://www.youtube.com/embed/${id}`;
            }
            // Convert watch?v= links to embed
            if (/watch\?v=/.test(embedSrc)) {
                const id = embedSrc.split('watch?v=')[1].split(/[?&]/)[0];
                embedSrc = `https://www.youtube.com/embed/${id}`;
            }
            playerIframe.src = embedSrc;
        } else {
            // Otherwise, use as-is (Vimeo, Pornhub, etc.)
            playerIframe.src = currentVideo.embedUrl;
        }
    } else if (currentVideo.youtubeId) {
        playerIframe.src = `https://www.youtube.com/embed/${currentVideo.youtubeId}?autoplay=1&enablejsapi=1&origin=*`;
    } else {
        playerIframe.src = '';
    }

    document.getElementById('playerModal').classList.add('show');
}

function closePlayer() {
    document.getElementById('playerModal').classList.remove('show');
    document.getElementById('playerIframe').src = '';
    currentVideo = null;
}

// Header scroll effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (window.scrollY > 100) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// Search functionality
searchInput.addEventListener('input', () => {
    renderAllSections();
});

// Close modal when clicking outside
document.getElementById('playerModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('playerModal')) {
        closePlayer();
    }
});

// Initialize
renderAllSections();