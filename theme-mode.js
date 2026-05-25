(function () {
    var DEFAULT_THEME = 'dark';
    var DEFAULT_ACCENT = '#d12a7a';
    var profileFetchInFlight = null;
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


    function wireMobileLogoNavToggle() {
        ensureHomeLinkInNavBars();
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

            logo.dataset.mobileNavWired = '1';
            logo.setAttribute('aria-controls', nav.id);
            logo.setAttribute('aria-expanded', 'false');
            menuBtn.setAttribute('aria-controls', nav.id);
            menuBtn.setAttribute('aria-expanded', 'false');

            function setMenuOpen(open) {
                header.classList.toggle('mobile-nav-open', !!open);
                logo.setAttribute('aria-expanded', open ? 'true' : 'false');
                menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
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
                    setMenuOpen(false);
                }
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
        return fileName.indexOf('collections') !== -1 || fileName.indexOf('arts') !== -1 || fileName.indexOf('vagina') !== -1 || fileName.indexOf('hypnosis') !== -1 || fileName.indexOf('raw') !== -1 || fileName.indexOf('cum') !== -1 || fileName.indexOf('baby') !== -1 || /-2\.html$/.test(fileName);
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
            return 'cum-collections.html';
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

    function normalizeTheme(theme) {
        var normalized = String(theme || '').toLowerCase();
        if (normalized === 'light' || normalized === 'dark') {
            return normalized;
        }
        return DEFAULT_THEME;
    }

    function getSavedState() {
        var rawTheme = String(localStorage.getItem('appearanceTheme') || '').toLowerCase();
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
        } else if (input === 'mom') {
            localStorage.setItem('appearanceMom', 'on');
            if (!localStorage.getItem('appearanceTheme')) {
                localStorage.setItem('appearanceTheme', DEFAULT_THEME);
            }
        } else {
            localStorage.setItem('appearanceTheme', normalizeTheme(input));
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
                '<img id="profileAvatarIcon" src="" alt="Profile" style="display:none;width:36px;height:36px;border-radius:50%;vertical-align:middle;object-fit:cover;">' +
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

    async function syncGlobalProfileHeader() {
        ensureProfileDropdownExists();
        ensureHomeLinkInNavBars();
        // Upload link injection removed; now only in index.html
        wireProfileDropdownToggle();
        wireMobileLogoNavToggle();

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

        if (loggedInUser && token) {
            if (profileLink) {
                profileLink.style.display = '';
                profileLink.href = 'public-profile.html?user=' + encodeURIComponent(loggedInUser);
                profileLink.textContent = 'Profile';
            }
            if (settingsLink) settingsLink.style.display = '';
            if (signoutLink) signoutLink.style.display = '';
            if (dropdownLogin) dropdownLogin.style.display = 'none';
            if (dropdownSignup) dropdownSignup.style.display = 'none';

            if (publicProfileLink) publicProfileLink.style.display = 'none';

            var profileData = await fetchProfileData(token);
            var avatar = profileData && profileData.avatar ? profileData.avatar : '';
            if (profileAvatarIcon && avatar) {
                profileAvatarIcon.src = avatar;
                profileAvatarIcon.style.display = '';
                if (profileAvatarFallback) profileAvatarFallback.style.display = 'none';
            } else {
                if (profileAvatarIcon) profileAvatarIcon.style.display = 'none';
                if (profileAvatarFallback) profileAvatarFallback.style.display = '';
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
            if (publicProfileLink) publicProfileLink.style.display = 'none';
            if (profileAvatarIcon) profileAvatarIcon.style.display = 'none';
            if (profileAvatarFallback) profileAvatarFallback.style.display = '';
        }
    }

    applySavedAppearance();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            applySavedAppearance();
            syncGlobalProfileHeader();
            syncOwBranding();
            wireMobileLogoNavToggle();
            applyDeviceMode();
            ensureSectionBackButton();
        });
    } else {
        syncGlobalProfileHeader();
        syncOwBranding();
        wireMobileLogoNavToggle();
        applyDeviceMode();
        ensureSectionBackButton();
    }

    window.addEventListener('storage', function (event) {
        if (
            event.key === 'appearanceTheme' ||
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

    window.addEventListener('resize', applyDeviceMode);
    window.addEventListener('orientationchange', applyDeviceMode);

    window.applySavedAppearance = applySavedAppearance;
    window.setAppearanceMode = setAppearanceMode;
    window.setAppearanceAccent = setAppearanceAccent;
    window.syncGlobalProfileHeader = syncGlobalProfileHeader;
    window.applyDeviceMode = applyDeviceMode;
})();

document.addEventListener('DOMContentLoaded', function() {
    const logoText = document.querySelector('.logo .cute-logo span:nth-child(2)');
    const logoIcon = document.querySelector('.logo .cute-logo span:nth-child(1) svg');
    const currentTheme = localStorage.getItem('theme') || 'light';

    if (!logoText || !logoIcon) {
        updateLogoTheme(currentTheme);
        return;
    }

    function applyThemeToLogo(theme) {
        if (theme === 'dark') {
            logoText.style.textShadow = '0 4px 12px #ff99cc, 0 3px 0 #333';
            logoText.style.filter = 'drop-shadow(0 0 10px #ff99cc88)';
            logoIcon.style.fill = '#ff99cc';
            logoIcon.style.stroke = '#ff66a3';
        } else {
            logoText.style.textShadow = '0 4px 12px #ff99cc, 0 3px 0 #fff4';
            logoText.style.filter = 'drop-shadow(0 0 10px #ff99cc88)';
            logoIcon.style.fill = '#ff99cc';
            logoIcon.style.stroke = '#ff66a3';
        }
    }

    function updateLogoTheme(theme) {
        const logo = document.querySelector('.logo img');
        if (logo) {
            if (theme === 'light') {
                logo.style.filter = 'brightness(0) invert(1)';
            } else {
                logo.style.filter = 'none';
            }
        }
    }

    if (typeof window.applySavedAppearance === 'function') {
        applyThemeToLogo(currentTheme);

        window.applySavedAppearance = function() {
            const theme = localStorage.getItem('theme') || 'light';
            applyThemeToLogo(theme);
        };
    }

    updateLogoTheme(currentTheme);

    // Add event listener for theme changes
    document.addEventListener('themeChange', (event) => {
        updateLogoTheme(event.detail.theme);
    });
});
