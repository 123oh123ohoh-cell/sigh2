(function () {
    var DEFAULT_THEME = 'dark';
    var DEFAULT_ACCENT = '#d12a7a';
    var DEFAULT_PROFILE_AVATAR = 'logos_and_profileicons/defaultpfp.webp';
    var VAGINA_TEXTURE_IMAGES = [
        'vagina/2492938.png',
        'vagina/6205268.png',
        'vagina/8441522.png'
    ];
    var profileFetchInFlight = null;
    var profilePrefetchStarted = false;
    var mobileNavOutsideClickWired = false;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function detectMobileClient() {
        var hasTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        var smallViewport = window.innerWidth <= 900;
        var ua = navigator.userAgent || '';
        var uaMobile = /Android|iPhone|iPad|iPod|Windows Phone|Opera Mini|IEMobile/i.test(ua);
        var uaDataMobile = !!(navigator.userAgentData && navigator.userAgentData.mobile);
        return uaMobile || uaDataMobile || (smallViewport && hasTouch);
    }

    function applyDeviceMode() {
        var body = document.body;
        if (!body) {
            return;
        }
        var fileName = String((window.location && window.location.pathname) || '').split('/').pop().toLowerCase();
        body.classList.toggle('raw-page', fileName.indexOf('raw') !== -1);

        var isMobile = detectMobileClient();
        body.classList.toggle('mobile-mode', isMobile);
        body.classList.toggle('desktop-mode', !isMobile);
        body.setAttribute('data-device', isMobile ? 'mobile' : 'desktop');
        document.documentElement.style.setProperty('--app-vh', (window.innerHeight * 0.01) + 'px');

        if (!isMobile) {
            closeAllMobileNavMenus();
        }
    }

    function closeAllMobileNavMenus() {
        var headers = document.querySelectorAll('.header.mobile-nav-open');
        headers.forEach(function (header) {
            header.classList.remove('mobile-nav-open');
            var logo = header.querySelector('.logo');
            if (logo) {
                logo.setAttribute('aria-expanded', 'false');
            }
            var menuBtn = header.querySelector('.mobile-menu-btn');
            if (menuBtn) {
                menuBtn.setAttribute('aria-expanded', 'false');
            }
        });
        applyLogoTheme(getSavedState().mode);
    }

    function ensureHomeLinkInNavBars() {
        var navLists = document.querySelectorAll('.header .nav-links');
        navLists.forEach(function (nav) {
            var hasHome = Array.prototype.slice.call(nav.querySelectorAll('a')).some(function (link) {
                var href = String(link.getAttribute('href') || '').trim().toLowerCase();
                var text = String(link.textContent || '').trim().toLowerCase();
                return text === 'home' || href === 'index.html' || /\/index\.html(?:[#?].*)?$/.test(href) || href === '/';
            });

            if (!hasHome) {
                var homeLink = document.createElement('a');
                homeLink.href = 'index.html';
                homeLink.className = 'nav-link';
                homeLink.textContent = 'Home';
                nav.insertBefore(homeLink, nav.firstChild);
            }
        });
    }

    function wireLogoPressOriginalColorPreview() {
        var logos = document.querySelectorAll('.header .logo');
        logos.forEach(function (logo) {
            if (!logo || logo.dataset.logoPressPreviewWired === '1') {
                return;
            }
            logo.dataset.logoPressPreviewWired = '1';

            function restoreOriginalLogoColor() {
                var image = logo.querySelector('img');
                if (image) {
                    image.style.filter = '';
                }
                logo.dataset.logoPreviewActive = '1';
                window.setTimeout(function () {
                    if (logo.dataset.logoPreviewActive === '1') {
                        delete logo.dataset.logoPreviewActive;
                        applyLogoTheme(getSavedState().mode);
                    }
                }, 220);
            }

            logo.addEventListener('pointerdown', restoreOriginalLogoColor);
            logo.addEventListener('mousedown', restoreOriginalLogoColor);
            logo.addEventListener('touchstart', restoreOriginalLogoColor, { passive: true });
            logo.addEventListener('click', function (event) {
                var body = document.body;
                if (!body || !body.classList.contains('mobile-mode')) {
                    return;
                }
                var href = String(logo.getAttribute('href') || '').trim();
                if (!href || href.charAt(0) === '#' || /^javascript:/i.test(href)) {
                    return;
                }
                event.preventDefault();
                restoreOriginalLogoColor();
                var targetUrl;
                try {
                    targetUrl = new URL(href, window.location.href);
                } catch (e) {
                    targetUrl = null;
                }
                if (targetUrl && targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search && targetUrl.hash === window.location.hash) {
                    return;
                }
                window.setTimeout(function () {
                    window.location.href = href;
                }, 220);
            });
            logo.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    restoreOriginalLogoColor();
                }
            });
        });
    }

    function normalizeNavTarget(value) {
        var href = String(value || '').trim().toLowerCase();
        if (!href || href === '/' || href === './') {
            return 'index.html';
        }
        if (href.indexOf('#') !== -1) {
            href = href.split('#')[0];
        }
        if (href.indexOf('?') !== -1) {
            href = href.split('?')[0];
        }
        if (href.charAt(href.length - 1) === '/') {
            return 'index.html';
        }
        return href.split('/').pop() || 'index.html';
    }

    function updateCurrentNavLinkState(nav) {
        if (!nav) {
            return;
        }
        var current = normalizeNavTarget(window.location && window.location.pathname);
        var matchTarget = current;

        // Treat all arts-related pages as the Arts section for nav highlighting.
        if (current.indexOf('arts') !== -1) {
            matchTarget = 'arts.html';
        }

        // Treat premium page as the Premium section for nav highlighting.
        if (current.indexOf('premium') !== -1) {
            matchTarget = 'premium.html';
        }

        var links = Array.prototype.slice.call(nav.querySelectorAll('a.nav-link'));
        var homeOnlyLink = null;
        var collectionsOnlyLink = null;

        if (current === 'index.html') {
            homeOnlyLink = links.find(function (link) {
                var text = String(link.textContent || '').trim().toLowerCase();
                return text === 'home';
            }) || links.find(function (link) {
                return normalizeNavTarget(link.getAttribute('href')) === 'index.html';
            }) || null;
        }

        if (current.indexOf('collections') !== -1) {
            collectionsOnlyLink = links.find(function (link) {
                var text = String(link.textContent || '').trim().toLowerCase();
                return text.indexOf('collection') !== -1;
            }) || null;
        }

        links.forEach(function (link) {
            var target = normalizeNavTarget(link.getAttribute('href'));
            var isCurrent = homeOnlyLink
                ? (link === homeOnlyLink)
                : (collectionsOnlyLink ? (link === collectionsOnlyLink) : (target === matchTarget));
            link.classList.toggle('nav-link-current', isCurrent);
            link.classList.toggle('nav-link-active', isCurrent);
            link.classList.toggle('mobile-nav-current', isCurrent);
            link.setAttribute('aria-current', isCurrent ? 'page' : 'false');
        });
    }


    function wireMobileLogoNavToggle() {
        ensureHomeLinkInNavBars();
        wireLogoPressOriginalColorPreview();
        // Upload link injection removed; now only in index.html
        var headers = document.querySelectorAll('.header');
        headers.forEach(function (header, index) {
            var logo = header.querySelector('.logo');
            var nav = header.querySelector('.nav-links');
            if (!logo || !nav || logo.dataset.mobileNavWired === '1') {
                return;
            }

            var menuBtn = header.querySelector('.mobile-menu-btn');
            if (!menuBtn) {
                menuBtn = document.createElement('button');
                menuBtn.type = 'button';
                menuBtn.className = 'mobile-menu-btn';
                menuBtn.setAttribute('aria-label', 'Toggle navigation menu');
                menuBtn.textContent = '\u2630';
                header.insertBefore(menuBtn, header.firstChild);
            }

            if (!nav.id) {
                nav.id = 'mobile-nav-' + index;
            }

            updateCurrentNavLinkState(nav);

            logo.dataset.mobileNavWired = '1';
            logo.setAttribute('aria-controls', nav.id);
            logo.setAttribute('aria-expanded', 'false');
            menuBtn.setAttribute('aria-controls', nav.id);
            menuBtn.setAttribute('aria-expanded', 'false');

            function setMenuOpen(open) {
                header.classList.toggle('mobile-nav-open', !!open);
                logo.setAttribute('aria-expanded', open ? 'true' : 'false');
                menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
                applyLogoTheme(getSavedState().mode);
            }

            function toggleMenu(event) {
                var body = document.body;
                if (!body || !body.classList.contains('mobile-mode')) {
                    return;
                }
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                var shouldOpen = !header.classList.contains('mobile-nav-open');
                closeAllMobileNavMenus();
                setMenuOpen(shouldOpen);
            }

            menuBtn.addEventListener('pointerdown', function (event) {
                menuBtn.dataset.lastPointerToggleAt = String(Date.now());
                toggleMenu(event);
            });

            menuBtn.addEventListener('click', function (event) {
                var lastPointerToggleAt = parseInt(menuBtn.dataset.lastPointerToggleAt || '0', 10);
                if (Date.now() - lastPointerToggleAt < 450) {
                    // Ignore synthetic click after pointerdown to avoid double toggle.
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                toggleMenu(event);
            });

            nav.addEventListener('click', function (event) {
                var body = document.body;
                if (!body || !body.classList.contains('mobile-mode')) {
                    return;
                }
                var link = event.target.closest('a');
                if (link) {
                    nav.querySelectorAll('a.nav-link').forEach(function (item) {
                        item.classList.remove('mobile-nav-tap-active');
                    });
                    link.classList.add('mobile-nav-tap-active');
                    setMenuOpen(false);
                }
            });

            nav.addEventListener('pointerdown', function (event) {
                var link = event.target.closest('a.nav-link');
                if (!link) {
                    return;
                }
                nav.querySelectorAll('a.nav-link').forEach(function (item) {
                    item.classList.remove('mobile-nav-tap-active');
                });
                link.classList.add('mobile-nav-tap-active');
            });
        });

        if (!mobileNavOutsideClickWired) {
            mobileNavOutsideClickWired = true;
            document.addEventListener('pointerdown', function (event) {
                var body = document.body;
                if (!body || !body.classList.contains('mobile-mode')) {
                    return;
                }
                if (!event.target.closest('.header')) {
                    closeAllMobileNavMenus();
                }
            });
            document.addEventListener('click', function (event) {
                var body = document.body;
                if (!body || !body.classList.contains('mobile-mode')) {
                    return;
                }
                if (!event.target.closest('.header')) {
                    closeAllMobileNavMenus();
                }
            });
        }
    }

    function shouldShowSectionBackButton(fileName) {
        if (!fileName) {
            return false;
        }
        return fileName.indexOf('collections') !== -1 || fileName.indexOf('arts') !== -1 || fileName.indexOf('vagina') !== -1 || fileName.indexOf('hypnosis') !== -1 || fileName.indexOf('raw') !== -1 || fileName.indexOf('cum') !== -1 || fileName.indexOf('baby') !== -1 || fileName.indexOf('came') !== -1 || fileName.indexOf('imcuming') !== -1 || /-2\.html$/.test(fileName);
    }

    function getSectionFallbackTarget(fileName) {
        if (fileName === 'collections.html' || fileName === 'collections-2.html') {
            return 'index.html';
        }
        if (fileName === 'arts.html') {
            return 'index.html';
        }
        if (fileName.indexOf('arts') !== -1) {
            return 'collections.html';
        }
        if (fileName.indexOf('vagina') !== -1) {
            return 'vagina-collections.html';
        }
        if (fileName.indexOf('hypnosis') !== -1) {
            return 'collections.html';
        }
        if (fileName.indexOf('raw') !== -1) {
            return 'raw-collections.html';
        }
        if (fileName.indexOf('cum') !== -1 || fileName.indexOf('baby') !== -1) {
            return 'clack-collections.html';
        }
        if (fileName.indexOf('came') !== -1) {
            return 'clack-collections.html';
        }
        if (/-2\.html$/.test(fileName)) {
            return 'collections.html';
        }
        return 'collections.html';
    }

    function positionCollectionsBackButton(button) {
        if (!button) {
            return;
        }
        var header = document.querySelector('.header');
        if (!header) {
            button.style.top = '84px';
            return;
        }
        var rect = header.getBoundingClientRect();
        var top = Math.max(56, Math.round(rect.bottom + 10));
        button.style.top = top + 'px';
    }

    function ensureSectionBackButton() {
        var path = String((window.location && window.location.pathname) || '').toLowerCase();
        var fileName = path.split('/').pop();
        if (!shouldShowSectionBackButton(fileName)) {
            return;
        }

        var existing = document.getElementById('collectionsBackBtn');
        if (existing) {
            existing.classList.toggle('is-vagina-page', fileName.indexOf('vagina') !== -1);
            existing.classList.toggle('is-baby2-page', /-2\.html$/.test(fileName));
            positionCollectionsBackButton(existing);
            return;
        }

        var button = document.createElement('button');
        button.id = 'collectionsBackBtn';
        button.className = 'collections-back-btn';
        if (fileName.indexOf('vagina') !== -1) {
            button.classList.add('is-vagina-page');
        }
        if (/-2\.html$/.test(fileName)) {
            button.classList.add('is-baby2-page');
        }
        button.type = 'button';
        button.textContent = '\u2190 Back';
        button.setAttribute('aria-label', 'Go back to previous page');
        button.addEventListener('click', function () {
            if (window.history.length > 1) {
                window.history.back();
                return;
            }
            window.location.href = getSectionFallbackTarget(fileName);
        });

        document.body.appendChild(button);
        positionCollectionsBackButton(button);

        if (!window._collectionsBackBtnPosWired) {
            window._collectionsBackBtnPosWired = true;
            window.addEventListener('resize', function () {
                positionCollectionsBackButton(document.getElementById('collectionsBackBtn'));
            });
            window.addEventListener('orientationchange', function () {
                positionCollectionsBackButton(document.getElementById('collectionsBackBtn'));
            });
        }
    }

    function initVagina2TextureBackground() {
        var path = String((window.location && window.location.pathname) || '').toLowerCase();
        var fileName = path.split('/').pop();
        if (!/vagina2\.html$/.test(fileName)) {
            return;
        }

        if (document.getElementById('vagina2BgTexture')) {
            return;
        }

        var imageSources = VAGINA_TEXTURE_IMAGES.slice();

        if (!imageSources.length) {
            return;
        }

        var layer = document.createElement('div');
        layer.id = 'vagina2BgTexture';
        layer.className = 'vagina2-bg-texture';

        var gridA = document.createElement('div');
        gridA.className = 'vagina2-bg-grid layer-a';
        layer.appendChild(gridA);

        var gridB = document.createElement('div');
        gridB.className = 'vagina2-bg-grid layer-b';
        layer.appendChild(gridB);

        var movers = document.createElement('div');
        movers.className = 'vagina2-bg-movers';
        layer.appendChild(movers);

        var lanePercents = [4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92];
        for (var i = 0; i < lanePercents.length; i += 1) {
            var mover = document.createElement('img');
            mover.className = 'vagina2-bg-mover';
            mover.src = imageSources[i % imageSources.length];
            mover.alt = '';
            mover.setAttribute('aria-hidden', 'true');
            mover.style.setProperty('--lane-x', lanePercents[i] + 'vw');
            mover.style.setProperty('--mover-size', (72 + (i % 3) * 14) + 'px');
            mover.style.setProperty('--mover-duration', (15 + (i % 4) * 2.5) + 's');
            mover.style.setProperty('--mover-delay', String(i * -1.8) + 's');
            mover.style.setProperty('--drift', ((i % 2 === 0 ? 1 : -1) * (6 + (i % 3) * 2)) + 'px');
            movers.appendChild(mover);
        }

        document.body.classList.add('vagina2-texture-active');
        document.body.prepend(layer);
    }

    function initImcumingFireworks() {
        var path = String((window.location && window.location.pathname) || '').toLowerCase();
        var fileName = path.split('/').pop();
        if (!/imcuming\d*\.html$/.test(fileName)) {
            return;
        }
        if (document.getElementById('imcumingFireworks')) {
            return;
        }

        var layer = document.createElement('div');
        layer.id = 'imcumingFireworks';
        layer.className = 'imcuming-fireworks';

        for (var i = 0; i < 18; i += 1) {
            var fw = document.createElement('span');
            fw.className = 'imcuming-firework';
            fw.setAttribute('aria-hidden', 'true');
            var xValue = (4 + Math.random() * 92).toFixed(2) + 'vw';
            var peakValue = (9 + Math.random() * 50).toFixed(2) + 'vh';
            var delayValue = -1 * (Math.random() * 9);
            fw.style.setProperty('--x', xValue);
            fw.style.setProperty('--peak', peakValue);
            fw.style.setProperty('--size', (44 + Math.random() * 44).toFixed(0) + 'px');
            fw.style.setProperty('--delay', delayValue.toFixed(2) + 's');
            fw.style.setProperty('--duration', (3.5 + Math.random() * 2.3).toFixed(2) + 's');
            fw.style.setProperty('--hue', String(318 + Math.round(Math.random() * 26)));
            layer.appendChild(fw);

            for (var j = 0; j < 4; j += 1) {
                var drop = document.createElement('span');
                drop.className = 'imcuming-milk-drop';
                drop.setAttribute('aria-hidden', 'true');
                drop.style.setProperty('--x', xValue);
                drop.style.setProperty('--peak', peakValue);
                drop.style.setProperty('--dx', ((Math.random() * 22) - 11).toFixed(2) + 'vw');
                drop.style.setProperty('--fall', (16 + Math.random() * 32).toFixed(2) + 'vh');
                drop.style.setProperty('--drop-size', (7 + Math.random() * 10).toFixed(0) + 'px');
                drop.style.setProperty('--delay', (delayValue + 0.35 + Math.random() * 0.5).toFixed(2) + 's');
                drop.style.setProperty('--duration', (3.5 + Math.random() * 2.3).toFixed(2) + 's');
                layer.appendChild(drop);
            }
        }

        document.body.classList.add('imcuming-fireworks-active');
        document.body.prepend(layer);
    }

    function normalizeTheme(theme) {
        var normalized = String(theme || '').toLowerCase();
        if (normalized === 'light' || normalized === 'dark') {
            return normalized;
        }
        return DEFAULT_THEME;
    }

    function getSavedState() {
        var rawTheme = String(localStorage.getItem('appearanceTheme') || '').toLowerCase();
        if (!rawTheme) {
            // Fallback for legacy pages that still store plain "theme".
            rawTheme = String(localStorage.getItem('theme') || '').toLowerCase();
        }
        var mode = normalizeTheme(rawTheme);
        var donkEnabled = localStorage.getItem('appearanceDonk') === 'on';
        var momEnabled = localStorage.getItem('appearanceMom') === 'on';

        // Migrate legacy values where donk/mom were stored in appearanceTheme.
        if (rawTheme === 'donk') {
            mode = 'dark';
            donkEnabled = true;
            localStorage.setItem('appearanceTheme', mode);
            localStorage.setItem('appearanceDonk', 'on');
        } else if (rawTheme === 'mom') {
            mode = 'dark';
            momEnabled = true;
            localStorage.setItem('appearanceTheme', mode);
            localStorage.setItem('appearanceMom', 'on');
        }

        return {
            mode: mode,
            donkEnabled: donkEnabled,
            momEnabled: momEnabled
        };
    }

    function normalizeHex(color) {
        var value = String(color || '').trim();
        if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
            return DEFAULT_ACCENT;
        }
        if (value.length === 4) {
            return (
                '#' +
                value[1] + value[1] +
                value[2] + value[2] +
                value[3] + value[3]
            ).toLowerCase();
        }
        return value.toLowerCase();
    }

    function hexToRgb(hex) {
        var clean = normalizeHex(hex).replace('#', '');
        return {
            r: parseInt(clean.substring(0, 2), 16),
            g: parseInt(clean.substring(2, 4), 16),
            b: parseInt(clean.substring(4, 6), 16)
        };
    }

    function rgbToHex(rgb) {
        var r = clamp(Math.round(rgb.r), 0, 255).toString(16).padStart(2, '0');
        var g = clamp(Math.round(rgb.g), 0, 255).toString(16).padStart(2, '0');
        var b = clamp(Math.round(rgb.b), 0, 255).toString(16).padStart(2, '0');
        return '#' + r + g + b;
    }

    function mix(colorA, colorB, ratio) {
        var a = hexToRgb(colorA);
        var b = hexToRgb(colorB);
        var t = clamp(ratio, 0, 1);
        return rgbToHex({
            r: a.r + (b.r - a.r) * t,
            g: a.g + (b.g - a.g) * t,
            b: a.b + (b.b - a.b) * t
        });

        // Auto-close mobile nav on scroll
        if (!window._mobileNavScrollWired) {
            window._mobileNavScrollWired = true;
            window.addEventListener('scroll', function () {
                var body = document.body;
                if (body && body.classList.contains('mobile-mode')) {
                    closeAllMobileNavMenus();
                }
            }, { passive: true });
        }
    }

    function toRgba(hex, alpha) {
        var rgb = hexToRgb(hex);
        return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + clamp(alpha, 0, 1) + ')';
    }

    function applyThemePalette(root, mode, accent) {
        var accentColor = normalizeHex(accent);
        var accentBright = mix(accentColor, '#ffffff', 0.22);
        var accentDark = mix(accentColor, '#000000', 0.22);

        root.style.setProperty('--accent', accentColor);
        root.style.setProperty('--accent-color', accentColor);
        root.style.setProperty('--accent-dark', accentDark);
        root.style.setProperty('--accent-soft', toRgba(accentColor, 0.22));
        root.style.setProperty('--primary-red', accentColor);
        root.style.setProperty('--gradient', 'linear-gradient(135deg, ' + accentBright + ', ' + accentDark + ')');
        root.style.setProperty('--live-badge', accentColor);

        if (mode === 'light') {
            root.style.setProperty('--dark-bg', mix(accentColor, '#ffffff', 0.95));
            root.style.setProperty('--darker-bg', mix(accentColor, '#ffffff', 0.985));
            root.style.setProperty('--card-bg', mix(accentColor, '#ffffff', 0.99));
            root.style.setProperty('--text-light', '#20171d');
            root.style.setProperty('--text-gray', '#5e4856');
            root.style.setProperty('--text-dark', '#866679');
            root.style.setProperty('--border-color', mix(accentColor, '#e8d9e2', 0.62));
            root.style.setProperty('--hover-bg', mix(accentColor, '#fff1f8', 0.8));
        } else {
            root.style.setProperty('--dark-bg', mix(accentColor, '#08090f', 0.92));
            root.style.setProperty('--darker-bg', mix(accentColor, '#04050a', 0.95));
            root.style.setProperty('--card-bg', mix(accentColor, '#11131b', 0.82));
            root.style.setProperty('--text-light', '#f6edf4');
            root.style.setProperty('--text-gray', '#d7c4d2');
            root.style.setProperty('--text-dark', '#9f8798');
            root.style.setProperty('--border-color', mix(accentColor, '#2b2630', 0.76));
            root.style.setProperty('--hover-bg', mix(accentColor, '#24202a', 0.8));
        }
    }

    function applyLogoTheme(mode) {
        var headers = document.querySelectorAll('.header');
        headers.forEach(function (header) {
            var logo = header.querySelector('.logo');
            var img = logo ? logo.querySelector('img') : null;
            if (!img) {
                return;
            }
            if (logo && logo.dataset.logoPreviewActive === '1') {
                img.style.filter = '';
                return;
            }
            var menuOpen = header.classList.contains('mobile-nav-open');
            if (menuOpen) {
                img.style.filter = 'sepia(1) saturate(650%) hue-rotate(300deg) brightness(0.95)';
                return;
            }
            if (mode === 'light') {
                img.style.filter = 'brightness(0) saturate(100%)';
            } else {
                img.style.filter = 'brightness(0) invert(1)';
            }
        });
    }

    function applySavedAppearance() {
        var root = document.documentElement;
        var body = document.body;
        var state = getSavedState();
        var mode = state.mode;
        var accent = normalizeHex(localStorage.getItem('appearanceAccent'));
        var themeClass = mode === 'light' ? 'theme-light' : 'theme-dark';

        root.classList.remove('theme-light', 'theme-dark');
        root.classList.add(themeClass);
        root.setAttribute('data-theme', mode);
        applyThemePalette(root, mode, accent);

        if (!body) {
            return;
        }

        body.classList.remove('theme-light', 'theme-dark', 'donk-mode', 'mom-mode');
        body.classList.add(themeClass);
        body.setAttribute('data-theme', mode);
        applyLogoTheme(mode);

        if (state.donkEnabled) {
            body.classList.add('donk-mode');
        }
        if (state.momEnabled) {
            body.classList.add('mom-mode');
        }

        try {
            window.dispatchEvent(new CustomEvent('appearancechange', {
                detail: {
                    mode: mode,
                    accent: accent,
                    donkEnabled: state.donkEnabled,
                    momEnabled: state.momEnabled
                }
            }));
        } catch (error) {
            // no-op in very old browsers
        }
    }

    function setAppearanceMode(mode) {
        var input = String(mode || '').toLowerCase();
        if (input === 'donk') {
            localStorage.setItem('appearanceDonk', 'on');
            if (!localStorage.getItem('appearanceTheme')) {
                localStorage.setItem('appearanceTheme', DEFAULT_THEME);
            }
            localStorage.setItem('theme', DEFAULT_THEME);
        } else if (input === 'mom') {
            localStorage.setItem('appearanceMom', 'on');
            if (!localStorage.getItem('appearanceTheme')) {
                localStorage.setItem('appearanceTheme', DEFAULT_THEME);
            }
            localStorage.setItem('theme', DEFAULT_THEME);
        } else {
            var normalized = normalizeTheme(input);
            localStorage.setItem('appearanceTheme', normalized);
            localStorage.setItem('theme', normalized);
        }
        applySavedAppearance();
    }

    function setAppearanceAccent(color) {
        var normalized = normalizeHex(color);
        localStorage.setItem('appearanceAccent', normalized);
        applySavedAppearance();
    }
    function ensureOwBrandStyles() {
        if (document.getElementById('ow-brand-style')) {
            return;
        }
        var style = document.createElement('style');
        style.id = 'ow-brand-style';
        style.textContent =
            '.header .logo.ow-brand-ready{' +
                'display:inline-flex !important;' +
                'align-items:center !important;' +
                'position:relative !important;' +
                'z-index:2002 !important;' +
                'gap:6px !important;' +
                'text-decoration:none !important;' +
            '}' +
            '.header .logo.ow-brand-ready img{' +
                'height:48px !important;' +
                'width:auto !important;' +
                'max-width:48px !important;' +
                'display:inline-block !important;' +
                'vertical-align:middle !important;' +
                'margin-right:10px !important;' +
                'position:relative !important;' +
                'z-index:2003 !important;' +
            '}' +
            '.header .logo.ow-brand-ready .ow-brand-text{' +
                'display:inline-block !important;' +
                'font-weight:700 !important;' +
                'line-height:1 !important;' +
                'position:relative !important;' +
                'z-index:2003 !important;' +
            '}' +
            '.header .nav-links,.header nav,.header .menu,.header .nav{' +
                'position:relative;' +
                'z-index:1000;' +
            '}';
        document.head.appendChild(style);
    }

    function syncOwBranding() {
        ensureOwBrandStyles();
        var logos = document.querySelectorAll('.header .logo');
        logos.forEach(function (logo) {
            logo.classList.add('ow-brand-ready');
            var image = logo.querySelector('img');
            if (!image) {
                image = document.createElement('img');
                image.alt = 'Logo';
                logo.insertBefore(image, logo.firstChild);
            }
            image.classList.add('ow-brand-logo');
            image.src = 'logos_and_profileicons/logo6.png';
            image.setAttribute('alt', 'Logo');

            Array.prototype.slice.call(logo.childNodes).forEach(function (node) {
                var isImageNode = node.nodeType === 1 && node.tagName === 'IMG';
                var isBrandText = node.nodeType === 1 && node.classList && node.classList.contains('ow-brand-text');
                if (!isImageNode && !isBrandText && (node.nodeType !== 3 || node.textContent.trim())) {
                    logo.removeChild(node);
                }
            });

            var text = logo.querySelector('.ow-brand-text');
            if (!text) {
                text = document.createElement('span');
                text.className = 'ow-brand-text';
                logo.appendChild(text);
            }
            text.textContent = 'ow';

            if (logo.firstChild !== image) {
                logo.insertBefore(image, logo.firstChild);
            }
            logo.dataset.owBrandApplied = '1';
        });
    }

    function ensureDropdownLink(menu, id, href, text, beforeId) {
        if (!menu) {
            return null;
        }
        var link = document.getElementById(id);
        if (!link) {
            link = document.createElement('a');
            link.id = id;
            link.href = href;
            link.textContent = text;
            link.style.display = 'none';
            var beforeNode = beforeId ? document.getElementById(beforeId) : null;
            if (beforeNode && beforeNode.parentElement === menu) {
                menu.insertBefore(link, beforeNode);
            } else {
                menu.appendChild(link);
            }
        }
        return link;
    }

    function shouldSkipInjectedProfileDropdown() {
        var fileName = String((window.location && window.location.pathname) || '').split('/').pop().toLowerCase();
        return fileName === 'profile.html' || fileName === 'public-profile.html';
    }

    function showDefaultProfileAvatar(profileAvatarIcon, profileAvatarFallback) {
        if (profileAvatarIcon) {
            profileAvatarIcon.onerror = function () {
                this.onerror = null;
                this.src = DEFAULT_PROFILE_AVATAR;
            };
            profileAvatarIcon.src = DEFAULT_PROFILE_AVATAR;
            profileAvatarIcon.style.display = '';
        }
        if (profileAvatarFallback) {
            profileAvatarFallback.style.display = 'none';
        }
    }

    function getAvatarCacheKey(username) {
        return 'profileAvatar:' + String(username || '').trim().toLowerCase();
    }

    function getCachedProfileAvatar(username) {
        if (!username) {
            return '';
        }
        return String(localStorage.getItem(getAvatarCacheKey(username)) || '').trim();
    }

    function setCachedProfileAvatar(username, avatar) {
        if (!username) {
            return;
        }
        var key = getAvatarCacheKey(username);
        var value = String(avatar || '').trim();
        if (value) {
            localStorage.setItem(key, value);
        } else {
            localStorage.removeItem(key);
        }
    }

    function normalizeAvatarValue(value) {
        var raw = String(value || '').trim();
        if (!raw) {
            return '';
        }
        var lowered = raw.toLowerCase();
        if (lowered === 'null' || lowered === 'undefined' || lowered === '[object object]') {
            return '';
        }
        return raw;
    }

    function resolveAvatarUrl(value) {
        var raw = normalizeAvatarValue(value);
        if (!raw) {
            return '';
        }
        try {
            var resolved = new URL(raw, window.location.href);
            var protocol = String(resolved.protocol || '').toLowerCase();
            if (protocol === 'http:' || protocol === 'https:' || protocol === 'data:' || protocol === 'blob:') {
                return resolved.href;
            }
        } catch (error) {
            return '';
        }
        return '';
    }

    function preloadImage(url) {
        return new Promise(function (resolve) {
            if (!url) {
                resolve(false);
                return;
            }
            var done = false;
            var image = new Image();
            var timeout = window.setTimeout(function () {
                if (done) {
                    return;
                }
                done = true;
                resolve(false);
            }, 7000);

            image.onload = function () {
                if (done) {
                    return;
                }
                done = true;
                window.clearTimeout(timeout);
                resolve(true);
            };

            image.onerror = function () {
                if (done) {
                    return;
                }
                done = true;
                window.clearTimeout(timeout);
                resolve(false);
            };

            image.src = url;
        });
    }

    async function showProfileAvatarFromSource(profileAvatarIcon, profileAvatarFallback, source) {
        if (!profileAvatarIcon) {
            return false;
        }
        var resolvedUrl = resolveAvatarUrl(source);
        if (!resolvedUrl) {
            return false;
        }
        var canLoad = await preloadImage(resolvedUrl);
        if (!canLoad) {
            return false;
        }
        profileAvatarIcon.onerror = null;
        profileAvatarIcon.src = resolvedUrl;
        profileAvatarIcon.style.display = '';
        if (profileAvatarFallback) {
            profileAvatarFallback.style.display = 'none';
        }
        return true;
    }

    function showProfileAvatarLoading(profileAvatarIcon, profileAvatarFallback) {
        if (!profileAvatarIcon) {
            if (profileAvatarFallback) {
                profileAvatarFallback.style.display = 'none';
            }
            return;
        }

        profileAvatarIcon.style.display = 'none';
        if (profileAvatarFallback) {
            profileAvatarFallback.style.display = 'none';
        }
    }

    function ensureProfileDropdownExists() {
        if (shouldSkipInjectedProfileDropdown()) {
            return;
        }
        syncOwBranding();
        if (document.getElementById('profileDropdownBtn')) {
            return;
        }

        var header = document.querySelector('.header');
        if (!header) {
            return;
        }

        var dropdown = document.createElement('div');
        dropdown.className = 'profile-dropdown';
        dropdown.innerHTML =
            '<button class="profile-btn" id="profileDropdownBtn" style="margin-left:0;vertical-align:middle;padding:0;background:none;border:none;">' +
                '<img id="profileAvatarIcon" src="' + DEFAULT_PROFILE_AVATAR + '" alt="Profile" style="display:none;width:36px;height:36px;border-radius:50%;vertical-align:middle;object-fit:cover;">' +
                '<span id="profileAvatarFallback" style="font-size:2em;vertical-align:middle;">\ud83d\udc64</span>' +
            '</button>' +
            '<div class="dropdown-content" id="profileDropdownMenu">' +
                '<a href="profile.html" id="profileLink" style="display:none;">Profile</a>' +
                '<a href="settings.html" id="settingsLink" style="display:none;">Settings</a>' +
                '<a href="signout.html" id="signoutLink" style="display:none;">Sign Out</a>' +
                '<a href="login.html" id="dropdownLogin">Log In</a>' +
                '<a href="signup.html" id="dropdownSignup">Create Account</a>' +
            '</div>';

        var premiumBadgeHeader = document.getElementById('premiumBadgeHeader');
        if (premiumBadgeHeader && premiumBadgeHeader.parentElement === header) {
            premiumBadgeHeader.insertAdjacentElement('afterend', dropdown);
        } else {
            header.appendChild(dropdown);
        }
    }

    function wireProfileDropdownToggle() {
        var dropdownBtn = document.getElementById('profileDropdownBtn');
        var dropdownMenu = document.getElementById('profileDropdownMenu') || document.querySelector('.profile-dropdown .dropdown-content');
        var dropdownContainer = dropdownBtn ? dropdownBtn.closest('.profile-dropdown') : null;
        if (!dropdownBtn || !dropdownMenu || !dropdownContainer || dropdownBtn.dataset.themeModeWired === '1') {
            return;
        }

        dropdownBtn.dataset.themeModeWired = '1';
        function toggleDropdown(event) {
            event.stopPropagation();
            var shouldShow = !dropdownMenu.classList.contains('show') && !dropdownContainer.classList.contains('show');
            dropdownMenu.classList.toggle('show', shouldShow);
            dropdownContainer.classList.toggle('show', shouldShow);
        }

        // Use pointerdown so the dropdown appears immediately on touch and mouse.
        dropdownBtn.addEventListener('pointerdown', function (event) {
            event.preventDefault();
            toggleDropdown(event);
        });

        // Keep keyboard activation behavior via click (detail === 0 means keyboard/assistive activation).
        dropdownBtn.addEventListener('click', function (event) {
            if (event.detail === 0) {
                toggleDropdown(event);
            }
        });

        document.addEventListener('click', function (event) {
            if (!dropdownMenu.contains(event.target) && !dropdownBtn.contains(event.target)) {
                dropdownMenu.classList.remove('show');
                dropdownContainer.classList.remove('show');
            }
        });
    }

    function fetchProfileData(token) {
        if (!token) {
            return Promise.resolve({});
        }
        if (!profileFetchInFlight) {
            profileFetchInFlight = fetch('https://ownshub.onrender.com/api/profile', {
                headers: { 'Authorization': 'Bearer ' + token }
            }).then(function (res) {
                if (!res.ok) {
                    return {};
                }
                return res.json();
            }).catch(function () {
                return {};
            }).finally(function () {
                profileFetchInFlight = null;
            });
        }
        return profileFetchInFlight;
    }

    function primeProfileFetchFromStorage() {
        if (profilePrefetchStarted) {
            return;
        }
        profilePrefetchStarted = true;
        var token = localStorage.getItem('token');
        if (token) {
            fetchProfileData(token);
        }
    }

    async function syncGlobalProfileHeader() {
        ensureProfileDropdownExists();

        var loggedInUser = localStorage.getItem('loggedInUser');
        var token = localStorage.getItem('token');
        var menu = document.getElementById('profileDropdownMenu') || document.querySelector('.profile-dropdown .dropdown-content');

        var profileLink = ensureDropdownLink(menu, 'profileLink', 'profile.html', 'Profile', 'settingsLink');
        var settingsLink = ensureDropdownLink(menu, 'settingsLink', 'settings.html', 'Settings', 'signoutLink');
        var signoutLink = ensureDropdownLink(menu, 'signoutLink', 'signout.html', 'Sign Out', null);
        var dropdownLogin = ensureDropdownLink(menu, 'dropdownLogin', 'login.html', 'Log In', null);
        var dropdownSignup = ensureDropdownLink(menu, 'dropdownSignup', 'signup.html', 'Create Account', null);
        var publicProfileLink = document.getElementById('publicProfileLink');
        var profileAvatarIcon = document.getElementById('profileAvatarIcon');
        var profileAvatarFallback = document.getElementById('profileAvatarFallback');
        var chatHeaderBtn = document.getElementById('chatHeaderBtn');

        if (loggedInUser && token) {
            showProfileAvatarLoading(profileAvatarIcon, profileAvatarFallback);

            // Start backend fetch first so avatar loading is prioritized on refresh/login.
            var profileDataPromise = fetchProfileData(token);

            var cachedAvatar = getCachedProfileAvatar(loggedInUser);
            await showProfileAvatarFromSource(profileAvatarIcon, profileAvatarFallback, cachedAvatar);

            if (profileLink) {
                profileLink.style.display = '';
                profileLink.href = 'public-profile.html?user=' + encodeURIComponent(loggedInUser);
                profileLink.textContent = 'Profile';
            }
            if (settingsLink) settingsLink.style.display = '';
            if (signoutLink) signoutLink.style.display = '';
            if (dropdownLogin) dropdownLogin.style.display = 'none';
            if (dropdownSignup) dropdownSignup.style.display = 'none';
            if (chatHeaderBtn) chatHeaderBtn.style.display = '';

            if (publicProfileLink) publicProfileLink.style.display = 'none';

            var profileData = await profileDataPromise;
            var avatar = profileData && profileData.avatar ? profileData.avatar : '';
            var avatarApplied = await showProfileAvatarFromSource(profileAvatarIcon, profileAvatarFallback, avatar);
            if (avatarApplied) {
                setCachedProfileAvatar(loggedInUser, resolveAvatarUrl(avatar));
            } else {
                setCachedProfileAvatar(loggedInUser, '');
                showDefaultProfileAvatar(profileAvatarIcon, profileAvatarFallback);
            }
        } else {
            if (profileLink) {
                profileLink.style.display = 'none';
                profileLink.href = 'profile.html';
                profileLink.textContent = 'Profile';
            }
            if (settingsLink) settingsLink.style.display = 'none';
            if (signoutLink) signoutLink.style.display = 'none';
            if (dropdownLogin) dropdownLogin.style.display = '';
            if (dropdownSignup) dropdownSignup.style.display = '';
            if (chatHeaderBtn) chatHeaderBtn.style.display = 'none';
            if (publicProfileLink) publicProfileLink.style.display = 'none';
            showDefaultProfileAvatar(profileAvatarIcon, profileAvatarFallback);
        }

        ensureHomeLinkInNavBars();
        // Upload link injection removed; now only in index.html
        wireProfileDropdownToggle();
        wireMobileLogoNavToggle();
    }

    primeProfileFetchFromStorage();
    applySavedAppearance();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            syncGlobalProfileHeader();
            applySavedAppearance();
            syncOwBranding();
            wireMobileLogoNavToggle();
            applyDeviceMode();
            ensureSectionBackButton();
            initVagina2TextureBackground();
            initImcumingFireworks();
        });
    } else {
        syncGlobalProfileHeader();
        syncOwBranding();
        wireMobileLogoNavToggle();
        applyDeviceMode();
        ensureSectionBackButton();
        initVagina2TextureBackground();
        initImcumingFireworks();
    }

    window.addEventListener('storage', function (event) {
        if (
            event.key === 'appearanceTheme' ||
            event.key === 'theme' ||
            event.key === 'appearanceAccent' ||
            event.key === 'appearanceDonk' ||
            event.key === 'appearanceMom'
        ) {
            applySavedAppearance();
        }

        if (event.key === 'loggedInUser' || event.key === 'token') {
            syncGlobalProfileHeader();
        }
    });

    // Run one more sync after full page load so page-specific scripts cannot
    // leave the header avatar in fallback emoji state.
    window.addEventListener('load', function () {
        syncGlobalProfileHeader();
    });

    window.addEventListener('resize', applyDeviceMode);
    window.addEventListener('orientationchange', applyDeviceMode);

    window.applySavedAppearance = applySavedAppearance;
    window.setAppearanceMode = setAppearanceMode;
    window.setAppearanceAccent = setAppearanceAccent;
    window.syncGlobalProfileHeader = syncGlobalProfileHeader;
    window.applyDeviceMode = applyDeviceMode;
})();
