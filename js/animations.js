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


        document.querySelectorAll('[data-animate-group]').forEach(function (group) {
            var step = parseInt(group.dataset.animateStep, 10) || 45;
            group.querySelectorAll('[data-animate]').forEach(function (el, i) {
                if (!el.style.getPropertyValue('--anim-delay')) {
                    el.style.setProperty('--anim-delay', (i * step) + 'ms');
                }
            });
        });


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
