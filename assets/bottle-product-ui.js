/* Device-local saved products and native mobile filter dialogs. No cart/checkout interception. */
(() => {
  if (customElements.get('bottle-image-tools')) return;
  let labels = {};
  try { labels = JSON.parse(document.getElementById('BottleProductUIStrings')?.textContent || '{}'); } catch { /* Use defaults. */ }
  const words = {
    title: 'Your wishlist', empty: 'Your wishlist is empty.', close: 'Close wishlist',
    saved: 'Saved to wishlist.', removed: 'Removed from wishlist.', remove: 'Remove',
    note: 'Saved on this device.', session: 'Saved for this visit.', ...labels,
  };
  const key = 'bottle-shop:wishlist:v1';
  let persistent = true;
  const validItem = item => {
    if (!item || !['string', 'number'].includes(typeof item.id) || typeof item.title !== 'string') return null;
    try {
      const url = new URL(item.url, location.origin);
      if (url.origin !== location.origin || !url.pathname.includes('/products/')) return null;
      let image = '';
      if (item.image) {
        const source = new URL(item.image, location.origin);
        if (['https:', 'http:'].includes(source.protocol)) image = source.href;
      }
      return { id: String(item.id), title: item.title.slice(0, 300), url: url.pathname + url.search, image };
    } catch { return null; }
  };
  const load = () => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(value)) return [];
      return [...new Map(value.map(validItem).filter(Boolean).map(item => [item.id, item])).values()].slice(0, 100);
    } catch { persistent = false; return []; }
  };
  let items = load();
  let wishlistDialog;
  let notice;
  let noticeTimer;
  const syncScroll = () => document.documentElement.classList.toggle('bs-ui-modal-open', Boolean(document.querySelector('dialog.bs-ui-dialog[open]')));
  const announce = message => {
    if (!notice) {
      notice = document.createElement('div');
      notice.className = 'bs-wishlist-notice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      document.body.append(notice);
    }
    clearTimeout(noticeTimer);
    notice.hidden = false;
    notice.textContent = message;
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 3500);
  };
  const updateCounts = () => {
    const count = items.length;
    document.querySelectorAll('[data-bs-wishlist-count]').forEach(el => {
      el.textContent = String(count);
      if (el.classList.contains('bs-wishlist-count')) {
        el.hidden = count === 0;
      }
    });
  };
  const commit = () => {
    try { localStorage.setItem(key, JSON.stringify(items)); persistent = true; } catch { persistent = false; }
    updateCounts();
    window.dispatchEvent(new CustomEvent('bottle:wishlist-update'));
    if (wishlistDialog?.open) renderWishlist();
  };
  const remove = id => { items = items.filter(item => item.id !== id); commit(); announce(words.removed); };
  const renderWishlist = () => {
    const body = wishlistDialog.querySelector('.bs-ui-dialog__body');
    body.replaceChildren();
    const note = document.createElement('p');
    note.className = 'bs-wishlist-note';
    note.textContent = persistent ? words.note : words.session;
    body.append(note);
    if (!items.length) {
      const empty = document.createElement('p');
      empty.textContent = words.empty;
      body.append(empty);
      return;
    }
    const list = document.createElement('ul');
    list.className = 'bs-wishlist-items';
    for (const item of items) {
      const row = document.createElement('li');
      row.className = 'bs-wishlist-item';
      const imageLink = document.createElement('a');
      imageLink.href = item.url;
      imageLink.setAttribute('aria-label', item.title);
      if (item.image) {
        const img = document.createElement('img');
        img.src = item.image; img.alt = ''; img.width = 64; img.height = 72; img.loading = 'lazy';
        imageLink.append(img);
      }
      const link = document.createElement('a');
      link.href = item.url; link.textContent = item.title;
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = words.remove;
      button.setAttribute('aria-label', words.remove + ': ' + item.title);
      button.addEventListener('click', () => { remove(item.id); wishlistDialog.querySelector('button')?.focus(); });
      row.append(imageLink, link, button);
      list.append(row);
    }
    body.append(list);
  };
  const openWishlist = () => {
    if (!wishlistDialog) {
      wishlistDialog = document.createElement('dialog');
      wishlistDialog.className = 'bs-ui-dialog bs-wishlist-dialog';
      wishlistDialog.setAttribute('aria-labelledby', 'BottleWishlistTitle');
      const header = document.createElement('div'); header.className = 'bs-ui-dialog__header';
      const heading = document.createElement('h2'); heading.id = 'BottleWishlistTitle'; heading.textContent = words.title;
      const close = document.createElement('button');
      close.type = 'button'; close.className = 'bs-ui-close'; close.textContent = '×'; close.setAttribute('aria-label', words.close);
      close.addEventListener('click', () => wishlistDialog.close());
      header.append(heading, close);
      const body = document.createElement('div'); body.className = 'bs-ui-dialog__body';
      wishlistDialog.append(header, body); document.body.append(wishlistDialog);
      wishlistDialog.addEventListener('close', syncScroll);
      wishlistDialog.addEventListener('click', event => { if (event.target === wishlistDialog) wishlistDialog.close(); });
    }
    renderWishlist(); wishlistDialog.showModal(); syncScroll();
  };
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    items = load();
    updateCounts();
    window.dispatchEvent(new CustomEvent('bottle:wishlist-update'));
    if (wishlistDialog?.open) renderWishlist();
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-bs-wishlist-open]')) {
      event.preventDefault();
      openWishlist();
      return;
    }
    if (event.target.closest('[data-bs-menu-close]')) {
      const menu = document.getElementById('BottleMobileMenu');
      if (menu) menu.removeAttribute('open');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const menu = document.getElementById('BottleMobileMenu');
      if (menu?.open) menu.removeAttribute('open');
    }
  });
  const setupMobileMenu = () => {
    const menu = document.getElementById('BottleMobileMenu');
    if (menu && !menu.dataset.bsBound) {
      menu.dataset.bsBound = 'true';
      menu.addEventListener('toggle', () => {
        document.documentElement.classList.toggle('bs-mobile-menu-open', menu.open);
      });
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { updateCounts(); setupMobileMenu(); });
  } else {
    updateCounts();
    setupMobileMenu();
  }
  window.addEventListener('bottle:wishlist-update', updateCounts);
  customElements.define('bottle-image-tools', class extends HTMLElement {
    connectedCallback() {
      if (this.abort) return;
      this.abort = new AbortController();
      const options = { signal: this.abort.signal };
      this.addEventListener('click', event => {
        if (event.target.closest('[data-bs-wishlist-open]')) { event.preventDefault(); openWishlist(); return; }
        if (!event.target.closest('[data-bs-wishlist-toggle]')) return;
        event.preventDefault();
        const item = validItem({ id: this.dataset.productId, title: this.dataset.productTitle, url: this.dataset.productUrl, image: this.dataset.productImage });
        if (!item) return;
        if (items.some(saved => saved.id === item.id)) remove(item.id);
        else { items = [item, ...items].slice(0, 100); commit(); announce(words.saved); }
      }, options);
      window.addEventListener('bottle:wishlist-update', () => this.refresh(), options);
      this.refresh();
    }
    refresh() {
      const button = this.querySelector('[data-bs-wishlist-toggle]');
      if (!button) return;
      const selected = items.some(item => item.id === this.dataset.productId);
      button.hidden = false;
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', (selected ? this.dataset.removeLabel : this.dataset.addLabel) + ': ' + this.dataset.productTitle);
      const view = this.querySelector('[data-bs-wishlist-open]');
      if (view) { view.hidden = !items.length; view.querySelector('[data-bs-wishlist-count]').textContent = String(items.length); }
    }
    disconnectedCallback() { this.abort?.abort(); this.abort = null; }
  });

  customElements.define('bottle-catalog', class extends HTMLElement {
    connectedCallback() {
      if (this.abort) return;
      this.abort = new AbortController();
      const options = { signal: this.abort.signal };
      this.dialog = this.querySelector('.bs-filter-dialog');
      this.sidebar = this.querySelector('.bs-shop-sidebar');
      this.mobile = matchMedia('(max-width: 800px)');
      this.enabled = this.dataset.bsMobileToolbar === 'true';
      if (this.sidebar) { this.marker = document.createComment('Bottle filter sidebar'); this.sidebar.before(this.marker); }
      let layout = 'grid';
      try { if (localStorage.getItem('bottle-shop:catalog-layout') === 'list') layout = 'list'; } catch { /* Default grid. */ }
      this.setLayout(layout);
      this.addEventListener('click', event => {
        const layoutButton = event.target.closest('[data-bs-catalog-layout]');
        if (layoutButton) { this.setLayout(layoutButton.dataset.bsCatalogLayout); return; }
        if (event.target.closest('[data-bs-open-filters]') && this.dialog) {
          this.sidebar?.querySelector('details')?.setAttribute('open', '');
          this.dialog.showModal(); syncScroll(); return;
        }
        if (event.target.closest('[data-bs-close-filters]') || event.target === this.dialog) this.dialog?.close();
        if (event.target.closest('[data-bs-clear-search]')) {
          const input = this.querySelector('.bs-mobile-shop-search input[type="search"]');
          input.value = ''; input.focus(); this.updateClearButton();
        }
      }, options);
      this.querySelector('.bs-mobile-shop-search input[type="search"]')?.addEventListener('input', () => this.updateClearButton(), options);
      this.mobile.addEventListener('change', () => this.placeSidebar(), options);
      this.dialog?.addEventListener('close', syncScroll, options);
      this.placeSidebar(); this.updateClearButton();
      this.setAttribute('data-bs-ready', '');
    }
    setLayout(layout) {
      this.dataset.bsMobileLayout = layout === 'list' ? 'list' : 'grid';
      this.querySelectorAll('[data-bs-catalog-layout]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.bsCatalogLayout === this.dataset.bsMobileLayout)));
      try { localStorage.setItem('bottle-shop:catalog-layout', this.dataset.bsMobileLayout); } catch { /* Layout still works for this page. */ }
    }
    placeSidebar() {
      if (!this.enabled || !this.sidebar || !this.dialog) return;
      if (this.mobile.matches) this.dialog.querySelector('[data-bs-filter-body]').append(this.sidebar);
      else { this.dialog.close(); this.marker.after(this.sidebar); syncScroll(); }
    }
    updateClearButton() {
      const form = this.querySelector('.bs-mobile-shop-search');
      const button = form?.querySelector('[data-bs-clear-search]');
      if (button) button.hidden = !form.querySelector('input[type="search"]').value;
    }
    disconnectedCallback() {
      this.dialog?.close(); this.abort?.abort(); this.abort = null;
      syncScroll();
    }
  });
})();
