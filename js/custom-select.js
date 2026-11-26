class CustomSelect {
    constructor(el) {
        this.select = el;
        this.isOpen = false;
        this.searchable = el.hasAttribute('data-searchable');
        this._allOptions = [];
        this.search = null;
        this.emptyRow = null;
        this.build();
        this.bind();
    }

    getTranslation(key) {
        if (!key) return '';
        const lang = (window.getValuonLang ? window.getValuonLang() : (document.documentElement.lang || 'en'));
        const dict = window.dashboardTranslations || window.businessTranslations || window.authTranslations;
        const table = dict && (dict[lang] || dict.ru);
        return (table && table[key]) || '';
    }

    findScrollParent(el) {
        let node = el.parentElement;
        while (node && node !== document.body && node !== document.documentElement) {
            const style = getComputedStyle(node);
            if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }

    get visibleOptions() {
        return Array.from(this.dropdown.querySelectorAll('.custom-select-option'))
            .filter((li) => li.style.display !== 'none');
    }

    build() {
        this.wrapper = this.select.closest('.custom-select-wrapper');
        if (!this.wrapper) {
            this.wrapper = document.createElement('div');
            this.wrapper.className = 'custom-select-wrapper';
            this.select.parentNode.insertBefore(this.wrapper, this.select);
            this.wrapper.appendChild(this.select);
        }

        this.trigger = this.wrapper.querySelector('.custom-select-trigger');
        if (!this.trigger) {
            this.trigger = document.createElement('button');
            this.trigger.type = 'button';
            this.trigger.className = 'custom-select-trigger';
            this.trigger.setAttribute('aria-haspopup', 'listbox');
            this.trigger.innerHTML =
                '<span class="custom-select-value"></span>' +
                '<svg class="custom-select-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 6 8 10 12 6"/></svg>';
            this.wrapper.appendChild(this.trigger);
        }

        this.dropdown = this.wrapper.querySelector('.custom-select-dropdown');
        if (!this.dropdown) {
            this.dropdown = document.createElement('ul');
            this.dropdown.className = 'custom-select-dropdown';
            this.dropdown.setAttribute('role', 'listbox');
            this.wrapper.appendChild(this.dropdown);
        }

        this.render();
        this.sync();
        this._syncDisabledState();
    }

    _syncDisabledState() {
        const disabled = !!this.select.disabled;
        this.wrapper.classList.toggle('is-disabled', disabled);
        this.trigger.classList.toggle('is-disabled', disabled);
        this.trigger.disabled = disabled;
        this.trigger.setAttribute('aria-disabled', String(disabled));
        if (disabled && this.isOpen) {
            this.close();
        }
    }

    render() {
        this.dropdown.innerHTML = '';
        this._allOptions = [];

        if (this.searchable) {
            const header = document.createElement('div');
            header.className = 'custom-select-sheet-header';

            this.search = document.createElement('input');
            this.search.type = 'search';
            this.search.name = 'cs_filter_' + Math.random().toString(36).slice(2, 8);
            this.search.className = 'custom-select-search';
            this.search.setAttribute('role', 'combobox');
            this.search.setAttribute('aria-autocomplete', 'list');
            this.search.setAttribute('aria-expanded', 'false');
            this.search.setAttribute('autocomplete', 'chrome-off');
            this.search.setAttribute('autocorrect', 'off');
            this.search.setAttribute('autocapitalize', 'off');
            this.search.setAttribute('spellcheck', 'false');
            this.search.setAttribute('enterkeyhint', 'search');
            this.search.setAttribute('data-lpignore', 'true');
            this.search.setAttribute('data-form-type', 'other');
            const phKey = this.select.getAttribute('data-search-placeholder');
            if (phKey) {
                this.search.setAttribute('data-i18n-placeholder', phKey);
                const phText = this.getTranslation(phKey);
                if (phText) this.search.placeholder = phText;
            }
            header.appendChild(this.search);

            this.sheetCloseBtn = document.createElement('button');
            this.sheetCloseBtn.type = 'button';
            this.sheetCloseBtn.className = 'cs-sheet-close';
            this.sheetCloseBtn.setAttribute('aria-label', 'Close');
            this.sheetCloseBtn.innerHTML =
                '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
            header.appendChild(this.sheetCloseBtn);

            this.dropdown.appendChild(header);

            this.search.addEventListener('input', () => this.applyFilter());
            this.search.addEventListener('keydown', (e) => this.onSearchKeydown(e));
            this.search.addEventListener('click', (e) => e.stopPropagation());
            this.sheetCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        this.list = document.createElement('div');
        this.list.className = 'custom-select-options';
        this.dropdown.appendChild(this.list);

        const val = this.select.value;
        this.select.querySelectorAll('option').forEach((opt) => {
            if (opt.disabled) return;
            const li = document.createElement('li');
            li.className = 'custom-select-option';
            li.setAttribute('role', 'option');
            li.dataset.value = opt.value;
            const iconHTML = opt.getAttribute('data-icon');
            const label = document.createElement('span');
            label.className = 'cs-option-label';
            label.textContent = opt.textContent;
            li.appendChild(label);
            if (iconHTML) {
                li.classList.add('cs-option-with-icon');
                const icon = document.createElement('span');
                icon.className = 'cs-option-icon';
                icon.innerHTML = iconHTML;
                li.appendChild(icon);
            }
            const selected = opt.value === val;
            li.classList.toggle('selected', selected);
            li.setAttribute('aria-selected', String(selected));
            this.list.appendChild(li);
            this._allOptions.push({
                li,
                value: opt.value,
                label: opt.textContent,
                aliases: opt.getAttribute('data-aliases') || '',
                dial: opt.getAttribute('data-dial') || ''
            });
        });

        if (this.searchable) {
            this.emptyRow = document.createElement('li');
            this.emptyRow.className = 'custom-select-search-empty';
            const emptyKey = this.select.getAttribute('data-search-empty');
            if (emptyKey) {
                this.emptyRow.setAttribute('data-i18n', emptyKey);
                const emptyText = this.getTranslation(emptyKey);
                if (emptyText) this.emptyRow.textContent = emptyText;
            }
            this.emptyRow.style.display = 'none';
            this.list.appendChild(this.emptyRow);
            this.applyFilter();
        }
    }

    scoreOption(o, q) {
        const val = o.value.toLowerCase();
        const label = o.label.toLowerCase();
        const dial = (o.dial || '').toLowerCase();
        const dialDigits = dial.replace(/^\+/, '');
        const aliasParts = o.aliases
            ? o.aliases.toLowerCase().split(';').map((s) => s.trim()).filter(Boolean)
            : [];

        // Priority 0: exact match on ISO code, dial code (+7 / 7), or exact alias
        if (
            val === q ||
            (dial && (dial === q || dialDigits === q)) ||
            aliasParts.some((a) => a === q)
        ) {
            return 0;
        }

        // Priority 1: startsWith on dial code, ISO code, alias, or label
        if (
            val.startsWith(q) ||
            (dial && (dial.startsWith(q) || dialDigits.startsWith(q))) ||
            label.startsWith(q) ||
            aliasParts.some((a) => a.startsWith(q))
        ) {
            return 1;
        }

        // Priority 2: substring match anywhere
        if (
            label.includes(q) ||
            val.includes(q) ||
            (o.aliases && o.aliases.toLowerCase().includes(q))
        ) {
            return 2;
        }

        return -1;
    }

    applyFilter() {
        if (!this.searchable) return;
        const q = this.search.value.trim().toLowerCase();
        let visibleCount = 0;

        if (!q) {
            this._allOptions.forEach((o) => {
                o.li.style.display = '';
                this.list.insertBefore(o.li, this.emptyRow || null);
                visibleCount++;
            });
        } else {
            const matched = [];
            this._allOptions.forEach((o, idx) => {
                const score = this.scoreOption(o, q);
                if (score >= 0) {
                    o.li.style.display = '';
                    matched.push({ o, score, idx });
                    visibleCount++;
                } else {
                    o.li.style.display = 'none';
                }
            });
            matched.sort((a, b) => a.score - b.score || a.idx - b.idx);
            matched.forEach(({ o }) => {
                this.list.insertBefore(o.li, this.emptyRow || null);
            });
        }

        if (this.emptyRow) {
            this.emptyRow.style.display = visibleCount === 0 && q ? '' : 'none';
        }
        this.dropdown.querySelectorAll('.custom-select-option').forEach((l) => l.classList.remove('highlighted'));
        const vis = this.visibleOptions;
        if (vis.length) vis[0].classList.add('highlighted');
    }

    moveHighlight(dir) {
        const opts = this.visibleOptions;
        if (!opts.length) return;
        let idx = opts.findIndex((o) => o.classList.contains('highlighted'));
        opts.forEach((o) => o.classList.remove('highlighted'));
        if (idx === -1) {
            idx = dir > 0 ? -1 : opts.length;
        }
        const next = Math.max(0, Math.min(idx + dir, opts.length - 1));
        opts[next].classList.add('highlighted');
        opts[next].scrollIntoView({ block: 'nearest' });
    }

    onSearchKeydown(e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            this.moveHighlight(e.key === 'ArrowDown' ? 1 : -1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const hl = this.dropdown.querySelector('.custom-select-option.highlighted');
            if (hl) this.setValue(hl.dataset.value);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.close();
        } else if (e.key === 'Tab') {
            this.close();
        }
    }

    sync() {
        const opt = this.select.querySelector('option:checked');
        const el = this.trigger.querySelector('.custom-select-value');
        const iconHTML = opt ? opt.getAttribute('data-icon') : '';
        const displayLabel = opt ? (opt.getAttribute('data-short-label') || opt.textContent) : '';
        if (iconHTML && opt) {
            el.textContent = '';
            const icon = document.createElement('span');
            icon.className = 'cs-value-icon';
            icon.innerHTML = iconHTML;
            el.appendChild(icon);
            el.appendChild(document.createTextNode(' ' + displayLabel));
        } else {
            el.textContent = displayLabel;
        }
        if (this.search && !this.isOpen) {
            this.search.value = opt && opt.value ? opt.textContent : '';
        }
        const val = this.select.value;
        this.dropdown.querySelectorAll('.custom-select-option').forEach((li) => {
            const sel = li.dataset.value === val;
            li.classList.toggle('selected', sel);
            li.setAttribute('aria-selected', String(sel));
        });
    }

    get isSheetMode() {
        return this.searchable && window.matchMedia('(max-width: 900px)').matches;
    }

    lockPageScroll() {
        if (!document.documentElement.classList.contains('cs-sheet-lock')) {
            document.documentElement.classList.add('cs-sheet-lock');
            this._lockedScroll = true;
        }
    }

    unlockPageScroll() {
        if (this._lockedScroll) {
            const otherSheetOpen = window.__valuonActivePicker && window.__valuonActivePicker !== this && window.__valuonActivePicker.isOpen && window.__valuonActivePicker._sheetMode;
            if (!otherSheetOpen) {
                document.documentElement.classList.remove('cs-sheet-lock');
            }
            this._lockedScroll = false;
        }
    }

    open() {
        if (this.isOpen || this.select.disabled) return;
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
        }
        if (this._focusTimer) {
            clearTimeout(this._focusTimer);
            this._focusTimer = null;
        }
        if (window.__valuonActivePicker && window.__valuonActivePicker !== this) {
            window.__valuonActivePicker.close();
        }
        window.__valuonActivePicker = this;
        this.isOpen = true;
        this.dropdown.classList.remove('closing');

        const sheetMode = this.isSheetMode;
        this._sheetMode = sheetMode;
        this.dropdown.classList.toggle('cs-sheet', sheetMode);

        if (sheetMode) {
            if (!this._backdrop) {
                this._backdrop = document.createElement('div');
                this._backdrop.className = 'cs-sheet-backdrop';
                this._backdrop.addEventListener('click', () => this.close());
            }
            document.body.appendChild(this._backdrop);
            void this._backdrop.offsetHeight;
            this._backdrop.classList.add('visible');
        }

        document.body.appendChild(this.dropdown);
        this.dropdown.style.display = 'flex';
        void this.dropdown.offsetHeight;
        this.dropdown.classList.add('visible');

        if (sheetMode) {
            this.dropdown.style.top = '';
            this.dropdown.style.left = '';
            this.dropdown.style.width = '';
            this.dropdown.style.transformOrigin = '';
            this.lockPageScroll();

            this._sheetTouchY = 0;
            this._sheetTouchStart = (e) => {
                if (e.touches.length === 1) {
                    this._sheetTouchY = e.touches[0].clientY;
                }
            };
            this._sheetTouchMove = (e) => {
                if (e.touches.length > 1) return;
                const scroller = e.target.closest?.('.custom-select-options');
                if (!scroller) {
                    e.preventDefault();
                    return;
                }
                const maxScroll = scroller.scrollHeight - scroller.clientHeight;
                if (maxScroll <= 1) {
                    e.preventDefault();
                    return;
                }
                const dy = e.touches[0].clientY - this._sheetTouchY;
                if ((dy > 0 && scroller.scrollTop <= 0) || (dy < 0 && scroller.scrollTop >= maxScroll - 1)) {
                    e.preventDefault();
                }
            };
            this.dropdown.addEventListener('touchstart', this._sheetTouchStart, { passive: true });
            this.dropdown.addEventListener('touchmove', this._sheetTouchMove, { passive: false });
            this._backdrop?.addEventListener('touchmove', this._sheetTouchMove, { passive: false });
        } else {
            this.position();
        }

        this.wrapper.classList.add('open');
        this.trigger.setAttribute('aria-expanded', 'true');

        if (this.searchable && this.search) {
            this.search.setAttribute('aria-expanded', 'true');
            this.search.value = '';
            this.applyFilter();
            this.dropdown.querySelectorAll('.custom-select-option').forEach((l) => l.classList.remove('highlighted'));
            const sel = this._allOptions.find((o) => o.value === this.select.value);
            if (sel) sel.li.classList.add('highlighted');
            if (sheetMode) {
                this._focusTimer = setTimeout(() => {
                    this._focusTimer = null;
                    if (this.isOpen && this.search) {
                        this.search.focus({ preventScroll: true });
                    }
                }, 280);
            } else {
                this.search.focus({ preventScroll: true });
            }
        }

        this._closeHandler = (e) => {
            if (sheetMode) return;
            if (!this.wrapper.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.close();
            }
        };
        this._keyHandler = (e) => {
            if (e.key === 'Escape' || e.key === 'Tab') this.close();
        };
        document.addEventListener('click', this._closeHandler);
        document.addEventListener('keydown', this._keyHandler);

        if (!sheetMode) {
            this._scrollHandler = () => this.close();
            this._resizeHandler = () => {
                if (this._positionRaf) return;
                this._positionRaf = requestAnimationFrame(() => {
                    this._positionRaf = null;
                    if (this.isOpen) this.position();
                });
            };
            window.addEventListener('scroll', this._scrollHandler, { passive: true });
            window.addEventListener('resize', this._resizeHandler, { passive: true });

            this._scrollParent = this.findScrollParent(this.trigger);
            if (this._scrollParent) {
                this._scrollParent.addEventListener('scroll', this._scrollHandler, { passive: true });
            }
        }
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;

        if (window.__valuonActivePicker === this) {
            window.__valuonActivePicker = null;
        }

        if (this._focusTimer) {
            clearTimeout(this._focusTimer);
            this._focusTimer = null;
        }
        if (this._positionRaf) {
            cancelAnimationFrame(this._positionRaf);
            this._positionRaf = null;
        }

        if (this.searchable && this.search) {
            this.search.setAttribute('aria-expanded', 'false');
            const opt = this.select.querySelector('option:checked');
            this.search.value = opt && opt.value ? opt.textContent : '';
        }

        this.dropdown.classList.remove('visible');
        this.dropdown.classList.add('closing');
        if (this._backdrop) {
            this._backdrop.classList.remove('visible');
        }

        document.removeEventListener('click', this._closeHandler);
        document.removeEventListener('keydown', this._keyHandler);
        if (this._sheetTouchStart) {
            this.dropdown.removeEventListener('touchstart', this._sheetTouchStart);
            this._sheetTouchStart = null;
        }
        if (this._sheetTouchMove) {
            this.dropdown.removeEventListener('touchmove', this._sheetTouchMove);
            this._backdrop?.removeEventListener('touchmove', this._sheetTouchMove);
            this._sheetTouchMove = null;
        }
        if (this._scrollHandler) {
            window.removeEventListener('scroll', this._scrollHandler);
            if (this._scrollParent) this._scrollParent.removeEventListener('scroll', this._scrollHandler);
        }
        if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
        this._scrollHandler = null;
        this._resizeHandler = null;
        this._scrollParent = null;

        this._closeTimer = setTimeout(() => {
            this._closeTimer = null;
            this.wrapper.classList.remove('open');
            this.trigger.setAttribute('aria-expanded', 'false');
            this.dropdown.classList.remove('closing', 'cs-sheet');
            this.dropdown.style.display = 'none';
            this.wrapper.appendChild(this.dropdown);
            if (this._backdrop && this._backdrop.parentNode) {
                this._backdrop.parentNode.removeChild(this._backdrop);
            }
            this.unlockPageScroll();
        }, this._sheetMode ? 230 : 130);
    }

    position() {
        const trigRect = this.trigger.getBoundingClientRect();
        const gap = 4;
        const dropdownHeight = Math.min(this.dropdown.scrollHeight, 240);
        const spaceBelow = window.innerHeight - trigRect.bottom;
        const spaceAbove = trigRect.top;

        let top, origin;
        if (spaceBelow >= dropdownHeight + gap || spaceBelow >= spaceAbove) {
            top = trigRect.bottom + gap;
            origin = 'top';
        } else {
            top = trigRect.top - dropdownHeight - gap;
            origin = 'bottom';
        }

        const minW = parseInt(this.select.getAttribute('data-dropdown-min-width') || '0', 10) || 0;
        const width = Math.min(Math.max(trigRect.width, minW), window.innerWidth - 16);
        const left = Math.max(8, Math.min(trigRect.left, window.innerWidth - width - 8));

        top = Math.max(8, top);

        this.dropdown.style.left = left + 'px';
        this.dropdown.style.width = width + 'px';
        this.dropdown.style.top = top + 'px';
        this.dropdown.style.transformOrigin = origin;
    }

    setValue(val) {
        this.select.value = val;
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
        this.sync();
        this.close();
    }

    bind() {
        this.trigger.addEventListener('click', (e) => {
            if (this.select.disabled) return;
            e.stopPropagation();
            this.isOpen ? this.close() : this.open();
        });

        this.dropdown.addEventListener('click', (e) => {
            const li = e.target.closest('.custom-select-option');
            if (li && this.isOpen) {
                e.stopPropagation();
                this.setValue(li.dataset.value);
            }
        });

        this.trigger.addEventListener('keydown', (e) => {
            if (this.select.disabled) return;
            const opts = this.visibleOptions;
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.isOpen) {
                    const hl = this.dropdown.querySelector('.highlighted');
                    if (hl) this.setValue(hl.dataset.value);
                    else this.close();
                } else {
                    this.open();
                }
            } else if (e.key === ' ' && !this.isOpen) {
                e.preventDefault();
                this.open();
            } else if (e.key === 'Escape') {
                if (this.isOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.close();
                }
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!this.isOpen) { this.open(); return; }
                let idx = opts.findIndex((o) => o.classList.contains('highlighted'));
                if (idx === -1) {
                    idx = opts.findIndex((o) => o.dataset.value === this.select.value);
                }
                const next = Math.max(0, Math.min(idx + (e.key === 'ArrowDown' ? 1 : -1), opts.length - 1));
                opts.forEach((o) => o.classList.remove('highlighted'));
                if (opts[next]) {
                    opts[next].classList.add('highlighted');
                    opts[next].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Tab') {
                this.close();
            }
        });

        this.dropdown.addEventListener('mouseover', (e) => {
            const li = e.target.closest('.custom-select-option');
            if (li) {
                this.dropdown.querySelectorAll('.custom-select-option').forEach((o) => o.classList.remove('highlighted'));
                li.classList.add('highlighted');
            }
        });
        this._disabledObserver = new MutationObserver(() => this._syncDisabledState());
        this._disabledObserver.observe(this.select, {
            attributes: true,
            attributeFilter: ['disabled']
        });

        this._invalidHandler = () => {
            this.trigger.focus();
        };
        this.select.addEventListener('invalid', this._invalidHandler);

        this._form = this.select.closest('form');
        if (this._form) {
            this._resetHandler = () => {
                setTimeout(() => this.sync(), 0);
            };
            this._form.addEventListener('reset', this._resetHandler);
        }
    }

    destroy() {
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
        }
        this.close();
        this.unlockPageScroll();
        if (this._disabledObserver) this._disabledObserver.disconnect();
        if (this._invalidHandler) this.select.removeEventListener('invalid', this._invalidHandler);
        if (this._form && this._resetHandler) this._form.removeEventListener('reset', this._resetHandler);
        this.dropdown.remove();
        this.wrapper.replaceWith(this.select);
        delete this.select._cs;
    }

    refresh() {
        this.render();
        this.sync();
        this._syncDisabledState();
    }

    static init(root) {
        (root || document).querySelectorAll('select.custom-select').forEach((el) => {
            if (!el._cs) el._cs = new CustomSelect(el);
        });
    }

    static refreshAll(root) {
        (root || document).querySelectorAll('select.custom-select').forEach((el) => {
            if (el._cs) el._cs.refresh();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => CustomSelect.init());