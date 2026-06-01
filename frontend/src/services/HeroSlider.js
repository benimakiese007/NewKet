/* NewKet - Hero Background Slider Service */

const HeroSlider = {
    currentIndex: 0,
    slides: [],
    interval: null,
    pauseOnHover: true,
    intervalMs: 5000,

    setIntervalSeconds(seconds) {
        const value = Number(seconds);
        if (!Number.isFinite(value)) return;
        const clamped = Math.min(30, Math.max(2, value));
        this.intervalMs = clamped * 1000;
    },

    init() {
        this.stopAutoPlay();
        this.currentIndex = 0;
        this.slides = document.querySelectorAll('.hero-slide');
        if (this.slides.length < 2) {
            console.log('[HeroSlider] Not enough slides to start rotation');
            return;
        }

        console.log('[HeroSlider] Initializing sliding logic for', this.slides.length, 'images');
        
        // Ensure the first slide is active
        this.slides.forEach((slide, index) => {
            if (index === 0) slide.classList.add('active');
            else slide.classList.remove('active');
        });

        this.startAutoPlay();
        this.bindEvents();
    },

    bindEvents() {
        const heroSection = document.getElementById('heroSection');
        if (!heroSection || !this.pauseOnHover) return;

        heroSection.addEventListener('mouseenter', () => this.stopAutoPlay());
        heroSection.addEventListener('mouseleave', () => this.startAutoPlay());
    },

    startAutoPlay() {
        this.stopAutoPlay();
        this.interval = setInterval(() => this.nextSlide(), this.intervalMs || 5000);
    },

    stopAutoPlay() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    },

    nextSlide() {
        if (this.slides.length === 0) return;

        // Fade out current
        this.slides[this.currentIndex].classList.remove('active');
        
        // Move to next
        this.currentIndex = (this.currentIndex + 1) % this.slides.length;
        
        // Fade in next
        this.slides[this.currentIndex].classList.add('active');
    }
};

window.HeroSlider = HeroSlider;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('heroSection')) HeroSlider.init();
    }, { once: true });
} else if (document.getElementById('heroSection')) {
    HeroSlider.init();
}
