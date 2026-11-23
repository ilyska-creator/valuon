/**
 * Unified sliding pill indicator for segmented controls (tabs, mode switches, period filters).
 * Uses offsetLeft/offsetWidth so parent modal scale animations never skew measurement,
 * auto-syncs on ResizeObserver/window resize, and respects prefers-reduced-motion.
 */

export function prefersReducedMotion() {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createSegmentedIndicator(container, indicator, options = {}) {
    if (!container || !indicator) {
        return { update() { }, destroy() { } };
    }

    const itemSelector = options.itemSelector || 'button';
    const activeClass = options.activeClass || 'active';
    let initialized = false;
    let rafId = null;

    const applyPosition = (instant) => {
        const activeBtn = container.querySelector(`${itemSelector}.${activeClass}`);
        if (!activeBtn) {
            indicator.style.opacity = '0';
            return;
        }

        const width = activeBtn.offsetWidth;
        const left = activeBtn.offsetLeft;
        if (width <= 0) {
            // Container is currently hidden (e.g. inside a closed modal) — snap once visible
            initialized = false;
            return;
        }

        const skipTransition = Boolean(instant) || !initialized || prefersReducedMotion();
        if (skipTransition) {
            indicator.style.transition = 'none';
        }

        indicator.style.width = `${width}px`;
        indicator.style.transform = `translateX(${left}px)`;
        indicator.style.opacity = '1';

        if (skipTransition) {
            void indicator.offsetWidth;
            indicator.style.transition = '';
        }

        initialized = true;
    };

    const update = (instant = false) => {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (instant) {
            applyPosition(true);
        } else {
            rafId = requestAnimationFrame(() => {
                rafId = null;
                applyPosition(false);
            });
        }
    };

    const onResize = () => applyPosition(true);
    window.addEventListener('resize', onResize, { passive: true });

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
            applyPosition(true);
        });
        resizeObserver.observe(container);
    }

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => applyPosition(true)).catch(() => { });
    }

    applyPosition(true);

    return {
        update,
        destroy() {
            if (rafId !== null) cancelAnimationFrame(rafId);
            window.removeEventListener('resize', onResize);
            if (resizeObserver) resizeObserver.disconnect();
        }
    };
}
