const artImagePool = [
    'public/imagetab/IMG_0842.png',
    'public/imagetab/IMG_0866.png',
    'public/imagetab/IMG_0867.png',
    'public/imagetab/IMG_0869.png',
    'public/imagetab/IMG_0870.png',
    'public/imagetab/IMG_0871.png',
    'public/imagetab/IMG_0872.png',
    'public/imagetab/IMG_0873.png',
    'public/imagetab/IMG_0878.png',
    'public/imagetab/IMG_0879.png',
    'public/imagetab/IMG_0880.png',
    'public/imagetab/IMG_0881.png',
    'public/imagetab/IMG_0882.png',
    'public/imagetab/IMG_0884.png',
    'public/hijabarts/(m=q18T2ZXbeaSaaTbaAaaaa)(mh=zJMuchy9Z1JP4GC7)0.jpg',
    'public/hijabarts/69decdf6db8a7d1ef0a59a50.jpg',
    'public/hijabarts/69ded0b5db8a7d1ef0aaeb4f.jpg',
    'public/hijabarts/69dfa9ffdb8a7d1ef04d28b1.jpg',
    'public/hijabarts/69e07b86db8a7d1ef0e1649d.jpg',
    'public/hijabarts/69e091e3db8a7d1ef0090cd9.jpg',
    'public/hijabarts/69e0924edb8a7d1ef009da19.jpg',
    'public/hijabarts/69e8c2c0f453f2f497b436d5.jpg',
    'public/hijabarts/69e9649f7d96736a341dbffc.jpg',
    'public/hijabarts/69eb39517d96736a34b337ba.jpg',
    'public/hijabarts/IMG_0862.png',
    'public/hijabarts/IMG_0863.png'
];

const DAILY_HUNT_SIZE = 8;
const fallbackCardImage = 'public/imagetab/IMG_0842.png';
const inventoryKey = 'artCollectorInventoryV1';
const dailyHuntKey = 'artCollectorDailyHuntV1';
let gameCards = [];
let inventory = [];
let highlightedItem = null;
let countdownTimer = null;
let activeDateKey = '';

function hashString(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
}

function mulberry32(seed) {
    let t = seed >>> 0;
    return function random() {
        t += 0x6D2B79F5;
        let m = Math.imul(t ^ (t >>> 15), t | 1);
        m ^= m + Math.imul(m ^ (m >>> 7), m | 61);
        return ((m ^ (m >>> 14)) >>> 0) / 4294967296;
    };
}

function seededShuffle(items, seedInput) {
    const shuffled = [...items];
    const random = mulberry32(hashString(seedInput));
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getDateKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getNextMidnight() {
    const next = new Date();
    next.setHours(24, 0, 0, 0);
    return next;
}

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function fileNameFromPath(path) {
    const slashIndex = path.lastIndexOf('/');
    return slashIndex >= 0 ? path.slice(slashIndex + 1) : path;
}

function stripExtension(fileName) {
    return fileName.replace(/\.[^.]+$/, '');
}

function toTitle(fileName) {
    const cleaned = stripExtension(fileName)
        .replace(/^IMG_/i, 'Image ')
        .replace(/[()]/g, ' ')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) return 'Collection Art';

    return cleaned
        .split(' ')
        .slice(0, 5)
        .map(token => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');
}

function toCardId(path, index) {
    const base = stripExtension(fileNameFromPath(path)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `art-${base || 'item'}-${index}`;
}

function toCard(path, index) {
    return {
        id: toCardId(path, index),
        title: toTitle(fileNameFromPath(path)),
        desc: 'Fresh from the collections. Available in today\'s Art Hunt only.',
        src: path
    };
}

function getOwnedSources() {
    return new Set(inventory.map(item => item.src));
}

function readDailyState() {
    try {
        const saved = localStorage.getItem(dailyHuntKey);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
}

function saveDailyState(state) {
    try {
        localStorage.setItem(dailyHuntKey, JSON.stringify(state));
    } catch (e) {
        console.warn('Unable to save daily hunt state', e);
    }
}

function createDailyCards(dateKey, availableSources) {
    const shuffled = seededShuffle(availableSources, `art-hunt-${dateKey}`);
    const picks = shuffled.slice(0, Math.min(DAILY_HUNT_SIZE, shuffled.length));
    return picks.map((path, index) => toCard(path, index));
}

function setDailyInfoText() {
    const dailyPoolInfo = document.getElementById('dailyPoolInfo');
    if (!dailyPoolInfo) return;

    if (!gameCards.length) {
        dailyPoolInfo.textContent = `All ${artImagePool.length} collection images are already in your inventory. Reset inventory to hunt again.`;
        return;
    }

    dailyPoolInfo.textContent = `${gameCards.length} brand new arts selected today from ${artImagePool.length} collection images.`;
}

function refreshDailyHunt() {
    activeDateKey = getDateKey();
    const ownedSources = getOwnedSources();
    const availableSources = artImagePool.filter(path => !ownedSources.has(path));

    const saved = readDailyState();
    let selectedSources = [];

    if (saved && saved.dateKey === activeDateKey && Array.isArray(saved.sources)) {
        const availableSet = new Set(availableSources);
        selectedSources = saved.sources.filter(path => availableSet.has(path));
    }

    if (!selectedSources.length && availableSources.length) {
        selectedSources = createDailyCards(activeDateKey, availableSources).map(card => card.src);
        saveDailyState({ dateKey: activeDateKey, sources: selectedSources });
    }

    gameCards = selectedSources.map((path, index) => toCard(path, index));
    setDailyInfoText();
}

function loadInventory() {
    try {
        const saved = localStorage.getItem(inventoryKey);
        inventory = saved ? JSON.parse(saved) : [];
    } catch (e) {
        inventory = [];
    }
}
function saveInventory() {
    try {
        localStorage.setItem(inventoryKey, JSON.stringify(inventory));
    } catch (e) {
        console.warn('Unable to save inventory', e);
    }
}
function formatInventoryItem(item) {
    return `
        <li class="inventory-item" data-item-id="${item.id}">
            <div class="inventory-item-main">
                <button type="button" class="inventory-thumb-btn" data-view-src="${item.src}" aria-label="View ${item.title}">
                    <img src="${item.src}" alt="${item.title}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackCardImage}';">
                </button>
                <div>
                    <strong>${item.title}</strong><br><span>${item.desc}</span>
                </div>
            </div>
            <div class="inventory-actions">
                <button type="button" class="inventory-view-btn" data-view-src="${item.src}">View</button>
                <button type="button" class="btn" data-remove-id="${item.id}" style="background:#ff4d4d;">Remove</button>
            </div>
        </li>`;
}
function updateInventoryPanel(lastCollectedTitle) {
    const inventoryList = document.getElementById('inventoryList');
    const inventoryCount = document.getElementById('inventoryCount');
    const lastCollectedTag = document.getElementById('lastCollectedTag');
    if (!inventoryList || !inventoryCount || !lastCollectedTag) return;
    inventoryList.innerHTML = inventory.map(formatInventoryItem).join('') || '<li class="inventory-item" style="justify-content:center;color:#aaa;">Your inventory is empty.</li>';
    inventoryCount.textContent = inventory.length;
    lastCollectedTag.textContent = lastCollectedTitle ? `Last: ${lastCollectedTitle}` : 'No collection yet';
}
function renderGameCards() {
    const grid = document.getElementById('gameCardGrid');
    if (!grid) return;

    if (!gameCards.length) {
        grid.innerHTML = '<div class="inventory-item" style="justify-content:center;color:#aaa;grid-column:1 / -1;">No new art available today. Come back after the daily refresh.</div>';
        return;
    }

    const ownedSources = getOwnedSources();
    grid.innerHTML = gameCards.map(card => {
        const owned = ownedSources.has(card.src);
        return `
            <article class="game-card ${owned ? 'collected highlighted' : ''}" data-card-id="${card.id}">
                <img src="${card.src}" alt="${card.title}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackCardImage}';">
                <div class="game-card-body">
                    <h3 class="game-card-title">${card.title}</h3>
                    <p class="game-card-desc">${card.desc}</p>
                    <div class="game-card-actions">
                        <button type="button" class="collect-btn" data-collect-id="${card.id}">${owned ? 'Collected' : 'Collect'}</button>
                    </div>
                </div>
            </article>`;
    }).join('');
}
function setHighlight(itemId) {
    highlightedItem = itemId;
    document.querySelectorAll('.game-card').forEach(card => {
        if (card.dataset.cardId === itemId) {
            card.classList.add('highlighted');
        } else {
            card.classList.remove('highlighted');
        }
    });
}
function clearHighlight() {
    highlightedItem = null;
    document.querySelectorAll('.game-card').forEach(card => card.classList.remove('highlighted'));
}
function collectArt(itemId) {
    const card = gameCards.find(item => item.id === itemId);
    if (!card) return;
    if (!inventory.some(item => item.src === card.src)) {
        inventory.push(card);
        saveInventory();
        renderGameCards();
        updateInventoryPanel(card.title);
        setHighlight(card.id);
    }
}
function removeInventoryItem(itemId) {
    inventory = inventory.filter(item => item.id !== itemId);
    saveInventory();
    renderGameCards();
    updateInventoryPanel(highlightedItem ? gameCards.find(item => item.id === highlightedItem)?.title : null);
}

function openImageViewer(src) {
    const viewer = document.getElementById('imageViewer');
    const viewerImg = document.getElementById('imageViewerImg');
    if (!viewer || !viewerImg || !src) return;
    viewerImg.src = src;
    viewer.classList.add('is-open');
    viewer.setAttribute('aria-hidden', 'false');
}

function closeImageViewer() {
    const viewer = document.getElementById('imageViewer');
    const viewerImg = document.getElementById('imageViewerImg');
    if (!viewer || !viewerImg) return;
    viewer.classList.remove('is-open');
    viewer.setAttribute('aria-hidden', 'true');
    viewerImg.src = '';
}
function chooseRandomArt() {
    const ownedSources = getOwnedSources();
    const remaining = gameCards.filter(card => !ownedSources.has(card.src));
    if (!remaining.length) {
        alert('You have collected all available art in today\'s hunt. Come back tomorrow for a refresh.');
        return;
    }
    const choice = remaining[Math.floor(Math.random() * remaining.length)];
    collectArt(choice.id);
    const cardElement = document.querySelector(`.game-card[data-card-id="${choice.id}"]`);
    if (cardElement) cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function resetInventory() {
    if (!confirm('Reset your art inventory? This will remove all collected items.')) return;
    inventory = [];
    saveInventory();
    refreshDailyHunt();
    renderGameCards();
    updateInventoryPanel(null);
    clearHighlight();
}

function updateCountdown() {
    const timer = document.getElementById('dailyResetTimer');
    if (!timer) return;

    const now = new Date();
    const nextMidnight = getNextMidnight();
    timer.textContent = `Refresh in ${formatDuration(nextMidnight.getTime() - now.getTime())}`;

    const currentKey = getDateKey();
    if (currentKey !== activeDateKey) {
        refreshDailyHunt();
        renderGameCards();
    }
}

function startCountdownTimer() {
    if (countdownTimer) clearInterval(countdownTimer);
    updateCountdown();
    countdownTimer = setInterval(updateCountdown, 1000);
}

function attachEventHandlers() {
    const grid = document.getElementById('gameCardGrid');
    const clearHighlightsBtn = document.getElementById('clearHighlightsBtn');
    const randomFindBtn = document.getElementById('randomFindBtn');
    const resetInventoryBtn = document.getElementById('resetInventoryBtn');
    const imageViewer = document.getElementById('imageViewer');
    const closeImageViewerBtn = document.getElementById('closeImageViewerBtn');

    if (grid) {
        grid.addEventListener('click', event => {
            const collectBtn = event.target.closest('[data-collect-id]');
            if (collectBtn) {
                collectArt(collectBtn.dataset.collectId);
                return;
            }
            const cardElement = event.target.closest('.game-card');
            if (cardElement) {
                const cardId = cardElement.dataset.cardId;
                setHighlight(cardId);
            }
        });
    }
    if (clearHighlightsBtn) clearHighlightsBtn.addEventListener('click', clearHighlight);
    if (randomFindBtn) randomFindBtn.addEventListener('click', chooseRandomArt);
    if (resetInventoryBtn) resetInventoryBtn.addEventListener('click', resetInventory);
    document.getElementById('inventoryList')?.addEventListener('click', event => {
        const viewBtn = event.target.closest('[data-view-src]');
        if (viewBtn) {
            openImageViewer(viewBtn.dataset.viewSrc);
            return;
        }
        const removeBtn = event.target.closest('[data-remove-id]');
        if (removeBtn) removeInventoryItem(removeBtn.dataset.removeId);
    });
    if (closeImageViewerBtn) closeImageViewerBtn.addEventListener('click', closeImageViewer);
    if (imageViewer) {
        imageViewer.addEventListener('click', event => {
            if (event.target === imageViewer) closeImageViewer();
        });
    }
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeImageViewer();
    });
}
function initializeGame() {
    loadInventory();
    refreshDailyHunt();
    renderGameCards();
    updateInventoryPanel();
    attachEventHandlers();
    startCountdownTimer();
}
document.addEventListener('DOMContentLoaded', initializeGame);
