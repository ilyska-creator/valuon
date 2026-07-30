class CustomSelect {
    constructor(el) {
        this.select = el;
        this.isOpen = false;
        this.build();
        this.bind();
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
        const val = this.select.value;
        this.select.querySelectorAll('option').forEach((opt) => {
            const li = document.createElement('li');
            li.className = 'custom-select-option';
            li.setAttribute('role', 'option');
            li.dataset.value = opt.value;
            li.textContent = opt.textContent;
            const selected = opt.value === val;
            li.classList.toggle('selected', selected);
            li.setAttribute('aria-selected', String(selected));
            this.dropdown.appendChild(li);
        });
    }

    sync() {
        const opt = this.select.querySelector('option:checked');
        const el = this.trigger.querySelector('.custom-select-value');
        el.textContent = opt ? opt.textContent : '';
        const val = this.select.value;
        this.dropdown.querySelectorAll('.custom-select-option').forEach((li) => {
            const sel = li.dataset.value === val;
            li.classList.toggle('selected', sel);
            li.setAttribute('aria-selected', String(sel));
        });
    }

    open() {
        if (this.isOpen) return;
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
        }
        this.isOpen = true;
        this.dropdown.classList.remove('closing');

        document.body.appendChild(this.dropdown);
        this.dropdown.style.display = 'block';
        void this.dropdown.offsetHeight;
        this.dropdown.classList.add('visible');
        this.position();

        this.wrapper.classList.add('open');
        this.trigger.setAttribute('aria-expanded', 'true');

        this._closeHandler = (e) => {
            if (!this.wrapper.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.close();
            }
        };
        this._scrollHandler = () => this.close();
        this._resizeHandler = () => this.close();
        this._keyHandler = (e) => {
            if (e.key === 'Escape') this.close();
        };

        document.addEventListener('click', this._closeHandler);
        window.addEventListener('scroll', this._scrollHandler, { passive: true });
        window.addEventListener('resize', this._resizeHandler, { passive: true });
        document.addEventListener('keydown', this._keyHandler);
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;

        this.dropdown.classList.remove('visible');
        this.dropdown.classList.add('closing');

        document.removeEventListener('click', this._closeHandler);
        window.removeEventListener('scroll', this._scrollHandler);
        window.removeEventListener('resize', this._resizeHandler);
        document.removeEventListener('keydown', this._keyHandler);

        this._closeTimer = setTimeout(() => {
            this._closeTimer = null;
            this.wrapper.classList.remove('open');
            this.trigger.setAttribute('aria-expanded', 'false');
            this.dropdown.classList.remove('closing');
            this.dropdown.style.display = 'none';
            this.wrapper.appendChild(this.dropdown);
        }, 130);
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
            const opts = this.dropdown.querySelectorAll('.custom-select-option');
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
                const idx = Array.from(opts).findIndex(
                    (o) => o.classList.contains('highlighted') || o.dataset.value === this.select.value
                );
                const next = Math.max(0, Math.min(idx + (e.key === 'ArrowDown' ? 1 : -1), opts.length - 1));
                opts.forEach((o) => o.classList.remove('highlighted'));
                opts[next].classList.add('highlighted');
                opts[next].scrollIntoView({ block: 'nearest' });
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
