// animations.js — Scroll reveal, counter animation, FAQ, navbar scroll, FAQs

document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initCounters();
    initFAQ();
    initNavScroll();
});

// ── Scroll Reveal ──
function initScrollReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('is-visible');
                observer.unobserve(e.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    els.forEach(el => observer.observe(el));
}

// ── Counter animation ──
function initCounters() {
    const counters = document.querySelectorAll('[data-counter]');
    if (!counters.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                animateCounter(e.target);
                observer.unobserve(e.target);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(el => observer.observe(el));
}

function animateCounter(el) {
    const target = parseInt(el.dataset.counter, 10);
    const suffix = el.dataset.suffix || '';
    const duration = 1800;
    const start = performance.now();

    function step(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        const current = Math.round(eased * target);
        el.textContent = current.toLocaleString() + suffix;
        if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

// ── FAQ accordion ──
function initFAQ() {
    document.querySelectorAll('.faq-item__q').forEach(q => {
        q.addEventListener('click', () => {
            const item = q.closest('.faq-item');
            const isOpen = item.classList.contains('is-open');

            // Close all
            document.querySelectorAll('.faq-item.is-open').forEach(i => i.classList.remove('is-open'));

            if (!isOpen) item.classList.add('is-open');
        });
    });
}

// ── Navbar scroll state ──
function initNavScroll() {
    const nav = document.querySelector('.nav');
    if (!nav) return;

    const handler = () => {
        nav.classList.toggle('scrolled', window.scrollY > 20);
    };

    window.addEventListener('scroll', handler, { passive: true });
    handler();
}
