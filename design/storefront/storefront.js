/* Renders one Awning storefront from a business record.
   Local preview: index.html?b=<slug>[&state=draft]. In production the same markup is rendered
   server-side from GET /v1/businesses/:slug (see design/storefront/README in DIRECTION.md). */
(function () {
  const q = new URLSearchParams(location.search);
  const all = window.AWNING_BUSINESSES;
  const b = all.find((x) => x.slug === q.get('b')) || all[0];
  const draft = q.get('state') === 'draft' || b.status === 'draft';

  /* The API's palette is {primary, accent, ink, paper}. Our richer theme derives from it, so a
     business generated with only four colors still gets stripes, a deep tone and a hero variant. */
  function themeFrom(p, category) {
    if (p.ground) return p;
    return { ground: p.paper, ink: p.ink, accent: p.primary, accent2: p.accent, stripeA: p.primary, stripeB: `color-mix(in oklab, ${p.paper} 40%, #fff)`, deep: `color-mix(in oklab, ${p.ink} 70%, ${p.primary})` };
  }
  /* Fonts and hero variant by category when the record doesn't choose them. */
  const BY_CATEGORY = [
    [/coffee|bakery|food|cafe|kitchen|restaurant/i, { display: 'Alfa Slab One', text: 'Work Sans', hero: 'sign' }],
    [/bike|repair|garage|auto|tools|hardware|fitness/i, { display: 'Big Shoulders Display', text: 'Barlow', hero: 'poster' }],
    [/ceramic|studio|craft|art|flor|design|beauty/i, { display: 'Young Serif', text: 'Figtree', hero: 'arch' }],
  ];
  const fallback = BY_CATEGORY.find(([re]) => re.test(b.category))?.[1] || BY_CATEGORY[2][1];
  const fonts = b.fonts || fallback;
  const hero = b.hero || fallback.hero;
  const t = themeFrom(b.palette, b.category);

  // load the business's two fonts
  const fam = (f, w) => `family=${f.replace(/ /g, '+')}${w ? ':wght@' + w : ''}`;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  const dispW = fonts.display === 'Big Shoulders Display' ? '800;900' : '';
  link.href = `https://fonts.googleapis.com/css2?${fam(fonts.display, dispW)}&${fam(fonts.text, '400;500;600')}&family=Martian+Mono:wght@500&family=Archivo:wdth,wght@100..125,500..700&display=swap`;
  document.head.append(link);

  const root = document.documentElement;
  for (const [k, v] of Object.entries(t)) root.style.setProperty('--' + k, v);
  root.style.setProperty('--display', `"${fonts.display}"`);
  root.style.setProperty('--text', `"${fonts.text}"`);
  if (draft) root.classList.add('is-draft');

  const featured = b.offers.find((o) => o.featured) || b.offers[0];
  const buyUrl = (o) => `https://api.awning.sh/x402/b/${b.slug}/${o.id}`;
  const phrase = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(featured.title) ? featured.title : featured.title[0].toLowerCase() + featured.title.slice(1);
  const prompt = `Book a ${phrase} at ${b.name} (${domain}) and pay with PayBox.`;
  const art = window.AWNING_ART[b.art]({ ...t, displayFont: fonts.display, textFont: fonts.text }, b.name);
  const hasPhone = !!b.phone && !draft; // free plan and drafts have no line yet
  const tel = hasPhone ? b.phone.replace(/[^+\d]/g, '') : '';
  const domain = b.domain || `${b.slug}.awning.sh`;
  const today = b.hours[0];
  const name = hero === 'poster' ? b.name.replace(' & ', '<br>&amp; ') : b.name;
  const mark = '<svg viewBox="4 10 56 36" aria-hidden="true"><path d="M9 11.5h46a2.5 2.5 0 0 1 0 5H9a2.5 2.5 0 0 1 0-5Z" fill="currentColor"/><path d="M15 18 4 34a5.6 5.6 0 0 0 11.2 0l7.6-16Zm15.6 0-4.2 16a5.6 5.6 0 0 0 11.2 0l-4.2-16Zm15.6 0 7.6 16a5.6 5.6 0 0 0 11.2 0L49 18Z" fill="currentColor"/></svg>';

  document.title = draft ? `${b.name} · preview` : `${b.name} · ${b.category} in ${b.city}`;
  document.getElementById('app').innerHTML = `
<div class="draftbar" role="status"><span>Preview, not open yet. Only you can see this page. Tell your agent “open it” to go live.</span></div>
<header>
  <div class="rod"><div class="wrap">
    <a class="brand" href="#top">${b.name}</a>
    <nav aria-label="${b.name}"><a href="#offers">Offers</a><a href="#agent">Buy with an agent</a><a href="#visit">Visit</a>${hasPhone ? `<a class="callbtn" href="tel:${tel}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>Call ${b.receptionist}</a>` : ''}</nav>
  </div></div>
  <div class="canopy" aria-hidden="true"></div>
</header>
<main id="top">
<section class="hero h-${hero}"><div class="wrap">
  <div class="copy">
    <h1>${name}</h1>
    <p class="tagline">${b.tagline}</p>
    <span class="status"><i></i>${draft ? 'Opening soon' : `Open today ${today[1].split(' ')[0]}`} · ${b.city}</span>
    <div class="actions">
      <a class="b b-primary" href="#offers" ${draft ? 'aria-disabled="true"' : ''}>${verb(featured)} · ${trim(featured.price)} USDC</a>
      ${hasPhone ? `<a class="b b-ghost" href="tel:${tel}">${b.phone}</a>` : `<a class="b b-ghost" href="#visit">Hours and address</a>`}
    </div>
  </div>
  <div class="art">${art}<div class="stamp"><b>Opening<br>soon</b></div></div>
</div></section>

<section class="offers" id="offers"><div class="wrap">
  <div class="sec-h"><h2>${b.art === 'coffee' ? 'On the bar' : b.art === 'bike' ? 'On the stand' : 'From the wheel'}</h2><p>Book here${hasPhone ? `, call ${b.receptionist},` : ''} or send your AI agent. Every payment goes straight to ${b.name}, in USDC.</p></div>
  <ul class="menu">
    ${b.offers.map((o) => `<li class="item${o.featured ? ' featured' : ''}"><div><h3 data-flag="Most booked">${o.title}</h3><p>${o.desc}</p></div><div class="price">${trim(o.price)} <small>USDC ${o.unit}</small></div><a class="b" href="#agent" data-sku="${o.id}" ${draft ? 'aria-disabled="true"' : ''}>${draft ? 'Opens soon' : verb(o)}</a></li>`).join('')}
  </ul>
</div></section>

<section class="agent" id="agent"><div class="wrap">
  <div><h2>Buy with your AI agent.</h2><p class="lede">Ask Claude, ChatGPT or any agent with PayBox. It finds us, reads the offer and asks you for one tap. The money goes straight to ${b.name}’s own wallet.</p></div>
  <div class="slip">
    <label for="p1">Say this to your agent</label>
    <p class="prompt" id="p1">“${prompt}”</p>
    <div class="row"><button class="copy-btn" data-copy="${prompt.replace(/"/g, '&quot;')}">Copy prompt</button></div>
    <hr>
    <label for="l1">Or give it the pay link (x402)</label>
    <div class="row"><code class="link" id="l1">${buyUrl(featured)}</code><button class="copy-btn" data-copy="${buyUrl(featured)}">Copy link</button></div>
    <p class="fine"><span>Pays ${b.wallet} · USDC on Base · one approval per payment</span></p>
  </div>
</div></section>

<section class="visit" id="visit"><div class="wrap">
  <div class="about"><h2>About ${b.name}</h2><p>${b.about}</p><p class="addr">${b.address}</p></div>
  <div class="hours"><h2>Hours</h2><dl>${b.hours.map(([d, h]) => `<dt>${d}</dt><dd>${h}</dd>`).join('')}</dl></div>
  ${hasPhone ? `<div class="phone"><h2>Call us</h2><a href="tel:${tel}">${b.phone}</a><p>${b.receptionist} picks up any hour, takes bookings and texts you a pay link.</p></div>` : ''}
</div></section>
</main>
<footer>
  <div class="foot"><div class="wrap"><span class="name">${b.name}</span><span>${domain} · ${b.city}, ${b.country}</span></div></div>
  <a class="ribbon" href="https://awning.sh/?ref=${b.slug}">${mark}Opened with Awning <span>· open yours in one sentence</span></a>
</footer>`;

  function verb(o) {
    const s = o.title.toLowerCase();
    if (/class|tasting|tune|call|session/.test(s)) return 'Book';
    if (/month|box|subscri/.test(s)) return 'Subscribe';
    return 'Buy';
  }
  function trim(p) { return p.replace(/\.00$/, ''); }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    try { await navigator.clipboard.writeText(btn.dataset.copy); } catch { /* clipboard blocked: the text stays selectable */ }
    const was = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = was), 1400);
  });
})();
