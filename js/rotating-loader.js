class RotatingTextLoader {
    constructor(container, phrases, options = {}) {
        if (!container) return;
        if (container._rotatingLoader) {
            container._rotatingLoader.destroy();
        }
        this.container = container;
        this.phrases = Array.isArray(phrases) ? phrases.map(p => String(p ?? '')) : [];
        this.interval = options.interval || 5000;
        this.autoRotate = options.autoRotate !== false;
        this.currentIndex = 0;
        this.intervalId = null;
        this.render();
        this.container._rotatingLoader = this;
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const spinner = document.createElement('i');
        spinner.className = 'fa-solid fa-circle-notch rotating-loader-spinner';
        spinner.setAttribute('aria-hidden', 'true');

        const textWrap = document.createElement('div');
        textWrap.className = 'rotating-loader-text';
        this.phrases.forEach((p, i) => {
            const span = document.createElement('span');
            span.className = `rotating-loader-phrase${i === 0 ? ' active' : ''}`;
            span.textContent = p;
            textWrap.appendChild(span);
        });

        const dotsWrap = document.createElement('div');
        dotsWrap.className = 'rotating-loader-dots';
        this.phrases.forEach((_, i) => {
            const dot = document.createElement('span');
            dot.className = `dot${i === 0 ? ' active' : ''}`;
            dotsWrap.appendChild(dot);
        });

        this.container.append(spinner, textWrap, dotsWrap);
        this.phraseEls = this.container.querySelectorAll('.rotating-loader-phrase');
        this.dotEls = this.container.querySelectorAll('.dot');
        this.start();
    }

    start() {
        this.stop();
        if (!this.autoRotate || this.phrases.length <= 1) return;
        this.intervalId = setInterval(() => this.next(), this.interval);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    next() {
        if (!this.container || !this.container.isConnected || !this.phraseEls?.length || this.phrases.length === 0) {
            this.destroy();
            return;
        }
        const prev = this.currentIndex;
        this.currentIndex = (this.currentIndex + 1) % this.phrases.length;
        this.phraseEls[prev]?.classList.remove('active');
        this.dotEls[prev]?.classList.remove('active');
        this.phraseEls[this.currentIndex]?.classList.add('active');
        this.dotEls[this.currentIndex]?.classList.add('active');
    }

    destroy() {
        this.stop();
        if (this.container && this.container._rotatingLoader === this) {
            delete this.container._rotatingLoader;
        }
    }

    setPhrases(phrases) {
        const safePhrases = Array.isArray(phrases) ? phrases.map(p => String(p ?? '')) : [];
        if (!this.autoRotate && this.phraseEls && this.phraseEls.length === safePhrases.length) {
            this.phrases = safePhrases;
            this.phraseEls.forEach((el, i) => {
                el.textContent = safePhrases[i];
            });
            return;
        }
        this.stop();
        this.phrases = safePhrases;
        this.currentIndex = 0;
        this.render();
    }
}
