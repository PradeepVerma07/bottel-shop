/* Native, instance-scoped components. Reconnecting in the Shopify editor is supported. */
if (!customElements.get('bottle-slideshow')) {
  customElements.define('bottle-slideshow', class extends HTMLElement {
    connectedCallback() {
      if (this.abort) return;
      this.abort = new AbortController();
      const options = { signal: this.abort.signal };
      this.slides = [...this.querySelectorAll('[data-bs-slide]')];
      this.current = 0;
      this.previous = this.querySelector('[data-bs-previous]');
      this.next = this.querySelector('[data-bs-next]');
      this.counter = this.querySelector('[data-bs-current]');
      this.progress = this.querySelector('[data-bs-progress]');
      this.dots = [...this.querySelectorAll('[data-bs-dot]')];
      this.paused = false;
      this.previous?.addEventListener('click', () => { this.show(this.current - 1); this.start(); }, options);
      this.next?.addEventListener('click', () => { this.show(this.current + 1); this.start(); }, options);
      this.dots.forEach(dot => dot.addEventListener('click', () => { this.show(Number(dot.dataset.bsDot)); this.start(); }, options));
      this.addEventListener('keydown', event => {
        if (event.target.closest('input, textarea, select')) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          this.show(this.current + (event.key === 'ArrowRight' ? 1 : -1));
          this.start();
        }
      }, options);

      // Touch swipe gestures for mobile phones & tablets
      let touchStartX = 0;
      let touchStartY = 0;
      let touchEndX = 0;
      let touchEndY = 0;
      this.addEventListener('touchstart', event => {
        if (!event.touches?.length) return;
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        touchEndX = touchStartX;
        touchEndY = touchStartY;
      }, { passive: true, signal: this.abort.signal });

      this.addEventListener('touchmove', event => {
        if (!event.touches?.length) return;
        touchEndX = event.touches[0].clientX;
        touchEndY = event.touches[0].clientY;
      }, { passive: true, signal: this.abort.signal });

      this.addEventListener('touchend', () => {
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
          this.show(this.current + (diffX < 0 ? 1 : -1));
          this.start();
        }
      }, { passive: true, signal: this.abort.signal });

      // Pointer drag gestures for mouse and pen
      let pointerStartX = 0;
      let pointerStartY = 0;
      let isPointerDown = false;
      this.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (event.target.closest('button, a, input, select, textarea')) return;
        isPointerDown = true;
        pointerStartX = event.clientX;
        pointerStartY = event.clientY;
      }, options);

      this.addEventListener('pointerup', event => {
        if (!isPointerDown) return;
        isPointerDown = false;
        const diffX = event.clientX - pointerStartX;
        const diffY = event.clientY - pointerStartY;
        if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
          this.show(this.current + (diffX < 0 ? 1 : -1));
          this.start();
        }
      }, options);

      this.addEventListener('pointercancel', () => { isPointerDown = false; }, options);

      this.addEventListener('pointerenter', () => this.stop(), options);
      this.addEventListener('pointerleave', () => this.start(), options);
      this.addEventListener('focusin', () => this.stop(), options);
      this.addEventListener('focusout', event => { if (!this.contains(event.relatedTarget)) this.start(); }, options);
      document.addEventListener('visibilitychange', () => document.hidden ? this.stop() : this.start(), options);
      document.addEventListener('shopify:block:select', event => {
        const index = this.slides.findIndex(slide => slide.dataset.blockId === event.detail?.blockId);
        if (index !== -1) { this.paused = true; this.stop(); this.show(index); }
      }, options);
      document.addEventListener('shopify:block:deselect', () => { this.paused = false; this.start(); }, options);
      this.querySelector('[data-bs-pause]')?.addEventListener('click', event => {
        this.paused = !this.paused;
        event.currentTarget.setAttribute('aria-pressed', String(this.paused));
        this.paused ? this.stop() : this.start();
      }, options);
      this.show(0);
      this.start();
    }
    show(index) {
      if (!this.slides.length) return;
      this.current = (index + this.slides.length) % this.slides.length;
      this.slides.forEach((slide, i) => { slide.hidden = i !== this.current; });
      if (this.counter) this.counter.textContent = String(this.current + 1).padStart(2, '0');
      this.dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === this.current)));
      if (this.progress) this.progress.style.width = `${(this.current + 1) / this.slides.length * 100}%`;
    }
    start() {
      this.stop();
      if (this.dataset.autoplay !== 'true' || this.paused || this.slides.length < 2 || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches || this.contains(document.activeElement)) return;
      const intervalSec = Math.max(3, Number(this.dataset.interval) || 5);
      this.timer = setInterval(() => this.show(this.current + 1), intervalSec * 1000);
    }
    stop() { clearInterval(this.timer); }
    disconnectedCallback() { this.stop(); this.abort?.abort(); this.abort = null; }
  });
}
document.addEventListener('shopify:block:select', event => {
  const menu = event.target instanceof Element ? event.target.closest('.bs-mobile-menu') : null;
  if (menu) menu.open = true;
  const footerColumn = event.target instanceof Element ? event.target.closest('.bs-footer__column') : null;
  const disclosure = footerColumn?.querySelector('.bs-footer__mobile-disclosure');
  if (disclosure) disclosure.open = true;
});
document.addEventListener('click', event => {
  const menu = event.target.closest('.bs-mobile-menu');
  if (menu && event.target.closest('a')) menu.open = false;
  document.querySelectorAll('.bs-mobile-menu[open], .bs-mobile-search[open]').forEach(item => { if (!item.contains(event.target)) item.open = false; });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') document.querySelectorAll('.bs-mobile-menu[open], .bs-mobile-search[open]').forEach(item => { item.open = false; item.querySelector('summary')?.focus(); });
});

// Keep optional navigation anchors unique when a merchant duplicates a section.
function syncBottleAnchors() {
  const nodes = [...document.querySelectorAll('[data-bs-anchor]')];
  nodes.forEach(node => { if (node.id === node.dataset.bsAnchor) node.removeAttribute('id'); });
  nodes.forEach(node => { const anchor = node.dataset.bsAnchor; if (anchor && !document.getElementById(anchor)) node.id = anchor; });
}
syncBottleAnchors();
document.addEventListener('shopify:section:load', syncBottleAnchors);
document.addEventListener('shopify:section:unload', () => requestAnimationFrame(syncBottleAnchors));
