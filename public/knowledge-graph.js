/* Animated sample workspace on the sign-in page. All examples are local. */
(() => {
  // Texts follow the page language set by app.js; translations live in public/i18n.js.
  const tr = (s) => (document.documentElement.lang === 'uk' && window.TEAMOS_I18N?.uk?.[s]) || s;
  const hubs = [
    { id: 'project', name: 'Pricing launch', x: 345, y: 180, color: '#efd6ff' },
    { id: 'ideas', name: 'Hypotheses', x: 180, y: 72, color: '#bfa3f0' },
    { id: 'goals', name: 'Goals', x: 482, y: 69, color: '#a0d6cc' },
    { id: 'docs', name: 'Documents', x: 91, y: 187, color: '#af9de0' },
    { id: 'promises', name: 'Commitments', x: 533, y: 254, color: '#f3aac9' },
    { id: 'people', name: 'Team', x: 239, y: 320, color: '#eac398' },
  ];
  const stories = [
    { type: 'Meeting', title: 'Launch sync', result: 'Pricing page', target: 'promises', related: 'people', source: [382,331], fact: [436,255], detail: 'Maya agreed to publish the pricing page by Friday. The commitment joins the launch project.' },
    { type: 'PDF', title: 'Pricing study.pdf', result: '14-day trial', target: 'ideas', related: 'docs', source: [68,63], fact: [266,103], detail: 'Customers asked for two weeks to evaluate the product. The PDF becomes evidence for the trial hypothesis.' },
    { type: 'Chat', title: 'Sales thread', result: 'Pilot group', target: 'people', related: 'project', source: [90,300], fact: [207,241], detail: 'Sales named three teams willing to join the pilot. The conversation now connects those teams to the launch.' },
    { type: 'Document', title: 'Launch plan', result: '50 teams', target: 'goals', related: 'project', source: [575,111], fact: [409,123], detail: 'The plan calls for 50 paying teams this quarter. The goal links back to the document that set it.' },
    { type: 'Guide', title: 'Launch checklist', result: 'Price review', target: 'docs', related: 'people', source: [116,256], fact: [238,168], detail: 'The checklist assigns price reviews to Sales. The process and its owners stay connected to the original guide.' },
  ];
  const duration = 8200;
  const svgNS = 'http://www.w3.org/2000/svg';
  const clamp = value => Math.max(0, Math.min(1, value));
  function mark(parent, tag, attrs = {}) {
    const el = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    parent.appendChild(el);
    return el;
  }
  function segment(el, a, b, progress = 1) {
    el.setAttribute('x1', a.x);
    el.setAttribute('y1', a.y);
    el.setAttribute('x2', a.x + (b.x - a.x) * progress);
    el.setAttribute('y2', a.y + (b.y - a.y) * progress);
  }
  function place(el, pt) {
    el.setAttribute('transform', 'translate(' + pt.x.toFixed(2) + ' ' + pt.y.toFixed(2) + ')');
  }
  function cluster(parent, hub, i) {
    const group = mark(parent, 'g', {color: hub.color});
    const dots = [];
    const count = i === 0 ? 20 : 14;
    for (let n = 0; n < count; n++) {
      const angle = n * 2.39996 + i * 1.7;
      const radius = 12 + Math.sqrt((n + 1) / count) * (i === 0 ? 69 : 51);
      const p = {x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * .68};
      const origin = dots[n - 5] && n % 4 ? dots[n - 5] : {x: 0, y: 0};
      segment(mark(group, 'line', {class: 'kg-filament'}), origin, p);
      if (n > 5 && n % 3 === 0) segment(mark(group, 'line', {class: 'kg-filament'}), dots[n - 3], p);
      dots.push(p);
    }
    dots.forEach((p, n) => mark(group, 'circle', {cx:p.x, cy:p.y, r:n % 4 === 0 ? 2.8 : 1.7, fill:'currentColor', opacity:.48 + (n % 3) * .18}));
    const size = i === 0 ? 9 : 5;
    for (const [scale, opacity] of [[3.7,.06],[2,.14],[1,1]]) {
      mark(group,'circle',{r:size * scale, fill:'currentColor', opacity});
    }
    mark(group, 'text', {y:size + 20, class:i ? 'kg-label' : 'kg-label kg-main-label'}).textContent = tr(hub.name);
    return group;
  }
  function record(parent, label, isSource) {
    const g = mark(parent, 'g');
    mark(g, 'circle', {r:isSource ? 11 : 8, class:'kg-aura'});
    mark(g, 'circle', {r:isSource ? 4.8 : 3.8, class:'kg-record-dot'});
    const text = mark(g, 'text', {y: -13, class:'kg-label kg-record-label'});
    text.textContent = tr(label);
    return {g, text};
  }
  class KnowledgeGraph extends HTMLElement {
    connectedCallback() {
      this.innerHTML = `<figure class="kg">
        <div class="kg-bar"><figcaption>${tr('Team knowledge graph')}</figcaption><button type="button" class="kg-motion"></button></div>
        <svg class="kg-map" viewBox="0 0 660 385" role="img" aria-label="${tr('Example pricing launch project connected to documents, goals, hypotheses, commitments, and team members')}"></svg>
        <div class="kg-caption"><div class="kg-origin"><span class="kg-type"></span><strong></strong></div><p></p></div>
        <div class="kg-queue" role="group" aria-label="${tr('Example sources')}"></div>
      </figure>`;
      this.abort = new AbortController();
      const options = {signal:this.abort.signal};
      this.media = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.playing = !this.media.matches;
      this.elapsed = this.playing ? 0 : 3400;
      this.time = 0;
      this.frame = 0;
      this.last = null;
      this.visible = true;
      this.seen = new Set();
      this.motion = this.querySelector('.kg-motion');
      this.caption = this.querySelector('.kg-caption');
      this.svg = this.querySelector('.kg-map');
      const bridges = mark(this.svg, 'g', {class:'kg-bridges'});
      const branches = mark(this.svg, 'g');
      const clusters = mark(this.svg, 'g');
      const records = mark(this.svg, 'g');
      this.groups = hubs.map((hub, i) => cluster(clusters, hub, i));
      this.bridges = [[0,1],[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[2,4],[4,5],[3,5]].map(([a,b]) => ({a,b,line:mark(bridges,'line')}));
      this.items = stories.map(story => ({
        source:record(records,story.title,true), fact:record(records,story.result,false),
        lines:Array.from({length:3}, () => mark(branches,'line',{class:'kg-new-link'})),
        target:hubs.findIndex(h => h.id === story.target), related:hubs.findIndex(h => h.id === story.related),
      }));
      const queue = this.querySelector('.kg-queue');
      this.buttons = stories.map((story,i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = tr(story.type);
        b.setAttribute('aria-label', tr('Show {title}').replace('{title}', tr(story.title)));
        b.addEventListener('click', () => {
          this.elapsed = this.playing ? 0 : 3400;
          this.select(i);
          this.paint();
        }, options);
        queue.appendChild(b);
        return b;
      });
      this.select(0);
      this.motion.addEventListener('click', () => this.setPlaying(!this.playing), options);
      this.media.addEventListener('change', () => this.setPlaying(!this.media.matches), options);
      document.addEventListener('visibilitychange', () => this.schedule(), options);
      this.observer = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        this.schedule();
      });
      this.observer.observe(this);
      this.setPlaying(this.playing);
    }
    disconnectedCallback() {
      this.abort.abort();
      this.observer.disconnect();
      cancelAnimationFrame(this.frame);
    }
    setPlaying(playing) {
      this.playing = playing;
      this.motion.innerHTML = playing ? `<span aria-hidden="true">Ⅱ</span> ${tr('Pause')}` : `<span aria-hidden="true">▷</span> ${tr('Play')}`;
      this.motion.setAttribute('aria-label', tr(playing ? 'Pause graph animation' : 'Play graph animation'));
      if (!playing && this.media.matches) this.elapsed = Math.max(this.elapsed,3400);
      this.paint();
      this.schedule();
    }
    select(index) {
      this.index = index;
      this.seen.add(index);
      const story = stories[index];
      this.caption.querySelector('.kg-type').textContent = tr(story.type);
      this.caption.querySelector('strong').textContent = tr(story.title);
      this.caption.querySelector('p').textContent = tr(story.detail);
      this.buttons.forEach((button,i) => button.setAttribute('aria-pressed',String(i === index)));
    }
    schedule() {
      cancelAnimationFrame(this.frame);
      this.last = null;
      if (this.playing && this.visible && !document.hidden && this.isConnected) this.frame = requestAnimationFrame(this.tick);
    }
    tick = now => {
      const dt = this.last === null ? 0 : Math.min(now - this.last, 100);
      this.last = now;
      this.time += dt;
      this.elapsed += dt;
      if (this.elapsed >= duration) {
        const next = (this.index + 1) % stories.length;
        if (!next) this.seen.clear();
        this.elapsed %= duration;
        this.select(next);
      }
      this.paint();
      this.frame = requestAnimationFrame(this.tick);
    };
    paint() {
      const t = this.time * .00048;
      const positions = hubs.map((h,i) => ({x:h.x + 7 * Math.sin(t + i * 1.8), y:h.y + 5 * Math.cos(t * .87 + i * 2.4)}));
      this.groups.forEach((g,i) => place(g,positions[i]));
      this.bridges.forEach(({a,b,line}) => segment(line,positions[a],positions[b]));
      this.items.forEach((item,i) => {
        const current = i === this.index;
        const seen = this.seen.has(i);
        const age = current ? this.elapsed : duration;
        const appear = seen ? clamp(age / 650) : 0;
        const sprout = seen ? clamp((age - 700) / 1100) : 0;
        const attach = seen ? clamp((age - 1700) / 1050) : 0;
        // Dim earlier additions and retire them together at the end of the tour.
        const fade = this.index === stories.length - 1 ? clamp((duration - this.elapsed) / 600) : 1;
        const opacity = (current ? 1 : .32) * fade;
        const story = stories[i];
        const source = {x:story.source[0] + 4 * Math.sin(t + i), y:story.source[1] + 3 * Math.cos(t + i)};
        const fact = {x:source.x + (story.fact[0] - source.x) * sprout, y:source.y + (story.fact[1] - source.y) * sprout};
        place(item.source.g,source); place(item.fact.g,fact);
        item.source.g.setAttribute('opacity',appear * opacity);
        item.fact.g.setAttribute('opacity',sprout * opacity);
        item.source.text.setAttribute('opacity',current ? 1 : 0);
        item.fact.text.setAttribute('opacity',current ? sprout : 0);
        segment(item.lines[0],source,fact);
        segment(item.lines[1],fact,positions[item.target],attach);
        segment(item.lines[2],source,positions[item.related],attach);
        item.lines.forEach((line,j) => line.setAttribute('opacity',opacity * (j === 0 ? sprout : attach) * (j === 2 ? .44 : .85)));
      });
    }
  }
  customElements.define('team-knowledge-graph',KnowledgeGraph);
})();
