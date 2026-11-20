// Simulate Flarum 2's timing: initializers execute before app.session exists.
// This is a smoke test, not a browser or database integration test.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeElement {
  constructor(tag, className = '') {
    this.tag = tag;
    this.className = className;
    this.children = [];
    this.hidden = false;
    this.listeners = {};
    this.textContent = '';
    this.scrollHeight = 1500;
  }
  appendChild(el) { this.children.push(el); return el; }
  replaceChildren(...els) { this.children = [...els]; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  setAttribute(name, value) { this[name] = value; }
  getBoundingClientRect() { return { top: 0 }; }
  querySelectorAll() { return []; }
  querySelector(selector) {
    const token = selector.replace(/^\./, '');
    for (const c of this.children) {
      if (c.className.split(' ').includes(token)) return c;
      const nested = c.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

const source = fs.readFileSync(path.join(__dirname, '../dist/forum.js'), 'utf8');
const body = new FakeElement('body');
const articleBody = new FakeElement('div', 'LinkRobinsWiki-articleBody');
const callbacks = [];
const requests = [];
let initializer;
const app = {
  initializers: { add(name, fn) { assert.equal(name, 'startpro-wiki-reader'); initializer = fn; } },
  request(opts) {
    assert.ok(app.session?.user, 'No request should run before session exists');
    requests.push(opts);
    if (opts.url.includes('/article?address=')) return Promise.resolve({
      article: { id: 17, slug: 'fde', title: 'FDE Book' }, signedIn: true, progress: null, bookmarks: []
    });
    if (opts.method === 'GET') return Promise.resolve({ recent: [], bookmarks: [] });
    if (opts.url.endsWith('/bookmarks') && opts.method === 'POST') {
      return Promise.resolve({ bookmark: { id: 10 } });
    }
    return Promise.resolve({});
  }
};
const document = {
  body,
  createElement(tag) { return new FakeElement(tag); },
  querySelector(selector) { return selector === '.LinkRobinsWiki-articleBody' ? articleBody : null; },
  addEventListener() {}
};
const window = {
  location: { origin: 'https://example.com', pathname: '/wiki/fde', search: '' },
  scrollY: 0, innerHeight: 800,
  setTimeout(fn, ms) { callbacks.push({ fn, ms }); return callbacks.length; },
  clearTimeout() {}, setInterval() {}, addEventListener() {}, scrollTo() {}
};
const sandbox = { app, document, window, URLSearchParams, console, fetch() { throw Error('Unexpected fetch'); } };
vm.runInNewContext('var module={};\n' + source + '\n', sandbox, { timeout: 2000 });
assert.equal(typeof initializer, 'function');
assert.ok(sandbox.module.exports, 'Flarum module export should exist');
initializer();
assert.equal(requests.length, 0, 'The initializer must not request an article before boot');
assert.equal(body.children.length, 0, 'The initializer must not mount UI before boot');
assert.equal(callbacks[0]?.ms, 0, 'UI boot should be deferred to next task');

(async () => {
  app.session = { user: { id: 42 }, csrfToken: 'fake-csrf' };
  app.forum = { attribute(name) { return name === 'apiUrl' ? 'https://example.com/api' : 'https://example.com'; } };
  callbacks.shift().fn();
  await new Promise(resolve => setImmediate(resolve));
  const dock = body.querySelector('.SPWikiReader-dock');
  assert.ok(dock, 'Reader dock should mount after boot');
  assert.ok(requests.some(x => x.url.includes('/article?address=fde')), 'Reader should fetch article state');
  const bookmarkButton = dock.querySelector('.SPWikiReader-markButton');
  assert.ok(bookmarkButton, 'Bookmark button exists');
  assert.equal(bookmarkButton.hidden, false, 'Signed-in users should see Add bookmark');
  bookmarkButton.listeners.click();
  await Promise.resolve();
  assert.ok(requests.some(x => x.method === 'POST' && x.url.endsWith('/bookmarks')), 'Bookmark should POST');
  const libraryButton = dock.querySelector('.SPWikiReader-mainButton');
  libraryButton.listeners.click();
  await new Promise(resolve => setImmediate(resolve));
  const panel = body.querySelector('.SPWikiReader-panel');
  const panelContent = panel.querySelector('.SPWikiReader-panelContent');
  assert.equal(panelContent.children[0].textContent, '最近阅读', 'Signed-in users should see history, not sign-in prompt');
  console.log('Flarum delayed-session and bookmark controls smoke test passed');
})().catch(err => { console.error(err); process.exitCode = 1; });
