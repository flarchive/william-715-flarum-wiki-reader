'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class El {
  constructor(tag) { this.tagName = tag.toUpperCase();this.children=[];this.parentElement=null;this.textContent='';this.className='';this.listeners={};this.hidden=false;this.value='';this.scrollHeight=8000;this.style={};this.id=''; }
  appendChild(el) { this.children.push(el);el.parentElement=this;return el; }
  replaceChildren(...els) { this.children=els;els.forEach(x=>x.parentElement=this); }
  addEventListener(name,fn) { this.listeners[name]=fn; }
  setAttribute(k,v) { this[k]=v; }
  contains(el) { return this===el || this.children.some(x=>x.contains&&x.contains(el)); }
  closest() { return null; }
  querySelector(s) { const c=s.replace(/^\./,'');for(const child of this.children){if(child.className.split(' ').includes(c))return child;const inside=child.querySelector&&child.querySelector(s);if(inside)return inside;}return null; }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return {top:0,bottom:8000,height:8000}; }
}
const queue=[],documentEvents={},windowEvents={},calls=[];
const timer=(f,ms)=>{queue.push({f,ms});return queue.length};
let interval,init,now=100000;
const body=new El('div');body.className='LinkRobinsWiki-articleBody';body.textContent='Example article sample selection, words are saved privately.';body.scrollHeight=9000;
const block=new El('p');block.textContent=body.textContent;body.appendChild(block);
body.querySelectorAll=()=>[block];body.getBoundingClientRect=()=>({top:0,bottom:9000,height:9000});
const root=new El('body'),head=new El('head');
const doc={body:root,head,visibilityState:'visible',createElement:tag=>new El(tag),
  querySelector:s=>s==='.LinkRobinsWiki-articleBody'?body:null,
  getElementById:()=>null,
  createRange:()=>({selectNodeContents(){},setEnd(){},toString(){return 'Example article '}}),
  addEventListener:(n,f)=>{documentEvents[n]=f}};
const selectionRange={startContainer:block,endContainer:block,startOffset:0,endOffset:7};
const win={location:{origin:'https://example.com',pathname:'/wiki/fde',search:''},scrollY:0,innerHeight:750,innerWidth:1024,
  setTimeout:timer,clearTimeout(){},setInterval:f=>{interval=f},addEventListener:(n,f)=>{windowEvents[n]=f},
  scrollTo(){},requestAnimationFrame:f=>f(),getSelection:()=>({isCollapsed:false,rangeCount:1,toString:()=> 'Example',getRangeAt:()=>selectionRange})};
const article={id:17,slug:'fde',title:'FDE Book'};
const book={id:11,title:'FDE Guide',description:'',chaptersTotal:1,chaptersCompleted:0,lastArticleId:17,chapters:[{article,completed:false,progress:null,position:10}]};
let notes=[],completed=false,books=[book],readingProgress={version:2,anchorId:'srp-17-0-500',scrollPercent:5};
const app={initializers:{add(_name,cb){init=cb}},request(x){
  calls.push(x);
  if(x.url.includes('/article?address='))return Promise.resolve({article,signedIn:true,progress:readingProgress,bookId:11,completed,highlights:notes.map(n=>({...n})),bookmarks:[]});
  if(x.url.includes('/highlights?')&&x.method==='GET')return Promise.resolve({highlights:notes.map(n=>({article,highlight:n})),pagination:{page:1,lastPage:1,total:notes.length,hasMore:false}});
  if(x.url.endsWith('/highlights')&&x.method==='POST') {const n={id:12,articleId:17,quote:x.body.quote,positionContext:x.body.positionContext,note:''};notes.push(n);return Promise.resolve({highlight:n})}
  if(x.url.endsWith('/highlights/12')&&x.method==='PATCH') {notes[0].note=x.body.note;return Promise.resolve({highlight:notes[0]})}
  if(x.url.endsWith('/highlights/12')&&x.method==='DELETE') {notes=[];return Promise.resolve({deleted:true})}
  if(x.url.endsWith('/shelf'))return Promise.resolve({books,standalone:[],isAdmin:true});
  if(x.url.endsWith('/stats'))return Promise.resolve({stats:{estimatedReadingSeconds:360,activeDaysLast30:2,bookmarks:3,articlesCompleted:1,highlights:notes.length}});
  if(x.url.endsWith('/books')&&x.method==='POST') {books.push({...book,id:15,title:x.body.title,chapters:[],chaptersTotal:0});return Promise.resolve({book:{id:15,title:x.body.title}})}
  if(x.url.includes('/chapters')&&x.method==='POST')return Promise.resolve({chapter:{articleId:17}});
  if(x.url.includes('/completions/17')){completed=x.method==='POST';return Promise.resolve({articleId:17,completed})}
  if(x.url.includes('/activity/17'))return Promise.resolve({activeSeconds:x.body.activeSeconds});
  if(x.url.includes('/wiki-reader?'))return Promise.resolve({recent:[],bookmarks:[],pagination:{page:1,lastPage:1,hasMore:false}});
  return Promise.resolve({});
}};
const FakeDate={now:()=>now};
vm.runInNewContext('var module={};\n'+fs.readFileSync(path.join(__dirname,'../dist/forum.js'),'utf8'),
  {app,window:win,document:doc,Date:FakeDate,URLSearchParams,console,fetch:()=>Promise.resolve({status:200})},{timeout:3000});
init();app.session={user:{id:7,isAdmin:()=>true},csrfToken:'csrf'};app.forum={attribute:k=>k==='apiUrl'?'https://example.com/api':'https://example.com'};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fire(ms){const i=queue.findIndex(x=>x.ms===ms);assert.ok(i>=0,`Missing timeout ${ms}, queue=[${queue.map(x=>x.ms)}]`);queue.splice(i,1)[0].f()}
(async()=>{
  fire(0);await flush();
  const dock=root.querySelector('.SPWikiReader-dock');assert.ok(dock);
  const mark=dock.querySelector('.SPWikiReader-highlightButton');assert.ok(mark);
  // One-paragraph selection; `captureSelection` is scheduled from mouseup.
  documentEvents.mouseup();fire(0);
  mark.listeners.click();await flush();
  assert.equal(notes.length,1);
  assert.equal(notes[0].quote,'Example');
  assert.ok(notes[0].positionContext && notes[0].positionContext.block);
  dock.querySelector('.SPWikiReader-mainButton').listeners.click();await flush();
  const panel=root.querySelector('.SPWikiReader-panel');
  let tab=panel.children[1].querySelector('.SPWikiReader-tab');
  assert.ok(tab,'Tabbed panel should be available');
  const clickTab=(text)=>{
    const nav=panel.children[1].querySelector('.SPWikiReader-tabs');
    const btn=nav.children.find(c=>c.textContent===text);assert.ok(btn,`Missing tab ${text}`);btn.listeners.click();
  };
  clickTab('划线笔记');await flush();
  const note=panel.querySelector('.SPWikiReader-highlightNote');assert.ok(note);
  note.value='A private note';panel.querySelector('.SPWikiReader-saveNote').listeners.click();await flush();
  assert.equal(notes[0].note,'A private note');
  clickTab('我的书架');await flush();
  assert.ok(panel.querySelector('.SPWikiReader-bookCard'));
  panel.querySelector('.SPWikiReader-completeSmall').listeners.click();await flush();assert.equal(completed,true);
  const title=panel.querySelector('.SPWikiReader-newBookTitle');assert.ok(title,'Admin can curate books');
  title.value='A New Book';
  const admin=panel.querySelector('.SPWikiReader-bookAdmin');
  const create=admin.children.find(x=>x.textContent==='创建书籍');assert.ok(create);create.listeners.click();await flush();
  assert.ok(books.some(x=>x.title==='A New Book'));
  clickTab('阅读统计');await flush();assert.ok(panel.querySelector('.SPWikiReader-statsGrid'));
  // Active reading time is idempotent per session and only sent after interaction.
  now+=16000;interval(); now+=16000;interval();await flush();
  assert.ok(calls.some(x=>x.url.endsWith('/activity/17')&&x.body.activeSeconds>=30),'Activity should send cumulative active seconds');
  console.log('v0.3 highlight/notes, shelf/admin, completion, stats and active-reading smoke: OK');
})().catch(e=>{console.error(e);process.exitCode=1});
