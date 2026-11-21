/* Standard Shopify forms handle all purchasing, cart updates and checkout. */
if (!customElements.get('bottle-quantity')) {
  customElements.define('bottle-quantity', class extends HTMLElement {
    connectedCallback() {
      if (this.abort) return;
      this.abort = new AbortController();
      this.addEventListener('click', event => {
        const button = event.target.closest('[data-bs-step]');
        const input = this.querySelector('input');
        if (!button || !input) return;
        const value = Number(input.value) || Number(input.min) || 1;
        const step = Number(input.step) || 1;
        const minimum = Number(input.min) || 1;
        const maximum = input.max ? Number(input.max) : Infinity;
        input.value = String(Math.min(maximum, Math.max(minimum, value + Number(button.dataset.bsStep) * step)));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, { signal: this.abort.signal });
    }
    disconnectedCallback() { this.abort?.abort(); this.abort = null; }
  });
}
if (!customElements.get('bottle-recommendations')) {
  customElements.define('bottle-recommendations', class extends HTMLElement {
    connectedCallback() {
      if (!this.dataset.url || this.observer || window.Shopify?.designMode) return;
      this.abort = new AbortController();
      this.observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { this.observer.disconnect(); this.load(); }
      }, { rootMargin: '300px' });
      this.observer.observe(this);
    }
    async load() {
      try {
        const url = new URL(this.dataset.url, location.origin);
        if (url.origin !== location.origin) return;
        const response = await fetch(url, { signal: this.abort.signal });
        if (!response.ok) return;
        const documentFragment = new DOMParser().parseFromString(await response.text(), 'text/html');
        const content = documentFragment.querySelector('[data-bs-related-content]');
        const target = this.querySelector('[data-bs-related-content]');
        if (target && content?.querySelector('.bs-product-card')) target.innerHTML = content.innerHTML;
      } catch (error) { /* Keep the server-rendered collection fallback. */ }
    }
    disconnectedCallback() { this.abort?.abort(); this.observer?.disconnect(); this.observer = null; }
  });
}
document.addEventListener('change', event => {
  if (!(event.target instanceof Element)) return;
  const sort = event.target.closest('[data-bs-sort]');
  if (!sort) return;
  document.getElementById(sort.dataset.bsForm)?.requestSubmit();
});

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const carouselBtn = event.target.closest('[data-bs-carousel-prev], [data-bs-carousel-next]');
  if (carouselBtn) {
    const section = carouselBtn.closest('.bs-recommendations, .bs-new-arrivals');
    const grid = section?.querySelector('.bs-product-grid');
    if (grid) {
      const card = grid.querySelector('.bs-product-card');
      const step = card ? (card.offsetWidth + 20) : 280;
      const direction = carouselBtn.hasAttribute('data-bs-carousel-prev') ? -1 : 1;
      grid.scrollBy({ left: direction * step, behavior: 'smooth' });
    }
  }
  const minus = event.target.closest('.bs-qty-btn--minus');
  const plus = event.target.closest('.bs-qty-btn--plus');
  if (minus) {
    const input = minus.closest('.bs-qty-pill')?.querySelector('.bs-qty-input');
    if (input) {
      const min = Number(input.min) || 1;
      const step = Number(input.step) || 1;
      const current = Number(input.value) || min;
      if (current > min) {
        input.value = Math.max(min, current - step);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }
  if (plus) {
    const input = plus.closest('.bs-qty-pill')?.querySelector('.bs-qty-input');
    if (input) {
      const max = input.max ? Number(input.max) : Infinity;
      const step = Number(input.step) || 1;
      const current = Number(input.value) || 1;
      if (current < max) {
        input.value = current + step;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }
});

function polishBuyButtons() {
  document.querySelectorAll('.shopify-payment-button__button--unbranded').forEach(btn => {
    btn.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && /buy/i.test(node.nodeValue)) {
        node.nodeValue = ' BUY NOW';
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', polishBuyButtons);
} else {
  polishBuyButtons();
}

const payObserver = new MutationObserver(() => {
  polishBuyButtons();
});
document.addEventListener('DOMContentLoaded', () => {
  const payContainer = document.querySelector('.shopify-payment-button') || document.body;
  if (payContainer) {
    payObserver.observe(payContainer, { childList: true, subtree: true });
  }
});
