'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class El {
  constructor(tag, className = '') {
    this.tag = tag; this.tagName = String(tag).toUpperCase(); this.className = className;
    this.children = []; this.hidden = false; this.listeners = {}; this.textContent = '';
    this.scrollHeight = 9000; this.parentElement = null; this.value = ''; this.id = '';
  }
  appendChild(el) { this.children.push(el); el.parentElement = this; return el; }
  replaceChildren(...els) { this.children = els; els.forEach(el => { el.parentElement = this; }); }
  addEventListener(name, cb) { this.listeners[name] = cb; }
  setAttribute(name, v) { this[name] = v; }
  querySelector(sel) {
    const cls = sel.replace(/^\./, '');
    for (const child of this.children) {
      if (child.className.split(' ').includes(cls)) return child;
      const nested = child.querySelector && child.querySelector(sel);
      if (nested) return nested;
    }
    return null;
  }
  closest() { return null; }
  contains(el) { return this === el || this.children.some(x => x.contains && x.contains(el)); }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { top:0, bottom:9000, height:9000 }; }
}
const tick = () => new Promise(r => setImmediate(r));
const timers = []; const events={}; let watcher, init;
const requests = [], scrolls = [];
const window = {
  location: { origin:'https://example.com', pathname:'/wiki/fde', search:'' },
  innerWidth: 1024, innerHeight: 720, scrollY: 0,
  setTimeout(fn,ms) { timers.push({fn,ms}); return timers.length; }, clearTimeout() {},
  requestAnimationFrame(fn) { fn(); }, setInterval(fn) { watcher=fn; }, addEventListener(name,cb) { events[name]=cb; },
  scrollTo({top}) { this.scrollY=top; scrolls.push(top); }
};
function block(top,height,text) {
  const el = new El('p'); el.textContent=text;
  el.getBoundingClientRect=() => ({top:top-window.scrollY,bottom:top+height-window.scrollY,height});
  return el;
}
const textA='Some early chapter opening with ordinary background concepts';
const textB='Important workflow checkpoint: FDE maps customer operations into real value and measurable outputs; the paragraph is unique and should survive editorial insertions.';
const textC='Closing notes about enterprise delivery and progress management.';
const blocks=[block(60,100,'Title'), block(350,180,textA), block(1500,450,textB), block(2900,500,textC)];
const body = new El('div','LinkRobinsWiki-articleBody');
body.scrollHeight=9000; body.textContent=blocks.map(b=>b.textContent).join(' ');
body.querySelectorAll=(selector) => selector.includes('p,li') ? blocks : [];
body.contains=el => el===body || blocks.includes(el);
body.getBoundingClientRect=()=>({top:-window.scrollY,bottom:9000-window.scrollY,height:9000});
const root=new El('body');
const document = {
  body:root,createElement:tag=>new El(tag),
  querySelector:sel=>sel==='.LinkRobinsWiki-articleBody'?body:null,
  getElementById:()=>null,addEventListener(){}
};
let state={
  article:{id:17,slug:'fde',title:'Book'},
  progress:{scrollPercent:22,anchorId:'srp-17-2-500',version:4,positionContext:null},bookmarks:[]
};
let capturedBookmark=null;let conflictNext=false;
const app={
  initializers:{add(name,cb){assert.equal(name,'startpro-wiki-reader');init=cb;}},
  request(opts){
    requests.push(opts);
    if (opts.url.includes('/article?address=')) return Promise.resolve({...state,signedIn:true});
    if (opts.url.match(/\/bookmarks\/\d+$/) && opts.method==='GET') return Promise.resolve({article:state.article,bookmark:capturedBookmark});
    if (opts.url.includes('/startpro/wiki-reader?')) {
      return Promise.resolve({recent:[],bookmarks: capturedBookmark?[{article:state.article,bookmark:capturedBookmark}]:[],
        pagination:{page:Number(new URL(opts.url).searchParams.get('page')),perPage:20,total:capturedBookmark?1:0,lastPage:1,hasMore:false}});
    }
    if (opts.url.endsWith('/bookmarks') && opts.method==='POST') {
      capturedBookmark={id:14,articleId:17,label:opts.body.label,note:'',anchorId:opts.body.anchorId,
        scrollPercent:opts.body.scrollPercent,positionContext:opts.body.positionContext};
      return Promise.resolve({bookmark:capturedBookmark});
    }
    if (opts.url.includes('/bookmarks/14') && opts.method==='PATCH') {
      capturedBookmark={...capturedBookmark,...opts.body}; return Promise.resolve({bookmark:capturedBookmark});
    }
    if (opts.url.includes('/bookmarks/14') && opts.method==='DELETE') {capturedBookmark=null;return Promise.resolve({deleted:true});}
    if (opts.url.includes('/bookmarks/14/restore') && opts.method==='POST') {
      capturedBookmark={id:14,label:'Restored',note:'',articleId:17}; return Promise.resolve({bookmark:capturedBookmark});
    }
    if (opts.url.includes('/progress/') && opts.method==='POST') {
      if (conflictNext && !opts.body.force) {
        conflictNext=false;state.progress={...state.progress,version:6};
        return Promise.reject({status:409});
      }
      state.progress={...opts.body,version:(opts.body.expectedVersion||0)+1};
      return Promise.resolve({progress:state.progress});
    }
    return Promise.resolve({});
  }
};
const src=fs.readFileSync(path.resolve(__dirname,'../dist/forum.js'),'utf8');
vm.runInNewContext('var module={};\n'+src,{app,window,document,console,URLSearchParams,URL,fetch:()=>Promise.resolve({status:200})},{timeout:3000});
init();
app.session={user:{id:2},csrfToken:'token'};app.forum={attribute:key=>key==='apiUrl'?'https://example.com/api':'https://example.com'};
function fire(ms) {const i=timers.findIndex(t=>t.ms===ms);assert.ok(i>=0,`timer ${ms} absent`);timers.splice(i,1)[0].fn();}
(async()=>{
  fire(0);await tick();
  fire(300); fire(700); scrolls.length=0;
  // Bookmark stores text selectors, not only block index.
  window.scrollY=1550;
  const dock=root.querySelector('.SPWikiReader-dock');
  dock.querySelector('.SPWikiReader-markButton').listeners.click(); await tick();
  assert.ok(capturedBookmark.positionContext.quote.exact.includes('value'), 'quote context stored');
  assert.equal(capturedBookmark.positionContext.block.index,2);
  assert.match(capturedBookmark.anchorId,/^srp-17-2-/);
  // Simulate a new paragraph being inserted BEFORE the saved one.
  blocks.unshift(block(20,40,'New editorial introduction inserted after bookmark was made'));
  // Existing target block now shifts from index 2 to 3, but text exact is stable.
  window.location.search='?sr_bookmark=14';watcher();await tick();fire(300);fire(700);
  assert.ok(scrolls.length>0);
  assert.ok(scrolls[scrolls.length-1]>1200,'text selector must target original paragraph after an insertion');
  // Search and pagination use server query parameters.
  dock.querySelector('.SPWikiReader-mainButton').listeners.click(); await tick();
  const panel=root.querySelector('.SPWikiReader-panel');
  let search=panel.querySelector('.SPWikiReader-search');
  search.value='FDE';search.listeners.input();fire(350);await tick();
  assert.ok(requests.some(x=>x.url.includes('search=FDE')));
  // Editing does not change location and allows notes.
  let edit=panel.querySelector('.SPWikiReader-editButton');
  edit.listeners.click();
  panel.querySelector('.SPWikiReader-editLabel').value='项目关键段落';
  panel.querySelector('.SPWikiReader-editNote').value='方案写作引用';
  panel.querySelector('.SPWikiReader-saveEdit').listeners.click();await tick();
  assert.equal(capturedBookmark.label,'项目关键段落');
  assert.equal(capturedBookmark.note,'方案写作引用');
  // Soft delete and 10-minute undo are distinct endpoints.
  panel.querySelector('.SPWikiReader-delete').listeners.click(); await tick();
  assert.equal(capturedBookmark,null);
  panel.querySelector('.SPWikiReader-undoButton').listeners.click(); await tick();
  assert.ok(capturedBookmark);
  // Mobile compact menu can reveal bookmark and library actions.
  window.innerWidth=375;window.location.search='';watcher();await tick();
  dock.querySelector('.SPWikiReader-mainButton').listeners.click();
  assert.ok(dock.className.includes('is-expanded'));
  assert.ok(dock.querySelector('.SPWikiReader-libraryButton'));
  // Progress requests include the last seen server version. Simulate a race.
  window.innerWidth=1024;window.scrollY=1550;conflictNext=true;
  fire(300); fire(700); // resume timers from navigating back to article
  events.scroll();fire(500);await tick();await tick();
  assert.ok(requests.some(x=>x.url.includes('/progress/') && x.body.expectedVersion===4));
  const conflictButton=dock.querySelector('.SPWikiReader-conflictButton');
  assert.equal(conflictButton.hidden,false,'409 must stop overwrite and offer explicit choice');
  conflictButton.listeners.click();await tick();
  assert.ok(requests.some(x=>x.url.includes('/progress/') && x.body.force===true && x.body.expectedVersion===6));
  assert.equal(conflictButton.hidden,true,'resolved conflict should clear prompt');
  console.log('v0.2 quote after edits, edit/search, undo, mobile menu and stale-tab conflict: OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
