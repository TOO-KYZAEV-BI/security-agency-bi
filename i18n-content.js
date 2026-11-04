// BI агентства · i18n-content.js — английский язык для СОДЕРЖИМОГО интерфейса (разделы ядра app.js, тексты мира world.js/catalog.js).
// Подключается сразу после i18n.js. Русский язык не меняется ни на символ: всё ниже работает только при I18N.lang === 'en'.
//
// Как устроено:
//   1) I18N.phrases('en', { 'русский текст': 'English text' }) — перевод по самому русскому тексту (точное совпадение, без пробелов по краям);
//   2) I18N.templates('en', { 'Смены на {d}': 'Shifts as of {d}' }) — шаблоны с подстановками:
//        {n} {m} {k} (и n1, m2 …) — число (как есть), остальные имена ({a}, {d}, {x} …) — текст, переводится рекурсивно;
//        [смена|смены|смен] — любой из вариантов русского склонения; в английском {n?site|sites} — форма по числу n;
//   3) составные строки «A · B — C» переводятся по частям (разделители · — ; : , / →), имена-номера мира — I18N.w;
//   4) перевод выполняется на выводе: I18N.tx(s) и проход по DOM (текстовые узлы и атрибуты title/placeholder/aria-label/alt)
//      после каждой перерисовки и для всего, что модули дописывают в страницу (MutationObserver). Разметка и классы не меняются.
//   При возврате на RU исходные русские узлы восстанавливаются, затем ядро перерисовывает страницу.
//   I18N.untranslated — Map(строка → число встреч) того, что не нашлось в словаре (для tools/i18n-check.js).
//   Не переводятся: поля ввода (value), [contenteditable], элементы с атрибутом data-noi18n и их потомки.
(function(){
  'use strict';
  const I = window.I18N; if (!I || !I._phr) return;
  const PHR = I._phr.en || (I._phr.en = {});
  const CYR = /[А-Яа-яЁё]/;
  const TPL = [], cache = new Map(), untranslated = new Map();
  const NUM = '[−+\\-]?\\d+(?:[.,\\u00a0\\u202f]\\d+)*(?:\\s?%)?';
  const MON = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
  const DATE = `\\d{1,2} (?:${MON})(?: \\d{4})?(?:,? \\d{1,2}:\\d{2})?|(?:${MON}) \\d{4}|\\d{1,2}:\\d{2}|\\d{2}\\.\\d{2}(?:\\.\\d{4})?|\\d{4}`;
  const MONEY = '[−+\\-]?[₸$€₽]?\\s?(?:\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+(?:,\\d+)?|\\d[\\d.,]*)(?:\\s?(?:K|M|B|тыс\\.?|млн|млрд))?(?:\\s?[₸$€₽])?';
  // имена подстановок: n m k (+цифра) — число; d — дата; v — сумма; остальные — текст (переводится рекурсивно)
  const isNumKey = k => /^[nmkdv]\d?$/.test(k);
  const PAT = k => k[0] === 'd' ? DATE : (k[0] === 'v' ? MONEY : NUM);
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // ---------- шаблоны ----------
  function compile(ru, en){
    const keys = [], lits = []; let re = '', alt = 0;
    for (const p of ru.split(/(\{\w+\}|\[[^\]|]*\|[^\]]*\])/)){
      if (!p) continue;
      const m = p.match(/^\{(\w+)\}$/);
      if (m){ keys.push(m[1]); re += isNumKey(m[1]) ? `(${PAT(m[1])})` : '([\\s\\S]+?)'; }
      else if (p[0] === '[' && p.includes('|')){ const alts = p.slice(1, -1).split('|'); re += '(?:' + alts.map(reEsc).join('|') + ')'; alt += Math.min(...alts.map(x => x.length)); }
      else { re += reEsc(p); lits.push(p); }
    }
    const lit = lits.filter(x => CYR.test(x)).sort((a, b) => b.length - a.length)[0] || '';
    return { re: new RegExp('^' + re + '$'), keys, en, lit, ru, w: lits.join('').length + alt };
  }
  function templates(l, map){
    if (l !== 'en') return;
    for (const ru in map) TPL.push(compile(ru, map[ru]));
    TPL.sort((a, b) => b.w - a.w);              // длинные (более точные) шаблоны — первыми
    cache.clear();
  }
  const numOf = v => { const x = parseFloat(String(v).replace(/[,  \s]/g, '').replace('−', '-')); return isFinite(x) ? x : 2; };
  const MONS = MON.split('|');
  const enDate = x => { let m = x.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); if (m) return `${+m[1]} ${MONS[m[2] - 1]} ${m[3]}`; m = x.match(/^(\d{2})\.(\d{2})$/); if (m) return `${+m[1]} ${MONS[m[2] - 1]}`; return x; };
  // число из русского текста мира: «0,3 %» → «0.3%», «1 200» → «1,200»; английские «1,326» не трогаем
  const enNum = x => String(x).replace(/\s%$/, '%').replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2').replace(/(\d)[\u00a0\u202f](?=\d{3})/g, '$1,');
  // сумма из русского текста мира: «120 млн ₸» → «₸120 M», «149 000 ₸» → «₸149,000»
  const UNIT = { 'тыс': 'K', 'тыс.': 'K', 'млн': 'M', 'млрд': 'B', K: 'K', M: 'M', B: 'B' };
  const enMoney = x => {
    const m = String(x).match(/^([−+\-]?)([₸$€₽]?)\s?([\d.,\u00a0\u202f ]*\d)\s?(K|M|B|тыс\.?|млн|млрд)?\s?([₸$€₽]?)$/);
    if (!m) return enNum(x);
    const num = enNum(m[3].replace(/ (?=\d{3}\b)/g, '\u00a0'));
    return m[1] + (m[2] || m[5]) + num + (m[4] ? ' ' + UNIT[m[4]] : '');
  };
  function fillT(T, m){
    const v = {}; T.keys.forEach((k, i) => { v[k] = m[i + 1]; });
    return T.en.replace(/\{(\w+)(?:\?([^}]*))?\}/g, (all, k, forms) => {
      if (!(k in v)) return all;
      if (forms != null){ const f = forms.split('|'); return Math.abs(numOf(v[k])) === 1 ? f[0] : (f[1] != null ? f[1] : f[0]); }
      if (k[0] === 'd') return enDate(v[k]);
      if (k[0] === 'v') return enMoney(v[k]);
      return isNumKey(k) ? enNum(v[k]) : core(v[k]);
    });
  }

  // ---------- имена-номера мира ----------
  const NAMES = [
    [/ТОО «Заказчик-(\d+)»/g, 'Customer-$1 LLP'], [/ТОО «Заказчик-(\d+)/g, 'Customer-$1 LLP'], [/Заказчик-(\d+)/g, 'Customer-$1'],
    [/(?:Объект|объект|Объекта|объекта|Объекту|объекту|Объектом|объектом|Объекте|объекте) № ?(\d+)/g, 'Site No. $1'],
    [/(?:пост|поста|посту|посте) (\d+)/g, 'post $1'], [/№ ?(\d)/g, 'No. $1'],
    [/(^|[^А-Яа-яЁё])П-(\d{4})-(\d+)/g, '$1E-$2-$3'], [/(^|[^А-Яа-яЁё])СЗ-(\d+)/g, '$1M-$2'], [/(^|[^А-Яа-яЁё])ЗО-(\d{4})-(\d+)/g, '$1PR-$2-$3'], [/(^|[^А-Яа-яЁё])Н-(\d{4})-(\d+)/g, '$1T-$2-$3'],
    [/(\d)-к(?![А-Яа-яЁё])/g, '$1-P'], [/(\d)-о(?![А-Яа-яЁё])/g, '$1-O'],
  ];
  const names = s => { let r = s; for (const [re, to] of NAMES) r = r.replace(re, to); return r; };
  const uc = s => s.charAt(0).toUpperCase() + s.slice(1), lc = s => s.charAt(0).toLowerCase() + s.slice(1);
  function look(s){
    let p = PHR[s]; if (p != null) return p;
    const c = s.charAt(0);
    if (c !== c.toUpperCase()){ p = PHR[uc(s)]; if (p != null) return /^[A-Z][a-z]/.test(p) && !/^(AI|AR|SUNKAR|EBITDA|DSO|KPI|CSV|ID)\b/.test(p) ? lc(p) : p; }
    else if (c !== c.toLowerCase()){ p = PHR[lc(s)]; if (p != null) return uc(p); }
    return null;
  }

  // ---------- перевод строки ----------
  const SEPS = [' · ', ' — ', ' – ', '; ', ': ', '. ', ', ', ' / ', ' → ', ' + ', ' | ', ' = ', ' − ', ' × ', ' ÷ '];
  const WRAP = /^([\s▲▼⚠✓✔✕✗★☆✦•·—–\-+()«»“”"'№⓵ⓘ🔒🔔📎🎤✎⌛⏱⏸▶■□●○◆◇…↑↓→←↗↘]+)?([\s\S]*?)([\s.:;,!?…()«»“”"'%*·—–]+)?$/;
  const cyrN = s => (s.match(/[А-Яа-яЁё]/g) || []).length;
  // кандидаты перевода пробуются по очереди; первый полностью английский — ответ, иначе — тот, где меньше кириллицы
  function core(s, depth = 0){
    if (!CYR.test(s)) return s;
    let p = look(s); if (p != null) return p;
    let s2 = names(s);
    if (s2 !== s){ if (!CYR.test(s2)) return s2; p = look(s2); if (p != null) return p; }
    if (depth > 8) return miss(s2);
    // текст в кавычках переводится отдельно: «Errand E-2026-1532 “Список решений…” accepted»
    const s3 = s2.replace(/([«“"])([^«»“”"]*[А-Яа-яЁё][^«»“”"]*)([»”"])/g, (m, q1, x, q2) => q1 + core(x, depth + 1) + q2);
    if (s3 !== s2){ if (!CYR.test(s3)) return s3; p = look(s3); if (p != null) return p; s2 = s3; }
    const m0 = MISS.length; let best = null, bestM = null, bestN = Infinity;
    const tryIt = fn => {
      const r = fn(); if (r == null) return false;
      const k = cyrN(r);
      if (!k){ MISS.length = m0; return r; }
      if (k < bestN){ best = r; bestN = k; bestM = MISS.slice(m0); }
      MISS.length = m0; return false;
    };
    let r;
    for (const T of TPL){
      if (T.lit && !s2.includes(T.lit)) continue;
      const m = T.re.exec(s2); if (!m) continue;
      if ((r = tryIt(() => fillT(T, m))) !== false) return r;
    }
    const w = s2.match(WRAP);
    if (w && (w[1] || w[3]) && w[2] && w[2] !== s2 && (r = tryIt(() => (w[1] || '') + core(w[2], depth + 1) + (w[3] || ''))) !== false) return r;
    for (const sep of SEPS){
      if (!s2.includes(sep)) continue;
      if ((r = tryIt(() => s2.split(sep).map(x => x.trim() ? core(x, depth + 1) : x).join(sep))) !== false) return r;
    }
    const lat = s2.match(/^([A-Za-z0-9][\w\s.,:;()'’&/+-]*?[\s(“"«])([«“"]?[А-ЯЁа-яё][\s\S]*)$/);   // «English prefix + русский хвост» (подписи модулей с русскими данными)
    if (lat && (r = tryIt(() => lat[1] + core(lat[2], depth + 1))) !== false) return r;
    const sp = s2.match(/^([\s\S]+?) (\([^()]*\))$/);   // «текст (уточнение)»
    if (sp && (r = tryIt(() => core(sp[1], depth + 1) + ' ' + core(sp[2], depth + 1))) !== false) return r;
    if (best != null && bestN < cyrN(s2)){ MISS.push(...bestM); return best; }
    return miss(s2);
  }
  let MISS = [];
  function miss(s){ if (CYR.test(s)) MISS.push(s); return s; }
  const note = list => list.forEach(s => untranslated.set(s, (untranslated.get(s) || 0) + 1));
  const QUOTES = s => s.replace(/«/g, '“').replace(/»/g, '”');
  const PCT = /(\d)[ \u00a0\u202f]%/g;           // «12,5 %» из шаблонов ядра → «12.5%» (английская запись процентов)
  function tr(s){
    if (s == null) return s;
    if (!CYR.test(s)) return PCT.test(s) ? (PCT.lastIndex = 0, s.replace(PCT, '$1%')) : s;
    const c = cache.get(s); if (c !== undefined){ if (c.m.length) note(c.m); return c.r; }
    const m = String(s).match(/^(\s*)([\s\S]*?)(\s*)$/);
    MISS = [];
    const r = (m[1] + QUOTES(core(m[2])) + m[3]).replace(PCT, '$1%');
    cache.set(s, { r, m: MISS }); note(MISS); return r;
  }

  // ---------- I18N.tx: точный перевод + шаблоны + составные строки ----------
  const fill = (s, vars) => vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
  const tx0 = I.tx;
  I.tx = (s, vars) => {
    if (I.lang === 'ru' || s == null) return tx0(s, vars);
    const p = PHR[s]; if (p != null) return fill(p, vars);
    return fill(tr(String(s)), vars);
  };
  const w0 = I.w;
  I.w = s => (I.lang === 'ru' || s == null) ? w0(s) : tr(names(String(s)));

  // ---------- проход по DOM ----------
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-tip'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT']);
  const ORIG = new WeakMap(), ORIGA = new WeakMap();
  const skipEl = el => { for (let e = el; e && e.nodeType === 1; e = e.parentNode){ if (SKIP.has(e.tagName) || e.isContentEditable || e.hasAttribute('data-noi18n')) return true; } return false; };
  function doText(n){
    const v = n.nodeValue; if (!v || !(CYR.test(v) || /\d[ \u00a0\u202f]%/.test(v)) || skipEl(n.parentNode)) return;
    const r = tr(v); if (r !== v){ ORIG.set(n, [v, r]); n.nodeValue = r; }
  }
  function doAttrs(el){
    if (el.nodeType !== 1) return;
    for (const a of ATTRS){
      const v = el.getAttribute(a); if (!v || !CYR.test(v)) continue;
      if (skipEl(el)) return;
      const r = tr(v); if (r !== v){ const o = ORIGA.get(el) || {}; o[a] = [v, r]; ORIGA.set(el, o); el.setAttribute(a, r); }
    }
  }
  function translate(root){
    if (I.lang !== 'en' || !root) return;
    if (root.nodeType === 3){ doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) doText(n);
    if (root.nodeType === 1) doAttrs(root);
    if (root.querySelectorAll) root.querySelectorAll('[title],[placeholder],[aria-label],[alt],[data-tip]').forEach(doAttrs);
  }
  function restore(root = document){
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())){ const o = ORIG.get(n); if (o && n.nodeValue === o[1]) n.nodeValue = o[0]; ORIG.delete(n); }
    root.querySelectorAll('*').forEach(el => { const o = ORIGA.get(el); if (!o) return; for (const a in o) if (el.getAttribute(a) === o[a][1]) el.setAttribute(a, o[a][0]); ORIGA.delete(el); });
  }
  let obs = null;
  function observe(){
    if (obs || typeof MutationObserver === 'undefined') return;
    obs = new MutationObserver(recs => {
      if (I.lang !== 'en') return;
      for (const r of recs){
        if (r.type === 'characterData') doText(r.target);
        else if (r.type === 'attributes') doAttrs(r.target);
        else r.addedNodes.forEach(translate);
      }
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  const unobserve = () => { if (obs){ obs.disconnect(); obs = null; } };
  I.on(l => { if (l === 'en'){ observe(); queueMicrotask(() => translate(document)); } else { unobserve(); restore(document); } });
  if (I.lang === 'en'){ observe(); const start = () => translate(document); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start(); }

  // ключи разделов ядра, добавленные в 0.8 (раздел «Обновить данные»)
  I.add('ru', {
    'rf.sub': 'цикл данных движка: выгрузки 1С, Битрикс24, отметки смен, сверки',
    'rf.exports': 'Выгрузки 1С на {d}', 'rf.exp_ok': 'приняты, сверка с ОСВ сходится', 'rf.exp_bad': 'выгрузка отклонена — в отчётах последняя принятая версия',
    'rf.backup': 'Ночные копии 1С', 'rf.bk_ok': 'выполнены', 'rf.bk_bad': 'не выполнены', 'rf.bk_d': 'Effector Saver и MS SQL · подробно в «Сервер и 1С»',
    'rf.mode': 'Где считаются отчёты', 'rf.mode_srv': 'сервер Агентства', 'rf.mode_srv_d': 'движок проверяет данные каждые 10 минут', 'rf.mode_local': 'в этом браузере', 'rf.mode_local_d': 'демо-данные из книги проводок, без подключения к 1С',
    'rf.last': 'Последний пересчёт', 'rf.last_d': 'в этом сеансе ещё не запускался', 'rf.last_ok': 'все разделы пересчитаны из книги проводок',
    'rf.now_t': 'Пересчитать сейчас', 'rf.now': 'Пересчитать отчёты',
    'rf.now_d': 'Пересчитывает все разделы на дату «Данные на» и выбранный период; на сервере Агентства — сначала запрашивает у движка состояние последнего цикла.',
    'rf.srv_ok': 'цикл движка в {a} · {s}', 'rf.srv_off': 'нет связи с сервером — пересчитано по данным страницы',
  });
  I.add('en', {
    'rf.sub': 'engine data cycle: 1C exports, Bitrix24, shift check-ins, reconciliations',
    'rf.exports': '1C exports as of {d}', 'rf.exp_ok': 'accepted, reconciliation with the trial balance matches', 'rf.exp_bad': 'export rejected — reports use the last accepted version',
    'rf.backup': 'Nightly 1C copies', 'rf.bk_ok': 'completed', 'rf.bk_bad': 'failed', 'rf.bk_d': 'Effector Saver and MS SQL · details in “Server & 1C”',
    'rf.mode': 'Where reports are calculated', 'rf.mode_srv': 'Agency server', 'rf.mode_srv_d': 'the engine checks the data every 10 minutes', 'rf.mode_local': 'in this browser', 'rf.mode_local_d': 'demo data from the general ledger, no connection to 1C',
    'rf.last': 'Last recalculation', 'rf.last_d': 'not yet run in this session', 'rf.last_ok': 'all sections recalculated from the general ledger',
    'rf.now_t': 'Recalculate now', 'rf.now': 'Recalculate reports',
    'rf.now_d': 'Recalculates all sections for the “Data as of” date and the selected period; on the Agency server it first asks the engine for the state of the last cycle.',
    'rf.srv_ok': 'engine cycle at {a} · {s}', 'rf.srv_off': 'no connection to the server — recalculated from the page data',
  });

  // ---------- ОПиУ по уровням (0.8.2): форма МСФО, расходы по функциям ----------
  I.add('ru', {
    'pl.q.net': 'ОПиУ по уровням: чистая прибыль = книга проводок', 'pl.q.tax': 'Взносы работодателя в ОПиУ = расчёт налогов (СО, ООСМС, ОПВР, СН)', 'pl.q.sga': 'Коммерческие + административные = статьи администрации',
    'pl.cd.path': 'Место в отчёте', 'pl.cd.how': 'Как выделено', 'pl.cd.kids': 'Разложение строки',
    'pl.f.fot': 'ФОТ = начисленная статья «ФОТ с взносами» ÷ (1 + ставка взносов работодателя; {y} г. — {e}).', 'pl.f.tax': 'Взносы работодателя = статья «ФОТ с взносами» − ФОТ (ставка {y} г. — {e}): СО, ООСМС, ОПВР, СН за вычетом СО.',
    'pl.f.taxk': 'Вид взноса — в доле его ставки в общей ставке взносов работодателя своего года.', 'pl.f.staff': 'Доля коммерческой службы (коммерческий директор, менеджеры, тендерный специалист) в численности администрации на каждый день по орг. структуре.',
    'pl.f.other': '«Прочие»: доля продаж за год = стоимость привлечения подписанных договоров года по каналу (не больше 60 % «Прочих» года), внутри года — равномерно; остаток — административные.', 'pl.f.tot': 'Итог = сумма разделов выше по порядку отчёта.',
    'pl.calc_h': 'ОПиУ по уровням', 'pl.title': 'Отчёт о прибыли или убытке (ОПиУ)', 'pl.sub': 'МСФО · расходы по функциям · начисления по дням за ровно дни периода',
    'pl.n.revenue': 'Выручка (без НДС)', 'pl.n.rev_t24': 'Круглосуточные посты', 'pl.n.rev_tday': 'Дневные посты', 'pl.n.rev_vahta': 'Вахтовые посты (15/15)',
    'pl.n.cogs': 'Себестоимость оказанных услуг', 'pl.n.guardFot': 'ФОТ охранников', 'pl.n.guardTax': 'Налоги и взносы работодателя с ФОТ охраны',
    'pl.n.tax_so': 'Социальные отчисления (СО)', 'pl.n.tax_oosms': 'Отчисления на ОСМС', 'pl.n.tax_opvr': 'Пенсионные взносы работодателя (ОПВР)', 'pl.n.tax_sn': 'Социальный налог за вычетом СО',
    'pl.n.uniform': 'Форма и спецсредства', 'pl.n.transport': 'Транспорт и ГСМ (ГБР, развозка)', 'pl.n.comms': 'Связь на постах',
    'pl.n.gross': 'Валовая прибыль', 'pl.n.grossM': 'Валовая маржа, %',
    'pl.n.sales': 'Коммерческие расходы', 'pl.n.salesFot': 'ФОТ коммерческой службы', 'pl.n.salesTax': 'Налоги и взносы работодателя с ФОТ коммерческой службы',
    'pl.n.sales_tenders': 'Тендеры и госзакупки: обеспечение заявок, сборы', 'pl.n.sales_ads': 'Реклама и сайт', 'pl.n.sales_repr': 'Представительские и командировочные по продажам', 'pl.n.crm': 'Битрикс24 и CRM (доля продаж в ИТ)',
    'pl.n.admin': 'Административные расходы', 'pl.n.adminFot': 'ФОТ администрации', 'pl.n.adminTax': 'Налоги и взносы работодателя с ФОТ администрации',
    'pl.n.office': 'Офис и аренда', 'pl.n.it': 'ИТ и система', 'pl.n.other': 'Прочие административные',
    'pl.n.ebitda': 'EBITDA', 'pl.n.ebitdaM': 'Маржа EBITDA, %', 'pl.n.dep': 'Амортизация основных средств', 'pl.n.ebit': 'Операционная прибыль (EBIT)',
    'pl.n.fin': 'Финансовые доходы и расходы', 'pl.n.interest': 'Проценты по лизингу', 'pl.n.finInc': 'Финансовые доходы (проценты по остаткам)',
    'pl.n.ebt': 'Прибыль до налогообложения', 'pl.n.cit': 'Корпоративный подоходный налог (КПН 20 %)', 'pl.n.net': 'Чистая прибыль', 'pl.n.netM': 'Чистая маржа, %',
    'pl.c.period': 'За период', 'pl.c.share': '% к выручке', 'pl.c.dprev': 'Δ к прошлому', 'pl.c.dyago': 'Δ к году назад', 'pl.c.exec': 'Исполнение', 'pl.c.total': 'Итого',
    'pl.tip.share': 'Сумма строки по модулю ÷ выручка периода × 100; у строк маржи — сама маржа.', 'pl.tip.exec': 'Факт ÷ план бюджета (БДР) × 100; зелёный — в пользу компании. Ниже EBITDA статьи в бюджет не входят.',
    'pl.bar': 'Уровни отчёта', 'pl.collapse_all': 'Свернуть всё', 'pl.level2': 'Подстатьи', 'pl.expand_all': 'Развернуть всё', 'pl.expand': 'Развернуть «{n}»', 'pl.collapse': 'Свернуть «{n}»',
    'pl.mode': 'Колонки', 'pl.m.period': 'За период', 'pl.m.months': 'По месяцам', 'pl.m.years': 'По годам', 'pl.rows': '{n} строк · {g} раскрываются',
    'pl.sign_ch': 'знак строки сменился — показана разница суммы', 'pl.csv.level': 'Уровень', 'pl.csv.code': 'Код строки',
    'pl.note': 'Доходы — со знаком «+», расходы — со знаком «−»; итоговые строки выделены. Δ — изменение суммы строки (▲ рост, ▼ снижение), цвет — влияние на прибыль: зелёный в пользу компании, красный — против. План — из бюджета (БДР) до EBITDA. ▸ — раскрыть строку, → / ← с клавиатуры; раскрытие запоминается.',
    'pl.calc': 'Отчёт о прибыли или убытке — по МСФО (IAS 1), расходы по функциям: выручка → себестоимость услуг → валовая прибыль → коммерческие → административные → EBITDA → амортизация → операционная прибыль → финансовые доходы и расходы → прибыль до налогообложения → КПН → чистая прибыль. Все строки — из книги проводок за дни периода; подстатьи в сумме равны статье, разделы — итогам, чистая прибыль — той же, что в кокпите, капитале и бюджете. Выручка раскрывается по видам постов (круглосуточные, дневные, вахта), регионам и объектам. ФОТ и взносы работодателя делятся из начисленной статьи «ФОТ с взносами» по ставкам своего года: ФОТ = статья ÷ (1 + ставка взносов), взносы = статья − ФОТ, по видам (СО, ООСМС, ОПВР, СН за вычетом СО) — в доле ставки. Форма, транспорт и ГСМ, связь — прямые расходы постов (себестоимость); отдельной офисной связи в учёте нет. Коммерческие расходы выделены из статей администрации без изменения итогов: коммерческая служба (коммерческий директор, менеджеры и тендерный специалист по орг. структуре) — её доля в численности администрации на каждый день, так же — доля CRM в ИТ; тендеры, реклама и сайт, представительские — из «Прочих»: за год — стоимость привлечения подписанных договоров года по каналу (не больше 60 % «Прочих»), внутри года — равномерно. Финансовых доходов в данных нет (0). Колонки: за период, % к выручке, на пост в месяц, прошлый период и год назад с Δ, план бюджета и исполнение; «по месяцам» — месяцы периода и итог (длиннее 13 месяцев — по годам).',
  });
  I.add('en', {
    'pl.q.net': 'P&L by level: net profit = general ledger', 'pl.q.tax': 'Employer contributions in the P&L = tax calculation (SO, health insurance, OPVR, social tax)', 'pl.q.sga': 'Selling + administrative = administrative ledger items',
    'pl.cd.path': 'Place in the report', 'pl.cd.how': 'How it is carved out', 'pl.cd.kids': 'Line breakdown',
    'pl.f.fot': 'Payroll = accrued item “payroll with contributions” ÷ (1 + employer contribution rate; {y} — {e}).', 'pl.f.tax': 'Employer contributions = item “payroll with contributions” − payroll (rate in {y} — {e}): SO, health insurance, OPVR, social tax net of SO.',
    'pl.f.taxk': 'Each contribution type is its rate’s share of the total employer contribution rate of its year.', 'pl.f.staff': 'Share of the sales team (commercial director, managers, tender specialist) in administrative headcount on each day, per the org chart.',
    'pl.f.other': '“Other”: the sales share for a year = acquisition cost of contracts signed that year by channel (no more than 60% of the year’s “Other”), spread evenly within the year; the rest is administrative.', 'pl.f.tot': 'Total = sum of the sections above in report order.',
    'pl.calc_h': 'P&L by level', 'pl.title': 'Statement of profit or loss (P&L)', 'pl.sub': 'IFRS · expenses by function · daily accruals for exactly the days of the period',
    'pl.n.revenue': 'Revenue (excl. VAT)', 'pl.n.rev_t24': '24-hour posts', 'pl.n.rev_tday': 'Daytime posts', 'pl.n.rev_vahta': 'Rotation posts (15/15)',
    'pl.n.cogs': 'Cost of services rendered', 'pl.n.guardFot': 'Guards’ payroll', 'pl.n.guardTax': 'Employer taxes and contributions on guards’ payroll',
    'pl.n.tax_so': 'Social contributions (SO)', 'pl.n.tax_oosms': 'Compulsory health insurance contributions', 'pl.n.tax_opvr': 'Employer pension contributions (OPVR)', 'pl.n.tax_sn': 'Social tax net of SO',
    'pl.n.uniform': 'Uniforms and equipment', 'pl.n.transport': 'Transport and fuel (rapid response, shuttles)', 'pl.n.comms': 'Communications at posts',
    'pl.n.gross': 'Gross profit', 'pl.n.grossM': 'Gross margin, %',
    'pl.n.sales': 'Selling expenses', 'pl.n.salesFot': 'Sales team payroll', 'pl.n.salesTax': 'Employer taxes and contributions on sales team payroll',
    'pl.n.sales_tenders': 'Tenders and public procurement: bid security, fees', 'pl.n.sales_ads': 'Advertising and website', 'pl.n.sales_repr': 'Entertainment and sales travel', 'pl.n.crm': 'Bitrix24 and CRM (sales share of IT)',
    'pl.n.admin': 'Administrative expenses', 'pl.n.adminFot': 'Administration payroll', 'pl.n.adminTax': 'Employer taxes and contributions on administration payroll',
    'pl.n.office': 'Office and rent', 'pl.n.it': 'IT and system', 'pl.n.other': 'Other administrative',
    'pl.n.ebitda': 'EBITDA', 'pl.n.ebitdaM': 'EBITDA margin, %', 'pl.n.dep': 'Depreciation of fixed assets', 'pl.n.ebit': 'Operating profit (EBIT)',
    'pl.n.fin': 'Finance income and costs', 'pl.n.interest': 'Leasing interest', 'pl.n.finInc': 'Finance income (interest on balances)',
    'pl.n.ebt': 'Profit before tax', 'pl.n.cit': 'Corporate income tax (CIT 20%)', 'pl.n.net': 'Net profit', 'pl.n.netM': 'Net margin, %',
    'pl.c.period': 'For the period', 'pl.c.share': '% of revenue', 'pl.c.dprev': 'Δ vs previous', 'pl.c.dyago': 'Δ vs a year ago', 'pl.c.exec': 'Execution', 'pl.c.total': 'Total',
    'pl.tip.share': 'Absolute line amount ÷ revenue of the period × 100; for margin lines — the margin itself.', 'pl.tip.exec': 'Actual ÷ budget plan (P&L budget) × 100; green is in the company’s favour. Items below EBITDA are not budgeted.',
    'pl.bar': 'Report levels', 'pl.collapse_all': 'Collapse all', 'pl.level2': 'Sub-items', 'pl.expand_all': 'Expand all', 'pl.expand': 'Expand “{n}”', 'pl.collapse': 'Collapse “{n}”',
    'pl.mode': 'Columns', 'pl.m.period': 'For the period', 'pl.m.months': 'By month', 'pl.m.years': 'By year', 'pl.rows': '{n} rows · {g} expandable',
    'pl.sign_ch': 'the line changed sign — the difference in amount is shown', 'pl.csv.level': 'Level', 'pl.csv.code': 'Line code',
    'pl.note': 'Income is shown with “+”, expenses with “−”; total lines are highlighted. Δ is the change in the line amount (▲ up, ▼ down); colour is the effect on profit: green in the company’s favour, red against it. Plan comes from the P&L budget down to EBITDA. ▸ expands a line, → / ← from the keyboard; expanded lines are remembered.',
    'pl.calc': 'The statement of profit or loss follows IFRS (IAS 1) with expenses by function: revenue → cost of services → gross profit → selling → administrative → EBITDA → depreciation → operating profit → finance income and costs → profit before tax → CIT → net profit. Every line comes from the general ledger for the days of the period; sub-items add up to their item, sections to the totals, and net profit equals the one in the cockpit, equity and budget. Revenue is broken down by post type (24-hour, daytime, rotation), region and site. Payroll and employer contributions are split from the accrued item “payroll with contributions” at the rates of its year: payroll = item ÷ (1 + contribution rate), contributions = item − payroll, by type (SO, health insurance, OPVR, social tax net of SO) in proportion to the rate. Uniforms, transport and fuel, and communications are direct post costs (cost of services); there is no separate office communications line in the ledger. Selling expenses are carved out of the administrative items without changing totals: the sales team (commercial director, managers and tender specialist per the org chart) is its share of administrative headcount on each day, and so is the CRM share of IT; tenders, advertising and website, and entertainment come from “Other”: for a year — the acquisition cost of contracts signed that year by channel (no more than 60% of “Other”), spread evenly within the year. There is no finance income in the data (0). Columns: for the period, % of revenue, per post per month, previous period and a year ago with Δ, budget plan and execution; “by month” shows the months of the period and the total (longer than 13 months — by year).',
  });

  I.phrases('en', { 'Коммерческая служба (ФОТ с взносами)': 'Sales team (payroll with contributions)', 'Тендеры, реклама, представительские': 'Tenders, advertising, entertainment',
    'CRM коммерческой службы': 'Sales team CRM', 'ФОТ коммерческой службы с взносами': 'Sales team payroll with contributions' });

  Object.assign(I, { templates, translate, restore, untranslated, trText: tr, templateCount: () => TPL.length });
})();
