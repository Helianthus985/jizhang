/* ================= 小账本 ================= */
(function () {
  'use strict';

  const KEY = 'xzb.records.v2';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ---------- 分类 ---------- */
  const CATS = {
    expense: [
      { id: 'food',      name: '餐饮', icon: '🍜', color: '#C4735B' },
      { id: 'transport', name: '交通', icon: '🚌', color: '#8FA3B0' },
      { id: 'shopping',  name: '购物', icon: '🛍️', color: '#C89AA6' },
      { id: 'fun',       name: '娱乐', icon: '🎮', color: '#A493B5' },
      { id: 'home',      name: '居住', icon: '🏠', color: '#B39B7F' },
      { id: 'daily',     name: '日用', icon: '🧻', color: '#8CA394' },
      { id: 'medical',   name: '医疗', icon: '💊', color: '#7F9E9B' },
      { id: 'study',     name: '学习', icon: '📚', color: '#A9A07E' },
      { id: 'social',    name: '人情', icon: '🎁', color: '#D0A88F' },
      { id: 'other',     name: '其他', icon: '📦', color: '#ADA9A3' }
    ],
    income: [
      { id: 'salary',   name: '工资', icon: '💰', color: '#7E8F79' },
      { id: 'bonus',    name: '奖金', icon: '🏆', color: '#C4A265' },
      { id: 'invest',   name: '理财', icon: '📈', color: '#8FA3B0' },
      { id: 'parttime', name: '兼职', icon: '💼', color: '#A493B5' },
      { id: 'gift',     name: '红包', icon: '🧧', color: '#C4735B' },
      { id: 'other_in', name: '其他', icon: '✨', color: '#ADA9A3' }
    ]
  };
  const CAT_MAP = {};
  Object.keys(CATS).forEach((t) => CATS[t].forEach((c) => (CAT_MAP[t + ':' + c.id] = c)));

  /* ---------- 状态 ---------- */
  let records = [];
  let curMonth = '';
  let statMonth = '';
  let statType = 'expense';
  let editingId = null;
  let draft = null;

  /* ---------- 工具 ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const ymOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1);
  const today = () => ymd(new Date());

  function money(n) {
    return Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function round2(n) { return Math.round(n * 100) / 100; }

  function monthLabel(ym) {
    const p = ym.split('-');
    return p[0] + '年' + Number(p[1]) + '月';
  }
  function shiftMonth(ym, delta) {
    const p = ym.split('-');
    const d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
    return ymOf(d);
  }
  function dayLabel(dateStr) {
    const p = dateStr.split('-');
    const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    const t = today();
    let prefix = '';
    if (dateStr === t) prefix = '今天 · ';
    else {
      const y = new Date(); y.setDate(y.getDate() - 1);
      if (dateStr === ymd(y)) prefix = '昨天 · ';
    }
    return prefix + Number(p[1]) + '月' + Number(p[2]) + '日 ' + week;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.filter((r) => r && r.id && r.date && typeof r.amount === 'number');
      }
    } catch (e) { console.warn('读取数据失败', e); }
    return [];
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(records)); }
    catch (e) { toast('保存失败：存储空间不足'); }
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('on'), 1800);
  }

  /* ---------- 首页渲染 ---------- */
  function renderHome() {
    $('#monthLabel').textContent = monthLabel(curMonth);
    const list = records
      .filter((r) => r.date.slice(0, 7) === curMonth)
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));

    let exp = 0, inc = 0;
    list.forEach((r) => (r.type === 'income' ? (inc += r.amount) : (exp += r.amount)));

    $('#heroExpense').textContent = money(exp);
    $('#heroIncome').textContent = money(inc);
    $('#heroBalance').textContent = money(inc - exp);
    $('#heroCount').textContent = list.length;

    const wrap = $('#recordList');
    const empty = $('#homeEmpty');
    if (!list.length) {
      wrap.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    const groups = [];
    let cur = null;
    list.forEach((r) => {
      if (!cur || cur.date !== r.date) { cur = { date: r.date, items: [] }; groups.push(cur); }
      cur.items.push(r);
    });

    wrap.innerHTML = groups.map((g) => {
      let ge = 0, gi = 0;
      g.items.forEach((r) => (r.type === 'income' ? (gi += r.amount) : (ge += r.amount)));
      const sub = [];
      if (ge) sub.push('支出 ¥' + money(ge));
      if (gi) sub.push('收入 ¥' + money(gi));
      const rows = g.items.map((r) => {
        const c = CAT_MAP[r.type + ':' + r.category] || { name: '未分类', icon: '📦', color: '#ADA9A3' };
        const color = hexA(c.color, 0.13);
        return '<div class="rec-item" data-id="' + r.id + '">' +
          '<div class="rec-ic" style="background:' + color + '">' + c.icon + '</div>' +
          '<div class="rec-mid"><div class="rec-name">' + esc(c.name) + '</div>' +
          (r.note ? '<div class="rec-note">' + esc(r.note) + '</div>' : '') +
          '</div>' +
          '<div class="rec-amt ' + r.type + '">' + (r.type === 'income' ? '+' : '-') + '¥' + money(r.amount) + '</div>' +
          '</div>';
      }).join('');
      return '<div class="day"><div class="day-head"><span>' + dayLabel(g.date) + '</span><b>' + sub.join('　') + '</b></div>' +
        '<div class="rec">' + rows + '</div></div>';
    }).join('');
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  /* ---------- 统计渲染 ---------- */
  function renderStats() {
    $('#statMonth').textContent = monthLabel(statMonth);
    const list = records.filter((r) => r.date.slice(0, 7) === statMonth && r.type === statType);
    const total = round2(list.reduce((s, r) => s + r.amount, 0));

    const map = {};
    list.forEach((r) => {
      const k = r.category;
      if (!map[k]) map[k] = 0;
      map[k] += r.amount;
    });
    const groups = Object.keys(map).map((k) => {
      const c = CAT_MAP[statType + ':' + k] || { name: '未分类', icon: '📦', color: '#ADA9A3' };
      return { name: c.name, icon: c.icon, color: c.color, value: round2(map[k]) };
    }).sort((a, b) => b.value - a.value);

    $('#donutLabel').textContent = statType === 'expense' ? '支出合计' : '收入合计';
    $('#donutValue').textContent = '¥' + money(total);

    drawDonut(groups, total);

    const rank = $('#catRank');
    if (!groups.length) {
      rank.innerHTML = '<div class="rank-row" style="text-align:center;color:#9A9088;padding:34px 0;font-size:13.5px">本月暂无' +
        (statType === 'expense' ? '支出' : '收入') + '记录</div>';
      return;
    }
    rank.innerHTML = groups.map((g) => {
      const pct = total ? (g.value / total) * 100 : 0;
      return '<div class="rank-row">' +
        '<div class="rank-top">' +
        '<span class="rank-dot" style="background:' + g.color + '"></span>' +
        '<span class="rank-name">' + esc(g.name) + '</span>' +
        '<span class="rank-pct">' + pct.toFixed(1) + '%</span>' +
        '<span class="rank-amt">¥' + money(g.value) + '</span>' +
        '</div>' +
        '<div class="rank-bar"><i style="width:' + Math.max(pct, 1.5) + '%;background:' + g.color + '"></i></div>' +
        '</div>';
    }).join('');
  }

  function drawDonut(groups, total) {
    const cv = $('#donut');
    const size = 240;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = size * dpr;
    cv.height = size * dpr;
    cv.style.width = size + 'px';
    cv.style.height = size + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2, cy = size / 2, r = 92, lw = 30;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';

    if (!groups.length || !total) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#EFE9E2';
      ctx.stroke();
      return;
    }

    let start = -Math.PI / 2;
    const gap = groups.length > 1 ? 0.028 : 0;
    groups.forEach((g) => {
      const ang = (g.value / total) * Math.PI * 2;
      const a0 = start + gap / 2;
      const a1 = start + ang - gap / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, Math.max(a1, a0 + 0.004));
      ctx.strokeStyle = g.color;
      ctx.stroke();
      start += ang;
    });
  }

  /* ---------- 我的 ---------- */
  function renderMe() {
    let exp = 0, inc = 0;
    records.forEach((r) => (r.type === 'income' ? (inc += r.amount) : (exp += r.amount)));
    $('#allExpense').textContent = '¥' + money(exp);
    $('#allIncome').textContent = '¥' + money(inc);
    $('#allCount').textContent = records.length;
  }

  function renderAll() { renderHome(); renderStats(); renderMe(); }

  /* ---------- 视图切换 ---------- */
  function switchView(name) {
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === 'view-' + name));
    $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.view === name));
    window.scrollTo({ top: 0 });
  }

  /* ---------- 记账面板 ---------- */
  function openSheet(rec) {
    editingId = rec ? rec.id : null;
    draft = rec
      ? { type: rec.type, category: rec.category, amount: String(rec.amount), note: rec.note || '', date: rec.date }
      : { type: 'expense', category: 'food', amount: '0', note: '', date: today() };
    if (!rec) {
      // 记住上次用过的同类型分类
      const last = records.find((r) => r.type === 'expense' && r.date <= today());
      if (last && CAT_MAP['expense:' + last.category]) draft.category = last.category;
    }

    $('#sheetCancel').textContent = editingId ? '删除' : '取消';
    $('#sheetCancel').className = editingId ? 'txt-btn del' : 'txt-btn';
    $('#sheetSave').textContent = '保存';

    syncTypeSeg();
    renderCats();
    renderAmount();
    $('#noteInput').value = draft.note;
    $('#dateInput').value = draft.date;

    $('#sheetMask').classList.add('on');
    $('#sheet').classList.add('on');
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    $('#sheetMask').classList.remove('on');
    $('#sheet').classList.remove('on');
    document.body.style.overflow = '';
    document.body.classList.remove('typing');
    $('#noteInput').blur();
    editingId = null;
  }

  function syncTypeSeg() {
    $$('#typeSeg .seg-btn').forEach((b) => b.classList.toggle('on', b.dataset.type === draft.type));
  }

  function renderCats() {
    const grid = $('#catGrid');
    grid.innerHTML = CATS[draft.type].map((c) =>
      '<button class="cat' + (c.id === draft.category ? ' on' : '') + '" data-id="' + c.id + '">' +
      '<div class="cat-ic" style="color:' + c.color + '"><span>' + c.icon + '</span></div>' +
      '<div class="cat-name">' + c.name + '</div></button>'
    ).join('');
  }

  function renderAmount() {
    const el = $('#amountVal');
    el.textContent = draft.amount;
    el.classList.toggle('small', draft.amount.length > 7);
  }

  function pressKey(k) {
    let a = draft.amount;
    if (k === 'del') {
      a = a.length > 1 ? a.slice(0, -1) : '0';
      if (a === '' ) a = '0';
    } else if (k === '.') {
      if (!a.includes('.')) a = a + '.';
    } else {
      if (a === '0') a = k;
      else {
        const parts = a.split('.');
        if (parts[1] !== undefined && parts[1].length >= 2) return;
        if (parts[0].length >= 8) return;
        a = a + k;
      }
    }
    draft.amount = a;
    renderAmount();
  }

  function saveDraft() {
    const amount = round2(parseFloat(draft.amount));
    if (!amount || amount <= 0) {
      toast('请先输入金额');
      const el = $('#amountVal');
      el.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
        { duration: 240 }
      );
      return;
    }
    const note = $('#noteInput').value.trim();
    const date = $('#dateInput').value || today();
    const wasEditing = !!editingId;

    if (wasEditing) {
      const idx = records.findIndex((r) => r.id === editingId);
      if (idx > -1) {
        records[idx] = Object.assign({}, records[idx], {
          type: draft.type, category: draft.category, amount, note, date
        });
      }
    } else {
      records.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: draft.type, category: draft.category, amount, note, date,
        createdAt: Date.now()
      });
    }
    save();
    closeSheet();
    curMonth = date.slice(0, 7);
    statMonth = curMonth;
    renderAll();
    toast(wasEditing ? '已更新' : '已记一笔');
  }

  function deleteEditing() {
    if (!editingId) return;
    if (!confirm('确定删除这条记录吗？')) return;
    records = records.filter((r) => r.id !== editingId);
    save();
    closeSheet();
    renderAll();
    toast('已删除');
  }

  /* ---------- 导出 / 导入 ---------- */
  function download(filename, content, type) {
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function exportCsv() {
    if (!records.length) return toast('还没有数据');
    const head = ['日期', '类型', '分类', '金额', '备注'];
    const lines = [head.join(',')].concat(
      records.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map((r) => {
        const c = CAT_MAP[r.type + ':' + r.category] || { name: '未分类' };
        return [r.date, r.type === 'income' ? '收入' : '支出', c.name, r.amount.toFixed(2), '"' + (r.note || '').replace(/"/g, '""') + '"'].join(',');
      })
    );
    download('账本_' + today() + '.csv', '\ufeff' + lines.join('\r\n'), 'text/csv;charset=utf-8');
    toast('已导出 CSV');
  }

  function exportJson() {
    if (!records.length) return toast('还没有数据');
    download('账本备份_' + today() + '.json', JSON.stringify({ app: 'xiaozhangben', version: 2, records }, null, 2), 'application/json');
    toast('备份已导出');
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        const arr = Array.isArray(data) ? data : data.records;
        if (!Array.isArray(arr)) throw new Error('格式不正确');
        const clean = arr.filter((r) => r && r.date && typeof r.amount !== 'undefined');
        if (!clean.length) throw new Error('没有可用记录');
        if (!confirm('将导入 ' + clean.length + ' 条记录，与现有数据合并（相同 ID 会覆盖），继续吗？')) return;
        const map = {};
        records.forEach((r) => (map[r.id] = r));
        clean.forEach((r) => {
          map[r.id || (Date.now() + Math.random()).toString(36)] = {
            id: r.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
            type: r.type === 'income' ? 'income' : 'expense',
            category: r.category || 'other',
            amount: round2(Number(r.amount) || 0),
            note: r.note || '',
            date: r.date,
            createdAt: r.createdAt || Date.now()
          };
        });
        records = Object.values(map);
        save();
        renderAll();
        toast('已导入 ' + clean.length + ' 条');
      } catch (e) {
        toast('导入失败：' + e.message);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  /* ---------- 示例数据 ---------- */
  function loadDemo() {
    if (records.length && !confirm('这会在现有数据基础上追加 12 条示例记录，继续吗？')) return;
    const base = new Date();
    const y = base.getFullYear(), m = base.getMonth();
    const mk = (day, type, cat, amount, note) => ({
      id: 'demo' + Math.random().toString(36).slice(2, 9),
      type, category: cat, amount,
      note: note || '',
      date: y + '-' + pad(m + 1) + '-' + pad(Math.min(day, 28)),
      createdAt: Date.now() - Math.random() * 1e6
    });
    const demo = [
      mk(2, 'expense', 'food', 26, '早餐'),
      mk(3, 'expense', 'transport', 12, '地铁'),
      mk(5, 'expense', 'shopping', 189, '换季衣服'),
      mk(6, 'expense', 'food', 58, '和朋友吃饭'),
      mk(8, 'expense', 'daily', 45.5, '纸巾洗发水'),
      mk(9, 'income', 'salary', 12000, '月薪'),
      mk(10, 'expense', 'home', 2500, '房租'),
      mk(11, 'expense', 'fun', 68, '电影票'),
      mk(12, 'expense', 'food', 32, '午餐'),
      mk(13, 'income', 'invest', 320, '基金分红'),
      mk(14, 'expense', 'study', 99, '买书'),
      mk(15, 'expense', 'medical', 76, '感冒药')
    ];
    records = demo.concat(records);
    save();
    curMonth = ymOf(base);
    statMonth = curMonth;
    renderAll();
    switchView('home');
    toast('已载入示例数据');
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    // 底部导航
    $$('.tab').forEach((t) => t.addEventListener('click', () => switchView(t.dataset.view)));

    // 月份切换
    $('#prevMonth').addEventListener('click', () => { curMonth = shiftMonth(curMonth, -1); renderHome(); });
    $('#nextMonth').addEventListener('click', () => { curMonth = shiftMonth(curMonth, 1); renderHome(); });
    $('#statPrev').addEventListener('click', () => { statMonth = shiftMonth(statMonth, -1); renderStats(); });
    $('#statNext').addEventListener('click', () => { statMonth = shiftMonth(statMonth, 1); renderStats(); });

    // 统计类型切换
    $$('#statSeg .seg-btn').forEach((b) => b.addEventListener('click', () => {
      statType = b.dataset.type;
      $$('#statSeg .seg-btn').forEach((x) => x.classList.toggle('on', x === b));
      renderStats();
    }));

    // 打开记账
    $('#fabAdd').addEventListener('click', () => openSheet(null));
    $('#sheetMask').addEventListener('click', closeSheet);
    $('#sheetCancel').addEventListener('click', () => (editingId ? deleteEditing() : closeSheet()));
    $('#sheetSave').addEventListener('click', saveDraft);

    // 收支切换
    $$('#typeSeg .seg-btn').forEach((b) => b.addEventListener('click', () => {
      if (draft.type === b.dataset.type) return;
      draft.type = b.dataset.type;
      draft.category = CATS[draft.type][0].id;
      syncTypeSeg();
      renderCats();
    }));

    // 分类选择
    $('#catGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('.cat');
      if (!btn) return;
      draft.category = btn.dataset.id;
      renderCats();
    });

    // 键盘
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];
    $('#keypad').innerHTML = keys.map((k) =>
      '<button class="key' + (k === 'del' ? ' fn' : '') + '" data-k="' + k + '">' + (k === 'del' ? '⌫' : k) + '</button>'
    ).join('');
    $('#keypad').addEventListener('click', (e) => {
      const b = e.target.closest('.key');
      if (b) pressKey(b.dataset.k);
    });

    // 备注输入时不顶起键盘
    const note = $('#noteInput');
    note.addEventListener('focus', () => document.body.classList.add('typing'));
    note.addEventListener('blur', () => setTimeout(() => document.body.classList.remove('typing'), 120));

    // 点击记录编辑
    $('#recordList').addEventListener('click', (e) => {
      const item = e.target.closest('.rec-item');
      if (!item) return;
      const rec = records.find((r) => r.id === item.dataset.id);
      if (rec) openSheet(rec);
    });

    // 我的页操作
    $('#btnExportCsv').addEventListener('click', exportCsv);
    $('#btnExportJson').addEventListener('click', exportJson);
    $('#btnDemo').addEventListener('click', loadDemo);
    $('#fileImport').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importJson(f);
      e.target.value = '';
    });
    $('#btnClear').addEventListener('click', () => {
      if (!records.length) return toast('本来就没有数据');
      if (!confirm('确定清空全部 ' + records.length + ' 条记录吗？此操作不可撤销，建议先备份。')) return;
      records = [];
      save();
      renderAll();
      toast('已清空');
    });

    // 键盘快捷键（桌面预览用）
    document.addEventListener('keydown', (e) => {
      if (!$('#sheet').classList.contains('on')) {
        if (e.key === 'n' || e.key === 'N') openSheet(null);
        return;
      }
      if (/^[0-9]$/.test(e.key)) pressKey(e.key);
      else if (e.key === '.') pressKey('.');
      else if (e.key === 'Backspace') pressKey('del');
      else if (e.key === 'Enter') saveDraft();
      else if (e.key === 'Escape') closeSheet();
    });

    // 窗口尺寸变化重绘图表
    window.addEventListener('resize', () => renderStats());
  }

  /* ---------- 启动 ---------- */
  function init() {
    records = load();
    const now = new Date();
    curMonth = ymOf(now);
    statMonth = curMonth;
    bind();
    renderAll();
    if (!records.length) $('#homeEmpty').hidden = false;

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
