/* StartPro Wiki Reader 0.1.0 - dependency-free Flarum 2 forum initializer.
 * Works with LR Wiki's /wiki/:slug routes and .LinkRobinsWiki-articleBody.
 */
(function () {
  'use strict';
  if (typeof app === 'undefined' || !app.initializers) return;

  app.initializers.add('startpro-wiki-reader', function () {
    const PREFIX = 'SPWikiReader';
    const API = (app.forum && app.forum.attribute('apiUrl') || (window.location.origin + '/api')).replace(/\/$/, '') + '/startpro/wiki-reader';
    const BASE = (app.forum && app.forum.attribute('baseUrl') || window.location.origin).replace(/\/$/, '');
    const SIGNED_IN = !!(app.session && app.session.user);
    const SAVE_INTERVAL = 6500;

    let active = null;
    let currentPath = '';
    let generation = 0;
    let toolbar = null;
    let dialog = null;
    let content = null;
    let status = null;
    let library = null;
    let panelOpen = false;
    let lastSavedAt = 0;
    let dirty = false;
    let saving = false;
    let saveTimer = null;

    function element(tag, className, contentText) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (contentText !== undefined) el.textContent = String(contentText);
      return el;
    }

    function clamp(value) {
      return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
    }

    function parseWikiRoute() {
      const path = window.location.pathname;
      const i = path.indexOf('/wiki');
      if (i < 0 || (i !== 0 && path.charAt(i - 1) !== '/')) return null;
      const rest = path.slice(i + 5).split('/').filter(Boolean);
      if (rest.length === 0) return { type: 'index' };
      if (rest.length !== 1 || rest[0] === 'new') return null;
      try { return { type: 'article', address: decodeURIComponent(rest[0]) }; }
      catch (e) { return null; }
    }

    function urlForArticle(article, progress, bookmark) {
      const slug = article.slug || String(article.id);
      const url = BASE + '/wiki/' + encodeURIComponent(slug);
      const args = [];
      if (progress || bookmark) {
        const point = bookmark || progress;
        args.push('sr_resume=1');
        args.push('sr_percent=' + encodeURIComponent(String(point.scrollPercent || 0)));
        if (point.anchorId) args.push('sr_anchor=' + encodeURIComponent(point.anchorId));
      }
      return url + (args.length ? '?' + args.join('&') : '');
    }

    function getBody() {
      return document.querySelector('.LinkRobinsWiki-articleBody');
    }

    function snapshot() {
      const body = getBody();
      if (!body) return null;
      const rect = body.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const target = window.scrollY + Math.min(window.innerHeight * 0.28, 180);
      const length = Math.max(1, body.scrollHeight);
      const percent = clamp(((target - top) / length) * 100);
      const headings = Array.from(body.querySelectorAll('h1,h2,h3,h4,h5,h6[id]'));
      let currentHeading = null;
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= Math.min(window.innerHeight * 0.35, 200)) currentHeading = h;
        else break;
      }
      return {
        scrollPercent: percent,
        anchorId: currentHeading && currentHeading.id || null,
        label: currentHeading && currentHeading.textContent && currentHeading.textContent.trim() || (active && active.article.title) || '当前位置'
      };
    }

    function statusText(text) {
      if (status) status.textContent = text;
    }

    function apiRequest(method, url, body) {
      // Flarum's request helper provides CSRF token and same-session credentials.
      const params = { method: method, url: url, background: true };
      if (body !== undefined) params.body = body;
      return app.request(params);
    }

    function queueSave() {
      if (!SIGNED_IN || !active || !active.article || !getBody()) return;
      dirty = true;
      if (saveTimer) return;
      saveTimer = window.setTimeout(function () {
        saveTimer = null;
        persistProgress();
      }, Math.max(500, SAVE_INTERVAL - (Date.now() - lastSavedAt)));
    }

    async function persistProgress() {
      if (!dirty || saving || !SIGNED_IN || !active || !active.article) return;
      const point = snapshot();
      if (!point) return;
      dirty = false;
      saving = true;
      const articleId = active.article.id;
      const thisGeneration = generation;
      try {
        const result = await apiRequest('POST', API + '/progress/' + articleId, point);
        lastSavedAt = Date.now();
        if (active && generation === thisGeneration) {
          active.progress = result.progress || point;
          statusText('阅读进度已同步');
        }
      } catch (err) {
        dirty = true;
        if (active && generation === thisGeneration) statusText('保存失败，将在下次滚动时重试');
      } finally {
        saving = false;
      }
    }

    function flushOnHide() {
      if (!dirty || !active || !SIGNED_IN || !app.session || !app.session.csrfToken) return;
      const point = snapshot();
      if (!point) return;
      dirty = false;
      // keepalive lets this small JSON payload finish as the user leaves.
      fetch(API + '/progress/' + active.article.id, {
        method: 'POST', credentials: 'same-origin', keepalive: true,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': app.session.csrfToken },
        body: JSON.stringify(point)
      }).catch(function () {});
    }

    function restorePoint(point) {
      if (!point) return;
      const body = getBody();
      if (!body) return;
      const percent = Number(point.scrollPercent);
      let y = NaN;
      if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
        y = body.getBoundingClientRect().top + window.scrollY + body.scrollHeight * (percent / 100) - Math.min(window.innerHeight * 0.28, 180);
      }
      if (!Number.isFinite(y) && point.anchorId) {
        const candidate = document.getElementById(point.anchorId);
        if (candidate && body.contains(candidate)) y = candidate.getBoundingClientRect().top + window.scrollY - 95;
      }
      if (Number.isFinite(y)) {
        window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
        statusText('已回到上次阅读位置');
      }
    }

    function restoreWhenReady(point, token, attempts) {
      if (generation !== token || attempts <= 0) return;
      if (getBody()) {
        restorePoint(point);
        return;
      }
      window.setTimeout(function () { restoreWhenReady(point, token, attempts - 1); }, 200);
    }

    function button(text, className, handler) {
      const btn = element('button', PREFIX + '-button ' + (className || ''), text);
      btn.type = 'button';
      btn.addEventListener('click', handler);
      return btn;
    }

    function makeDock() {
      toolbar = element('div', PREFIX + '-dock');
      const openButton = button('📖 我的阅读', PREFIX + '-mainButton', function () { showLibrary(); });
      openButton.setAttribute('aria-label', '查看阅读记录和书签');
      toolbar.appendChild(openButton);
      const bookmarkButton = button('☆ 添加书签', PREFIX + '-markButton', function () { addBookmark(); });
      bookmarkButton.title = '收藏当前章节的阅读位置';
      toolbar.appendChild(bookmarkButton);
      const resumeButton = button('↪ 继续阅读', PREFIX + '-resumeButton', function () {
        if (active && active.progress) restorePoint(active.progress);
      });
      toolbar.appendChild(resumeButton);
      status = element('span', PREFIX + '-status', '');
      toolbar.appendChild(status);
      document.body.appendChild(toolbar);

      dialog = element('section', PREFIX + '-panel');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-label', '我的 Wiki 阅读记录');
      const header = element('div', PREFIX + '-panelHeader');
      header.appendChild(element('strong', '', '我的 Wiki 阅读'));
      header.appendChild(button('×', PREFIX + '-close', function () { hidePanel(); }));
      dialog.appendChild(header);
      content = element('div', PREFIX + '-panelContent');
      dialog.appendChild(content);
      dialog.hidden = true;
      document.body.appendChild(dialog);
      updateDock();
    }

    function updateDock() {
      if (!toolbar) return;
      const route = parseWikiRoute();
      const visible = !!route;
      toolbar.hidden = !visible;
      if (!visible) hidePanel();
      const markBtn = toolbar.querySelector('.' + PREFIX + '-markButton');
      const resumeBtn = toolbar.querySelector('.' + PREFIX + '-resumeButton');
      markBtn.hidden = !SIGNED_IN || !active || !active.article || !getBody();
      resumeBtn.hidden = !active || !active.progress || !getBody();
    }

    function hidePanel() {
      if (!dialog) return;
      dialog.hidden = true;
      panelOpen = false;
    }

    function listRow(article, point, note, withRemove) {
      const row = element('div', PREFIX + '-row');
      const a = element('a', PREFIX + '-rowLink');
      a.href = urlForArticle(article, point);
      a.appendChild(element('span', PREFIX + '-rowTitle', article.title || 'Wiki 文章'));
      a.appendChild(element('small', PREFIX + '-rowDetail', note));
      row.appendChild(a);
      if (withRemove) {
        row.appendChild(button('删除', PREFIX + '-delete', function () { removeBookmark(withRemove); }));
      }
      return row;
    }

    function renderLibrary() {
      if (!content) return;
      content.replaceChildren();
      if (!SIGNED_IN) {
        content.appendChild(element('p', PREFIX + '-muted', '登录论坛后，可在不同设备间同步书签和阅读进度。'));
        return;
      }
      if (!library) {
        content.appendChild(element('p', PREFIX + '-muted', '正在加载阅读记录…'));
        return;
      }
      const recent = library.recent || [];
      const marks = library.bookmarks || [];
      content.appendChild(element('h3', '', '最近阅读'));
      if (recent.length === 0) content.appendChild(element('p', PREFIX + '-muted', '还没有阅读记录。打开一本 Wiki 文章即可开始记录。'));
      recent.forEach(function (rec) {
        const percent = Number(rec.progress.scrollPercent || 0);
        content.appendChild(listRow(rec.article, rec.progress, '继续阅读 · ' + Math.round(percent) + '%'));
      });
      content.appendChild(element('h3', '', '我的书签 (' + marks.length + ')'));
      if (marks.length === 0) content.appendChild(element('p', PREFIX + '-muted', '阅读文章时点击「添加书签」即可保存当前位置。'));
      marks.forEach(function (rec) {
        content.appendChild(listRow(rec.article, rec.bookmark, rec.bookmark.label, rec.bookmark.id));
      });
    }

    async function showLibrary() {
      if (!dialog) return;
      panelOpen = true;
      dialog.hidden = false;
      library = null;
      renderLibrary();
      if (!SIGNED_IN) return;
      try {
        library = await apiRequest('GET', API);
      } catch (err) {
        library = { recent: [], bookmarks: [] };
        statusText('阅读记录加载失败');
      }
      if (panelOpen) renderLibrary();
    }

    async function addBookmark() {
      if (!SIGNED_IN || !active || !getBody()) return;
      const point = snapshot();
      if (!point) return;
      try {
        await apiRequest('POST', API + '/bookmarks', {
          articleId: active.article.id,
          scrollPercent: point.scrollPercent,
          anchorId: point.anchorId,
          label: point.label.slice(0, 120)
        });
        statusText('书签已添加');
        if (panelOpen) showLibrary();
      } catch (e) {
        statusText('添加书签失败，请重新尝试');
      }
    }

    async function removeBookmark(id) {
      if (!SIGNED_IN) return;
      try {
        await apiRequest('DELETE', API + '/bookmarks/' + encodeURIComponent(String(id)));
        statusText('书签已删除');
        if (panelOpen) showLibrary();
      } catch (e) {
        statusText('删除书签失败');
      }
    }

    async function loadArticle(address, token) {
      try {
        const result = await apiRequest('GET', API + '/article?address=' + encodeURIComponent(address));
        if (generation !== token) return;
        active = result;
        updateDock();
        if (SIGNED_IN && !result.progress) {
          // Record a new chapter visit. Never overwrite an existing saved
          // position with 0% just because the reader re-opened the chapter.
          window.setTimeout(function () { if (generation === token) queueSave(); }, 2200);
        }
        const search = new URLSearchParams(window.location.search);
        if (search.get('sr_resume') === '1') {
          const requestedPercent = search.has('sr_percent') ? Number(search.get('sr_percent')) : NaN;
          const desired = Number.isFinite(requestedPercent) && requestedPercent >= 0 && requestedPercent <= 100
            ? { scrollPercent: requestedPercent, anchorId: search.get('sr_anchor') }
            : result.progress;
          if (desired) {
            window.setTimeout(function () {
              restoreWhenReady(desired, token, 20);
            }, 300);
          }
        }
      } catch (err) {
        if (generation === token) {
          active = null;
          statusText('阅读记录暂不可用');
          updateDock();
        }
      }
    }

    function onRouteChange() {
      const route = parseWikiRoute();
      const routeKey = window.location.pathname;
      if (routeKey === currentPath) {
        if (active) updateDock();
        return;
      }
      if (active && dirty) flushOnHide();
      if (saveTimer) window.clearTimeout(saveTimer);
      saveTimer = null;
      dirty = false;
      currentPath = routeKey;
      generation++;
      active = null;
      lastSavedAt = 0;
      hidePanel();
      updateDock();
      if (route && route.type === 'article') loadArticle(route.address, generation);
    }

    makeDock();
    onRouteChange();
    window.addEventListener('scroll', function () { if (active && SIGNED_IN) queueSave(); }, { passive: true });
    window.addEventListener('popstate', onRouteChange);
    window.addEventListener('pagehide', flushOnHide);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushOnHide(); });
    // LR Wiki's pages are lazily loaded in Flarum 2's SPA. A small route watcher
    // avoids relying on the wiki's private component exports or DOM lifecycle.
    window.setInterval(onRouteChange, 800);
  });
})();

// Flarum 2.x wraps extension JS with `var module={}` and expects a module export.
// Without this object, Application.bootExtensions() throws reading `.extend`.
module.exports = {};
