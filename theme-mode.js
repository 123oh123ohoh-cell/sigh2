(function () {
    var DEFAULT_THEME = 'dark';
    var DEFAULT_ACCENT = '#d12a7a';

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
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

    applySavedAppearance();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applySavedAppearance);
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
    });

    window.applySavedAppearance = applySavedAppearance;
    window.setAppearanceMode = setAppearanceMode;
    window.setAppearanceAccent = setAppearanceAccent;
})();
