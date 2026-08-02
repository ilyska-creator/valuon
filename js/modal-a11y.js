export function attachModalA11y(modal, { mode = 'active', onClose } = {}) {
    if (!modal || modal.dataset.a11yBound) return;
    modal.dataset.a11yBound = '1';

    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    let lastFocused = null;

    function isOpen() {
        return mode === 'hidden'
            ? !modal.classList.contains('is-hidden')
            : modal.classList.contains('active');
    }

    function getFocusable() {
        return Array.from(modal.querySelectorAll(
            'a[href], button:not([disabled]), textarea, input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])'
        )).filter(el => el.offsetParent !== null);
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') {
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
        if (isOpen()) {
            lastFocused = document.activeElement;
            document.addEventListener('keydown', handleKeydown);
            requestAnimationFrame(() => getFocusable()[0]?.focus());
        } else {
            document.removeEventListener('keydown', handleKeydown);
            lastFocused?.focus();
            lastFocused = null;
        }
    });

    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
}