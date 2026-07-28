class RotatingTextLoader {
    constructor(container, phrases, options = {}) {
        this.container = container;
        this.phrases = phrases;
        this.interval = options.interval || 5000;
        this.currentIndex = 0;
        this.intervalId = null;
        this.render();
        this.container._rotatingLoader = this;
    }

    render() {
        this.container.innerHTML = `
            <i class="fa-solid fa-circle-notch rotating-loader-spinner"></i>
            <div class="rotating-loader-text">
                ${this.phrases.map((p, i) => `<span class="rotating-loader-phrase${i === 0 ? ' active' : ''}">${p}</span>`).join('')}
            </div>
            <div class="rotating-loader-dots">
                ${this.phrases.map((_, i) => `<span class="dot${i === 0 ? ' active' : ''}"></span>`).join('')}
            </div>
        `;
        this.phraseEls = this.container.querySelectorAll('.rotating-loader-phrase');
        this.dotEls = this.container.querySelectorAll('.dot');
        this.start();
    }

    start() {
        this.stop();
        this.intervalId = setInterval(() => this.next(), this.interval);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    next() {
        const prev = this.currentIndex;
        this.currentIndex = (this.currentIndex + 1) % this.phrases.length;
        this.phraseEls[prev].classList.remove('active');
        this.dotEls[prev].classList.remove('active');
        this.phraseEls[this.currentIndex].classList.add('active');
        this.dotEls[this.currentIndex].classList.add('active');
    }

    destroy() {
        this.stop();
        if (this.container._rotatingLoader === this) {
            delete this.container._rotatingLoader;
        }
    }

    setPhrases(phrases) {
        this.stop();
        this.phrases = phrases;
        this.currentIndex = 0;
        this.render();
    }
}
