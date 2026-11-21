/* StartPro Wiki Reader 0.3.0-beta.1 - Flarum 2.x independent reader extension.
 * Works with LR Wiki's /wiki/:slug routes and .LinkRobinsWiki-articleBody.
 */
(function () {
  'use strict';
  if (typeof app === 'undefined' || !app.initializers) return;

  app.initializers.add('startpro-wiki-reader', function () {
    const PREFIX = 'SPWikiReader';
    const API = (app.forum && app.forum.attribute('apiUrl') || (window.location.origin + '/api')).replace(/\/$/, '') + '/startpro/wiki-reader';
    const BASE = (app.forum && app.forum.attribute('baseUrl') || window.location.origin).replace(/\/$/, '');
    // Flarum executes extension initializers before it constructs app.session.
    // Never snapshot the login state here: inspect it when actions are invoked.
    function signedIn() {
      return !!(app.session && app.session.user);
    }
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
    let restoring = false;
    let saving = false;
    let saveTimer = null;
    let conflict = null;
    let compactOpen = false;
    let undoId = null;
    let libraryRequestId = 0;
    let libraryFilters = { search: '', sort: 'newest', page: 1, perPage: 20 };
    let editingId = null;
    let filterTimer = null;
    let mobileNotice = false;
    let noticeTimer = null;

    // v0.3 reader: private highlighting, explicit book collections, and estimated active reading.
    let panelTab = 'bookmarks';
    let highlightsList = null;
    let highlightsFilter = { search: '', page: 1, perPage: 20 };
    let shelfData = null;
    let statsData = null;
    let chosenText = null;
    let highlightRequestId = 0;
    let activityKey = '';
    let activitySeconds = 0;
    let activitySentSeconds = 0;
    let activityLastTick = Date.now();
    let activityLastInteraction = Date.now();
    let activitySending = false;

    function isAdmin() {
      const user = app.session && app.session.user;
      return !!(user && typeof user.isAdmin === 'function' && user.isAdmin());
    }

    function captureSelection() {
      if (!signedIn() || !active || !active.article || !getBody() ||
          !window.getSelection || !document.createRange) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;
      const quote = normalizeText(selection.toString());
      if (!quote || quote.length > 500) return;
      const range = selection.getRangeAt(0);
      const body = getBody();
      if (!body.contains(range.startContainer) || !body.contains(range.endContainer)) return;
      const blocks = articleBlocks(body);
      let index = -1;
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].contains(range.startContainer) && blocks[i].contains(range.endContainer)) {
          index = i; break;
        }
      }
      if (index < 0) {
        statusText('请先选择同一段落内的文字进行划线');
        return;
      }
      const block = blocks[index];
      let prefixLength = 0;
      try {
        const before = document.createRange();
        before.selectNodeContents(block);
        before.setEnd(range.startContainer, range.startOffset);
        prefixLength = before.toString().length;
      } catch (_) { return; }
      const ratio = Math.max(0, Math.min(1000, Math.round(prefixLength / Math.max(1, block.textContent.length) * 1000)));
      const context = captureContext(blocks, index, ratio, body);
      // Use the user's exact selection as the text quote; whitespace is normalized on the server.
      context.quote.exact = quote.slice(0, 100);
      const selected = { quote, positionContext: context };
      chosenText = selected;
      updateDock();
    }

    function locateHighlightRange(item, body) {
      if (!document.createRange || !document.createTreeWalker) return null;
      const blocks = articleBlocks(body);
      const quote = normalizeText(item.quote || '');
      if (!quote) return null;
      const ctx = item.positionContext || {};
      const remembered = Number(ctx.block && ctx.block.index);
      const ranked = blocks.map((block, idx) => {
        const text = normalizeText(block.textContent);
        const at = text.indexOf(quote);
        return { block, idx, at, rank: at < 0 ? -Infinity : 100 - Math.abs(idx - (Number.isFinite(remembered) ? remembered : idx)) * 0.3 };
      }).filter(x => x.at >= 0).sort((a, b) => b.rank - a.rank);
      if (!ranked.length) return null;
      const found = ranked[0];
      // Browser text nodes may have multiple nested inline spans. Build offsets
      // across all text nodes, without injecting markup into LR Wiki/Mithril DOM.
      const nodeFilter = window.NodeFilter && window.NodeFilter.SHOW_TEXT || 4;
      const walker = document.createTreeWalker(found.block, nodeFilter);
      const raw = String(found.block.textContent || '');
      // Map normalized whitespace back to raw UTF-16 offsets for nested markup.
      // This avoids mismatches when the saved quote collapsed multiple spaces.
      let normalized = '', offsets = [];
      for (let i = 0; i < raw.length; i++) {
        const char = raw.charAt(i);
        if (/\s/.test(char)) {
          if (!normalized || normalized.endsWith(' ')) continue;
          normalized += ' '; offsets.push(i);
        } else {
          normalized += char; offsets.push(i);
        }
      }
      if (normalized.endsWith(' ')) { normalized = normalized.slice(0, -1); offsets.pop(); }
      const offset = normalized.indexOf(quote);
      if (offset < 0) return null;
      const begin = offsets[offset], end = offsets[offset + quote.length - 1] + 1;
      let node, current = 0, startNode = null, endNode = null, startOffset = 0, endOffset = 0;
      while ((node = walker.nextNode())) {
        const length = node.nodeValue && node.nodeValue.length || 0;
        if (startNode === null && begin >= current && begin < current + length) {
          startNode = node; startOffset = begin - current;
        }
        if (end <= current + length && end >= current) {
          endNode = node; endOffset = Math.max(0, end - current); break;
        }
        current += length;
      }
      if (!startNode || !endNode) return null;
      try {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        return range;
      } catch (_) { return null; }
    }

    function renderInlineHighlights() {
      if (!window.CSS || !window.CSS.highlights || !window.Highlight) return;
      try {
        window.CSS.highlights.delete('startpro-wiki-reader');
        if (!active || !active.highlights || !active.highlights.length) return;
        const body = getBody();
        if (!body) return;
        const ranges = active.highlights.map(item => locateHighlightRange(item, body)).filter(Boolean);
        if (ranges.length) window.CSS.highlights.set('startpro-wiki-reader', new window.Highlight(...ranges));
      } catch (_) { /* Highlights are optional progressive enhancement. */ }
    }

    async function saveHighlight() {
      if (!signedIn() || !active || !active.article) return;
      // Selection may collapse when pressing the action button; use cached selection.
      captureSelection();
      const selected = chosenText;
      if (!selected) { statusText('请先在正文中选中一小段文字'); return; }
      chosenText = null;
      const articleId = active.article.id;
      try {
        const result = await apiRequest('POST', API + '/highlights', {
          articleId, quote: selected.quote, positionContext: selected.positionContext, note: ''
        });
        if (active && Number(active.article.id) === Number(articleId)) {
          active.highlights = active.highlights || [];
          active.highlights.unshift(result.highlight);
          renderInlineHighlights();
        }
        statusText('划线已保存，可在「划线笔记」中添加备注');
        if (panelOpen && panelTab === 'highlights') await fetchHighlights();
      } catch (_) { statusText('划线保存失败'); }
    }

    async function updateHighlight(id, note) {
      if (String(note || '').length > 1000) { statusText('笔记最多1000字'); return; }
      try {
        await apiRequest('PATCH', API + '/highlights/' + id, { note: String(note || '') });
        statusText('笔记已保存');
        await fetchHighlights();
      } catch (_) { statusText('笔记保存失败'); }
    }

    async function deleteHighlight(id) {
      try {
        await apiRequest('DELETE', API + '/highlights/' + id);
        if (active && active.highlights) active.highlights = active.highlights.filter(x => x.id !== id);
        renderInlineHighlights();
        statusText('划线已删除');
        await fetchHighlights();
      } catch (_) { statusText('删除失败'); }
    }

    function tabStrip() {
      const nav = element('nav', PREFIX + '-tabs');
      nav.setAttribute('aria-label', '阅读助手内容');
      [['bookmarks', '书签'], ['highlights', '划线笔记'], ['shelf', '我的书架'], ['stats', '阅读统计']].forEach(function (t) {
        const b = button(t[1], PREFIX + '-tab' + (panelTab === t[0] ? ' is-active' : ''), function () {
          openTab(t[0]);
        });
        b.setAttribute('aria-current', panelTab === t[0] ? 'page' : 'false');
        nav.appendChild(b);
      });
      return nav;
    }

    function openTab(tab) {
      if (!dialog || !signedIn()) return;
      panelOpen = true;
      dialog.hidden = false;
      panelTab = tab;
      if (tab === 'bookmarks') { library = null; renderLibrary(); fetchLibrary(); }
      if (tab === 'highlights') { highlightsList = null; renderHighlightsPanel(); fetchHighlights(); }
      if (tab === 'shelf') { shelfData = null; renderShelfPanel(); fetchShelf(); }
      if (tab === 'stats') { statsData = null; renderStatsPanel(); fetchStats(); }
    }

    function renderHighlightsPanel() {
      if (!content) return;
      content.replaceChildren();
      content.appendChild(tabStrip());
      content.appendChild(element('h3', '', '我的划线与个人笔记'));
      const filter = element('input', PREFIX + '-highlightSearch');
      filter.type = 'search'; filter.maxLength = 80;
      filter.placeholder = '搜索划线文字、笔记或文章';
      filter.value = highlightsFilter.search;
      filter.setAttribute('aria-label', '搜索划线笔记');
      filter.addEventListener('change', function () {
        highlightsFilter.search = filter.value.slice(0, 80);
        highlightsFilter.page = 1; fetchHighlights();
      });
      content.appendChild(filter);
      if (!highlightsList) { content.appendChild(element('p', PREFIX + '-muted', '正在加载划线笔记…')); return; }
      const items = highlightsList.highlights || [];
      if (!items.length) content.appendChild(element('p', PREFIX + '-muted', '暂无笔记。选中同一段落内的文字，点击「划线」即可保存。'));
      items.forEach(function (row) {
        const item = row.highlight;
        const box = element('section', PREFIX + '-highlightCard');
        const link = element('a', PREFIX + '-highlightQuote', '“' + item.quote + '”');
        link.href = urlForArticle(row.article, null) + '?sr_highlight=' + encodeURIComponent(item.id);
        box.appendChild(link);
        box.appendChild(element('small', PREFIX + '-rowDetail', row.article.title));
        const input = element('textarea', PREFIX + '-highlightNote');
        input.maxLength = 1000; input.rows = 2; input.value = item.note || '';
        input.placeholder = '给这段划线写一条私人笔记（仅自己可见）';
        input.setAttribute('aria-label', '划线笔记');
        box.appendChild(input);
        const actions = element('div', PREFIX + '-rowActions');
        actions.appendChild(button('保存笔记', PREFIX + '-saveNote', function () { updateHighlight(item.id, input.value); }));
        actions.appendChild(button('删除划线', PREFIX + '-deleteHighlight', function () { deleteHighlight(item.id); }));
        box.appendChild(actions); content.appendChild(box);
      });
      const page = highlightsList.pagination || { page: 1, lastPage: 1, hasMore: false };
      const paging = element('div', PREFIX + '-paging');
      const prev = button('上一页', '', function () { if (highlightsFilter.page > 1) { highlightsFilter.page--; fetchHighlights(); } });
      prev.disabled = page.page <= 1;
      const next = button('下一页', '', function () { if (page.hasMore) { highlightsFilter.page++; fetchHighlights(); } });
      next.disabled = !page.hasMore;
      paging.appendChild(prev); paging.appendChild(element('span', '', '第 ' + page.page + ' / ' + Math.max(1, page.lastPage) + ' 页'));
      paging.appendChild(next); content.appendChild(paging);
    }

    async function fetchHighlights() {
      const token = ++highlightRequestId;
      const f = highlightsFilter;
      try {
        const data = await apiRequest('GET', API + '/highlights?page=' + f.page + '&perPage=' + f.perPage + '&search=' + encodeURIComponent(f.search));
        if (token !== highlightRequestId) return;
        highlightsList = data;
        if (panelOpen && panelTab === 'highlights') renderHighlightsPanel();
      } catch (_) { statusText('划线笔记加载失败'); }
    }

    function renderShelfPanel() {
      if (!content) return;
      content.replaceChildren(); content.appendChild(tabStrip());
      content.appendChild(element('h3', '', '我的书架'));
      if (!shelfData) { content.appendChild(element('p', PREFIX + '-muted', '正在加载书籍与章节…')); return; }
      const books = shelfData.books || [];
      if (!books.length) content.appendChild(element('p', PREFIX + '-muted', '暂无编排好的书籍。管理员可在下方创建书籍并关联 Wiki 文章。'));
      books.forEach(function (book) {
        const card = element('section', PREFIX + '-bookCard');
        const heading = element('strong', '', book.title);
        card.appendChild(heading);
        if (book.description) card.appendChild(element('p', PREFIX + '-muted', book.description));
        card.appendChild(element('small', PREFIX + '-rowDetail', '已完成 ' + book.chaptersCompleted + ' / ' + book.chaptersTotal + ' 篇章节（手动标记）'));
        const meter = element('div', PREFIX + '-meter');
        const fill = element('div', PREFIX + '-meterFill');
        fill.style.width = (book.chaptersTotal ? Math.round(book.chaptersCompleted / book.chaptersTotal * 100) : 0) + '%';
        meter.appendChild(fill); card.appendChild(meter);
        (book.chapters || []).forEach(function (chapter) {
          card.appendChild(chapterRow(chapter));
        });
        content.appendChild(card);
      });
      const solos = shelfData.standalone || [];
      if (solos.length) {
        content.appendChild(element('h3', '', '独立长文（未归入书籍）'));
        solos.forEach(function (item) { content.appendChild(chapterRow(item)); });
      }
      if (shelfData.isAdmin) renderAdminBookTools();
    }

    function chapterRow(item) {
      const article = item.article;
      const row = element('div', PREFIX + '-chapterRow');
      const a = element('a', PREFIX + '-rowLink', article.title);
      a.href = urlForArticle(article, item.progress || null);
      row.appendChild(a);
      const check = button(item.completed ? '✓ 已读完' : '○ 标为读完', PREFIX + '-completeSmall', function () {
        setCompleted(article.id, !item.completed);
      });
      row.appendChild(check);
      return row;
    }

    function renderAdminBookTools() {
      const admin = element('section', PREFIX + '-bookAdmin');
      admin.appendChild(element('h3', '', '管理员：书籍和章节编排'));
      admin.appendChild(element('p', PREFIX + '-muted', '书籍必须显式创建；不会自动将整个 Wiki 分类当成一本书。'));
      const name = element('input', PREFIX + '-newBookTitle');
      name.placeholder = '新书名称'; name.maxLength = 160;
      admin.appendChild(name);
      admin.appendChild(button('创建书籍', '', async function () {
        const title = name.value.trim();
        if (!title) { statusText('请填写书名'); return; }
        try { await apiRequest('POST', API + '/books', { title, description: '' }); statusText('书籍已创建'); await fetchShelf(); }
        catch (_) { statusText('创建书籍失败'); }
      }));
      if (active && active.article && shelfData.books && shelfData.books.length) {
        const select = element('select', PREFIX + '-bookSelector');
        select.setAttribute('aria-label', '选择目标书籍');
        shelfData.books.forEach(function (book) {
          const option = element('option', '', book.title);
          option.value = String(book.id); select.appendChild(option);
        });
        if (active.bookId) select.value = String(active.bookId);
        admin.appendChild(select);
        const order = element('input', PREFIX + '-chapterPosition');
        order.type = 'number'; order.min = '0'; order.max = '100000'; order.value = '10';
        order.setAttribute('aria-label', '章节排序序号'); admin.appendChild(order);
        admin.appendChild(button('将当前文章设为章节', '', async function () {
          const id = Number(select.value);
          try {
            await apiRequest('POST', API + '/books/' + id + '/chapters', {
              articleId: active.article.id, position: Number(order.value)
            });
            active.bookId = id; statusText('当前 Wiki 文章已关联到书籍'); await fetchShelf();
          } catch (_) { statusText('关联失败；如已归属其他书籍，请先移除原关联'); }
        }));
        if (active.bookId) admin.appendChild(button('从当前书籍移除此文章', '', async function () {
          try {
            await apiRequest('DELETE', API + '/books/' + active.bookId + '/chapters/' + active.article.id);
            active.bookId = null; statusText('章节关联已移除，文章正文未删除'); await fetchShelf();
          } catch (_) { statusText('移除关联失败'); }
        }));
      }
      content.appendChild(admin);
    }

    async function fetchShelf() {
      try {
        const data = await apiRequest('GET', API + '/shelf');
        shelfData = data;
        if (panelOpen && panelTab === 'shelf') renderShelfPanel();
      } catch (_) { statusText('书架加载失败'); }
    }

    async function setCompleted(articleId, done) {
      try {
        await apiRequest(done ? 'POST' : 'DELETE', API + '/completions/' + articleId);
        if (active && Number(active.article.id) === Number(articleId)) active.completed = done;
        statusText(done ? '已标记为读完（手动）' : '已取消完成标记');
        updateDock();
        if (panelOpen && panelTab === 'shelf') await fetchShelf();
      } catch (_) { statusText('更新章节完成状态失败'); }
    }

    function renderStatsPanel() {
      if (!content) return;
      content.replaceChildren(); content.appendChild(tabStrip());
      content.appendChild(element('h3', '', '个人阅读统计'));
      if (!statsData) { content.appendChild(element('p', PREFIX + '-muted', '正在加载统计…')); return; }
      const stats = statsData.stats || {};
      const grid = element('div', PREFIX + '-statsGrid');
      const duration = seconds => {
        const hours = Math.floor(Number(seconds || 0) / 3600);
        const minutes = Math.floor(Number(seconds || 0) % 3600 / 60);
        return hours ? hours + '小时 ' + minutes + '分钟' : minutes + '分钟';
      };
      [
        ['估算专注阅读时间', duration(stats.estimatedReadingSeconds)],
        ['最近30天阅读时间', duration(stats.estimatedLast30DaysSeconds)],
        ['最近30天活跃天数', String(stats.activeDaysLast30 || 0) + '天'],
        ['读过的文章', String(stats.articlesVisited || 0)],
        ['手动标记读完', String(stats.articlesCompleted || 0)],
        ['我的书签', String(stats.bookmarks || 0)],
        ['我的划线', String(stats.highlights || 0)]
      ].forEach(function (pair) {
        const tile = element('div', PREFIX + '-statTile');
        tile.appendChild(element('strong', '', pair[1]));
        tile.appendChild(element('small', '', pair[0]));
        grid.appendChild(tile);
      });
      content.appendChild(grid);
      content.appendChild(element('p', PREFIX + '-muted', '阅读时间按浏览器可见、最近有操作的阅读时段估算；仅从 v0.3 开始记录，不包含历史阅读时长。章节完成状态由读者手动标记，并非根据滚动百分比推断。'));
    }

    async function fetchStats() {
      try {
        statsData = await apiRequest('GET', API + '/stats');
        if (panelOpen && panelTab === 'stats') renderStatsPanel();
      } catch (_) { statusText('阅读统计加载失败'); }
    }

    function newActivitySession() {
      activityKey = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 18);
      activitySeconds = 0; activitySentSeconds = 0;
      activityLastTick = Date.now(); activityLastInteraction = Date.now();
    }

    function trackInteraction() { activityLastInteraction = Date.now(); }

    function tickReadingActivity() {
      if (!signedIn() || !active || !active.article || !getBody()) return;
      const now = Date.now();
      if (now - activityLastTick < 15000) return;
      const delta = Math.min(15, Math.floor((now - activityLastTick) / 1000));
      activityLastTick = now;
      if (document.visibilityState === 'hidden' || now - activityLastInteraction > 120000) return;
      activitySeconds = Math.min(14400, activitySeconds + Math.max(0, delta));
      if (activitySeconds >= 14400) newActivitySession();
      else if (activitySeconds - activitySentSeconds >= 30) syncReadingActivity();
    }

    async function syncReadingActivity() {
      if (!activityKey || !signedIn() || !active || !active.article || activitySending || activitySeconds <= activitySentSeconds) return;
      const key = activityKey, seconds = activitySeconds, articleId = active.article.id;
      activitySending = true;
      try {
        await apiRequest('POST', API + '/activity/' + articleId, { sessionKey: key, activeSeconds: seconds });
        if (activityKey === key) activitySentSeconds = Math.max(activitySentSeconds, seconds);
      } catch (_) { /* Retry next interval; statistics are best-effort. */ }
      finally { activitySending = false; }
    }

    function flushReadingActivity() {
      if (!activityKey || !signedIn() || !active || !active.article || activitySeconds <= activitySentSeconds ||
          !app.session || !app.session.csrfToken || typeof fetch !== 'function') return;
      fetch(API + '/activity/' + active.article.id, {
        method: 'POST', credentials: 'same-origin', keepalive: true,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': app.session.csrfToken },
        body: JSON.stringify({ sessionKey: activityKey, activeSeconds: activitySeconds })
      }).catch(function () {});
    }

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

    function urlForArticle(article, point, isBookmark) {
      const slug = article.slug || String(article.id);
      const url = BASE + '/wiki/' + encodeURIComponent(slug);
      if (isBookmark && point && point.id) return url + '?sr_bookmark=' + encodeURIComponent(point.id);
      if (point) {
        // Keep the old query params for pre-v0.2 links; current progress is
        // recovered server-side so the URL does not expose paragraph quotes.
        return url + '?sr_resume=1';
      }
      return url;
    }

    function getBody() {
      return document.querySelector('.LinkRobinsWiki-articleBody');
    }

    // Stable block-order anchors survive phone/desktop reflow. LR Wiki renders
    // identical article HTML on both devices, but paragraphs have different
    // heights, making document-wide scroll percentages unreliable.
    const BLOCKS = 'h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,table';

    function articleBlocks(body) {
      return Array.from(body.querySelectorAll(BLOCKS)).filter(function (el) {
        // For nested <li><p>...</p></li>, only count the outer block.
        const parentBlock = el.parentElement && el.parentElement.closest(BLOCKS);
        return !parentBlock || !body.contains(parentBlock);
      });
    }

    function normalizeText(value) {
      return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function nearestHeading(block, body) {
      if (!block) return null;
      const nodes = Array.from(body.querySelectorAll('h1,h2,h3,h4,h5,h6'));
      let prev = null;
      const blockTop = block.getBoundingClientRect().top;
      for (const h of nodes) {
        if (h.getBoundingClientRect().top <= blockTop + 1) prev = h;
        else break;
      }
      return prev && prev.id || null;
    }

    function captureContext(blocks, index, ratio, body) {
      const block = blocks[index];
      if (!block) return null;
      const text = normalizeText(block.textContent);
      const middle = Math.min(text.length, Math.max(0, Math.round(text.length * ratio / 1000)));
      const start = Math.max(0, Math.min(text.length - 1, middle - 36));
      const exact = text.slice(start, start + 72);
      return {
        v: 1,
        quote: { exact, prefix: text.slice(Math.max(0, start - 36), start), suffix: text.slice(start + exact.length, start + exact.length + 36) },
        block: { index, ratio, preview: text.slice(0, 140) },
        heading: nearestHeading(block, body)
      };
    }

    function snapshot() {
      const body = getBody();
      if (!body || !active || !active.article) return null;
      const rect = body.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const viewY = Math.min(window.innerHeight * 0.28, 180);
      const target = window.scrollY + viewY;
      const length = Math.max(1, body.scrollHeight);
      const percent = clamp(((target - top) / length) * 100);
      const blocks = articleBlocks(body);
      let chosen = null;
      let chosenIndex = -1;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i].getBoundingClientRect();
        if (b.height <= 0) continue;
        if (b.top <= viewY) {
          chosen = blocks[i]; chosenIndex = i;
          if (b.bottom >= viewY) break;
        } else if (!chosen) {
          chosen = blocks[i]; chosenIndex = i; break;
        } else break;
      }
      let anchorId = null;
      let positionContext = null;
      if (chosen && chosenIndex >= 0) {
        const b = chosen.getBoundingClientRect();
        const inside = Math.max(0, Math.min(1000, Math.round((viewY - b.top) / Math.max(1, b.height) * 1000)));
        anchorId = 'srp-' + active.article.id + '-' + chosenIndex + '-' + inside;
        positionContext = captureContext(blocks, chosenIndex, inside, body);
      }
      const text = chosen ? normalizeText(chosen.textContent) : '';
      return {
        scrollPercent: percent,
        anchorId,
        positionContext,
        label: text ? (text.slice(0, 52) + (text.length > 52 ? '…' : '')) : (active.article.title || '当前位置')
      };
    }

    function statusText(text) {
      if (status) status.textContent = text;
      // A collapsed phone toolbar otherwise hides success/error feedback.
      if (isCompact() && /(书签|失败|其他设备|撤销|覆盖)/.test(String(text || ''))) {
        mobileNotice = true;
        updateDock();
        if (noticeTimer) window.clearTimeout(noticeTimer);
        noticeTimer = window.setTimeout(function () {
          mobileNotice = false; noticeTimer = null; updateDock();
        }, 3200);
      }
    }

    function apiRequest(method, url, body) {
      // Flarum's request helper provides CSRF token and same-session credentials.
      const params = {
        method: method, url: url, background: true,
        // 409 is an expected optimistic-concurrency outcome. Handle it in our
        // toolbar instead of showing Flarum's generic forum-wide error alert.
        errorHandler: function (err) { return Number(err && err.status) === 409 ? true : false; }
      };
      if (body !== undefined) params.body = body;
      return app.request(params);
    }

    function queueSave() {
      if (restoring || conflict || !signedIn() || !active || !active.article || !getBody()) return;
      dirty = true;
      if (saveTimer) return;
      saveTimer = window.setTimeout(function () {
        saveTimer = null;
        persistProgress();
      }, Math.max(500, SAVE_INTERVAL - (Date.now() - lastSavedAt)));
    }

    async function resolveConflict(point, token) {
      if (!active || generation !== token) return;
      const localPoint = point;
      try {
        const latest = await apiRequest('GET', API + '/article?address=' + encodeURIComponent(active.article.slug || active.article.id));
        if (!active || generation !== token) return;
        active.progress = latest.progress || null;
      } catch (_) { /* The safe default is not to overwrite. */ }
      conflict = { local: localPoint, articleId: active.article.id };
      dirty = false;
      statusText('其他设备已有新进度，已暂停自动覆盖');
      updateDock();
    }

    async function persistProgress(force) {
      if (saving || (!dirty && !force) || !signedIn() || !active || !active.article) return;
      if (conflict && !force) return;
      const point = force && conflict ? (snapshot() || conflict.local) : snapshot();
      if (!point) return;
      const articleId = active.article.id;
      const expectedVersion = active.progress ? Number(active.progress.version || 1) : 0;
      const thisGeneration = generation;
      dirty = false;
      saving = true;
      try {
        const result = await apiRequest('POST', API + '/progress/' + articleId,
          Object.assign({}, point, { expectedVersion, force: !!force }));
        lastSavedAt = Date.now();
        if (active && generation === thisGeneration) {
          active.progress = result.progress || Object.assign({}, point, { version: expectedVersion + 1 });
          conflict = null;
          statusText('阅读进度已同步');
          updateDock();
        }
      } catch (err) {
        if (active && generation === thisGeneration) {
          const code = Number(err && (err.status || err.statusCode || err.response?.status || err.response?.statusCode));
          if (code === 409) await resolveConflict(point, thisGeneration);
          else {
            dirty = true;
            statusText('保存失败，稍后滚动时重试');
          }
        }
      } finally {
        saving = false;
        if (dirty && !conflict && active && generation === thisGeneration && !saveTimer) queueSave();
      }
    }

    function flushOnHide() {
      if (!dirty || saving || conflict || !active || !signedIn() || !app.session || !app.session.csrfToken) return;
      const point = snapshot();
      if (!point) return;
      const expectedVersion = active.progress ? Number(active.progress.version || 1) : 0;
      dirty = false;
      // The server checks expectedVersion even for keepalive writes; stale
      // hidden tabs cannot overwrite a newer position from another device.
      fetch(API + '/progress/' + active.article.id, {
        method: 'POST', credentials: 'same-origin', keepalive: true,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': app.session.csrfToken },
        body: JSON.stringify(Object.assign({}, point, { expectedVersion }))
      }).then(function (resp) {
        if (resp && resp.status === 409 && active) {
          conflict = { local: point, articleId: active.article.id };
          statusText('其他设备已更新，进度未被覆盖');
          updateDock();
        }
      }).catch(function () {});
    }

    function findTextMatch(point, body) {
      const context = point.positionContext;
      if (!context || !context.quote || !context.block) return null;
      const blocks = articleBlocks(body);
      const exact = normalizeText(context.quote.exact);
      const preview = normalizeText(context.block.preview);
      const oldIndex = Number(context.block.index);
      const ratio = Number(context.block.ratio);
      let best = null;
      let score = -Infinity;
      for (let i = 0; i < blocks.length; i++) {
        const text = normalizeText(blocks[i].textContent);
        if (!text) continue;
        const matchAt = exact ? text.indexOf(exact) : -1;
        const previewAt = preview ? text.indexOf(preview.slice(0, 32)) : -1;
        if (matchAt < 0 && previewAt < 0) continue;
        let currentScore = matchAt >= 0 ? 100 : 25;
        if (matchAt >= 0) {
          const prefix = normalizeText(context.quote.prefix);
          const suffix = normalizeText(context.quote.suffix);
          if (prefix && text.slice(Math.max(0, matchAt - prefix.length), matchAt) === prefix) currentScore += 12;
          if (suffix && text.slice(matchAt + exact.length, matchAt + exact.length + suffix.length) === suffix) currentScore += 12;
        }
        if (Number.isFinite(oldIndex)) currentScore -= Math.abs(i - oldIndex) * 0.12;
        if (currentScore > score) {
          best = { block: blocks[i], fraction: matchAt >= 0
            ? Math.min(1, (matchAt + exact.length / 2) / Math.max(1, text.length))
            : (Number.isFinite(ratio) ? ratio / 1000 : 0) };
          score = currentScore;
        }
      }
      return best;
    }

    function restorePoint(point) {
      if (!point) return false;
      const body = getBody();
      if (!body) return false;
      const viewY = Math.min(window.innerHeight * 0.28, 180);
      let y = NaN;
      // Strongest selector: text quote + surrounding context. A new paragraph
      // inserted above the bookmark does not change the target text.
      const found = findTextMatch(point, body);
      if (found) {
        const b = found.block.getBoundingClientRect();
        y = b.top + window.scrollY + b.height * found.fraction - viewY;
      }
      // Next: an existing heading id (stable if the wiki keeps this heading).
      if (!Number.isFinite(y) && point.positionContext && point.positionContext.heading) {
        const heading = document.getElementById(point.positionContext.heading);
        if (heading && body.contains(heading)) y = heading.getBoundingClientRect().top + window.scrollY - viewY;
      }
      // beta.5 block-order locator (also retained for existing beta.5 data).
      const match = typeof point.anchorId === 'string' && /^srp-(\d+)-(\d+)-(\d{1,4})$/.exec(point.anchorId);
      if (!Number.isFinite(y) && match && active && active.article && Number(match[1]) === Number(active.article.id)) {
        const block = articleBlocks(body)[Number(match[2])];
        if (block && Number(match[3]) <= 1000) {
          const b = block.getBoundingClientRect();
          y = b.top + window.scrollY + b.height * Number(match[3]) / 1000 - viewY;
        }
      }
      // beta.4 heading ids, followed by legacy whole-article percentage.
      if (!Number.isFinite(y) && point.anchorId && !match) {
        const heading = document.getElementById(point.anchorId);
        if (heading && body.contains(heading)) y = heading.getBoundingClientRect().top + window.scrollY - viewY;
      }
      const percent = Number(point.scrollPercent);
      if (!Number.isFinite(y) && Number.isFinite(percent) && percent >= 0 && percent <= 100) {
        y = body.getBoundingClientRect().top + window.scrollY + body.scrollHeight * (percent / 100) - viewY;
      }
      if (!Number.isFinite(y)) return false;
      window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
      statusText(found ? '已定位到原文段落' : '已恢复阅读位置');
      return true;
    }

    function restoreWhenReady(point, token, attempts) {
      if (generation !== token || attempts <= 0) {
        restoring = false;
        return;
      }
      const body = getBody();
      if (!body || !body.textContent || !body.textContent.trim() || body.scrollHeight < 30) {
        window.setTimeout(function () { restoreWhenReady(point, token, attempts - 1); }, 200);
        return;
      }
      restoring = true;
      // Flarum mounts Wiki content asynchronously. Allow the layout and
      // heading ids to settle before attempting to scroll.
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          if (generation === token) { restorePoint(point); renderInlineHighlights(); }
          window.setTimeout(function () { restoring = false; }, 700);
        });
      });
    }

    function button(text, className, handler) {
      const btn = element('button', PREFIX + '-button ' + (className || ''), text);
      btn.type = 'button';
      btn.addEventListener('click', handler);
      return btn;
    }

    function isCompact() {
      return Number(window.innerWidth || 1024) <= 640;
    }

    function makeDock() {
      toolbar = element('div', PREFIX + '-dock');
      const openButton = button('📖 我的阅读', PREFIX + '-mainButton', function () {
        if (isCompact()) {
          compactOpen = !compactOpen;
          updateDock();
        } else showLibrary();
      });
      openButton.setAttribute('aria-label', '打开阅读助手');
      toolbar.appendChild(openButton);
      toolbar.appendChild(button('📚 查看记录', PREFIX + '-libraryButton', function () {
        compactOpen = false; showLibrary(); updateDock();
      }));
      const bookmarkButton = button('☆ 添加书签', PREFIX + '-markButton', function () {
        compactOpen = false; addBookmark(); updateDock();
      });
      bookmarkButton.title = '收藏当前章节的阅读位置';
      toolbar.appendChild(bookmarkButton);
      const highlightButton = button('✍ 划线', PREFIX + '-highlightButton', function () {
        compactOpen = false; saveHighlight(); updateDock();
      });
      highlightButton.title = '先选中同一段落中的文字，再添加划线';
      toolbar.appendChild(highlightButton);
      toolbar.appendChild(button('📚 我的书架', PREFIX + '-shelfButton', function () {
        compactOpen = false; openTab('shelf'); updateDock();
      }));
      toolbar.appendChild(button('✓ 标为读完', PREFIX + '-completeButton', function () {
        compactOpen = false;
        if (active && active.article) setCompleted(active.article.id, !active.completed);
        updateDock();
      }));
      const resumeButton = button('↪ 继续阅读', PREFIX + '-resumeButton', function () {
        compactOpen = false;
        if (active && active.progress) restorePoint(active.progress);
        updateDock();
      });
      toolbar.appendChild(resumeButton);
      toolbar.appendChild(button('↥ 保留本机进度', PREFIX + '-conflictButton', function () {
        if (conflict && active && active.article && conflict.articleId === active.article.id) {
          persistProgress(true);
        }
      }));
      status = element('span', PREFIX + '-status', '');
      status.setAttribute('aria-live', 'polite');
      toolbar.appendChild(status);
      document.body.appendChild(toolbar);
      if (document.head && !document.getElementById('startpro-wiki-highlight-style')) {
        const sheet = document.createElement('style');
        sheet.id = 'startpro-wiki-highlight-style';
        sheet.textContent = '::highlight(startpro-wiki-reader) { background-color: rgba(255,194,76,0.42); color: inherit; }';
        document.head.appendChild(sheet);
      }

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
      toolbar.hidden = !route;
      if (!route) hidePanel();
      toolbar.className = PREFIX + '-dock' + (compactOpen ? ' is-expanded' : '') + (mobileNotice ? ' has-notice' : '');
      const markBtn = toolbar.querySelector('.' + PREFIX + '-markButton');
      const resumeBtn = toolbar.querySelector('.' + PREFIX + '-resumeButton');
      const conflictBtn = toolbar.querySelector('.' + PREFIX + '-conflictButton');
      markBtn.hidden = !signedIn() || !active || !active.article || !getBody();
      resumeBtn.hidden = !active || !active.progress || !getBody();
      conflictBtn.hidden = !conflict || !active || conflict.articleId !== active.article.id;
      const hlBtn = toolbar.querySelector('.' + PREFIX + '-highlightButton');
      const completeBtn = toolbar.querySelector('.' + PREFIX + '-completeButton');
      hlBtn.hidden = !signedIn() || !active || !getBody();
      completeBtn.hidden = !signedIn() || !active || !getBody();
      completeBtn.textContent = active && active.completed ? '↶ 取消读完' : '✓ 标为读完';
      toolbar.querySelector('.' + PREFIX + '-mainButton').setAttribute('aria-expanded', compactOpen ? 'true' : 'false');
    }

    function hidePanel() {
      if (!dialog) return;
      dialog.hidden = true;
      panelOpen = false;
      editingId = null;
    }

    function listRow(article, point, note, bookmark) {
      const row = element('div', PREFIX + '-row');
      const summary = element('div', PREFIX + '-rowSummary');
      const a = element('a', PREFIX + '-rowLink');
      a.href = urlForArticle(article, point, !!bookmark);
      a.appendChild(element('span', PREFIX + '-rowTitle', bookmark ? point.label : (article.title || 'Wiki 文章')));
      a.appendChild(element('small', PREFIX + '-rowDetail', note));
      summary.appendChild(a);
      if (bookmark && point.note) summary.appendChild(element('span', PREFIX + '-rowNote', point.note));
      row.appendChild(summary);
      if (bookmark) {
        const actions = element('div', PREFIX + '-rowActions');
        actions.appendChild(button('编辑', PREFIX + '-editButton', function () {
          editingId = point.id; renderLibrary();
        }));
        actions.appendChild(button('删除', PREFIX + '-delete', function () { removeBookmark(point.id); }));
        row.appendChild(actions);
        if (editingId === point.id) {
          const form = element('form', PREFIX + '-editForm');
          const labelInput = element('input', PREFIX + '-editLabel');
          labelInput.type = 'text'; labelInput.maxLength = 120; labelInput.value = point.label || '';
          labelInput.setAttribute('aria-label', '书签名称');
          const noteInput = element('textarea', PREFIX + '-editNote');
          noteInput.maxLength = 1000; noteInput.value = point.note || '';
          noteInput.rows = 3; noteInput.placeholder = '添加个人备注（最多1000字）';
          noteInput.setAttribute('aria-label', '书签备注');
          form.appendChild(labelInput); form.appendChild(noteInput);
          const controls = element('div', PREFIX + '-editActions');
          const saveButton = button('保存修改', PREFIX + '-saveEdit', function () {
            updateBookmark(point.id, labelInput.value, noteInput.value);
          });
          controls.appendChild(saveButton);
          controls.appendChild(button('取消', PREFIX + '-cancelEdit', function () {
            editingId = null; renderLibrary();
          }));
          form.appendChild(controls);
          form.addEventListener('submit', function (event) {
            if (event && event.preventDefault) event.preventDefault();
            updateBookmark(point.id, labelInput.value, noteInput.value);
          });
          row.appendChild(form);
        }
      }
      return row;
    }

    function makeFilters() {
      const container = element('div', PREFIX + '-filters');
      const input = element('input', PREFIX + '-search');
      input.type = 'search'; input.maxLength = 80;
      input.placeholder = '搜索书签名称、备注、文章';
      input.value = libraryFilters.search;
      input.setAttribute('aria-label', '搜索我的书签');
      input.addEventListener('input', function () {
        libraryFilters.search = input.value.slice(0, 80);
        libraryFilters.page = 1;
        if (filterTimer) window.clearTimeout(filterTimer);
        filterTimer = window.setTimeout(function () { filterTimer = null; fetchLibrary(); }, 350);
      });
      container.appendChild(input);
      const sort = element('select', PREFIX + '-sort');
      sort.setAttribute('aria-label', '排序方式');
      [['newest', '最新添加'], ['oldest', '最早添加'], ['title', '按名称']].forEach(function (item) {
        const option = element('option', '', item[1]); option.value = item[0]; sort.appendChild(option);
      });
      sort.value = libraryFilters.sort;
      sort.addEventListener('change', function () {
        libraryFilters.sort = sort.value;
        libraryFilters.page = 1;
        fetchLibrary();
      });
      container.appendChild(sort);
      return container;
    }

    function renderLibrary() {
      if (panelTab === 'highlights') { renderHighlightsPanel(); return; }
      if (panelTab === 'shelf') { renderShelfPanel(); return; }
      if (panelTab === 'stats') { renderStatsPanel(); return; }
      if (!content) return;
      content.replaceChildren();
      content.appendChild(tabStrip());
      if (!signedIn()) {
        content.appendChild(element('p', PREFIX + '-muted', '登录论坛后，可在不同设备间同步书签和阅读进度。'));
        return;
      }
      if (undoId !== null) {
        const undo = element('div', PREFIX + '-undo');
        undo.appendChild(element('span', '', '书签已删除（10分钟内可撤销）'));
        undo.appendChild(button('撤销删除', PREFIX + '-undoButton', function () { restoreBookmark(undoId); }));
        content.appendChild(undo);
      }
      if (!library) {
        content.appendChild(element('p', PREFIX + '-muted', '正在加载阅读记录…'));
        return;
      }
      const recent = library.recent || [];
      const marks = library.bookmarks || [];
      const page = library.pagination || { page: 1, lastPage: 1, total: marks.length, hasMore: false };
      content.appendChild(element('h3', '', '最近阅读'));
      if (recent.length === 0) content.appendChild(element('p', PREFIX + '-muted', '还没有阅读记录。打开一本 Wiki 文章即可开始记录。'));
      recent.forEach(function (rec) {
        const percent = Number(rec.progress.scrollPercent || 0);
        content.appendChild(listRow(rec.article, rec.progress, '继续阅读 · 约 ' + Math.round(percent) + '%', false));
      });
      content.appendChild(element('h3', '', '我的书签 (' + page.total + ')'));
      content.appendChild(makeFilters());
      if (marks.length === 0) content.appendChild(element('p', PREFIX + '-muted',
        libraryFilters.search ? '没有找到符合条件的书签。' : '阅读文章时点击「添加书签」即可保存当前位置。'));
      marks.forEach(function (rec) {
        content.appendChild(listRow(rec.article, rec.bookmark, rec.article.title || 'Wiki 文章', true));
      });
      const paging = element('div', PREFIX + '-paging');
      const prev = button('上一页', PREFIX + '-pagePrev', function () {
        if (libraryFilters.page > 1) { libraryFilters.page--; fetchLibrary(); }
      });
      prev.disabled = page.page <= 1;
      paging.appendChild(prev);
      paging.appendChild(element('span', '', '第 ' + page.page + ' / ' + Math.max(1, page.lastPage) + ' 页'));
      const next = button('下一页', PREFIX + '-pageNext', function () {
        if (page.hasMore) { libraryFilters.page++; fetchLibrary(); }
      });
      next.disabled = !page.hasMore;
      paging.appendChild(next);
      content.appendChild(paging);
    }

    async function fetchLibrary() {
      const requestId = ++libraryRequestId;
      const filters = libraryFilters;
      const url = API + '?page=' + filters.page + '&perPage=' + filters.perPage +
        '&sort=' + encodeURIComponent(filters.sort) + '&search=' + encodeURIComponent(filters.search);
      try {
        const result = await apiRequest('GET', url);
        if (requestId !== libraryRequestId) return;
        library = result;
        if (panelOpen) renderLibrary();
      } catch (err) {
        if (requestId !== libraryRequestId) return;
        statusText('阅读记录加载失败');
        if (panelOpen) {
          content.replaceChildren();
          content.appendChild(element('p', PREFIX + '-muted', '加载失败，请关闭面板后重试。'));
        }
      }
    }

    async function showLibrary() {
      if (!dialog) return;
      panelTab = 'bookmarks';
      panelOpen = true;
      dialog.hidden = false;
      library = null;
      renderLibrary();
      if (signedIn()) await fetchLibrary();
    }

    async function addBookmark() {
      if (!signedIn() || !active || !getBody()) return;
      const point = snapshot();
      if (!point) return;
      try {
        await apiRequest('POST', API + '/bookmarks', {
          articleId: active.article.id,
          scrollPercent: point.scrollPercent,
          anchorId: point.anchorId,
          positionContext: point.positionContext,
          label: point.label.slice(0, 120),
          note: ''
        });
        statusText('书签已添加，可在“我的阅读”中修改名称和备注');
        if (panelOpen) await fetchLibrary();
      } catch (e) {
        statusText('添加书签失败，请重新尝试');
      }
    }

    async function updateBookmark(id, label, note) {
      if (!signedIn()) return;
      if (!String(label || '').trim()) { statusText('书签名称不能为空'); return; }
      if (String(note || '').length > 1000) { statusText('备注不能超过1000字'); return; }
      try {
        await apiRequest('PATCH', API + '/bookmarks/' + encodeURIComponent(String(id)),
          { label: String(label).trim(), note: String(note || '') });
        editingId = null;
        statusText('书签修改已保存');
        await fetchLibrary();
      } catch (err) { statusText('编辑失败，请重试'); }
    }

    async function removeBookmark(id) {
      if (!signedIn()) return;
      try {
        await apiRequest('DELETE', API + '/bookmarks/' + encodeURIComponent(String(id)));
        undoId = id;
        editingId = null;
        statusText('书签已删除，10分钟内可撤销');
        await fetchLibrary();
      } catch (e) { statusText('删除书签失败'); }
    }

    async function restoreBookmark(id) {
      if (!signedIn()) return;
      try {
        await apiRequest('POST', API + '/bookmarks/' + encodeURIComponent(String(id)) + '/restore');
        undoId = null;
        statusText('书签已恢复');
        await fetchLibrary();
      } catch (e) { statusText('撤销失败，可能已超过10分钟'); undoId = null; renderLibrary(); }
    }

    async function loadArticle(address, token) {
      try {
        const result = await apiRequest('GET', API + '/article?address=' + encodeURIComponent(address));
        if (generation !== token) return;
        active = result;
        conflict = null;
        updateDock();
        window.setTimeout(function () { if (generation === token) renderInlineHighlights(); }, 450);
        if (signedIn() && !result.progress) {
          window.setTimeout(function () { if (generation === token) queueSave(); }, 2200);
        }
        const search = new URLSearchParams(window.location.search);
        let desired = result.progress;
        const highlightId = Number(search.get('sr_highlight'));
        if (Number.isInteger(highlightId) && highlightId > 0 && signedIn()) {
          try {
            const savedHighlight = await apiRequest('GET', API + '/highlights/' + highlightId);
            if (generation !== token) return;
            if (savedHighlight.highlight && savedHighlight.highlight.articleId === active.article.id) {
              const hl = savedHighlight.highlight;
              desired = { positionContext: hl.positionContext, scrollPercent: 0 };
            }
          } catch (_) { statusText('无法读取指定划线，已使用最近进度'); }
        }
        const bookmarkId = Number(search.get('sr_bookmark'));
        if (!(Number.isInteger(highlightId) && highlightId > 0) && Number.isInteger(bookmarkId) && bookmarkId > 0 && signedIn()) {
          try {
            const saved = await apiRequest('GET', API + '/bookmarks/' + bookmarkId);
            if (generation !== token) return;
            if (saved.bookmark && saved.bookmark.articleId === active.article.id) desired = saved.bookmark;
          } catch (err) { statusText('无法读取指定书签，已使用最近进度'); }
        } else if (!(Number.isInteger(highlightId) && highlightId > 0) && search.get('sr_resume') === '1') {
          // Legacy bookmarks before v0.2 used percent + anchor in the URL.
          const pct = search.has('sr_percent') ? Number(search.get('sr_percent')) : NaN;
          const anchor = search.get('sr_anchor');
          if ((Number.isFinite(pct) && pct >= 0 && pct <= 100) || anchor) {
            desired = { scrollPercent: pct, anchorId: anchor };
          }
        }
        if (desired) {
          restoring = true;
          window.setTimeout(function () { restoreWhenReady(desired, token, 35); }, 300);
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
      // Watch resume query params too: mobile SPA navigation can open a
      // bookmark to the *same* article without changing pathname.
      const qs = new URLSearchParams(window.location.search);
      const routeKey = window.location.pathname + '|' + (qs.get('sr_resume') || '') + '|' +
        (qs.get('sr_anchor') || '') + '|' + (qs.get('sr_percent') || '') + '|' + (qs.get('sr_bookmark') || '') + '|' + (qs.get('sr_highlight') || '');
      if (routeKey === currentPath) {
        if (active) updateDock();
        return;
      }
      if (active && dirty) flushOnHide();
      if (active) flushReadingActivity();
      if (saveTimer) window.clearTimeout(saveTimer);
      saveTimer = null;
      dirty = false;
      restoring = false;
      conflict = null;
      compactOpen = false;
      currentPath = routeKey;
      generation++;
      active = null;
      lastSavedAt = 0;
      newActivitySession();
      chosenText = null;
      if (window.CSS && window.CSS.highlights) window.CSS.highlights.delete('startpro-wiki-reader');
      hidePanel();
      updateDock();
      if (route && route.type === 'article') loadArticle(route.address, generation);
    }

    // Defer DOM mounting and initial article API requests until Flarum has
    // completed its synchronous boot and assigned app.session/app.forum.
    // Calling app.request during an initializer can fail before session exists.
    window.setTimeout(function startReaderAfterBoot() {
      makeDock();
      onRouteChange();
      window.addEventListener('scroll', function () { trackInteraction(); if (active && signedIn()) queueSave(); }, { passive: true });
      window.addEventListener('popstate', onRouteChange);
      window.addEventListener('pagehide', flushOnHide);
      window.addEventListener('pagehide', flushReadingActivity);
      window.addEventListener('resize', updateDock);
      document.addEventListener('mouseup', function () { window.setTimeout(captureSelection, 0); });
      document.addEventListener('touchend', function () { window.setTimeout(captureSelection, 0); });
      document.addEventListener('keydown', trackInteraction);
      document.addEventListener('pointerdown', trackInteraction);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushOnHide(); });
      // LR Wiki's pages are lazily loaded in Flarum 2's SPA. A small route watcher
      // avoids relying on the wiki's private component exports or DOM lifecycle.
      window.setInterval(function () { onRouteChange(); tickReadingActivity(); }, 800);
    }, 0);
  });
})();

// Flarum 2.x wraps extension JS with `var module={}` and expects a module export.
// Without this object, Application.bootExtensions() throws reading `.extend`.
module.exports = {};
