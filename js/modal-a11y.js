export function attachModalA11y(modal, { mode = 'active', onClose } = {}) {
    if (!modal || modal.dataset.a11yBound) return;
    modal.dataset.a11yBound = '1';

    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    let lastFocused = null;

    function isOpen() {
        if (modal.classList.contains('closing')) return false;
        return mode === 'hidden'
            ? !modal.classList.contains('is-hidden')
            : modal.classList.contains('active');
    }

    let wasOpen = isOpen();

    function getFocusable() {
        return Array.from(modal.querySelectorAll(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(el =>
            el.offsetParent !== null &&
            !el.closest('[inert]') &&
            !el.closest('[aria-hidden="true"]')
        );
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') {
            if (e.defaultPrevented || window.__valuonActivePicker?.isOpen) return;
            e.preventDefault();
            onClose?.();
            return;
        }
        if (e.key === 'Tab') {
            const focusables = getFocusable();
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    const observer = new MutationObserver(() => {
        const nowOpen = isOpen();
        if (nowOpen === wasOpen) return;
        wasOpen = nowOpen;

        if (nowOpen) {
            lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            document.addEventListener('keydown', handleKeydown);
            requestAnimationFrame(() => {
                if (isOpen()) getFocusable()[0]?.focus();
            });
        } else {
            document.removeEventListener('keydown', handleKeydown);
            const target = lastFocused;
            lastFocused = null;
            if (target && target.isConnected && !modal.contains(target)) {
                target.focus({ preventScroll: true });
            }
        }
    });

    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
}