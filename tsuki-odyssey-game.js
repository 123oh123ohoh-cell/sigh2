const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');
const scoreValue = document.getElementById('scoreValue');
const tokenValue = document.getElementById('tokenValue');
const chatCount = document.getElementById('chatCount');
const heartsRow = document.getElementById('heartsRow');
const slotBar = document.getElementById('slotBar');
const missionList = document.getElementById('missionList');
const dialogueBox = document.getElementById('dialogueBox');
const dialogueName = document.getElementById('dialogueName');
const dialogueText = document.getElementById('dialogueText');
const dialogueHint = document.getElementById('dialogueHint');
const artCollectionList = document.getElementById('artCollectionList');
const artPreviewTitle = document.getElementById('artPreviewTitle');
const artPreviewImage = document.getElementById('artPreviewImage');
const zoneBanner = document.getElementById('zoneBanner');
const zoneBannerTitle = document.getElementById('zoneBannerTitle');
const hintBtn = document.getElementById('hintBtn');
const restartBtn = document.getElementById('restartBtn');
const satchelBtn = document.getElementById('satchelBtn');
const travelBtn = document.getElementById('travelBtn');
const homeBtn = document.getElementById('homeBtn');
const keysBtn = document.getElementById('keysBtn');

const ITEM_TYPES = ['Milk Bottle', 'Silk Ribbon', 'Sweet Berry', 'Moon Charm', 'Crunchy Carrot', 'Jingle Bell'];
const ITEM_ICONS = {
    'Milk Bottle': '🥛',
    'Silk Ribbon': '🎀',
    'Sweet Berry': '🍓',
    'Moon Charm': '🌙',
    'Crunchy Carrot': '🥕',
    'Jingle Bell': '🔔'
};

const ART_COLLECTIONS = [
    { key: 'hijab-img-1', label: 'Hijab Image 1', icon: '🧕', src: 'public/hijabarts/IMG_0862.png', map: 'grove' },
    { key: 'hijab-img-2', label: 'Hijab Image 2', icon: '🧕', src: 'public/hijabarts/69decdf6db8a7d1ef0a59a50.jpg', map: 'grove' },
    { key: 'lifesuck-img-1', label: 'Life Suck Image 1', icon: '⚡', src: 'lifesuck/1i.jpg', map: 'meadow' },
    { key: 'lifesuck-img-2', label: 'Life Suck Image 2', icon: '⚡', src: 'lifesuck/12i.jpg', map: 'meadow' },
    { key: 'japan-img-1', label: 'Japan Image 1', icon: '🌸', src: 'public/imagetab/IMG_0842.png', map: 'shore' },
    { key: 'gf-img-1', label: 'Girlfriend Image 1', icon: '💌', src: 'girlfriend/girl1.jpg', map: 'shore' }
];

const MAPS = {
    grove: {
        name: 'Whispering Grove', width: 3200, height: 2000,
        groundTop: '#16241a', groundMid: '#1c2f20', groundBottom: '#0e1712',
        particleColor: '#fff6b0',
        spawn: { x: 1600, y: 1120 },
        homeReturnSpawn: { x: 260, y: 400 }
    },
    meadow: {
        name: 'Sunpetal Meadow', width: 2400, height: 1600,
        groundTop: '#5a7a2e', groundMid: '#7a9a3e', groundBottom: '#3f5a22',
        particleColor: '#fff2fb',
        spawn: { x: 220, y: 800 }
    },
    shore: {
        name: 'Moonlit Shore', width: 2800, height: 1800,
        groundTop: '#c9b183', groundMid: '#e0caa0', groundBottom: '#a68a5c',
        particleColor: '#eaffff',
        spawn: { x: 220, y: 900 }
    }
};

const HOME_ROOM = { width: 640, height: 420 };
const WALL_SWATCHES = ['#7a5a3f', '#4a5a3f', '#5a3f5a', '#3f4a5a', '#5a3f3f'];
const FLOOR_SWATCHES = ['#caa46a', '#b88c5a', '#8a9a6a', '#a68a5c', '#c9b183'];

const state = {
    width: 0,
    height: 0,
    worldWidth: 3200,
    worldHeight: 2000,
    camera: { x: 0, y: 0 },
    player: {
        x: 1720, y: 1260, size: 15, speed: 3.4,
        facing: 'down', moving: false, walkCycle: 0,
        skin: '#ffdcc4', hair: '#5a3826', outfit: '#7fa8ff', pants: '#3a4f6e'
    },
    items: [],
    artDrops: [],
    npcs: [],
    trees: [],
    bushes: [],
    rocks: [],
    ferns: [],
    logs: [],
    flowers: [],
    fireflies: [],
    pond: { x: 1080, y: 1360 },
    hasPond: true,
    signposts: [],
    homeDoor: null,
    mapId: 'grove',
    mapCache: {},
    modal: null,
    pendingChoice: null,
    lastAction: 0,
    home: {
        wallColor: '#7a5a3f',
        floorColor: '#caa46a',
        furniture: { bed: true, rug: true, plant: true, lamp: false }
    },
    tone: 0,
    collected: 0,
    score: 0,
    chatCount: 0,
    affection: 0,
    inventory: [],
    artCollectionUnlocks: {},
    message: 'Welcome, cutie. Explore the Whispering Grove and sniff out treats.',
    input: { left: false, right: false, up: false, down: false, interact: false },
    running: false,
    lastInteract: 0
};

try {
    const savedHome = JSON.parse(localStorage.getItem('tsukiHome') || 'null');
    if (savedHome) {
        Object.assign(state.home, savedHome);
        if (savedHome.furniture) Object.assign(state.home.furniture, savedHome.furniture);
    }
} catch (err) {
    /* ignore malformed storage */
}

try {
    const savedArtUnlocks = JSON.parse(localStorage.getItem('tsukiArtUnlocks') || '{}');
    if (savedArtUnlocks && typeof savedArtUnlocks === 'object') {
        state.artCollectionUnlocks = savedArtUnlocks;
    }
} catch (err) {
    /* ignore malformed storage */
}

function saveArtUnlocks() {
    try {
        localStorage.setItem('tsukiArtUnlocks', JSON.stringify(state.artCollectionUnlocks));
    } catch (err) {
        /* ignore storage errors */
    }
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.width = w;
    state.height = h;
    updateCamera();
}

function updateCamera() {
    state.camera.x = clamp(state.player.x - state.width / 2, 0, Math.max(0, state.worldWidth - state.width));
    state.camera.y = clamp(state.player.y - state.height / 2, 0, Math.max(0, state.worldHeight - state.height));
}

function resetPlayerPosition() {
    const spawn = MAPS[state.mapId].spawn;
    state.player.x = spawn.x;
    state.player.y = spawn.y;
}

function spawnWorld(mapId) {
    const id = mapId || state.mapId || 'grove';
    state.mapId = id;
    const map = MAPS[id];
    state.worldWidth = map.width;
    state.worldHeight = map.height;

    if (state.mapCache[id]) {
        const cache = state.mapCache[id];
        state.items = cache.items;
        state.artDrops = cache.artDrops || [];
        state.npcs = cache.npcs;
        state.trees = cache.trees;
        state.bushes = cache.bushes;
        state.rocks = cache.rocks;
        state.ferns = cache.ferns;
        state.logs = cache.logs;
        state.flowers = cache.flowers;
        state.fireflies = cache.fireflies;
        state.pond = cache.pond;
        state.hasPond = cache.hasPond;
        state.signposts = cache.signposts;
        state.homeDoor = cache.homeDoor;
        return;
    }

    if (id === 'grove') {
        state.items = [
            { x: 720, y: 560, label: 'Milk Bottle', color: '#fff2d6', icon: '🥛', collected: false },
            { x: 1340, y: 380, label: 'Silk Ribbon', color: '#ffb3e6', icon: '🎀', collected: false },
            { x: 2180, y: 900, label: 'Sweet Berry', color: '#ff7a90', icon: '🍓', collected: false },
            { x: 1560, y: 1520, label: 'Moon Charm', color: '#c9b6ff', icon: '🌙', collected: false },
            { x: 2480, y: 540, label: 'Crunchy Carrot', color: '#ffb066', icon: '🥕', collected: false },
            { x: 460, y: 1300, label: 'Jingle Bell', color: '#ffe37a', icon: '🔔', collected: false }
        ];

        state.artDrops = [
            {
                x: 520, y: 980,
                key: 'hijab-img-1',
                label: 'Hijab Image 1',
                icon: '🧕',
                color: '#f3b2d3',
                src: 'public/hijabarts/IMG_0862.png',
                collected: !!state.artCollectionUnlocks['hijab-img-1']
            },
            {
                x: 2740, y: 1260,
                key: 'hijab-img-2',
                label: 'Hijab Image 2',
                icon: '🧕',
                color: '#f6c4d8',
                src: 'public/hijabarts/69decdf6db8a7d1ef0a59a50.jpg',
                collected: !!state.artCollectionUnlocks['hijab-img-2']
            }
        ];

        state.npcs = [
            {
                baseX: 1900, baseY: 1180, x: 1900, y: 1180, phase: 0.4,
                name: 'Mochi', earType: 'cat', tailType: 'cat',
                skin: '#ffd9c2', hair: '#3a2418', outfit: '#ff8fc9', accent: '#ff8fc9', earColor: '#ffd7ef',
                facing: 'down', moving: true, walkCycle: 0,
                favoriteItem: 'Milk Bottle', relationship: 0, metPlayer: false, giftedFavorite: false, milestoneShown: false,
                introLine: 'Mochi\'s ears perk up as she spots you. "Oh! A new face wandering my grove," she purrs, sizing you up with half-lidded eyes.',
                milestoneLine: 'Mochi flops against your leg without hesitation now. "I actually look forward to your visits," she admits, voice softer than usual.',
                giftLine: 'Mochi gasps softly at the Milk Bottle. "For me? You really do spoil me rotten," she purrs, pressing her cheek to your hand.',
                dialogue: [
                    'Mochi arches her back in a slow stretch and gives you a sly little smirk.',
                    '"Mmm, you smell like adventure," Mochi purrs, tail curling near your ankle.',
                    '"Bring me something sweet and I might just curl up beside you."',
                    '"You are dangerously charming for someone covered in forest dust."'
                ],
                dialogueIndex: 0
            },
            {
                baseX: 980, baseY: 1560, x: 980, y: 1560, phase: 2.1,
                name: 'Clover', earType: 'bunny', tailType: 'bunny',
                skin: '#ffe6d2', hair: '#caa06a', outfit: '#e8d9ff', accent: '#d3b8ff', earColor: '#fff0fb',
                facing: 'down', moving: true, walkCycle: 0,
                favoriteItem: 'Crunchy Carrot', relationship: 0, metPlayer: false, giftedFavorite: false, milestoneShown: false,
                introLine: 'Clover freezes mid-nibble, ears standing straight up. "Oh! I didn\'t hear you coming," she squeaks, cheeks already pink.',
                milestoneLine: 'Clover leans her head against your arm. "I saved you the best patch of clover today," she whispers, ears drooping happily.',
                giftLine: 'Clover\'s whole body wiggles with delight at the Crunchy Carrot. "You remembered! You\'re going to make me impossible to get rid of."',
                dialogue: [
                    'Clover hops close, nose twitching, ears flopping playfully over one eye.',
                    '"You caught me mid-snack," Clover giggles, cheeks blushing pink.',
                    '"Carrots make me awfully affectionate, just so you know."',
                    '"Stay a while — I promise the company gets sweeter."'
                ],
                dialogueIndex: 0
            },
            {
                baseX: 2360, baseY: 700, x: 2360, y: 700, phase: 3.6,
                name: 'Velvet', earType: 'cat', tailType: 'cat',
                skin: '#ffdcc9', hair: '#552238', outfit: '#ffd3ec', accent: '#ff9fd2', earColor: '#ffe3f4',
                facing: 'down', moving: true, walkCycle: 0,
                favoriteItem: 'Silk Ribbon', relationship: 0, metPlayer: false, giftedFavorite: false, milestoneShown: false,
                introLine: 'Velvet lifts her head slowly from her mossy perch, studying you with sharp, unbothered elegance. "Well. You found me," she muses.',
                milestoneLine: 'Velvet lets you scratch behind her ear without protest. "Don\'t get used to this kind of access," she murmurs, clearly pleased anyway.',
                giftLine: 'Velvet examines the Silk Ribbon, then ties it loosely around her wrist. "Exquisite taste. Maybe you\'re worth keeping around."',
                dialogue: [
                    'Velvet stretches languidly across a mossy stone, watching you approach.',
                    '"Well aren\'t you bold, wandering into my favorite napping spot," she teases.',
                    '"Scratch behind my ears and I\'ll let you in on a little secret."',
                    '"You have that look... like you came here just to flirt with a cat."'
                ],
                dialogueIndex: 0
            },
            {
                baseX: 660, baseY: 780, x: 660, y: 780, phase: 5.0,
                name: 'Biscuit', earType: 'bunny', tailType: 'bunny',
                skin: '#ffe9da', hair: '#8a5a3c', outfit: '#ffe6f0', accent: '#ffb8d6', earColor: '#fff5fb',
                facing: 'down', moving: true, walkCycle: 0,
                favoriteItem: 'Jingle Bell', relationship: 0, metPlayer: false, giftedFavorite: false, milestoneShown: false,
                introLine: 'Biscuit peeks out from behind a fern, whiskers twitching. "O-oh! I wasn\'t expecting company this cute," she stammers, blushing.',
                milestoneLine: 'Biscuit hops right up to you now without any hesitation. "You\'re not a stranger anymore," she beams, tail wiggling.',
                giftLine: 'Biscuit hugs the Jingle Bell to her chest, eyes shining. "Now you\'ll always hear me coming — I mean, that\'s a good thing! Right?"',
                dialogue: [
                    'Biscuit peeks out from behind a fern, whiskers twitching shyly.',
                    '"O-oh! I wasn\'t expecting company this cute," Biscuit blushes.',
                    '"If you find my ribbon, I\'ll give you the softest hug in the grove."',
                    '"Careful — bunnies get attached awfully fast."'
                ],
                dialogueIndex: 0
            },
            {
                baseX: 1480, baseY: 860, x: 1480, y: 860, phase: 1.3,
                name: 'Sable', earType: 'cat', tailType: 'cat',
                skin: '#f6c9a6', hair: '#1c1414', outfit: '#c98bff', accent: '#e2b6ff', earColor: '#3a2430',
                facing: 'down', moving: true, walkCycle: 0,
                favoriteItem: 'Moon Charm', relationship: 0, metPlayer: false, giftedFavorite: false, milestoneShown: false,
                introLine: 'Sable saunters over with a confident sway, sizing you up. "Well hello, handsome. Not many make it this deep into the grove."',
                milestoneLine: 'Sable brushes against your side, tail curling around your ankle. "I don\'t usually let anyone this close," she purrs. "Consider yourself special."',
                giftLine: 'Sable turns the Moon Charm over in her paw, eyes softening. "You went looking for this... for me? Careful, or I might actually fall for you."',
                dialogue: [
                    'Sable saunters over with a confident sway, tail flicking behind her.',
                    '"Well hello, handsome," Sable purrs, tilting her head just so.',
                    '"I don\'t usually let strangers this close... consider yourself lucky."',
                    '"Keep looking at me like that and I might just follow you home."'
                ],
                dialogueIndex: 0
            },
            {
                baseX: 2020, baseY: 1460, x: 2020, y: 1460, phase: 4.4,
                name: 'Peaches', earType: 'bunny', tailType: 'bunny',
                skin: '#ffdccb', hair: '#e8a6c9', outfit: '#ff9fc4', accent: '#ffd1e3', earColor: '#ffe9f2',
                facing: 'down', moving: true, walkCycle: 0,
                favoriteItem: 'Sweet Berry', relationship: 0, metPlayer: false, giftedFavorite: false, milestoneShown: false,
                introLine: 'Peaches twirls a strand of hair, giving you a curious once-over. "Well aren\'t you a surprise. I don\'t usually get visitors this handsome."',
                milestoneLine: 'Peaches loops her arm through yours like it\'s the most natural thing in the world. "You\'re basically part of the grove now, you know."',
                giftLine: 'Peaches beams at the Sweet Berry, popping it right into her mouth. "Mmm — almost as sweet as you. Almost."',
                dialogue: [
                    'Peaches twirls a strand of hair, giving you a coy, lingering look.',
                    '"You found me already? Guess I wasn\'t hiding hard enough," she winks.',
                    '"A charmer like you should stick around... I don\'t bite. Much."',
                    '"Come closer — the grove gets awfully cozy after dark."'
                ],
                dialogueIndex: 0
            }
        ];

        state.hasPond = true;
        state.pond = { x: 1080, y: 1360 };
        state.signposts = [{ x: 3120, y: 1000, label: 'Sunpetal Meadow', target: 'meadow' }];
        state.homeDoor = { x: 260, y: 300, exit: false };

        const keepClear = [
            { x: state.pond.x, y: state.pond.y, r: 260 },
            { x: state.worldWidth / 2 + 120, y: state.worldHeight / 2 + 260, r: 160 },
            { x: 3120, y: 1000, r: 120 },
            { x: 260, y: 300, r: 130 },
            ...state.npcs.map(n => ({ x: n.baseX, y: n.baseY, r: 110 }))
        ];
        const isClear = (x, y) => keepClear.every(zone => Math.hypot(zone.x - x, zone.y - y) > zone.r);

        state.trees = [];
        let attempts = 0;
        while (state.trees.length < 90 && attempts < 900) {
            attempts += 1;
            const x = 80 + Math.random() * (state.worldWidth - 160);
            const y = 80 + Math.random() * (state.worldHeight - 160);
            if (!isClear(x, y)) continue;
            state.trees.push({
                x, y,
                height: 58 + Math.random() * 34,
                sway: Math.random() * Math.PI * 2,
                thickness: 8 + Math.random() * 7,
                kind: Math.random() < 0.28 ? 'blossom' : 'pine',
                scale: 0.85 + Math.random() * 0.5
            });
        }

        state.bushes = [];
        for (let i = 0; i < 70; i += 1) {
            const x = 60 + Math.random() * (state.worldWidth - 120);
            const y = 60 + Math.random() * (state.worldHeight - 120);
            if (!isClear(x, y)) continue;
            state.bushes.push({ x, y, r: 12 + Math.random() * 10, tone: Math.random() > 0.5 ? '#2b5a3c' : '#245039' });
        }

        state.rocks = [];
        for (let i = 0; i < 26; i += 1) {
            state.rocks.push({
                x: 60 + Math.random() * (state.worldWidth - 120),
                y: 60 + Math.random() * (state.worldHeight - 120),
                w: 16 + Math.random() * 18,
                h: 10 + Math.random() * 12,
                rot: Math.random() * Math.PI
            });
        }

        state.ferns = [];
        for (let i = 0; i < 90; i += 1) {
            state.ferns.push({
                x: 40 + Math.random() * (state.worldWidth - 80),
                y: 40 + Math.random() * (state.worldHeight - 80),
                scale: 0.7 + Math.random() * 0.8,
                sway: Math.random() * Math.PI * 2
            });
        }

        state.logs = [
            { x: 1240, y: 860, len: 90, rot: 0.3 },
            { x: 1980, y: 1240, len: 70, rot: -0.5 },
            { x: 760, y: 1680, len: 80, rot: 0.15 }
        ];

        state.flowers = [];
        for (let i = 0; i < 140; i += 1) {
            state.flowers.push({
                x: 60 + Math.random() * (state.worldWidth - 120),
                y: 60 + Math.random() * (state.worldHeight - 120),
                hue: ['#ff9fd2', '#c9b6ff', '#fff08a', '#ffffff'][Math.floor(Math.random() * 4)],
                size: 2.4 + Math.random() * 2.6
            });
        }

        state.fireflies = [];
        for (let i = 0; i < 34; i += 1) {
            state.fireflies.push({
                x: Math.random() * state.worldWidth,
                y: Math.random() * state.worldHeight,
                phase: Math.random() * Math.PI * 2,
                speed: 0.5 + Math.random() * 0.8,
                radius: 30 + Math.random() * 40
            });
        }
    } else if (id === 'meadow') {
        state.items = [];
        state.artDrops = [
            {
                x: 1080, y: 620,
                key: 'lifesuck-img-1',
                label: 'Life Suck Image 1',
                icon: '⚡',
                color: '#ffe89b',
                src: 'lifesuck/1i.jpg',
                collected: !!state.artCollectionUnlocks['lifesuck-img-1']
            },
            {
                x: 1830, y: 1140,
                key: 'lifesuck-img-2',
                label: 'Life Suck Image 2',
                icon: '⚡',
                color: '#ffe1a0',
                src: 'lifesuck/12i.jpg',
                collected: !!state.artCollectionUnlocks['lifesuck-img-2']
            }
        ];
        state.npcs = [];
        state.hasPond = false;
        state.pond = { x: 0, y: 0 };
        state.signposts = [
            { x: 120, y: 800, label: 'Whispering Grove', target: 'grove' },
            { x: map.width - 120, y: 800, label: 'Moonlit Shore', target: 'shore' }
        ];
        state.homeDoor = null;

        const keepClear = state.signposts.map(s => ({ x: s.x, y: s.y, r: 100 }));
        const isClear = (x, y) => keepClear.every(zone => Math.hypot(zone.x - x, zone.y - y) > zone.r);

        state.trees = [];
        let attempts = 0;
        while (state.trees.length < 22 && attempts < 400) {
            attempts += 1;
            const x = 80 + Math.random() * (state.worldWidth - 160);
            const y = 80 + Math.random() * (state.worldHeight - 160);
            if (!isClear(x, y)) continue;
            state.trees.push({
                x, y, height: 40 + Math.random() * 20, sway: Math.random() * Math.PI * 2,
                thickness: 7 + Math.random() * 5, kind: Math.random() < 0.5 ? 'blossom' : 'pine',
                scale: 0.6 + Math.random() * 0.3
            });
        }

        state.bushes = [];
        for (let i = 0; i < 30; i += 1) {
            const x = 60 + Math.random() * (state.worldWidth - 120);
            const y = 60 + Math.random() * (state.worldHeight - 120);
            if (!isClear(x, y)) continue;
            state.bushes.push({ x, y, r: 10 + Math.random() * 8, tone: Math.random() > 0.5 ? '#6b8a3a' : '#7a9a44' });
        }

        state.rocks = [];
        for (let i = 0; i < 10; i += 1) {
            state.rocks.push({
                x: 60 + Math.random() * (state.worldWidth - 120), y: 60 + Math.random() * (state.worldHeight - 120),
                w: 12 + Math.random() * 12, h: 8 + Math.random() * 8, rot: Math.random() * Math.PI
            });
        }

        state.ferns = [];
        for (let i = 0; i < 24; i += 1) {
            state.ferns.push({
                x: 40 + Math.random() * (state.worldWidth - 80), y: 40 + Math.random() * (state.worldHeight - 80),
                scale: 0.6 + Math.random() * 0.6, sway: Math.random() * Math.PI * 2
            });
        }

        state.logs = [{ x: state.worldWidth * 0.5, y: state.worldHeight * 0.3, len: 70, rot: 0.2 }];

        state.flowers = [];
        for (let i = 0; i < 220; i += 1) {
            state.flowers.push({
                x: 40 + Math.random() * (state.worldWidth - 80), y: 40 + Math.random() * (state.worldHeight - 80),
                hue: ['#ff9fd2', '#fff08a', '#ffffff', '#ffbf6b'][Math.floor(Math.random() * 4)],
                size: 2.6 + Math.random() * 2.8
            });
        }

        state.fireflies = [];
        for (let i = 0; i < 40; i += 1) {
            state.fireflies.push({
                x: Math.random() * state.worldWidth, y: Math.random() * state.worldHeight,
                phase: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.6, radius: 20 + Math.random() * 30
            });
        }
    } else if (id === 'shore') {
        state.items = [];
        state.artDrops = [
            {
                x: 910, y: 1220,
                key: 'japan-img-1',
                label: 'Japan Image 1',
                icon: '🌸',
                color: '#cfc7ff',
                src: 'public/imagetab/IMG_0842.png',
                collected: !!state.artCollectionUnlocks['japan-img-1']
            },
            {
                x: 2260, y: 1380,
                key: 'gf-img-1',
                label: 'Girlfriend Image 1',
                icon: '💌',
                color: '#ffd785',
                src: 'girlfriend/girl1.jpg',
                collected: !!state.artCollectionUnlocks['gf-img-1']
            }
        ];
        state.npcs = [];
        state.hasPond = true;
        state.pond = { x: state.worldWidth * 0.62, y: state.worldHeight * 0.4 };
        state.signposts = [{ x: 120, y: 900, label: 'Sunpetal Meadow', target: 'meadow' }];
        state.homeDoor = null;

        const keepClear = [
            { x: state.pond.x, y: state.pond.y, r: 340 },
            ...state.signposts.map(s => ({ x: s.x, y: s.y, r: 100 }))
        ];
        const isClear = (x, y) => keepClear.every(zone => Math.hypot(zone.x - x, zone.y - y) > zone.r);

        state.trees = [];
        let attempts = 0;
        while (state.trees.length < 16 && attempts < 400) {
            attempts += 1;
            const x = 80 + Math.random() * (state.worldWidth - 160);
            const y = 80 + Math.random() * (state.worldHeight - 160);
            if (!isClear(x, y)) continue;
            state.trees.push({
                x, y, height: 50 + Math.random() * 24, sway: Math.random() * Math.PI * 2,
                thickness: 7 + Math.random() * 6, kind: 'pine', scale: 0.7 + Math.random() * 0.3
            });
        }

        state.bushes = [];
        for (let i = 0; i < 20; i += 1) {
            const x = 60 + Math.random() * (state.worldWidth - 120);
            const y = 60 + Math.random() * (state.worldHeight - 120);
            if (!isClear(x, y)) continue;
            state.bushes.push({ x, y, r: 10 + Math.random() * 8, tone: '#7a8a5c' });
        }

        state.rocks = [];
        for (let i = 0; i < 44; i += 1) {
            state.rocks.push({
                x: 60 + Math.random() * (state.worldWidth - 120), y: 60 + Math.random() * (state.worldHeight - 120),
                w: 14 + Math.random() * 22, h: 10 + Math.random() * 14, rot: Math.random() * Math.PI
            });
        }

        state.ferns = [];
        for (let i = 0; i < 26; i += 1) {
            state.ferns.push({
                x: 40 + Math.random() * (state.worldWidth - 80), y: 40 + Math.random() * (state.worldHeight - 80),
                scale: 0.6 + Math.random() * 0.5, sway: Math.random() * Math.PI * 2
            });
        }

        state.logs = [
            { x: state.worldWidth * 0.3, y: state.worldHeight * 0.75, len: 90, rot: 0.4 },
            { x: state.worldWidth * 0.7, y: state.worldHeight * 0.82, len: 70, rot: -0.3 }
        ];

        state.flowers = [];
        for (let i = 0; i < 30; i += 1) {
            state.flowers.push({
                x: 40 + Math.random() * (state.worldWidth - 80), y: 40 + Math.random() * (state.worldHeight - 80),
                hue: ['#ffffff', '#fff2c9'][Math.floor(Math.random() * 2)], size: 2 + Math.random() * 2
            });
        }

        state.fireflies = [];
        for (let i = 0; i < 30; i += 1) {
            state.fireflies.push({
                x: Math.random() * state.worldWidth, y: Math.random() * state.worldHeight,
                phase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.5, radius: 26 + Math.random() * 36
            });
        }
    }

    state.mapCache[id] = {
        items: state.items, artDrops: state.artDrops, npcs: state.npcs, trees: state.trees, bushes: state.bushes,
        rocks: state.rocks, ferns: state.ferns, logs: state.logs, flowers: state.flowers,
        fireflies: state.fireflies, pond: state.pond, hasPond: state.hasPond,
        signposts: state.signposts, homeDoor: state.homeDoor
    };
}

function buildHearts() {
    heartsRow.innerHTML = '';
    for (let i = 0; i < 5; i += 1) {
        const heart = document.createElement('div');
        heart.className = 'heart';
        heartsRow.appendChild(heart);
    }
}

function buildSlots() {
    slotBar.innerHTML = '';
    ITEM_TYPES.forEach(label => {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.label = label;
        slot.innerHTML = `<span>${ITEM_ICONS[label]}</span><span class="slot-label">${label.split(' ')[0]}</span>`;
        slotBar.appendChild(slot);
    });
}

let dialogueTimer = null;
function currentZoneName() {
    return state.mapId === 'home' ? 'Home Sweet Home' : MAPS[state.mapId].name;
}

function setMessage(text, name) {
    state.message = text;
    dialogueText.textContent = text;
    dialogueName.textContent = name || currentZoneName();
    dialogueHint.textContent = 'continues shortly ▼';
    dialogueBox.classList.add('show');
    clearTimeout(dialogueTimer);
    dialogueTimer = setTimeout(() => dialogueBox.classList.remove('show'), 5200);
}

function presentChoice(npc, type, promptText, options) {
    clearTimeout(dialogueTimer);
    state.pendingChoice = { npc, type, options };
    dialogueName.textContent = npc.name;
    dialogueText.innerHTML = `${promptText}<br><span class="choice-opt">1</span> ${options[0]} &nbsp; <span class="choice-opt">2</span> ${options[1]}`;
    dialogueHint.textContent = 'Press 1 or 2 to respond';
    dialogueBox.classList.add('show');
}

function resolveChoice(optionIndex) {
    const choice = state.pendingChoice;
    if (!choice) return;
    const npc = choice.npc;
    state.pendingChoice = null;

    if (choice.type === 'gift') {
        if (optionIndex === 1) {
            const idx = state.inventory.findIndex(item => item.label === npc.favoriteItem);
            if (idx >= 0) state.inventory.splice(idx, 1);
            npc.giftedFavorite = true;
            npc.relationship += 3;
            state.affection = Math.min(5, state.affection + 1);
            state.score += 50;
            setMessage(npc.giftLine, npc.name);
        } else {
            setMessage(`"Maybe another time then," ${npc.name} says with a small, patient smile.`, npc.name);
        }
    } else if (choice.type === 'flirt') {
        if (optionIndex === 1) {
            npc.relationship += 2;
            state.affection = Math.min(5, state.affection + 1);
            setMessage(`${npc.name} giggles, cheeks warming. "Smooth... I like that about you."`, npc.name);
        } else {
            npc.relationship += 1;
            setMessage(`${npc.name} smirks. "Playing hard to get? Cute strategy."`, npc.name);
        }
    }
    updateUI();
}

function interactWithNpc(npc) {
    state.chatCount += 1;
    state.score += 20;

    if (!npc.metPlayer) {
        npc.metPlayer = true;
        npc.relationship += 1;
        state.affection = Math.min(5, state.affection + 1);
        setMessage(npc.introLine, npc.name);
        updateUI();
        return;
    }

    const hasFavorite = state.inventory.some(item => item.label === npc.favoriteItem);
    if (hasFavorite && !npc.giftedFavorite) {
        presentChoice(npc, 'gift', `You could give ${npc.name} the ${npc.favoriteItem} she adores.`, ['Give it to her', 'Not yet']);
        return;
    }

    if (npc.relationship >= 4 && !npc.milestoneShown) {
        npc.milestoneShown = true;
        npc.relationship += 1;
        state.affection = Math.min(5, state.affection + 1);
        setMessage(npc.milestoneLine, npc.name);
        updateUI();
        return;
    }

    const line = npc.dialogue[npc.dialogueIndex % npc.dialogue.length];
    npc.dialogueIndex += 1;
    setMessage(line, npc.name);

    if (npc.dialogueIndex % 2 === 0) {
        presentChoice(npc, 'flirt', `How do you respond to ${npc.name}?`, ['Flirt back', 'Play it cool']);
    }
}

function flashZoneBanner(name) {
    if (name) zoneBannerTitle.textContent = name;
    zoneBanner.classList.add('show');
    setTimeout(() => zoneBanner.classList.remove('show'), 2600);
}

function travelTo(mapId) {
    if (mapId === state.mapId) { closeModal(); return; }
    spawnWorld(mapId);
    resetPlayerPosition();
    updateCamera();
    setMessage(`You arrive at the ${MAPS[mapId].name}.`, MAPS[mapId].name);
    flashZoneBanner(MAPS[mapId].name);
    closeModal();
}

function enterHome() {
    state.mapId = 'home';
    state.worldWidth = HOME_ROOM.width;
    state.worldHeight = HOME_ROOM.height;
    state.items = [];
    state.artDrops = [];
    state.npcs = [];
    state.trees = [];
    state.bushes = [];
    state.rocks = [];
    state.ferns = [];
    state.logs = [];
    state.flowers = [];
    state.fireflies = [];
    state.signposts = [];
    state.hasPond = false;
    state.homeDoor = { x: HOME_ROOM.width / 2, y: HOME_ROOM.height - 40, exit: true };
    state.player.x = HOME_ROOM.width / 2;
    state.player.y = HOME_ROOM.height - 90;
    state.player.facing = 'down';
    updateCamera();
    setMessage('Your cozy cottage. Press H to decorate, or walk to the door to head out.', 'Home Sweet Home');
    flashZoneBanner('Home Sweet Home');
    closeModal();
}

function exitHome() {
    spawnWorld('grove');
    const spawn = MAPS.grove.homeReturnSpawn;
    state.player.x = spawn.x;
    state.player.y = spawn.y;
    updateCamera();
    setMessage(`Back in the ${MAPS.grove.name}.`, MAPS.grove.name);
    flashZoneBanner(MAPS.grove.name);
}

function openModal(name) {
    state.modal = name;
    state.pendingChoice = null;
    dialogueBox.classList.remove('show');
    clearTimeout(dialogueTimer);
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('show'));
    const el = document.getElementById(`${name}Panel`);
    if (el) el.classList.add('show');
    if (name === 'inventory') renderInventoryPanel();
    if (name === 'travel') renderTravelPanel();
    if (name === 'home') renderHomePanel();
}

function closeModal() {
    state.modal = null;
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('show'));
}

function toggleModal(name) {
    if (state.modal === name) closeModal();
    else openModal(name);
}

function showArtPreview(art) {
    if (!artPreviewImage || !artPreviewTitle) return;
    artPreviewTitle.textContent = art.label;
    artPreviewImage.src = art.src;
    artPreviewImage.alt = art.label;
    openModal('artPreview');
}

function saveHome() {
    try {
        localStorage.setItem('tsukiHome', JSON.stringify(state.home));
    } catch (err) {
        /* ignore storage errors */
    }
}

function renderInventoryPanel() {
    const grid = document.getElementById('inventoryGrid');
    const collectedLabels = state.inventory.map(item => item.label);
    grid.innerHTML = ITEM_TYPES.map(label => {
        const unlocked = collectedLabels.includes(label);
        return `
        <div class="inventory-slot ${unlocked ? 'have' : 'locked'}">
            <span class="icon">${unlocked ? ITEM_ICONS[label] : '❔'}</span>
            <span class="label">${unlocked ? label : '???'}</span>
        </div>
    `;
    }).join('');

    if (artCollectionList) {
        artCollectionList.innerHTML = ART_COLLECTIONS.map(art => {
            const unlocked = !!state.artCollectionUnlocks[art.key];
            return `
        <li class="${unlocked ? 'unlocked' : 'locked'}" ${unlocked ? `data-art-key="${art.key}"` : ''}>
            <span class="art-left"><span class="art-icon">${unlocked ? `<img src="${art.src}" alt="${art.label}">` : '❔'}</span><span>${unlocked ? art.label : '???'}</span></span>
            <span class="art-state">${unlocked ? 'Unlocked' : 'Locked'}</span>
        </li>
    `;
        }).join('');

        artCollectionList.querySelectorAll('[data-art-key]').forEach(el => {
            el.addEventListener('click', () => {
                const art = ART_COLLECTIONS.find(a => a.key === el.dataset.artKey);
                if (!art) return;
                showArtPreview(art);
            });
        });
    }

    const bonds = document.getElementById('bondsList');
    const groveNpcs = (state.mapCache.grove && state.mapCache.grove.npcs) || [];
    bonds.innerHTML = groveNpcs.map(npc => `
        <li>
            <span class="bond-avatar" style="background:${npc.metPlayer ? npc.accent : 'rgba(255,255,255,0.15)'}"></span>
            <span class="bond-name">${npc.metPlayer ? npc.name : '???'}</span>
            <span class="hearts-mini">${'♥'.repeat(Math.min(5, npc.relationship))}${'♡'.repeat(Math.max(0, 5 - npc.relationship))}</span>
        </li>
    `).join('');
}

function renderTravelPanel() {
    const list = document.getElementById('travelList');
    list.innerHTML = Object.keys(MAPS).map(id => `
        <li>
            <button class="travel-btn ${id === state.mapId ? 'current' : ''}" data-map="${id}" ${id === state.mapId ? 'disabled' : ''}>
                <span>${MAPS[id].name}</span><span>${id === state.mapId ? 'You are here' : 'Travel →'}</span>
            </button>
        </li>
    `).join('');
    list.querySelectorAll('.travel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            travelTo(btn.dataset.map);
        });
    });
}

function renderHomePanel() {
    const wallRow = document.getElementById('wallSwatches');
    wallRow.innerHTML = WALL_SWATCHES.map(color => `<button class="swatch ${color === state.home.wallColor ? 'active' : ''}" style="background:${color}" data-wall="${color}"></button>`).join('');
    const floorRow = document.getElementById('floorSwatches');
    floorRow.innerHTML = FLOOR_SWATCHES.map(color => `<button class="swatch ${color === state.home.floorColor ? 'active' : ''}" style="background:${color}" data-floor="${color}"></button>`).join('');

    const furnitureRow = document.getElementById('furnitureToggles');
    const items = [['bed', 'Bed'], ['rug', 'Rug'], ['plant', 'Plant'], ['lamp', 'Lamp']];
    furnitureRow.innerHTML = items.map(([key, label]) => `<button class="furniture-toggle ${state.home.furniture[key] ? 'on' : ''}" data-furniture="${key}">${label}</button>`).join('');

    wallRow.querySelectorAll('[data-wall]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.home.wallColor = btn.dataset.wall;
            saveHome();
            renderHomePanel();
        });
    });
    floorRow.querySelectorAll('[data-floor]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.home.floorColor = btn.dataset.floor;
            saveHome();
            renderHomePanel();
        });
    });
    furnitureRow.querySelectorAll('[data-furniture]').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.furniture;
            state.home.furniture[key] = !state.home.furniture[key];
            saveHome();
            renderHomePanel();
        });
    });
}

function startGame() {
    resizeCanvas();
    state.collected = 0;
    state.score = 0;
    state.chatCount = 0;
    state.affection = 0;
    state.inventory = [];
    state.running = true;
    state.lastInteract = 0;
    state.mapId = 'grove';
    spawnWorld('grove');
    resetPlayerPosition();
    updateUI();
    setMessage('Welcome, cutie. Explore the Whispering Grove and sniff out treats.', 'Whispering Grove');
    flashZoneBanner('Whispering Grove');
    requestAnimationFrame(gameLoop);
}

function updateUI() {
    scoreValue.textContent = state.score;
    tokenValue.textContent = state.collected;
    chatCount.textContent = state.chatCount;

    const hearts = heartsRow.querySelectorAll('.heart');
    hearts.forEach((heart, i) => heart.classList.toggle('filled', i < state.affection));

    const collectedLabels = state.inventory.map(item => item.label);
    slotBar.querySelectorAll('.slot').forEach(slot => {
        slot.classList.toggle('unlocked', collectedLabels.includes(slot.dataset.label));
    });

    missionList.innerHTML = missionHtml();
}

function missionHtml() {
    const groveNpcs = (state.mapCache.grove && state.mapCache.grove.npcs) || [];
    const missions = [
        { label: 'Find the Moon Charm', done: state.inventory.some(item => item.label === 'Moon Charm') },
        { label: 'Cuddle with Mochi', done: state.chatCount > 0 },
        { label: 'Collect 6 treats', done: state.collected >= 6 },
        { label: 'Gift someone their favorite', done: groveNpcs.some(n => n.giftedFavorite) },
        { label: 'Unlock Hijab and Life Suck images', done: !!state.artCollectionUnlocks['hijab-img-1'] && !!state.artCollectionUnlocks['lifesuck-img-1'] }
    ];
    return missions.map(mission => `
        <li class="${mission.done ? 'complete' : ''}">
            <span>${mission.label}</span>
            <span>${mission.done ? 'Done' : 'Open'}</span>
        </li>
    `).join('');
}

function drawGround() {
    const map = MAPS[state.mapId];
    const gradient = ctx.createLinearGradient(0, 0, 0, state.worldHeight);
    gradient.addColorStop(0, map.groundTop);
    gradient.addColorStop(0.4, map.groundMid);
    gradient.addColorStop(1, map.groundBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.worldWidth, state.worldHeight);

    if (state.mapId === 'grove') drawPaths();
    if (state.hasPond) drawPond();
    drawFlowers();
    drawFerns();
    drawRocks();
    drawLogs();
}

function drawPaths() {
    ctx.save();
    ctx.strokeStyle = 'rgba(210,180,120,0.14)';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(state.worldWidth / 2 + 120, state.worldHeight / 2 + 260);
    ctx.quadraticCurveTo(1500, 1100, 1900, 1180);
    ctx.quadraticCurveTo(2150, 900, 2360, 700);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(state.worldWidth / 2 + 120, state.worldHeight / 2 + 260);
    ctx.quadraticCurveTo(1100, 1400, 980, 1560);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(state.worldWidth / 2 + 120, state.worldHeight / 2 + 260);
    ctx.quadraticCurveTo(900, 900, 660, 780);
    ctx.stroke();
    ctx.restore();
}

function drawPond() {
    const cx = state.pond.x;
    const cy = state.pond.y;
    const shimmer = Math.sin(state.tone * 1.4) * 6;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 220 + shimmer, 150 + shimmer * 0.6, 0, 0, Math.PI * 2);
    const water = ctx.createRadialGradient(cx, cy, 20, cx, cy, 240);
    water.addColorStop(0, '#4fa8ff');
    water.addColorStop(1, '#1c5aa8');
    ctx.fillStyle = water;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
        const ringR = 40 + i * 40 + Math.sin(state.tone * 2 + i) * 6;
        ctx.beginPath();
        ctx.ellipse(cx, cy, ringR, ringR * 0.62, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    [[-90, -40], [60, 30], [-40, 60], [110, -30]].forEach(([dx, dy], i) => {
        ctx.fillStyle = '#2e7d4f';
        ctx.beginPath();
        ctx.ellipse(cx + dx, cy + dy + Math.sin(state.tone + i) * 2, 16, 11, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.save();
    ctx.translate(cx + 200, cy - 60);
    ctx.rotate(0.55);
    ctx.fillStyle = '#7a5231';
    ctx.fillRect(-70, -14, 140, 28);
    ctx.fillStyle = '#5c3c20';
    for (let i = -60; i <= 60; i += 20) {
        ctx.fillRect(i - 4, -14, 6, 28);
    }
    ctx.fillStyle = '#4a3018';
    ctx.fillRect(-72, -20, 6, 40);
    ctx.fillRect(66, -20, 6, 40);
    ctx.restore();

    ctx.restore();
}

function drawFlowers() {
    state.flowers.forEach(f => {
        ctx.beginPath();
        ctx.fillStyle = f.hue;
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawFerns() {
    state.ferns.forEach(fern => {
        const sway = Math.sin(state.tone + fern.sway) * 3;
        ctx.save();
        ctx.translate(fern.x, fern.y);
        ctx.scale(fern.scale, fern.scale);
        ctx.strokeStyle = '#2d5a34';
        ctx.lineWidth = 2;
        for (let i = -2; i <= 2; i += 1) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(i * 4 + sway * 0.3, -10, i * 7 + sway, -18);
            ctx.stroke();
        }
        ctx.restore();
    });
}

function drawRocks() {
    state.rocks.forEach(rock => {
        ctx.save();
        ctx.translate(rock.x, rock.y);
        ctx.rotate(rock.rot);
        ctx.fillStyle = '#5b5f5a';
        ctx.beginPath();
        ctx.ellipse(0, 0, rock.w, rock.h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.ellipse(-rock.w * 0.25, -rock.h * 0.3, rock.w * 0.4, rock.h * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawLogs() {
    state.logs.forEach(log => {
        ctx.save();
        ctx.translate(log.x, log.y);
        ctx.rotate(log.rot);
        ctx.fillStyle = '#5c3c22';
        ctx.fillRect(-log.len / 2, -9, log.len, 18);
        ctx.fillStyle = '#7a5231';
        ctx.beginPath();
        ctx.ellipse(log.len / 2, 0, 9, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4a2c18';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(log.len / 2, 0, 5, 5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    });
}

function drawBushes() {
    state.bushes.forEach(bush => {
        ctx.fillStyle = bush.tone;
        ctx.beginPath();
        ctx.arc(bush.x, bush.y, bush.r, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawTreeShape(tree) {
    const sway = Math.sin(state.tone + tree.sway) * 4;
    ctx.save();
    ctx.translate(tree.x, tree.y);
    ctx.scale(tree.scale, tree.scale);
    ctx.fillStyle = '#4a2f1c';
    ctx.fillRect(-tree.thickness / 2, 0, tree.thickness, tree.height);

    if (tree.kind === 'blossom') {
        ctx.fillStyle = '#ffb9dd';
        ctx.beginPath();
        ctx.ellipse(sway, -26, 36, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff9fd0';
        ctx.beginPath();
        ctx.ellipse(sway - 22, -10, 24, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(sway + 22, -12, 26, 28, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = '#1e4a36';
        ctx.beginPath();
        ctx.moveTo(-30, -6);
        ctx.lineTo(0, -58);
        ctx.lineTo(30, -6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#215239';
        ctx.beginPath();
        ctx.moveTo(-24, -30);
        ctx.lineTo(0, -78);
        ctx.lineTo(24, -30);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

function drawItem(item) {
    if (item.collected) return;
    const pulse = Math.sin(state.tone * 2 + item.x * 0.008) * 0.16 + 0.9;
    const radius = 17 * pulse;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.shadowColor = item.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.fillStyle = item.color;
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.icon, 0, 0);
    ctx.restore();
}

function drawArtDrop(drop) {
    if (drop.collected) return;
    const pulse = Math.sin(state.tone * 2.2 + drop.x * 0.007) * 0.16 + 0.94;
    const bob = Math.sin(state.tone * 3 + drop.y * 0.01) * 3;
    const size = 16 * pulse;
    ctx.save();
    ctx.translate(drop.x, drop.y + bob);

    ctx.globalAlpha = 0.33;
    ctx.fillStyle = drop.color;
    ctx.beginPath();
    ctx.arc(0, 0, 24 + pulse * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.shadowColor = drop.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = drop.color;
    roundRect(-size, -size, size * 2, size * 2, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(drop.icon, 0, 0);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f5efe0';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('IMAGE', 0, 26);
    ctx.restore();
}

function drawFireflies() {
    const color = MAPS[state.mapId].particleColor;
    state.fireflies.forEach(fly => {
        const t = state.tone * fly.speed + fly.phase;
        const x = fly.x + Math.cos(t) * fly.radius;
        const y = fly.y + Math.sin(t * 1.3) * fly.radius * 0.6;
        const glow = (Math.sin(t * 3) + 1) / 2;
        ctx.save();
        ctx.globalAlpha = 0.35 + glow * 0.5;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawSignpost(sign) {
    ctx.save();
    ctx.translate(sign.x, sign.y);
    drawShadow(0, 20, 16);
    ctx.fillStyle = '#5c3c20';
    ctx.fillRect(-3, -30, 6, 46);
    ctx.fillStyle = '#7a5231';
    roundRect(-30, -56, 60, 28, 6);
    ctx.fill();
    ctx.strokeStyle = '#4a2c18';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f5efe0';
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('→', 0, -45);
    ctx.font = '9px Georgia, serif';
    ctx.fillText(sign.label, 0, -34);
    ctx.restore();
}

function drawHomeDoor() {
    if (!state.homeDoor) return;
    const d = state.homeDoor;
    ctx.save();
    ctx.translate(d.x, d.y);
    drawShadow(0, 34, 30);
    ctx.fillStyle = '#8a5a3c';
    roundRect(-38, -70, 76, 92, 10);
    ctx.fill();
    ctx.fillStyle = '#5c3c20';
    roundRect(-38, -70, 76, 18, 10);
    ctx.fill();
    ctx.fillStyle = '#3a2410';
    roundRect(-16, -10, 32, 44, 6);
    ctx.fill();
    ctx.fillStyle = '#e8c477';
    ctx.beginPath();
    ctx.arc(10, 10, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5efe0';
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.exit ? 'Exit' : 'Your Cottage', 0, -78);
    ctx.restore();
}

function drawHomeInterior() {
    const w = state.worldWidth;
    const h = state.worldHeight;
    ctx.fillStyle = state.home.wallColor;
    ctx.fillRect(0, 0, w, h * 0.32);
    ctx.fillStyle = state.home.floorColor;
    ctx.fillRect(0, h * 0.32, w, h * 0.68);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, h * 0.32);
        ctx.lineTo(x - 14, h);
        ctx.stroke();
    }

    if (state.home.furniture.rug) {
        ctx.fillStyle = 'rgba(255,140,180,0.35)';
        ctx.beginPath();
        ctx.ellipse(w / 2, h * 0.68, 120, 46, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    if (state.home.furniture.bed) {
        ctx.fillStyle = '#7a5231';
        roundRect(40, h * 0.4, 140, 90, 10);
        ctx.fill();
        ctx.fillStyle = '#ffe6f0';
        roundRect(50, h * 0.4 + 10, 120, 60, 8);
        ctx.fill();
        ctx.fillStyle = '#ff9fd2';
        ctx.beginPath();
        ctx.ellipse(80, h * 0.4 + 30, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    if (state.home.furniture.plant) {
        ctx.fillStyle = '#5c3c20';
        ctx.fillRect(w - 110, h * 0.62, 26, 24);
        ctx.fillStyle = '#2e7d4f';
        ctx.beginPath();
        ctx.ellipse(w - 97, h * 0.58, 22, 30, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    if (state.home.furniture.lamp) {
        ctx.save();
        ctx.fillStyle = '#e8c477';
        ctx.globalAlpha = 0.5 + Math.sin(state.tone * 3) * 0.15;
        ctx.beginPath();
        ctx.arc(w - 70, h * 0.42, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#5c3c20';
        ctx.fillRect(w - 74, h * 0.42, 8, 40);
    }

    drawHomeDoor();
}

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawShadow(x, y, w) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawHair(facing, color, male) {
    ctx.fillStyle = color;
    if (male) {
        if (facing === 'up') {
            ctx.beginPath();
            ctx.arc(0, -25, 12, Math.PI, Math.PI * 2 + 0.2);
            ctx.fill();
            ctx.fillRect(-11, -31, 22, 10);
        } else {
            ctx.beginPath();
            ctx.arc(0, -28.5, 11.5, Math.PI * 0.85, Math.PI * 2.15);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-9, -27);
            ctx.quadraticCurveTo(-11.5, -20, -9.5, -14);
            ctx.quadraticCurveTo(-7, -20, -7.5, -27);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(9, -27);
            ctx.quadraticCurveTo(11.5, -20, 9.5, -14);
            ctx.quadraticCurveTo(7, -20, 7.5, -27);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            ctx.beginPath();
            ctx.ellipse(-3, -34, 4.5, 2, -0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        return;
    }
    if (facing === 'up') {
        ctx.beginPath();
        ctx.arc(0, -25, 12.5, Math.PI, Math.PI * 2 + 0.25);
        ctx.fill();
        ctx.fillRect(-11.5, -32, 23, 15);
        ctx.beginPath();
        ctx.ellipse(-13.5, -17, 3.4, 7.5, -0.25, 0, Math.PI * 2);
        ctx.ellipse(13.5, -17, 3.4, 7.5, 0.25, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.arc(0, -27, 12, Math.PI * 0.9, Math.PI * 2.1);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-9.5, -29);
        ctx.quadraticCurveTo(-15.5, -17, -10.5, -3);
        ctx.quadraticCurveTo(-6.5, -15, -7.5, -28);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(9.5, -29);
        ctx.quadraticCurveTo(15.5, -17, 10.5, -3);
        ctx.quadraticCurveTo(6.5, -15, 7.5, -28);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.24)';
        ctx.beginPath();
        ctx.ellipse(-4.5, -33, 5.5, 2.6, -0.4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawCritterEars(type, primary, secondary) {
    if (type === 'bunny') {
        ctx.save();
        ctx.fillStyle = primary;
        ctx.beginPath(); ctx.ellipse(-7, -42, 4.2, 16, -0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(7, -42, 4.2, 16, 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = secondary;
        ctx.beginPath(); ctx.ellipse(-7, -40, 2, 11, -0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(7, -40, 2, 11, 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    } else if (type === 'cat') {
        ctx.save();
        ctx.fillStyle = primary;
        ctx.beginPath(); ctx.moveTo(-12, -30); ctx.lineTo(-7, -44); ctx.lineTo(-2, -29); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(12, -30); ctx.lineTo(7, -44); ctx.lineTo(2, -29); ctx.closePath(); ctx.fill();
        ctx.fillStyle = secondary;
        ctx.beginPath(); ctx.moveTo(-9, -31); ctx.lineTo(-7, -39); ctx.lineTo(-4, -30); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(9, -31); ctx.lineTo(7, -39); ctx.lineTo(4, -30); ctx.closePath(); ctx.fill();
        ctx.restore();
    }
}

function drawTail(type, color, sideView) {
    ctx.save();
    if (type === 'bunny') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(sideView ? -10 : 0, 13, 5.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.arc(sideView ? -11.5 : -1.5, 11.3, 2, 0, Math.PI * 2);
        ctx.fill();
    } else if (type === 'cat') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sideView ? -8 : -6, 9);
        ctx.quadraticCurveTo(sideView ? -22 : -18, -2, sideView ? -15 : -3, -13);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sideView ? -15 : -3, -13, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawHuman(entity, opts) {
    const bobAmt = entity.moving ? Math.sin(entity.walkCycle) * 2 : Math.sin(state.tone * 1.5 + entity.x * 0.01) * 1;
    const x = entity.x;
    const y = entity.y + bobAmt;
    const facing = entity.facing || 'down';
    const flip = facing === 'left';
    const sideView = facing === 'left' || facing === 'right';

    drawShadow(entity.x, entity.y + 24, 15);

    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);

    const legSwing = entity.moving ? Math.sin(entity.walkCycle) * 6 : 0;
    const shoeColor = opts.accent || '#5a4634';

    ctx.fillStyle = opts.pants || opts.skin;
    roundRect(-7 + legSwing * 0.15, 9, 5.5, 12 - Math.abs(legSwing) * 0.15, 2.4);
    ctx.fill();
    roundRect(1.5 - legSwing * 0.15, 9, 5.5, 12 - Math.abs(legSwing) * 0.15, 2.4);
    ctx.fill();
    ctx.fillStyle = shoeColor;
    ctx.beginPath();
    ctx.ellipse(-4.2 + legSwing * 0.15, 21 - Math.abs(legSwing) * 0.15, 4, 2.6, 0, 0, Math.PI * 2);
    ctx.ellipse(4.2 - legSwing * 0.15, 21 - Math.abs(legSwing) * 0.15, 4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    if (opts.tailType) drawTail(opts.tailType, opts.accent, sideView);

    if (opts.male) {
        ctx.fillStyle = opts.outfit;
        roundRect(-9.5, -14, 19, 25, 6);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.ellipse(-3, -4, 2.4, 9, -0.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(20,15,12,0.4)';
        roundRect(-8.5, 6, 17, 2.2, 1.1);
        ctx.fill();
    } else {
        ctx.fillStyle = opts.outfit;
        ctx.beginPath();
        ctx.moveTo(-9.5, -14);
        ctx.quadraticCurveTo(-11.5, -3, -7.5, 5);
        ctx.quadraticCurveTo(-13, 9, -13.5, 15);
        ctx.quadraticCurveTo(0, 18.5, 13.5, 15);
        ctx.quadraticCurveTo(13, 9, 7.5, 5);
        ctx.quadraticCurveTo(11.5, -3, 9.5, -14);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.beginPath();
        ctx.ellipse(-3.5, -6, 2.6, 8.5, -0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = opts.accent || 'rgba(255,255,255,0.4)';
        roundRect(-8, 3.4, 16, 2.6, 1.3);
        ctx.fill();
    }

    const armSwing = entity.moving ? Math.sin(entity.walkCycle + Math.PI) * 5 : 0;
    ctx.fillStyle = opts.outfit;
    ctx.beginPath();
    ctx.ellipse(-11, -8 + armSwing * 0.2, 4.4, 6, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(11, -8 - armSwing * 0.2, 4.4, 6, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = opts.skin;
    ctx.beginPath();
    ctx.ellipse(-11.5, -1 + armSwing * 0.35, 3.6, 8, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(11.5, -1 - armSwing * 0.35, 3.6, 8, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-11.8, 5 + armSwing * 0.4, 2.6, 0, Math.PI * 2);
    ctx.arc(11.8, 5 - armSwing * 0.4, 2.6, 0, Math.PI * 2);
    ctx.fill();

    const headGrad = ctx.createRadialGradient(-3, -28, 2, 0, -24, 13);
    headGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
    headGrad.addColorStop(0.4, opts.skin);
    headGrad.addColorStop(1, opts.skin);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, -24, 11.5, 0, Math.PI * 2);
    ctx.fill();

    if (opts.earType) drawCritterEars(opts.earType, opts.accent, opts.earColor);
    drawHair(facing, opts.hair, opts.male);

    if (facing === 'down') {
        ctx.strokeStyle = 'rgba(40,25,30,0.75)';
        ctx.lineWidth = opts.male ? 1.4 : 1.1;
        ctx.beginPath();
        if (opts.male) {
            ctx.moveTo(-6.5, -28.2); ctx.lineTo(-2, -28.6);
            ctx.moveTo(6.5, -28.2); ctx.lineTo(2, -28.6);
        } else {
            ctx.moveTo(-6.5, -27.5); ctx.quadraticCurveTo(-4, -29, -1.8, -27.8);
            ctx.moveTo(6.5, -27.5); ctx.quadraticCurveTo(4, -29, 1.8, -27.8);
        }
        ctx.stroke();

        ctx.fillStyle = '#2b1c22';
        ctx.beginPath();
        ctx.ellipse(-4.2, -24, opts.male ? 1.7 : 2, opts.male ? 2.2 : 2.6, 0, 0, Math.PI * 2);
        ctx.ellipse(4.2, -24, opts.male ? 1.7 : 2, opts.male ? 2.2 : 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-4.9, -24.8, 0.7, 0, Math.PI * 2);
        ctx.arc(3.5, -24.8, 0.7, 0, Math.PI * 2);
        ctx.fill();

        if (opts.male) {
            ctx.strokeStyle = 'rgba(90,60,45,0.55)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(0, -19.5, 2.1, 0.2 * Math.PI, 0.8 * Math.PI);
            ctx.stroke();
        } else {
            ctx.strokeStyle = '#2b1c22';
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(-6, -25.6); ctx.lineTo(-7.2, -26.6);
            ctx.moveTo(6, -25.6); ctx.lineTo(7.2, -26.6);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,130,170,0.55)';
            ctx.beginPath();
            ctx.ellipse(-7.5, -20.5, 2.8, 1.8, 0, 0, Math.PI * 2);
            ctx.ellipse(7.5, -20.5, 2.8, 1.8, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(220,90,120,0.85)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(0, -19, 2.2, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
        }
    } else if (sideView) {
        ctx.fillStyle = '#2b1c22';
        ctx.beginPath();
        ctx.ellipse(6, -25, 1.5, opts.male ? 1.9 : 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(6.6, -25.7, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = opts.male ? 'rgba(90,60,45,0.5)' : 'rgba(220,90,120,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(7, -19.5, 1.6, 0, 0.6 * Math.PI);
        ctx.stroke();
    }

    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.label || '', entity.x, entity.y + 40);
}

function drawNpc(npc) {
    drawHuman(npc, {
        skin: npc.skin, hair: npc.hair, outfit: npc.outfit,
        accent: npc.accent, earColor: npc.earColor, earType: npc.earType, tailType: npc.tailType,
        label: npc.name
    });
}

function drawPlayer() {
    drawHuman(state.player, {
        skin: state.player.skin, hair: state.player.hair, outfit: state.player.outfit,
        pants: state.player.pants, male: true
    });
}

function drawMinimap() {
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    minimapCtx.clearRect(0, 0, w, h);
    minimapCtx.fillStyle = 'rgba(10,22,14,0.92)';
    minimapCtx.beginPath();
    minimapCtx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
    minimapCtx.fill();

    minimapCtx.save();
    minimapCtx.beginPath();
    minimapCtx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    minimapCtx.clip();

    const scaleX = w / state.worldWidth;
    const scaleY = h / state.worldHeight;

    if (state.hasPond) {
        minimapCtx.fillStyle = 'rgba(70,150,255,0.55)';
        minimapCtx.beginPath();
        minimapCtx.arc(state.pond.x * scaleX, state.pond.y * scaleY, 10, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    state.items.forEach(item => {
        if (item.collected) return;
        minimapCtx.fillStyle = '#ffd76b';
        minimapCtx.beginPath();
        minimapCtx.arc(item.x * scaleX, item.y * scaleY, 2.6, 0, Math.PI * 2);
        minimapCtx.fill();
    });

    state.artDrops.forEach(drop => {
        if (drop.collected) return;
        minimapCtx.fillStyle = '#8ce9ff';
        minimapCtx.beginPath();
        minimapCtx.rect(drop.x * scaleX - 2.4, drop.y * scaleY - 2.4, 4.8, 4.8);
        minimapCtx.fill();
    });

    state.npcs.forEach(npc => {
        minimapCtx.fillStyle = npc.accent;
        minimapCtx.beginPath();
        minimapCtx.arc(npc.x * scaleX, npc.y * scaleY, 3.2, 0, Math.PI * 2);
        minimapCtx.fill();
    });

    minimapCtx.fillStyle = '#ffffff';
    minimapCtx.beginPath();
    minimapCtx.arc(state.player.x * scaleX, state.player.y * scaleY, 4, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.strokeStyle = 'rgba(255,255,255,0.7)';
    minimapCtx.lineWidth = 1.3;
    minimapCtx.stroke();

    minimapCtx.restore();
}

function drawScene() {
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.save();
    ctx.translate(-state.camera.x, -state.camera.y);

    if (state.mapId === 'home') {
        drawHomeInterior();
        drawPlayer();
    } else {
        drawGround();
        drawBushes();

        const sortables = [
            ...state.trees.map(t => ({ y: t.y, draw: () => drawTreeShape(t) })),
            ...state.npcs.map(n => ({ y: n.y, draw: () => drawNpc(n) })),
            ...state.signposts.map(s => ({ y: s.y, draw: () => drawSignpost(s) })),
            ...(state.homeDoor ? [{ y: state.homeDoor.y, draw: () => drawHomeDoor() }] : []),
            { y: state.player.y, draw: () => drawPlayer() }
        ];
        sortables.sort((a, b) => a.y - b.y);
        sortables.forEach(entry => entry.draw());

        state.items.forEach(drawItem);
        state.artDrops.forEach(drawArtDrop);
        drawFireflies();
    }
    ctx.restore();

    drawMinimap();
}

function findNearestItem() {
    const remaining = state.items.filter(item => !item.collected);
    if (!remaining.length) return null;
    remaining.sort((a, b) => {
        const da = Math.hypot(a.x - state.player.x, a.y - state.player.y);
        const db = Math.hypot(b.x - state.player.x, b.y - state.player.y);
        return da - db;
    });
    return remaining[0];
}

function updatePlayer() {
    if (state.modal) return;
    const p = state.player;
    let moved = false;
    if (state.input.left) { p.x -= p.speed; moved = true; p.facing = 'left'; }
    if (state.input.right) { p.x += p.speed; moved = true; p.facing = 'right'; }
    if (state.input.up) { p.y -= p.speed; moved = true; p.facing = 'up'; }
    if (state.input.down) { p.y += p.speed; moved = true; p.facing = 'down'; }
    p.x = clamp(p.x, p.size, state.worldWidth - p.size);
    p.y = clamp(p.y, p.size, state.worldHeight - p.size);
    p.moving = moved;
    if (moved) {
        p.walkCycle += 0.22;
        updateCamera();
    }

    const touchedArt = state.artDrops.find(drop => !drop.collected && Math.hypot(drop.x - p.x, drop.y - p.y) < 28);
    if (touchedArt) {
        touchedArt.collected = true;
        state.artCollectionUnlocks[touchedArt.key] = true;
        saveArtUnlocks();
        state.score += 60;
        setMessage(`Image unlocked: ${touchedArt.label}. Open Satchel and tap it to view the real file.`, 'Collection Found');
        updateUI();
        return;
    }

    if (state.input.interact && Date.now() - state.lastInteract > 280) {
        state.lastInteract = Date.now();
        const nearestItem = state.items.find(item => !item.collected && Math.hypot(item.x - p.x, item.y - p.y) < 54);
        if (nearestItem) {
            nearestItem.collected = true;
            state.collected += 1;
            state.score += 30;
            state.inventory.push(nearestItem);
            state.affection = Math.min(5, state.collected);
            setMessage(`You found the ${nearestItem.label}! Someone nearby is going to be very pleased.`);
            return;
        }

        const nearestArt = state.artDrops.find(drop => !drop.collected && Math.hypot(drop.x - p.x, drop.y - p.y) < 58);
        if (nearestArt) {
            nearestArt.collected = true;
            state.artCollectionUnlocks[nearestArt.key] = true;
            saveArtUnlocks();
            state.score += 60;
            setMessage(`Image unlocked: ${nearestArt.label}. Open Satchel and tap it to view the real file.`, 'Collection Found');
            updateUI();
            return;
        }

        const npc = state.npcs.find(n => Math.hypot(n.x - p.x, n.y - p.y) < 86);
        if (npc) {
            interactWithNpc(npc);
            return;
        }

        const signpost = state.signposts.find(s => Math.hypot(s.x - p.x, s.y - p.y) < 70);
        if (signpost) {
            travelTo(signpost.target);
            return;
        }

        if (state.homeDoor && Math.hypot(state.homeDoor.x - p.x, state.homeDoor.y - p.y) < 70) {
            if (state.homeDoor.exit) exitHome();
            else enterHome();
            return;
        }

        setMessage('No one is close enough to cuddle. Wander closer to a glowing treat, a cutie, a signpost, or your door.');
    }
}

function updateNpcs() {
    state.npcs.forEach(npc => {
        const t = state.tone * 0.6 + npc.phase;
        const vx = Math.cos(t) * 0.6;
        const vy = -Math.sin(state.tone * 0.4 + npc.phase) * 0.4;
        npc.x = npc.baseX + Math.sin(t) * 34;
        npc.y = npc.baseY + Math.cos(state.tone * 0.4 + npc.phase) * 20;
        npc.walkCycle = state.tone * 4 + npc.phase;
        npc.facing = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
    });
}

function showHint() {
    if (state.mapId !== 'grove') {
        setMessage('Treats are hidden back in the Whispering Grove — travel there with M to hunt for more.', currentZoneName());
        return;
    }
    const closest = findNearestItem();
    if (!closest) {
        setMessage('Your satchel is full of treats — the whole grove adores you!', 'Whispering Grove');
        return;
    }
    const dx = closest.x - state.player.x;
    const dy = closest.y - state.player.y;
    const direction = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'east' : 'west')
        : (dy > 0 ? 'south' : 'north');
    setMessage(`Hint: something sweet is waiting to the ${direction}. Follow your nose.`, 'Whispering Grove');
}

function gameLoop() {
    if (!state.running) return;
    state.tone += 0.02;
    updatePlayer();
    updateNpcs();
    drawScene();
    updateUI();

    if (state.mapId === 'grove' && state.items.length && state.items.every(item => item.collected)) {
        state.running = false;
        setMessage('Every treat is found! The grove glows with warm, flirty affection just for you.', 'Whispering Grove');
        updateUI();
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, state.width, state.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('Tsuki Odyssey complete!', state.width / 2, state.height / 2 - 14);
        ctx.font = '17px Georgia, serif';
        ctx.fillText('Restart to cuddle up all over again.', state.width / 2, state.height / 2 + 22);
        ctx.restore();
        return;
    }
    requestAnimationFrame(gameLoop);
}

function handleKeyState(key, isPressed) {
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') state.input.left = isPressed;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') state.input.right = isPressed;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') state.input.up = isPressed;
    if (key === 'ArrowDown' || key === 's' || key === 'S') state.input.down = isPressed;
    if (key === 'e' || key === 'E') state.input.interact = isPressed;
}

function handleActionKey(key) {
    if (key === 'Escape') {
        if (state.modal) closeModal();
        return;
    }

    if (state.pendingChoice && (key === '1' || key === '2')) {
        resolveChoice(Number(key));
        return;
    }

    const now = Date.now();
    if (now - state.lastAction < 260) return;

    if (key === 'i' || key === 'I') {
        state.lastAction = now;
        toggleModal('inventory');
    } else if (key === 'm' || key === 'M') {
        state.lastAction = now;
        toggleModal('travel');
    } else if (key === 'h' || key === 'H') {
        state.lastAction = now;
        if (state.mapId === 'home') toggleModal('home');
        else enterHome();
    } else if (key === 'k' || key === 'K') {
        state.lastAction = now;
        toggleModal('keybinds');
    }
}

window.addEventListener('keydown', event => {
    handleKeyState(event.key, true);
    handleActionKey(event.key);
});
window.addEventListener('keyup', event => handleKeyState(event.key, false));
window.addEventListener('resize', () => {
    resizeCanvas();
    if (state.running) drawScene();
});

hintBtn.addEventListener('click', showHint);
restartBtn.addEventListener('click', () => {
    state.running = false;
    startGame();
});
satchelBtn.addEventListener('click', () => toggleModal('inventory'));
travelBtn.addEventListener('click', () => toggleModal('travel'));
homeBtn.addEventListener('click', () => {
    if (state.mapId === 'home') toggleModal('home');
    else enterHome();
});
keysBtn.addEventListener('click', () => toggleModal('keybinds'));

document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', closeModal);
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', event => {
        if (event.target === overlay) closeModal();
    });
});

buildHearts();
buildSlots();
startGame();
