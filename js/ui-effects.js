// Shared UI micro-interaction helpers (respects prefers-reduced-motion)

function prefersReducedMotion() {
    return typeof window !== 'undefined'
        && window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let iosHapticLabel = null;

function isIosTouchDevice() {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || '')
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function triggerIosTaptic() {
    if (typeof document === 'undefined' || !document.body) return;
    if (!iosHapticLabel) {
        const label = document.createElement('label');
        label.setAttribute('aria-hidden', 'true');
        label.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        input.tabIndex = -1;
        label.appendChild(input);
        document.body.appendChild(label);
        iosHapticLabel = label;
    }
    iosHapticLabel.click();
}

export function haptic(pattern = 12) {
    if (prefersReducedMotion()) return;
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(pattern);
            return;
        }
        if (isIosTouchDevice()) {
            triggerIosTaptic();
        }
    } catch (_) { /* ignore unsupported environments */ }
}

if (typeof window !== 'undefined') {
    window.valuonHaptic = haptic;
    if (!window.__valuonNavHapticBound) {
        window.__valuonNavHapticBound = true;
        document.addEventListener('click', (e) => {
            if (e.target && e.target.closest && e.target.closest('.bottom-nav-item')) {
                haptic(8);
            }
        }, true);
    }
}

export function animateCount(el, toValue, { duration = 350, format = (v) => String(Math.round(v)) } = {}) {
    if (!el) return;
    const target = Number(toValue);
    if (!Number.isFinite(target)) {
        el.textContent = format(0);
        return;
    }

    if (el._countRaf) {
        cancelAnimationFrame(el._countRaf);
        el._countRaf = null;
    }

    const from = Number.isFinite(el._countVal) ? el._countVal : 0;
    el._countVal = target;

    if (prefersReducedMotion() || duration <= 0 || from === target) {
        el.textContent = format(target);
        return;
    }

    const start = performance.now();
    const diff = target - from;

    const step = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        el.textContent = format(from + diff * eased);
        if (progress < 1) {
            el._countRaf = requestAnimationFrame(step);
        } else {
            el._countRaf = null;
            el.textContent = format(target);
        }
    };

    el._countRaf = requestAnimationFrame(step);
}

export function collapseAndRemove(el, onDone) {
    if (!el || prefersReducedMotion()) {
        if (typeof onDone === 'function') onDone();
        return;
    }
    const height = el.offsetHeight;
    el.style.height = `${height}px`;
    el.style.boxSizing = 'border-box';
    void el.offsetHeight; // force reflow
    el.classList.add('is-collapsing');
    setTimeout(() => {
        if (typeof onDone === 'function') onDone();
    }, 230);
}

export function morphCopyButton(btn, duration = 1500) {
    if (!btn) return;
    haptic(10);
    const icon = btn.querySelector('i');
    if (icon) {
        if (!btn.dataset.origIconClass) {
            btn.dataset.origIconClass = icon.className;
        }
        icon.className = 'fa-solid fa-check';
    }
    btn.classList.add('is-copied');
    if (btn._copyResetTimer) clearTimeout(btn._copyResetTimer);
    btn._copyResetTimer = setTimeout(() => {
        btn._copyResetTimer = null;
        btn.classList.remove('is-copied');
        if (icon && btn.dataset.origIconClass) {
            icon.className = btn.dataset.origIconClass;
        }
    }, duration);
}

export function pulseHighlight(el, duration = 1600) {
    if (!el) return;
    try {
        el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    } catch (_) { /* ignore */ }
    el.classList.remove('is-highlighted');
    void el.offsetWidth;
    el.classList.add('is-highlighted');
    if (el._highlightTimer) clearTimeout(el._highlightTimer);
    el._highlightTimer = setTimeout(() => {
        el._highlightTimer = null;
        el.classList.remove('is-highlighted');
    }, duration);
}

export function ringNotificationBell() {
    if (prefersReducedMotion()) return;
    document.querySelectorAll('[data-view="notifications"] i.fa-bell, a[href*="view-notifications"] i.fa-bell').forEach((icon) => {
        icon.classList.remove('bell-ring');
        void icon.offsetWidth;
        icon.classList.add('bell-ring');
        setTimeout(() => icon.classList.remove('bell-ring'), 700);
    });
}


// Auto-select numeric inputs on focus so typing replaces 0 / 1 immediately without manual backspace
if (typeof document !== 'undefined' && !window.__valuonNumAutoSelectBound) {
    window.__valuonNumAutoSelectBound = true;
    document.addEventListener('focusin', (e) => {
        const el = e.target;
        if (!(el instanceof HTMLInputElement) || el.type !== 'number') return;
        if (el.readOnly || el.disabled || !el.value.trim()) return;
        requestAnimationFrame(() => {
            if (document.activeElement === el) {
                try { el.select(); } catch (_) {}
            }
        });
        const onMouseUp = (mu) => {
            mu.preventDefault();
        };
        el.addEventListener('mouseup', onMouseUp, { once: true });
        setTimeout(() => el.removeEventListener('mouseup', onMouseUp), 300);
    });
}
