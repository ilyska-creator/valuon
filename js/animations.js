(function () {
    'use strict';

    function reveal(elements) {
        elements.forEach(function (el) {
            el.classList.add('is-visible');
        });
    }

    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hasIO = 'IntersectionObserver' in window;

    var observer = hasIO ? new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.01, rootMargin: '0px 0px -40px 0px' }) : null;

    function applyDelay(el) {
        if (el.dataset.delay && !el.style.getPropertyValue('--anim-delay')) {
            el.style.setProperty('--anim-delay', parseInt(el.dataset.delay, 10) + 'ms');
        }

        var group = el.closest('[data-animate-group]');
        if (group && !el.style.getPropertyValue('--anim-delay')) {
            var step = parseInt(group.dataset.animateStep, 10) || 45;
            var siblings = Array.prototype.slice.call(group.querySelectorAll('[data-animate]'));
            var index = siblings.indexOf(el);
            if (index >= 0) {
                el.style.setProperty('--anim-delay', (index * step) + 'ms');
            }
        }
    }

    function watch(el) {
        if (el.dataset.animateBound) return;
        el.dataset.animateBound = '1';

        applyDelay(el);

        if (reduceMotion || !hasIO) {
            reveal([el]);
            return;
        }

        observer.observe(el);
    }

    function scan(root) {
        var nodes = Array.prototype.slice.call(root.querySelectorAll('[data-animate]'));
        if (root.matches && root.matches('[data-animate]')) nodes.push(root);
        nodes.forEach(watch);
    }

    function init() {
        scan(document);

        if (!('MutationObserver' in window)) return;

        var mutationObserver = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return; // только элементы
                    scan(node);
                });
            });
        });

        mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();