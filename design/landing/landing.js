/* awning.sh landing: the hero street (a sentence on a hoarding becomes a shop), the "Opened today"
   street fed by /v1/live, and copy buttons. No dependencies. */
(function () {
  const B = window.AWNING_BUSINESSES, ART = window.AWNING_ART;
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const artFor = (b) => ART[b.art]({ ...b.palette, displayFont: b.fonts.display, textFont: b.fonts.text }, b.name);

  /* ---------------- shared: illustrated shopfronts ---------------- */
  const EXTRA = [
    { name: 'Mama Efua’s', slug: 'mama-efuas', city: 'Kumasi', disp: 'Shrikhand', fs: 28, wall: '#f6c8b8', trim: '#7a1f2b', sA: '#7a1f2b', sB: '#fff4ec', glass: '#2b1a1d', art: 'coffee', last: 'Jollof for two, $18', w: 300, h: 320 },
    { name: 'NIGHT OWL', full: 'Night Owl Records', slug: 'night-owl-records', city: 'Leeds', disp: 'Rubik Mono One', fs: 20, wall: '#262a4a', trim: '#f2c14e', sA: '#f2c14e', sB: '#262a4a', glass: '#11132a', art: 'ceramics', last: 'Crate dig pass, $10', w: 260, h: 360 },
    { name: 'Fold Press', slug: 'fold-press', city: 'Oaxaca', disp: 'Gloock', fs: 30, wall: '#dfe8d5', trim: '#2f4a2a', sA: '#2f4a2a', sB: '#f4f7ee', glass: '#20301d', art: 'ceramics', last: 'Bookbinding class, $40', w: 280, h: 300 },
    { name: 'Little Fig', slug: 'little-fig', city: 'Melbourne', disp: 'Bagel Fat One', fs: 30, wall: '#7c3a6d', trim: '#ffd1e8', sA: '#ffd1e8', sB: '#7c3a6d', glass: '#3b1834', art: 'bike', last: 'Friday bouquet, $25', w: 250, h: 340 },
  ];
  const fromBiz = (b, w, h) => ({ name: b.name, slug: b.slug, city: b.city, disp: b.fonts.display, dw: b.hero === 'poster' ? 900 : 400, fs: b.hero === 'poster' ? 34 : 30, wall: b.palette.ground, trim: b.palette.ink, sA: b.palette.stripeA, sB: b.palette.stripeB, glass: b.palette.deep, art: b.art, last: `${b.offers[0].title}, $${b.offers[0].price.replace(/\.00$/, '')}`, w, h, b });
  const shopArt = (s) => s.b ? artFor(s.b) : ART[s.art]({ ground: s.wall, ink: s.trim, accent: s.sA, accent2: s.sB, deep: s.glass, displayFont: s.disp, textFont: 'Archivo' }, s.name);
  const shopHTML = (s, { hidden = false, link = true } = {}) => {
    const tag = link ? 'a' : 'span';
    return `<${tag} class="shop" ${link ? `href="https://${s.slug}.awning.sh"` : ''} ${hidden ? 'tabindex="-1" aria-hidden="true"' : ''} style="--w:${s.w}px;--h:${s.h}px;--wall:${s.wall};--trim:${s.trim};--sA:${s.sA};--sB:${s.sB};--glass:${s.glass};--disp:'${s.disp}';--dw:${s.dw || 400};--fs:${s.fs}px">
      ${link ? `<span class="tag"><b>${s.full || s.name}, ${s.city}</b>Last sale: ${s.last}</span>` : ''}
      <span class="cornice"></span><span class="signboard">${s.name}</span><span class="aw"></span>
      <span class="front"><span class="win">${shopArt(s)}</span><span class="door"></span></span></${tag}>`;
  };

  /* ---------------- hero: neighbours ---------------- */
  $('rowL').innerHTML = [EXTRA[3], EXTRA[0]].map((s) => shopHTML(s, { link: false })).join('');
  $('rowR').innerHTML = [EXTRA[1], EXTRA[2]].map((s) => shopHTML(s, { link: false })).join('');

  /* ---------------- hero: the shop that opens ---------------- */
  function paint(b) {
    const lot = $('lot');
    for (const [k, v] of Object.entries(b.palette)) lot.style.setProperty('--b-' + (k === 'onAccent' ? 'on-accent' : k), v);
    lot.style.setProperty('--b-display', `"${b.fonts.display}"`);
    lot.style.setProperty('--b-text', `"${b.fonts.text}"`);
    const up = b.hero === 'poster';
    $('fName').textContent = b.name;
    $('fName').parentElement.className = 'signboard' + (up ? ' up' : '');
    $('mini').innerHTML = `
      <div class="mini-rod"><span class="nm">${b.name}</span><span>${b.domain}</span></div>
      <div class="mini-body">
        <div>
          <h3 class="mini-name${up ? ' up' : ''}">${up ? b.name.replace(' & ', '<br>& ') : b.name}</h3>
          <p class="mini-tag">${b.tagline}</p>
          <ul class="mini-menu">${b.offers.map((o) => `<li data-id="${o.id}"><b>${o.title}</b><span>$${o.price.replace(/\.00$/, '')}</span></li>`).join('')}</ul>
        </div>
        <div class="mini-art${b.hero === 'arch' ? ' arch' : ''}">${artFor(b)}</div>
      </div>`;
    return b.offers.find((o) => o.featured) || b.offers[0];
  }
  function line(l, r, cls = '') {
    const li = document.createElement('li');
    li.className = cls;
    li.innerHTML = `<span>${l}</span><span class="dots"></span><span>${r}</span>`;
    $('rcLines').append(li);
    requestAnimationFrame(() => requestAnimationFrame(() => li.classList.add('in')));
  }
  async function run(b, first) {
    const lot = $('lot');
    lot.classList.remove('built'); $('sign').classList.remove('is-open'); $('ring').className = 'ring'; $('receipt').className = 'receipt';
    await wait(first ? 0 : 900); // the hoarding comes back down before the next shop
    const featured = paint(b);
    $('rcLines').innerHTML = ''; $('rcTotal').className = 'total';
    $('rcName').textContent = b.name.toUpperCase();
    const t = $('typed'); t.textContent = '';
    if (reduce) t.textContent = b.sentence;
    else for (const ch of b.sentence) { t.textContent += ch; await wait(ch === ' ' ? 30 : 24); }
    await wait(600);
    $('receipt').classList.add('show');
    line('awning_plan', 'ready'); await wait(420);
    line(b.domain, 'registered'); await wait(420);
    line('PayBox', '1 tap'); await wait(500);
    lot.classList.add('built'); await wait(1500);
    line('storefront', 'live'); $('sign').classList.add('is-open'); await wait(800);
    $('ringNum').textContent = b.phone; $('ringLabel').textContent = `${b.receptionist} answers the new line`;
    $('ring').classList.add('show', 'ringing');
    line('phone line', 'ringing'); await wait(1400);
    line('an agent buys', featured.title.toLowerCase().split(' ').slice(0, 2).join(' '), 'agent');
    const el = document.querySelector(`.mini-menu li[data-id="${featured.id}"]`); el && el.classList.add('sold');
    await wait(450);
    $('rcAmt').textContent = '+' + featured.price;
    $('rcAgent').innerHTML = `USDC FROM AN AGENT<br>TO ${b.wallet}`;
    $('rcTotal').classList.add('in', 'pop');
    await wait(reduce ? 0 : 4800);
  }
  (async () => {
    if (reduce) { await run(B[0], true); return; }
    let i = 0, visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe($('lot'));
    await wait(400);
    for (;;) { while (!visible) await wait(400); await run(B[i % B.length], i === 0); i++; }
  })();

  /* ---------------- opened today: the street (GET /v1/live; sample data until it answers) ---------------- */
  function renderStreet(shops) {
    $('row').innerHTML = shops.map((s) => shopHTML(s)).join('') + shops.map((s) => shopHTML(s, { hidden: true })).join('');
  }
  renderStreet([fromBiz(B[0], 310, 350), EXTRA[0], fromBiz(B[1], 290, 330), EXTRA[1], EXTRA[2], fromBiz(B[2], 300, 360), EXTRA[3]]);
  // fetch('https://api.awning.sh/v1/businesses?live=1&limit=12').then((r) => r.json()).then(({ businesses }) => renderStreet(businesses.map(toShop))).catch(() => {});

  /* ---------------- copy ---------------- */
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    try { await navigator.clipboard.writeText(btn.dataset.copy); } catch { /* the text stays selectable */ }
    const was = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = was), 1400);
  });
})();
