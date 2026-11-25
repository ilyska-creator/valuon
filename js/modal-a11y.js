const openModalStack = [];

export function attachModalA11y(modal, { mode = 'active', onClose, beforeClose } = {}) {
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
    modal.setAttribute('aria-hidden', wasOpen ? 'false' : 'true');

    function getFocusable() {
        return Array.from(modal.querySelectorAll(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(el =>
            el.offsetParent !== null &&
            !el.closest('[inert]') &&
            !el.closest('[aria-hidden="true"]')
        );
    }

    function isTopModal() {
        return openModalStack.length === 0 || openModalStack[openModalStack.length - 1] === modal;
    }

    function handleKeydown(e) {
        if (!isTopModal()) return;
        if (e.key === 'Escape') {
            if (e.defaultPrevented || window.__valuonActivePicker?.isOpen) return;
            e.preventDefault();
            if (typeof beforeClose === 'function' && !beforeClose()) return;
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
            const activeInside = modal.contains(document.activeElement);
            if (!activeInside) {
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
            } else if (e.shiftKey && document.activeElement === first) {
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
        let startedInTopZone = false;
        let touchTarget = null;

        function hasScrolledInnerContainer(startNode, boundary) {
            let node = startNode instanceof Element ? startNode : null;
            while (node) {
                if (node.scrollTop > 0 && node.scrollHeight > node.clientHeight + 1) {
                    const ov = window.getComputedStyle(node).overflowY;
                    if (ov === 'auto' || ov === 'scroll' || ov === 'overlay') {
                        return true;
                    }
                }
                if (node === boundary) break;
                node = node.parentElement;
            }
            return false;
        }

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
            // Allow swipe if touched top drag area OR all scrollable containers under finger are at scrollTop === 0
            const rect = contentEl.getBoundingClientRect();
            const touchY = e.touches[0].clientY;
            const isTopZone = Boolean(target.closest('.sheet-drag-handle, .sheet-drag-pill')) || (touchY - rect.top) < 64;
            const isScrolledToTop = !hasScrolledInnerContainer(target, contentEl);

            if (isTopZone || isScrolledToTop) {
                canSwipe = true;
                startedInTopZone = isTopZone;
                touchTarget = target;
                touchStartY = touchY;
                touchStartX = e.touches[0].clientX;
                touchStartTime = performance.now();
                isDraggingDown = false;
            } else {
                canSwipe = false;
                startedInTopZone = false;
                touchTarget = null;
            }
        }, { passive: true });

        contentEl.addEventListener('touchmove', (e) => {
            if (!canSwipe || e.touches.length > 1) return;
            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const diffY = currentY - touchStartY;
            const diffX = currentX - touchStartX;

            if (!isDraggingDown) {
                if (Math.abs(diffX) > Math.abs(diffY) || diffY < 0) {
                    canSwipe = false;
                    return;
                }
                if (diffY > 8 && (startedInTopZone || !hasScrolledInnerContainer(touchTarget, contentEl))) {
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

        const snapBack = () => {
            contentEl.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
            contentEl.style.transform = '';
            setTimeout(() => {
                contentEl.style.transition = '';
            }, 280);
        };

        const endTouch = (e) => {
            if (!canSwipe) return;
            canSwipe = false;
            startedInTopZone = false;
            touchTarget = null;
            if (!isDraggingDown) return;
            isDraggingDown = false;

            const endY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : touchStartY;
            const diffY = endY - touchStartY;
            const elapsed = performance.now() - touchStartTime;
            const velocity = diffY / Math.max(1, elapsed);

            contentEl.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';

            if (diffY > 85 || (diffY > 40 && velocity > 0.45)) {
                if (typeof beforeClose === 'function' && !beforeClose()) {
                    snapBack();
                    return;
                }
                contentEl.style.transform = 'translateY(100%)';
                setTimeout(() => {
                    onClose?.();
                    requestAnimationFrame(() => {
                        contentEl.style.transform = '';
                        contentEl.style.transition = '';
                    });
                }, 260);
            } else {
                snapBack();
            }
        };

        const cancelTouch = () => {
            if (!canSwipe) return;
            canSwipe = false;
            startedInTopZone = false;
            touchTarget = null;
            if (!isDraggingDown) return;
            isDraggingDown = false;
            snapBack();
        };

        contentEl.addEventListener('touchend', endTouch, { passive: true });
        contentEl.addEventListener('touchcancel', cancelTouch, { passive: true });
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
        if (modal.classList.contains('closing')) {
            window.__valuonActivePicker?.close?.();
        }
        const nowOpen = isOpen();
        if (nowOpen === wasOpen) return;
        wasOpen = nowOpen;

        if (nowOpen) {
            const idx = openModalStack.indexOf(modal);
            if (idx !== -1) openModalStack.splice(idx, 1);
            openModalStack.push(modal);
            modal.setAttribute('aria-hidden', 'false');
            lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            document.addEventListener('keydown', handleKeydown);
            requestAnimationFrame(() => {
                if (!isOpen()) return;
                // Only autofocus first field on desktop keyboards (> 768px).
                // On mobile devices, auto-focusing inputs forces the virtual
                // keyboard to jump open unexpectedly and cover the screen.
                if (window.innerWidth > 768) {
                    getFocusable()[0]?.focus();
                }
            });
        } else {
            window.__valuonActivePicker?.close?.();
            const idx = openModalStack.indexOf(modal);
            if (idx !== -1) openModalStack.splice(idx, 1);
            modal.setAttribute('aria-hidden', 'true');
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