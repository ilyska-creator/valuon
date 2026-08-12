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
        const lang = localStorage.getItem('valuon-lang') || document.documentElement.lang || 'ru';
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
    }

    render() {
        this.dropdown.innerHTML = '';
        this._allOptions = [];

        if (this.searchable) {
            const header = document.createElement('div');
            header.className = 'custom-select-sheet-header';

            this.search = document.createElement('input');
            this.search.type = 'text';
            this.search.className = 'custom-select-search';
            this.search.setAttribute('role', 'combobox');
            this.search.setAttribute('aria-autocomplete', 'list');
            this.search.setAttribute('aria-expanded', 'false');
            this.search.setAttribute('autocomplete', 'off');
            this.search.setAttribute('spellcheck', 'false');
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
                aliases: opt.getAttribute('data-aliases') || ''
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

    applyFilter() {
        if (!this.searchable) return;
        const q = this.search.value.trim().toLowerCase();
        let visibleCount = 0;
        this._allOptions.forEach((o) => {
            const match = !q || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
                || (o.aliases && o.aliases.toLowerCase().includes(q));
            o.li.style.display = match ? '' : 'none';
            if (match) visibleCount++;
        });
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
        } else if (e.key === 'Escape' || e.key === 'Tab') {
            this.close();
        }
    }

    sync() {
        const opt = this.select.querySelector('option:checked');
        const el = this.trigger.querySelector('.custom-select-value');
        const iconHTML = opt ? opt.getAttribute('data-icon') : '';
        if (iconHTML && opt) {
            el.textContent = '';
            const icon = document.createElement('span');
            icon.className = 'cs-value-icon';
            icon.innerHTML = iconHTML;
            el.appendChild(icon);
            el.appendChild(document.createTextNode(' ' + opt.textContent));
        } else {
            el.textContent = opt ? opt.textContent : '';
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
            document.documentElement.classList.remove('cs-sheet-lock');
            this._lockedScroll = false;
        }
    }

    open() {
        if (this.isOpen) return;
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
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
            this.search.focus({ preventScroll: true });
        }

        this._closeHandler = (e) => {
            if (sheetMode) return;
            if (!this.wrapper.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.close();
            }
        };
        this._keyHandler = (e) => {
            if (e.key === 'Escape') this.close();
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

        document.removeEventListener('click', this._closeHandler);
        document.removeEventListener('keydown', this._keyHandler);
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
            this.unlockPageScroll();
        }, this._sheetMode ? 180 : 130);
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

        this.dropdown.style.left = trigRect.left + 'px';
        this.dropdown.style.width = trigRect.width + 'px';
        this.dropdown.style.top = top + 'px';
        this.dropdown.style.transformOrigin = origin;
    }

    setValue(val) {
        this.select.value = val;
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
        this.sync();
        this.close();
        this.trigger.blur();
        if (this.search) this.search.blur();
    }

    bind() {
        this.trigger.addEventListener('click', (e) => {
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
                this.close();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!this.isOpen) { this.open(); return; }
                const idx = opts.findIndex(
                    (o) => o.classList.contains('highlighted') || o.dataset.value === this.select.value
                );
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
    }

    refresh() {
        this.render();
        this.sync();
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