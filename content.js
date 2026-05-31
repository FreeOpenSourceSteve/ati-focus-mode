/**
 * ATI Time Hider — content.js
 *
 * Runs in both the top frame (lms.atitesting.com) and the embedded
 * iframe (pages-delivery.atitesting.com) thanks to all_frames: true
 * in manifest.json.
 *
 * Only the top frame creates the badge and keyboard shortcut.
 * The iframe receives toggle commands via postMessage so both frames
 * stay in sync from a single control point.
 *
 * Toggle: Option+H (⌥H) or the badge button (top frame only).
 */

(function () {
    'use strict';

    const HIDE_CLASS  = 'ati-hidden';
    const STORAGE_KEY = 'ati_focus_mode_active';
    const BADGE_ID    = 'ati-focus-badge';
    const IS_TOP      = window === window.top;

    // Selectors applied directly to matched elements
    const SELECTORS = [
        'app-white-hearder',
        '.blue-header',
        'div[role="toolbar"].navbar.navbar-expand-lg.fixed-top.nav-on-screen',
        'app-page-tools-toolbar',
        'app-site-header',
        'div[role="toolbar"].nav-on-screen',
        'app-text-to-speech-read-along',
        '.blue-footer',
        '.blue-footer1',
        '.btn-back-to-top',
        '._pendo-badge-image',
        '[data-_pendo-image-1]',
        'button[data-layout="badgeResourceCenter"]',
    ];

    var observer = null;

    /* ── State (top frame only) ── */
    function isActive() {
        return sessionStorage.getItem(STORAGE_KEY) === '1';
    }
    function setActive(value) {
        sessionStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    }

    /* ── Hide / show ── */
    function hideAll() {
        SELECTORS.forEach(function (sel) {
            document.querySelectorAll(sel).forEach(function (el) {
                el.classList.add(HIDE_CLASS);
            });
        });
    }

    function showAll() {
        document.querySelectorAll('.' + HIDE_CLASS).forEach(function (el) {
            el.classList.remove(HIDE_CLASS);
        });
    }

    /* ── MutationObserver: tag newly-rendered elements immediately ── */
    function startObserver() {
        if (observer) return;
        observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    SELECTORS.forEach(function (sel) {
                        if (node.matches && node.matches(sel)) {
                            node.classList.add(HIDE_CLASS);
                        }
                        if (node.querySelectorAll) {
                            node.querySelectorAll(sel).forEach(function (el) {
                                el.classList.add(HIDE_CLASS);
                            });
                        }
                    });
                });
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function stopObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    /* ── Apply focus mode in this frame ── */
    function applyFocusMode(active) {
        if (active) {
            hideAll();
            startObserver();
        } else {
            stopObserver();
            showAll();
        }
        if (IS_TOP) {
            updateBadge(active);
            setActive(active);
            broadcastToFrames(active);
        }
    }

    function toggleFocusMode() {
        applyFocusMode(!isActive());
    }

    /* ── Cross-frame messaging ── */

    // Top frame → broadcast current state to all child frames
    function broadcastToFrames(active) {
        var msg = { atiAction: active ? 'focusOn' : 'focusOff' };
        for (var i = 0; i < window.frames.length; i++) {
            try { window.frames[i].postMessage(msg, '*'); } catch (e) {}
        }
    }

    // Top frame listens for iframes requesting current state or a toggle
    function listenForFrameQueries() {
        window.addEventListener('message', function (e) {
            if (!e.data) return;
            if (e.data.atiQuery === 'getState' && e.source) {
                try {
                    e.source.postMessage(
                        { atiAction: isActive() ? 'focusOn' : 'focusOff' },
                        '*'
                    );
                } catch (err) {}
            }
            // Iframe keyboard shortcut forwards here to trigger a real toggle
            if (e.data.atiQuery === 'toggle') {
                toggleFocusMode();
            }
        });
    }

    // Iframe listens for commands from the top frame
    function listenForCommands() {
        window.addEventListener('message', function (e) {
            if (!e.data) return;
            if (e.data.atiAction === 'focusOn')  applyFocusMode(true);
            if (e.data.atiAction === 'focusOff') applyFocusMode(false);
        });
    }

    /* ── Badge (top frame only) ── */
    function createBadge() {
        if (document.getElementById(BADGE_ID)) return;
        var badge = document.createElement('button');
        badge.id          = BADGE_ID;
        badge.type        = 'button';
        badge.title       = 'Toggle ATI Focus Mode (Option+H)';
        badge.className   = 'badge-inactive';
        badge.textContent = 'Focus OFF  [⌥H]';
        badge.addEventListener('click', toggleFocusMode);
        document.body.appendChild(badge);
    }

    function updateBadge(active) {
        var badge = document.getElementById(BADGE_ID);
        if (!badge) return;
        badge.textContent = active ? 'Focus ON  [⌥H]' : 'Focus OFF  [⌥H]';
        badge.className   = active ? 'badge-active' : 'badge-inactive';
    }

    /* ── Keyboard shortcut (top frame only) ── */
    function bindShortcut() {
        document.addEventListener('keydown', function (e) {
            if (e.altKey && e.code === 'KeyH') {
                e.preventDefault();
                toggleFocusMode();
            }
        });
    }

    /* ── Keyboard shortcut (iframe) — forwards to top frame ── */
    function bindIframeShortcut() {
        document.addEventListener('keydown', function (e) {
            if (e.altKey && e.code === 'KeyH') {
                e.preventDefault();
                window.parent.postMessage({ atiQuery: 'toggle' }, '*');
            }
        });
    }

    /* ── Init ── */
    function init() {
        if (IS_TOP) {
            createBadge();
            bindShortcut();
            listenForFrameQueries();
            if (isActive()) {
                applyFocusMode(true);
            }
            console.log('[ATI Focus Mode] Ready. Press Option+H (⌥H) or click the badge.');
        } else {
            // Iframe: listen for toggle commands, bind shortcut to message parent,
            // then ask the top frame for current state
            listenForCommands();
            bindIframeShortcut();
            window.parent.postMessage({ atiQuery: 'getState' }, '*');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
