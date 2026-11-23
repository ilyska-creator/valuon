export function attachModalA11y(modal, { mode = 'active', onClose } = {}) {
    if (!modal || modal.dataset.a11yBound) return;
    modal.dataset.a11yBound = '1';

    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const contentEl = modal.querySelector('.modal-content, .forgot-modal-content');
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
            if (document.activeElement?.closest('.custom-select-dropdown, .custom-datepicker-panel')) {
                return;
            }
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

    // --- Touch swipe-down-to-dismiss gesture on mobile ---
    if (contentEl && typeof onClose === 'function') {
        let touchStartY = 0;
        let touchStartX = 0;
        let touchStartTime = 0;
        let isDraggingDown = false;
        let canSwipe = false;

        contentEl.addEventListener('touchstart', (e) => {
            if (window.innerWidth > 768 || e.touches.length > 1) return;
            const target = e.target;
            // Ignore touches on interactive controls like inputs, selects, range sliders, or buttons
            if (target.closest('input, select, textarea, button, a, .custom-select, .custom-datepicker')) {
                // If it's a close button or drag handle, allow gesture
                if (!target.closest('.sheet-drag-handle, .sheet-drag-pill')) {
                    canSwipe = false;
                    return;
                }
            }
            // Allow swipe if at top of scroll or touched top 80px (header / drag area)
            const rect = contentEl.getBoundingClientRect();
            const touchY = e.touches[0].clientY;
            const isTopZone = (touchY - rect.top) < 80;
            const isScrolledToTop = contentEl.scrollTop <= 0;

            if (isTopZone || isScrolledToTop) {
                canSwipe = true;
                touchStartY = touchY;
                touchStartX = e.touches[0].clientX;
                touchStartTime = performance.now();
                isDraggingDown = false;
            } else {
                canSwipe = false;
            }
        }, { passive: true });

        contentEl.addEventListener('touchmove', (e) => {
            if (!canSwipe || e.touches.length > 1) return;
            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const diffY = currentY - touchStartY;
            const diffX = currentX - touchStartX;

            if (!isDraggingDown) {
                if (Math.abs(diffX) > Math.abs(diffY)) {
                    canSwipe = false;
                    return;
                }
                if (diffY > 8 && contentEl.scrollTop <= 0) {
                    isDraggingDown = true;
                }
            }

            if (isDraggingDown && diffY > 0) {
                e.preventDefault();
                // Apply subtle damping resistance
                const dampened = diffY < 120 ? diffY : 120 + (diffY - 120) * 0.65;
                contentEl.style.transform = `translateY(${Math.max(0, dampened)}px)`;
                contentEl.style.transition = 'none';
            }
        }, { passive: false });

        const endTouch = (e) => {
            if (!canSwipe) return;
            canSwipe = false;
            if (!isDraggingDown) return;
            isDraggingDown = false;

            const endY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : touchStartY;
            const diffY = endY - touchStartY;
            const elapsed = performance.now() - touchStartTime;
            const velocity = diffY / Math.max(1, elapsed);

            contentEl.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';

            if (diffY > 85 || (diffY > 40 && velocity > 0.45)) {
                contentEl.style.transform = 'translateY(100%)';
                setTimeout(() => {
                    contentEl.style.transform = '';
                    contentEl.style.transition = '';
                    onClose?.();
                }, 260);
            } else {
                contentEl.style.transform = '';
                setTimeout(() => {
                    contentEl.style.transition = '';
                }, 260);
            }
        };

        contentEl.addEventListener('touchend', endTouch, { passive: true });
        contentEl.addEventListener('touchcancel', endTouch, { passive: true });
    }

    // --- Keyboard adaptive collapse & auto scroll-centering on mobile ---
    modal.addEventListener('focusin', (e) => {
        if (window.innerWidth <= 768 && e.target && e.target.matches('input, select, textarea')) {
            modal.classList.add('keyboard-active');
            contentEl?.classList.add('keyboard-active');
            setTimeout(() => {
                if (document.activeElement === e.target && isOpen()) {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 220);
        }
    });

    modal.addEventListener('focusout', () => {
        setTimeout(() => {
            if (!modal.contains(document.activeElement)) {
                modal.classList.remove('keyboard-active');
                contentEl?.classList.remove('keyboard-active');
            }
        }, 120);
    });

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
            modal.classList.remove('keyboard-active');
            if (contentEl) {
                contentEl.classList.remove('keyboard-active');
                contentEl.style.transform = '';
                contentEl.style.transition = '';
            }
            const target = lastFocused;
            lastFocused = null;
            if (target && target.isConnected && !modal.contains(target)) {
                target.focus({ preventScroll: true });
            }
        }
    });

    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
}