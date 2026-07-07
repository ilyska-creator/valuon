// Shared entrance / scroll-reveal animations for all Valuon pages.
//
// Opt an element in with the `data-animate` attribute. Optional values:
//   (empty)  — slide up (default)
//   "fade"   — fade only
//   "zoom"   — scale up
//   "left"   — slide in from the left
//   "right"  — slide in from the right
//   "down"   — slide down
//
// Stagger a set of items by wrapping them in a container with
// `data-animate-group` (optionally `data-animate-step="80"` for the delay
// in ms between items), or set `data-delay="150"` on a single element.
//
// Styling lives in css/style.css ([data-animate] / .is-visible). Respects
// the user's "prefers-reduced-motion" preference.
(function () {
    'use strict';

    function reveal(elements) {
        elements.forEach(function (el) {
            el.classList.add('is-visible');
        });
    }

    function init() {
        var elements = Array.prototype.slice.call(
            document.querySelectorAll('[data-animate]')
        );
        if (!elements.length) return;

        var reduceMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reduceMotion) {
            reveal(elements);
            return;
        }

        // Staggered delays for grouped items.
        document.querySelectorAll('[data-animate-group]').forEach(function (group) {
            var step = parseInt(group.dataset.animateStep, 10) || 90;
            group.querySelectorAll('[data-animate]').forEach(function (el, i) {
                if (!el.style.getPropertyValue('--anim-delay')) {
                    el.style.setProperty('--anim-delay', (i * step) + 'ms');
                }
            });
        });

        // Explicit per-element delays.
        elements.forEach(function (el) {
            if (el.dataset.delay) {
                el.style.setProperty('--anim-delay', parseInt(el.dataset.delay, 10) + 'ms');
            }
        });

        if (!('IntersectionObserver' in window)) {
            reveal(elements);
            return;
        }

        var observer = new IntersectionObserver(function (entries, obs) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        elements.forEach(function (el) {
            observer.observe(el);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
