class CustomDatePicker {
    static getLang() {
        return localStorage.getItem('valuon-lang') || 'ru';
    }

    static init(root) {
        (root || document).querySelectorAll('input[type="date"].custom-datepicker, input[type="datetime-local"].custom-datepicker').forEach(el => {
            if (!el._cdp) el._cdp = new CustomDatePicker(el);
        });
    }

    static refreshAll(root) {
        (root || document).querySelectorAll('input[type="date"].custom-datepicker, input[type="datetime-local"].custom-datepicker').forEach(el => {
            if (el._cdp) el._cdp.refresh();
        });
    }

    constructor(input) {
        this.input = input;
        this.lang = CustomDatePicker.getLang();
        this.isOpen = false;
        this.isDatetime = input.type === 'datetime-local';
        this.mode = 'days';
        this._gridIndex = 0;
        this._closeTimer = null;
        this._focusDate = null;
        this.selectedDate = this.input.value ? this._parseDate(this.input.value) : null;
        this.viewDate = this.selectedDate ? new Date(this.selectedDate) : new Date();
        this.build();
        this.bind();
    }

    // --- DOM construction ---

    build() {
        this.input.tabIndex = -1;
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'custom-datepicker-wrapper';
        this.input.parentNode.insertBefore(this.wrapper, this.input);
        this.wrapper.appendChild(this.input);

        this.trigger = document.createElement('div');
        this.trigger.className = 'custom-datepicker-trigger';
        this.trigger.setAttribute('aria-haspopup', 'dialog');
        this.trigger.setAttribute('aria-expanded', 'false');
        this.trigger.innerHTML =
            `<input class="custom-datepicker-input" type="text" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="${this.lang === 'ru' ? 'ДД.ММ.ГГГГ' : 'MM/DD/YYYY'}">` +
            (this.isDatetime ? `<span class="custom-datepicker-time"></span>` : '') +
            `<button type="button" class="custom-datepicker-arrow-btn" tabindex="-1" aria-label="${this.lang === 'ru' ? 'Открыть календарь' : 'Open calendar'}">` +
            `<svg class="custom-datepicker-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 6 8 10 12 6"/></svg>` +
            `</button>`;
        this.wrapper.appendChild(this.trigger);
        this._cdpInput = this.trigger.querySelector('.custom-datepicker-input');
        this.arrowBtn = this.trigger.querySelector('.custom-datepicker-arrow-btn');

        this.panel = document.createElement('div');
        this.panel.className = 'custom-datepicker-panel';
        this.panel.setAttribute('role', 'dialog');
        this.panel.setAttribute('aria-modal', 'true');
        this.panel.setAttribute('tabindex', '-1');
        this.wrapper.appendChild(this.panel);

        this.errorEl = document.createElement('div');
        this.errorEl.className = 'custom-datepicker-error';
        this.errorEl.setAttribute('role', 'alert');
        this.errorEl.hidden = true;
        this._errorId = `cdp-error-${Math.random().toString(36).slice(2, 8)}`;
        this.errorEl.id = this._errorId;
        this.wrapper.appendChild(this.errorEl);
        this._cdpInput.setAttribute('aria-describedby', this._errorId);

        this.input._cdp = this;
        this._syncDisplay();
        this._syncLockedState();
    }

    // --- Localization helpers ---

    _monthNames() {
        return this.lang === 'ru'
            ? ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
            : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    }

    _monthGenitive() {
        return this.lang === 'ru'
            ? ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
            : this._monthNames();
    }

    // --- Calendar rendering ---

    render() {
        if (this.mode === 'months') this._renderMonths();
        else if (this.mode === 'years') this._renderYears();
        else this._renderDays();
        this._attachPanelEvents();
    }

    _renderDays() {
        const year = this.viewDate.getFullYear();
        const month = this.viewDate.getMonth();
        const monthNames = this._monthNames();
        const monthGen = this._monthGenitive();

        const dayNames = this.lang === 'ru'
            ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
            : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const today = new Date();
        const todayY = today.getFullYear();
        const todayM = today.getMonth();
        const todayD = today.getDate();

        const selected = this.selectedDate;

        const makeCell = (date, inMonth) => {
            const y = date.getFullYear();
            const m = date.getMonth();
            const d = date.getDate();
            const iso = this._isoDate(date);
            const dow = date.getDay();

            const isToday = d === todayD && m === todayM && y === todayY;
            const isSelected = !!selected &&
                d === selected.getDate() &&
                m === selected.getMonth() &&
                y === selected.getFullYear();

            let cls = 'cal-day';
            if (!inMonth) cls += ' cal-day-other';
            if (dow === 0 || dow === 6) cls += ' cal-day-weekend';
            if (isToday) cls += ' cal-day-today';
            if (isSelected) cls += ' cal-day-selected';

            let attrs = `data-date="${iso}" role="gridcell" aria-label="${this.lang === 'ru' ? `${d} ${monthGen[m]} ${y}` : `${monthNames[m]} ${d}, ${y}`}"`;
            if (isSelected) attrs += ' aria-selected="true"';
            if (isToday) attrs += ' aria-current="date"';

            return `<span class="${cls}" ${attrs}>${d}</span>`;
        };

        let cellsHtml = '';

        for (let i = startOffset - 1; i >= 0; i--) {
            const date = new Date(year, month - 1, daysInPrevMonth - i);
            cellsHtml += makeCell(date, false);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            cellsHtml += makeCell(new Date(year, month, d), true);
        }

        const total = startOffset + daysInMonth;
        const remaining = (7 - total % 7) % 7;
        for (let d = 1; d <= remaining; d++) {
            cellsHtml += makeCell(new Date(year, month + 1, d), false);
        }

        const monthName = monthNames[month];
        const footer = this.selectedDate
            ? `<div class="cal-footer">
                <button class="cal-btn cal-today" type="button" tabindex="-1">${this.lang === 'ru' ? 'Сегодня' : 'Today'}</button>
                <button class="cal-btn cal-clear" type="button" tabindex="-1">${this.lang === 'ru' ? 'Очистить' : 'Clear'}</button>
               </div>`
            : `<div class="cal-footer cal-footer-single">
                <button class="cal-btn cal-today" type="button" tabindex="-1">${this.lang === 'ru' ? 'Сегодня' : 'Today'}</button>
               </div>`;

        this.panel.innerHTML = `
            <div class="cal-header">
                <button class="cal-nav cal-prev" type="button" tabindex="-1" aria-label="${this.lang === 'ru' ? 'Предыдущий месяц' : 'Previous month'}">◀</button>
                <button class="cal-title-btn" type="button" aria-label="${this.lang === 'ru' ? 'Выбрать месяц и год' : 'Pick month and year'}">${monthName} ${year}</button>
                <button class="cal-nav cal-next" type="button" tabindex="-1" aria-label="${this.lang === 'ru' ? 'Следующий месяц' : 'Next month'}">▶</button>
            </div>
            <div class="cal-day-names">
                ${dayNames.map(n => `<span class="cal-day-name">${n}</span>`).join('')}
            </div>
            <div class="cal-days-grid">
                ${cellsHtml}
            </div>
            ${footer}
        `;

        if (this.isDatetime) {
            this._renderTimePicker();
        }

        this._highlightFocusDate();
    }

    _renderMonths() {
        const year = this.viewDate.getFullYear();
        const monthNames = this._monthNames();
        const curMonth = this.viewDate.getMonth();

        let cells = '';
        for (let m = 0; m < 12; m++) {
            const sel = m === curMonth ? ' cal-cell-selected' : '';
            const cur = m === curMonth ? ' aria-current="true"' : '';
            cells += `<span class="cal-cell${sel}" data-month="${m}" role="gridcell" aria-label="${monthNames[m]}"${cur}>${monthNames[m]}</span>`;
        }

        this.panel.innerHTML = `
            <div class="cal-header">
                <button class="cal-nav cal-prev" type="button" tabindex="-1" aria-label="${this.lang === 'ru' ? 'Предыдущий год' : 'Previous year'}">◀</button>
                <button class="cal-title-btn" type="button" aria-label="${this.lang === 'ru' ? 'Выбрать год' : 'Pick year'}">${year}</button>
                <button class="cal-nav cal-next" type="button" tabindex="-1" aria-label="${this.lang === 'ru' ? 'Следующий год' : 'Next year'}">▶</button>
            </div>
            <div class="cal-grid">${cells}</div>
        `;
    }

    _renderYears() {
        const year = this.viewDate.getFullYear();
        const base = Math.floor(year / 12) * 12;

        let cells = '';
        for (let y = base; y < base + 12; y++) {
            const sel = y === year ? ' cal-cell-selected' : '';
            const cur = y === year ? ' aria-current="true"' : '';
            cells += `<span class="cal-cell${sel}" data-year="${y}" role="gridcell" aria-label="${y}"${cur}>${y}</span>`;
        }

        this.panel.innerHTML = `
            <div class="cal-header">
                <button class="cal-nav cal-prev" type="button" tabindex="-1" aria-label="${this.lang === 'ru' ? 'Предыдущий диапазон' : 'Previous range'}">◀</button>
                <span class="cal-month-year">${base} — ${base + 11}</span>
                <button class="cal-nav cal-next" type="button" tabindex="-1" aria-label="${this.lang === 'ru' ? 'Следующий диапазон' : 'Next range'}">▶</button>
            </div>
            <div class="cal-grid">${cells}</div>
        `;
    }

    _renderTimePicker() {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'cal-time';

        let hour = '12', minute = '00';
        const val = this.input.value;
        if (val && val.includes('T')) {
            const timePart = val.split('T')[1];
            if (timePart) {
                const [h, m] = timePart.split(':');
                if (h) hour = h;
                if (m) minute = m;
            }
        } else if (this.selectedDate) {
            hour = String(this.selectedDate.getHours()).padStart(2, '0');
            minute = String(this.selectedDate.getMinutes()).padStart(2, '0');
        }

        let hoursOpts = '';
        for (let h = 0; h < 24; h++) {
            const v = String(h).padStart(2, '0');
            hoursOpts += `<option value="${v}"${v === hour ? ' selected' : ''}>${v}</option>`;
        }
        let minsOpts = '';
        for (let m = 0; m < 60; m++) {
            const v = String(m).padStart(2, '0');
            minsOpts += `<option value="${v}"${v === minute ? ' selected' : ''}>${v}</option>`;
        }

        timeDiv.innerHTML = `
            <select class="cal-hour" tabindex="-1">${hoursOpts}</select>
            <span class="cal-time-sep">:</span>
            <select class="cal-min" tabindex="-1">${minsOpts}</select>
        `;

        this.panel.appendChild(timeDiv);
    }

    _attachPanelEvents() {
        const prevBtn = this.panel.querySelector('.cal-prev');
        const nextBtn = this.panel.querySelector('.cal-next');
        const titleBtn = this.panel.querySelector('.cal-title-btn');

        if (prevBtn) prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._navigate(-1);
        });
        if (nextBtn) nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._navigate(1);
        });
        if (titleBtn) titleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.mode = this.mode === 'days' ? 'months' : 'years';
            this.render();
        });

        if (this.mode === 'days') {
            const todayBtn = this.panel.querySelector('.cal-today');
            const clearBtn = this.panel.querySelector('.cal-clear');

            if (todayBtn) todayBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._selectDate(new Date());
            });
            if (clearBtn) clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._clearDate();
            });

            this.panel.querySelectorAll('.cal-day').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const date = this._parseDate(el.dataset.date);
                    if (date) this._selectDate(date);
                });
            });

            const hourSel = this.panel.querySelector('.cal-hour');
            const minSel = this.panel.querySelector('.cal-min');
            if (hourSel) hourSel.addEventListener('change', () => this._syncDateTime());
            if (minSel) minSel.addEventListener('change', () => this._syncDateTime());
        } else if (this.mode === 'months') {
            this.panel.querySelectorAll('.cal-cell[data-month]').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.viewDate.setMonth(parseInt(el.dataset.month, 10));
                    this.mode = 'days';
                    this.render();
                });
            });
        } else {
            this.panel.querySelectorAll('.cal-cell[data-year]').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.viewDate.setFullYear(parseInt(el.dataset.year, 10));
                    this.mode = 'months';
                    this.render();
                });
            });
        }
    }

    _navigate(dir) {
        if (this.mode === 'months') {
            this.viewDate.setFullYear(this.viewDate.getFullYear() + dir);
            this.render();
            return;
        }
        if (this.mode === 'years') {
            this.viewDate.setFullYear(this.viewDate.getFullYear() + dir * 12);
            this.render();
            return;
        }

        const grid = this.panel.querySelector('.cal-days-grid');
        grid.classList.add(dir > 0 ? 'slide-out-left' : 'slide-out-right');
        setTimeout(() => {
            this.viewDate.setMonth(this.viewDate.getMonth() + dir);
            this.render();
            const g = this.panel.querySelector('.cal-days-grid');
            g.classList.add(dir > 0 ? 'slide-in-left' : 'slide-in-right');
            setTimeout(() => g.classList.remove('slide-in-left', 'slide-in-right'), 220);
        }, 150);
    }

    // --- Public API ---

    open() {
        if (this.isOpen) return;
        if (this.trigger.classList.contains('is-disabled')) return;
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
        }

        this.isOpen = true;
        this.mode = 'days';
        this._gridIndex = 0;
        this.panel.classList.remove('closing');

        this.selectedDate = this.input.value ? this._parseDate(this.input.value) : null;
        if (this.selectedDate) this.viewDate = new Date(this.selectedDate);
        this._focusDate = this.selectedDate
            ? new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), this.selectedDate.getDate())
            : new Date();

        document.body.appendChild(this.panel);
        this.panel.style.display = 'block';

        this.render();
        this.position();

        void this.panel.offsetHeight;
        this.panel.classList.add('visible');
        this.trigger.setAttribute('aria-expanded', 'true');
        this.panel.focus();

        this._closeHandler = (e) => {
            if (!this.wrapper.contains(e.target) && !this.panel.contains(e.target)) {
                this.close();
            }
        };
        this._scrollHandler = () => this.close();
        this._resizeHandler = () => this.position();
        this._keyHandler = (e) => {
            if (e.key === 'Escape') this.close();
            if (e.key === 'Tab') {
                setTimeout(() => {
                    if (!this.panel.contains(document.activeElement)) this.close();
                }, 0);
            }
        };

        document.addEventListener('click', this._closeHandler);
        window.addEventListener('scroll', this._scrollHandler, { passive: true });
        window.addEventListener('resize', this._resizeHandler, { passive: true });
        document.addEventListener('keydown', this._keyHandler);
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;

        const shouldRefocus = this.panel.contains(document.activeElement);

        this.panel.classList.remove('visible');
        this.panel.classList.add('closing');

        document.removeEventListener('click', this._closeHandler);
        window.removeEventListener('scroll', this._scrollHandler);
        window.removeEventListener('resize', this._resizeHandler);
        document.removeEventListener('keydown', this._keyHandler);

        this._closeTimer = setTimeout(() => {
            this._closeTimer = null;
            this.panel.classList.remove('closing');
            this.panel.style.display = 'none';
            this.trigger.setAttribute('aria-expanded', 'false');
            this.wrapper.appendChild(this.panel);
        }, 130);

        if (shouldRefocus) this._cdpInput.focus();
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    setLocked(locked) {
        this.input.readOnly = locked;
        this._syncLockedState();
    }

    syncDisplay() {
        this.selectedDate = this.input.value ? this._parseDate(this.input.value) : null;
        if (this.selectedDate) this.viewDate = new Date(this.selectedDate);
        this._focusDate = this.selectedDate ? new Date(this.selectedDate) : null;
        this._syncDisplay();
    }

    refresh() {
        this.lang = CustomDatePicker.getLang();
        this._cdpInput.placeholder = this.lang === 'ru' ? 'ДД.ММ.ГГГГ' : 'MM/DD/YYYY';
        this.selectedDate = this.input.value ? this._parseDate(this.input.value) : null;
        this.viewDate = this.selectedDate ? new Date(this.selectedDate) : new Date();
        this._syncDisplay();
        this._syncLockedState();
        if (this.isOpen) {
            this.render();
            this.position();
        }
    }

    destroy() {
        this.close();
        if (this._observer) this._observer.disconnect();
        if (this._formHandler) this._form.removeEventListener('reset', this._formHandler);
        if (this._invalidHandler) this.input.removeEventListener('invalid', this._invalidHandler);
        if (this._nativeChangeHandler) this.input.removeEventListener('change', this._nativeChangeHandler);
        this.panel.remove();
        this.wrapper.replaceWith(this.input);
        const s = this.input.style;
        s.position = ''; s.width = ''; s.height = '';
        s.padding = ''; s.margin = ''; s.overflow = '';
        s.clip = ''; s.whiteSpace = ''; s.border = '';
        s.opacity = ''; s.pointerEvents = '';
        delete this.input._cdp;
    }

    // --- Internal ---

    position() {
        const trigRect = this.trigger.getBoundingClientRect();
        const gap = 4;
        const panelH = this.panel.scrollHeight;
        const spaceBelow = window.innerHeight - trigRect.bottom;
        const spaceAbove = trigRect.top;

        let top, origin;
        const belowFits = spaceBelow >= panelH + gap;
        const aboveFits = spaceAbove >= panelH + gap;
        if (belowFits || (!aboveFits && spaceBelow >= spaceAbove)) {
            top = trigRect.bottom + gap;
            origin = 'top';
        } else {
            top = trigRect.top - panelH - gap;
            origin = 'bottom';
        }

        const panelW = Math.min(Math.max(trigRect.width, 260), 320);
        let left;
        if (trigRect.width >= panelW) {
            left = trigRect.left;
        } else {
            left = trigRect.right - panelW;
        }
        if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
        if (left < 8) left = 8;

        this.panel.style.left = left + 'px';
        this.panel.style.width = panelW + 'px';
        this.panel.style.top = top + 'px';
        this.panel.style.transformOrigin = origin + ' center';
    }

    _selectDate(date) {
        this._applySelection(date);
        this.close();
    }

    _applySelection(date) {
        if (this.isDatetime) {
            let hh = '12', mm = '00';
            const val = this.input.value;
            if (val && val.includes('T')) {
                const tp = val.split('T')[1];
                if (tp) {
                    const [h, mi] = tp.split(':');
                    if (h) hh = h;
                    if (mi) mm = mi;
                }
            }
            const hSel = this.panel.querySelector('.cal-hour');
            const mSel = this.panel.querySelector('.cal-min');
            if (hSel) hh = hSel.value;
            if (mSel) mm = mSel.value;
            date.setHours(parseInt(hh, 10), parseInt(mm, 10));
        }

        this.selectedDate = date;
        this.viewDate = new Date(date.getFullYear(), date.getMonth(), 1);
        this._focusDate = new Date(date);
        this._clearInvalid();
        this._syncHiddenInput();
        this._syncDisplay();
    }

    _clearDate() {
        this._applyClear();
        this.close();
    }

    _applyClear() {
        if (!this.selectedDate) return;
        this.selectedDate = null;
        this._focusDate = null;
        this.input.value = '';
        this._clearInvalid();
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
        this._syncDisplay();
    }

    _syncHiddenInput() {
        if (!this.selectedDate) return;
        const y = this.selectedDate.getFullYear();
        const m = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
        const d = String(this.selectedDate.getDate()).padStart(2, '0');

        if (this.isDatetime) {
            const hSel = this.panel.querySelector('.cal-hour');
            const mSel = this.panel.querySelector('.cal-min');
            const h = hSel ? hSel.value : String(this.selectedDate.getHours()).padStart(2, '0');
            const mi = mSel ? mSel.value : String(this.selectedDate.getMinutes()).padStart(2, '0');
            this.input.value = `${y}-${m}-${d}T${h}:${mi}`;
        } else {
            this.input.value = `${y}-${m}-${d}`;
        }

        this.input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    _syncDateTime() {
        if (!this.selectedDate) {
            this.selectedDate = new Date();
            this.viewDate = new Date(this.selectedDate);
        } else {
            this.selectedDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), this.selectedDate.getDate());
        }
        this._syncHiddenInput();
        this._syncDisplay();
        this._clearInvalid();
    }

    _syncDisplay() {
        if (this.selectedDate) {
            this._cdpInput.value = this._formatDisplayDate(this.selectedDate);
        } else {
            this._cdpInput.value = '';
        }
        this._syncTimeDisplay();
    }

    _syncTimeDisplay() {
        const timeEl = this.trigger.querySelector('.custom-datepicker-time');
        if (!timeEl) return;
        timeEl.textContent = '';

        if (!this.isDatetime || !this.selectedDate) return;

        let hour = '12', minute = '00';
        const val = this.input.value;
        if (val && val.includes('T')) {
            const tp = val.split('T')[1];
            if (tp) {
                const [h, mi] = tp.split(':');
                if (h) hour = h;
                if (mi) minute = mi;
            }
        } else {
            hour = String(this.selectedDate.getHours()).padStart(2, '0');
            minute = String(this.selectedDate.getMinutes()).padStart(2, '0');
        }
        timeEl.textContent = `${hour}:${minute}`;
    }

    _formatDisplayDate(date) {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return this.lang === 'ru' ? `${d}.${m}.${y}` : `${m}/${d}/${y}`;
    }

    // --- Validation ---

    _showError(msg) {
        this.trigger.classList.add('is-invalid');
        this._cdpInput.setAttribute('aria-invalid', 'true');
        this.errorEl.textContent = msg;
        this.errorEl.hidden = false;
    }

    _clearInvalid() {
        this.trigger.classList.remove('is-invalid');
        this._cdpInput.removeAttribute('aria-invalid');
        this.errorEl.textContent = '';
        this.errorEl.hidden = true;
    }

    _inputFormatHint() {
        return this.lang === 'ru' ? 'ДД.ММ.ГГГГ' : 'MM/DD/YYYY';
    }

    _invalidFormatMessage() {
        return this.lang === 'ru'
            ? `Введите дату в формате ${this._inputFormatHint()}`
            : `Enter a date in the ${this._inputFormatHint()} format`;
    }

    _inputErrorMessage(code) {
        switch (code) {
            case 'year':
                return this.lang === 'ru' ? 'Неверный год' : 'Invalid year';
            case 'month':
                return this.lang === 'ru' ? 'Неверный месяц' : 'Invalid month';
            case 'day':
                return this.lang === 'ru' ? 'Неверный день' : 'Invalid day';
            default:
                return this._invalidFormatMessage();
        }
    }

    _syncLockedState() {
        const locked = this.input.readOnly || this.input.disabled;
        this.trigger.classList.toggle('is-disabled', locked);
        this.trigger.setAttribute('aria-disabled', String(locked));
        this._cdpInput.disabled = locked;
        this.arrowBtn.disabled = locked;
    }

    // --- Keyboard input (mask) ---

    _maskHandler = (e) => {
        const digits = this._cdpInput.value.replace(/\D/g, '').slice(0, 8);
        const sep = this.lang === 'ru' ? '.' : '/';
        let out = '';
        for (let i = 0; i < digits.length; i++) {
            if (i === 2 || i === 4) out += sep;
            out += digits[i];
        }
        this._cdpInput.value = out;
    };

    _commitInput(closePanel, advance) {
        const raw = this._cdpInput.value.trim();
        if (!raw) {
            this._applyClear();
            this._clearInvalid();
            if (closePanel) this.close();
            return;
        }
        const result = this._parseInputText(raw);
        if (result instanceof Date) {
            this._applySelection(result);
            this._clearInvalid();
            if (advance) this._focusNext();
        } else {
            this._showError(this._inputErrorMessage(result ? result.error : 'format'));
        }
        if (closePanel) this.close();
    }

    _focusNext() {
        const form = this.input.closest('form');
        if (!form || !form.elements) return;
        const els = Array.from(form.elements);
        const idx = els.indexOf(this.input);
        if (idx === -1) return;
        for (let i = idx + 1; i < els.length; i++) {
            const el = els[i];
            if (el === this.input) continue;
            if (el.disabled || el.readOnly) continue;
            if (el.type === 'hidden') continue;
            if (el.tabIndex < 0) continue;
            if (el.offsetParent === null) continue;
            el.focus();
            return;
        }
    }

    _parseInputText(str) {
        const parts = str.split(/[./]/);
        if (parts.length !== 3) return { error: 'format' };
        const [a, b, c] = parts;
        if (!a || !b || !c) return { error: 'format' };

        const y = parseInt(c, 10);
        if (c.length !== 4 || isNaN(y) || y < 1000 || y > 9999) return { error: 'year' };

        const n1 = parseInt(a, 10);
        const n2 = parseInt(b, 10);

        let day, mon;
        if (this.lang === 'ru') {
            day = n1;
            mon = n2;
        } else {
            day = n2;
            mon = n1;
        }

        if (isNaN(mon) || mon < 1 || mon > 12) return { error: 'month' };
        if (isNaN(day) || day < 1 || day > 31) return { error: 'day' };

        const date = new Date(y, mon - 1, day);
        if (date.getFullYear() !== y || date.getMonth() !== mon - 1 || date.getDate() !== day) return { error: 'day' };
        return date;
    }

    // --- Focus / keyboard navigation ---

    _moveFocus(date) {
        this._focusDate = date;
        const changed = date.getFullYear() !== this.viewDate.getFullYear() || date.getMonth() !== this.viewDate.getMonth();
        if (changed) {
            this.viewDate = new Date(date.getFullYear(), date.getMonth(), 1);
            this.render();
        } else {
            const prev = this.panel.querySelector('.cal-day-focused');
            if (prev) prev.classList.remove('cal-day-focused');
            this._highlightFocusDate();
        }
    }

    _highlightFocusDate() {
        if (!this._focusDate) return;
        const el = this.panel.querySelector(`.cal-day[data-date="${this._isoDate(this._focusDate)}"]`);
        if (el) el.classList.add('cal-day-focused');
    }

    _parseDate(str) {
        if (!str) return null;
        const datePart = str.slice(0, 10);
        const parts = datePart.split('-');
        if (parts.length !== 3) return null;
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return isNaN(d.getTime()) ? null : d;
    }

    _isoDate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    bind() {
        this.trigger.addEventListener('click', (e) => {
            if (e.target.closest('.custom-datepicker-input')) return;
            if (this.trigger.classList.contains('is-disabled')) return;
            this.toggle();
        });

        this._cdpInput.addEventListener('focus', () => {
            if (this.isOpen) this.close();
        });
        this._cdpInput.addEventListener('input', (e) => {
            this._maskHandler(e);
            this._clearInvalid();
            if (this._cdpInput.value.replace(/\D/g, '').length === 8) {
                const res = this._parseInputText(this._cdpInput.value);
                if (res instanceof Date) this._commitInput(false, true);
            }
        });
        this._cdpInput.addEventListener('blur', () => this._commitInput(false, false));
        this._cdpInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._commitInput(true, true);
            } else if (e.key === 'Escape') {
                this._syncDisplay();
                this.close();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.open();
            }
        });

        this.panel.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
                return;
            }
            if (this.mode !== 'days') {
                const cells = this.panel.querySelectorAll('.cal-cell');
                if (!cells.length) return;
                const count = cells.length;
                let idx = this._gridIndex;
                switch (e.key) {
                    case 'ArrowRight': e.preventDefault(); idx = Math.min(idx + 1, count - 1); break;
                    case 'ArrowLeft': e.preventDefault(); idx = Math.max(idx - 1, 0); break;
                    case 'ArrowDown': e.preventDefault(); idx = Math.min(idx + 3, count - 1); break;
                    case 'ArrowUp': e.preventDefault(); idx = Math.max(idx - 3, 0); break;
                    case 'Home': e.preventDefault(); idx = 0; break;
                    case 'End': e.preventDefault(); idx = count - 1; break;
                    case 'Enter': e.preventDefault(); cells[idx].click(); return;
                    default: return;
                }
                this._gridIndex = idx;
                cells.forEach(c => c.classList.remove('cal-cell-focused'));
                cells[idx].classList.add('cal-cell-focused');
                return;
            }

            const y = this.viewDate.getFullYear();
            const m = this.viewDate.getMonth();
            const cur = this._focusDate || new Date(y, m, 1);
            switch (e.key) {
                case 'ArrowLeft': e.preventDefault(); this._moveFocus(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 1)); break;
                case 'ArrowRight': e.preventDefault(); this._moveFocus(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)); break;
                case 'ArrowUp': e.preventDefault(); this._moveFocus(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 7)); break;
                case 'ArrowDown': e.preventDefault(); this._moveFocus(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7)); break;
                case 'Home': e.preventDefault(); this._moveFocus(new Date(y, m, 1)); break;
                case 'End': e.preventDefault(); this._moveFocus(new Date(y, m, new Date(y, m + 1, 0).getDate())); break;
                case 'Enter': e.preventDefault(); if (this._focusDate) this._selectDate(new Date(this._focusDate)); break;
            }
        });

        this._observer = new MutationObserver(() => this._syncLockedState());
        this._observer.observe(this.input, { attributes: true, attributeFilter: ['readonly', 'disabled'] });

        this._invalidHandler = (e) => {
            if (!this.input.validity.valueMissing) return;
            e.preventDefault();
            this._showError(this.lang === 'ru' ? 'Поле обязательно' : 'This field is required');
            this._cdpInput.focus();
        };
        this.input.addEventListener('invalid', this._invalidHandler);

        this._nativeChangeHandler = () => {
            this._syncDisplay();
            this._clearInvalid();
        };
        this.input.addEventListener('change', this._nativeChangeHandler);

        this._form = this.input.closest('form');
        if (this._form) {
            this._formHandler = () => {
                this.selectedDate = null;
                this.viewDate = new Date();
                this._focusDate = null;
                this._clearInvalid();
                this._syncDisplay();
            };
            this._form.addEventListener('reset', this._formHandler);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => CustomDatePicker.init());
