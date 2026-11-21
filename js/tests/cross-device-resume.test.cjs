'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class El {
  constructor(tag, className = '') {
    this.tag = tag;
    this.className = className;
    this.children = [];
    this.hidden = false;
    this.listeners = {};
    this.textContent = '';
    this.scrollHeight = 10000;
    this.parentElement = null;
  }
  appendChild(el) { this.children.push(el); el.parentElement = this; return el; }
  replaceChildren(...els) { this.children = els; }
  addEventListener(name, f) { this.listeners[name] = f; }
  setAttribute(name, v) { this[name] = v; }
  querySelector(selector) {
    const cls = selector.replace(/^\./, '');
    for (const child of this.children) {
      if (child.className.split(' ').includes(cls)) return child;
      if (typeof child.querySelector === 'function') {
        const found = child.querySelector(selector);
        if (found) return found;
      }
    }
    return null;
  }
  querySelectorAll() { return []; }
  contains(el) { return this === el || this.children.some(x => x.contains && x.contains(el)); }
  closest() { return null; }
  getBoundingClientRect() { return {top: 0, bottom: 0, height: 10000}; }
}

const timers = [];
let routeWatcher;
let initialize;
const posts = [];
const scrolls = [];
const window = {
  location: {origin: 'https://example.com', pathname: '/wiki/fde', search: ''},
  scrollY: 0,
  innerHeight: 750,
  setTimeout(fn, ms) { timers.push({fn,ms}); return timers.length; },
  clearTimeout() {},
  setInterval(fn) { routeWatcher = fn; },
  addEventListener() {},
  requestAnimationFrame(fn) { fn(); },
  scrollTo(opts) { this.scrollY = opts.top; scrolls.push(opts.top); }
};
const blocks = [
  [100, 90, 'Title'],
  [310, 240, 'Section one'],
  [2200, 500, 'Important paragraph on phone'],
  [3400, 1200, 'More text'],
].map(([top,height,text]) => {
  const el = new El('p');
  el.textContent = text;
  el.getBoundingClientRect = () => ({top:top-window.scrollY,bottom:top+height-window.scrollY,height});
  return el;
});
const body = new El('div','LinkRobinsWiki-articleBody');
body.textContent = blocks.map(x=>x.textContent).join(' ');
body.getBoundingClientRect = () => ({top:-window.scrollY,bottom:10000-window.scrollY,height:10000});
blocks.forEach(el => body.appendChild(el));
body.querySelectorAll = () => blocks;
const docBody = new El('body');
const document = {
  body:docBody,
  createElement:tag => new El(tag),
  querySelector:sel => sel === '.LinkRobinsWiki-articleBody' ? body : null,
  getElementById:() => null,
  addEventListener() {}
};
const app = {
  initializers: { add(name, fn) { assert.equal(name, 'startpro-wiki-reader'); initialize = fn; } },
  request(opts) {
    if (opts.url.includes('/article?address=')) return Promise.resolve({
      article:{id:17,slug:'fde',title:'Book'},signedIn:true,
      progress:{scrollPercent:12,anchorId:'srp-17-2-500'},bookmarks:[]
    });
    if (opts.method==='POST') { posts.push(opts); return Promise.resolve({bookmark:{id:1}}); }
    if (opts.method==='GET') return Promise.resolve({recent:[],bookmarks:[]});
    return Promise.resolve({});
  }
};
const sandbox={window,document,app,URLSearchParams,console};
const js = fs.readFileSync(path.resolve(__dirname,'../dist/forum.js'),'utf-8');
vm.runInNewContext('var module={};\n' + js, sandbox, {timeout:3000});
initialize();
app.session={user:{id:19},csrfToken:'test'};
app.forum={attribute:key=>key==='apiUrl'?'https://example.com/api':'https://example.com'};

function fire(ms) {
  const i=timers.findIndex(x=>x.ms===ms);
  assert.ok(i>=0,`missing timer ${ms}: ${timers.map(t=>t.ms).join(',')}`);
  const timer=timers.splice(i,1)[0];timer.fn();
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  fire(0);
  await tick();
  // Direct article visit, not an explicit resume URL, should restore saved progress.
  fire(300);
  assert.equal(scrolls[0],2200+250-180,'mobile should use block anchor, not desktop overall scroll percent');

  // New bookmark is paragraph-based, not a viewport-wide percentage.
  window.scrollY=2400;
  const dock=docBody.querySelector('.SPWikiReader-dock');
  const mark=dock.querySelector('.SPWikiReader-markButton');
  assert.equal(mark.hidden,false);
  mark.listeners.click();
  await tick();
  assert.equal(posts.length,1);
  assert.match(posts[0].body.anchorId,/^srp-17-2-\d+$/);

  // Flarum SPA can change only the query when clicking a bookmark on the same
  // article. This still has to trigger a new restore.
  window.location.search='?sr_resume=1&sr_percent=12&sr_anchor=srp-17-1-200';
  routeWatcher();
  await tick();
  fire(300);
  assert.equal(scrolls[1],310+48-180,'same-route bookmark must override current position');

  // Backward compatibility: a prior build's stable heading id must win
  // over its percentage value even on a different viewport.
  const heading={getBoundingClientRect:()=>({top:1700-window.scrollY,bottom:1740-window.scrollY,height:40})};
  document.getElementById = id => id==='wiki-chapter-1'?heading:null;
  body.contains = el => el===heading || blocks.includes(el) || el===body;
  window.location.search='?sr_resume=1&sr_percent=12&sr_anchor=wiki-chapter-1';
  routeWatcher();
  await tick();
  fire(300);
  assert.equal(scrolls[2],1700-180,'previous heading anchors must win over percent');
  console.log('Cross-device paragraph anchor, automatic resume, same-route bookmarks, legacy heading anchors: OK');
})().catch(err=>{console.error(err);process.exitCode=1;});
