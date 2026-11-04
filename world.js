// BI агентства — демонстрационный «мир» Охранное агентство по дням, 01.01.2022–31.12.2026 (5 лет), с вариантами развития.
// Всё вымышлено, но считается честно:
//  • каждая операция — проводка двойной записи, поэтому баланс сходится на ЛЮБУЮ дату;
//  • ОПиУ, ДДС, баланс, налоги, дебиторка — из одной книги проводок за любой период;
//  • до демо-даты запуска BI агентства (01.01.2025) история одинакова во всех вариантах; после — расходится по варианту.
// История компании: до 2025 года рентабельность снижается, с 2025 года — рост (порядок в сменах, дебиторке, тарифах, переработках).
// Факт — по 02.11.2026 (дата «сегодня» демо), дальше — прогноз по договорам. Даты в UTC.
(function(){
  'use strict';
  const SCENARIOS = {
    none: { name:'Без системы', k:0,   launchShift:0,  conv:0.42, churn:0.11, arTrend:0.18 },
    pess: { name:'Пессимистичный', k:0.5, launchShift:120, conv:0.62, churn:0.06, arTrend:0 },
    base: { name:'Базовый', k:1,   launchShift:0,  conv:0.80, churn:0.035, arTrend:0 },
    opt:  { name:'Оптимистичный', k:1.3, launchShift:0,  conv:0.95, churn:0.02, arTrend:0 },
  };

  function build(scnKey){
    const SC = SCENARIOS[scnKey] || SCENARIOS.base;
    // ---------- календарь ----------
    const Y0 = 2022, NY = 5;
    const DAY0 = Date.UTC(Y0,0,1);
    const DAYS = Math.round((Date.UTC(Y0+NY,0,1) - DAY0)/864e5);          // 1826
    const toDate = i => new Date(DAY0 + i*864e5);
    const idxOf = (y,m,d) => Math.round((Date.UTC(y,m,d) - DAY0)/864e5);
    const FACT_END = idxOf(2026,10,2);
    const LAUNCH_DEMO = idxOf(2025,0,1);
    const LAUNCH = LAUNCH_DEMO + SC.launchShift;                              // фактический старт работы системы по варианту
    const yOf = i => toDate(i).getUTCFullYear(), mOf = i => toDate(i).getUTCMonth(), dOf = i => toDate(i).getUTCDate();
    const monthIdx = i => (yOf(i)-Y0)*12 + mOf(i);
    const MONTHS = [];
    for (let k=0;k<NY*12;k++){ const y=Y0+Math.floor(k/12), m=k%12; const start=idxOf(y,m,1), end=idxOf(y,m+1,1)-1; MONTHS.push({ y, m, start, end, dim:end-start+1 }); }
    const fmt = i => { const d=toDate(i); return String(d.getUTCDate()).padStart(2,'0')+'.'+String(d.getUTCMonth()+1).padStart(2,'0')+'.'+d.getUTCFullYear(); };
    const fmtShort = i => fmt(i).slice(0,5);
    const iso = i => toDate(i).toISOString().slice(0,10);
    const fromIso = s => { const [y,m,d] = s.split('-').map(Number); return idxOf(y,m-1,d); };
    // эффект системы: 0 до старта, плавно до полного за 90 дней
    const eff = i => SC.k === 0 || i < LAUNCH ? 0 : SC.k * Math.min(1, (i - LAUNCH)/90);

    // ---------- случай (детерминированно) ----------
    function h(){ let x = 2166136261 >>> 0; for (let k=0;k<arguments.length;k++){ x ^= (arguments[k]*2654435761)>>>0; x = Math.imul(x ^ (x>>>15), 2246822519)>>>0; x = Math.imul(x ^ (x>>>13), 3266489917)>>>0; x ^= x>>>16; } return (x>>>0)/4294967296; }
    const pickW = (r, items) => { let s=0; for (const [w,v] of items){ s+=w; if (r < s) return v; } return items[items.length-1][1]; };

    // ---------- ставки по годам (упрощённо; подтверждает бухгалтер) ----------
    const RATES = {
      2022: { ipn:0.10, opv:0.10, vosms:0.02, so:0.035, oosms:0.02, opvr:0,     sn:0.095, vat:0.12, cit:0.20 },
      2023: { ipn:0.10, opv:0.10, vosms:0.02, so:0.035, oosms:0.03, opvr:0,     sn:0.095, vat:0.12, cit:0.20 },
      2024: { ipn:0.10, opv:0.10, vosms:0.02, so:0.035, oosms:0.03, opvr:0.015, sn:0.095, vat:0.12, cit:0.20 },
      2025: { ipn:0.10, opv:0.10, vosms:0.02, so:0.05,  oosms:0.03, opvr:0.025, sn:0.095, vat:0.12, cit:0.20 },
      2026: { ipn:0.10, opv:0.10, vosms:0.02, so:0.05,  oosms:0.03, opvr:0.035, sn:0.11,  vat:0.16, cit:0.20 },
    };
    for (const y in RATES){ const r=RATES[y]; r.withholding = r.opv + r.vosms + r.ipn*(1-r.opv-r.vosms); r.employer = r.so + r.oosms + r.opvr + Math.max(0, r.sn - r.so); }
    const R = i => RATES[yOf(Math.min(i,DAYS-1))];
    const FX = { USD:[], EUR:[], RUB:[] };
    for (let k=0;k<NY*12;k++){ const t=k/12; FX.USD.push(Math.round(430 + 22*t + 9*Math.sin(k/2.3))); FX.EUR.push(Math.round(460 + 27*t + 12*Math.sin(k/2.8))); FX.RUB.push(+(5.6 + 0.25*t + 0.5*Math.sin(k/3.1)).toFixed(2)); }
    const fx = (cur, i) => cur==='KZT' ? 1 : FX[cur][monthIdx(Math.max(0,Math.min(i, DAYS-1)))];

    // ---------- экономика по годам ----------
    const P = {
      tariff24: { 2022: 900000, 2023: 980000, 2024: 1060000, 2025: 1150000, 2026: 1250000 },
      tariffDay:{ 2022: 440000, 2023: 480000, 2024: 520000,  2025: 560000,  2026: 610000 },
      fte24: 3.1, fteDay: 1.7,
      guardSalary: { 2022: 160000, 2023: 180000, 2024: 200000, 2025: 215000, 2026: 230000 },
      adminSalary: { 2022: 300000, 2023: 330000, 2024: 365000, 2025: 400000, 2026: 420000 },
      opex: { uniform: 10500000, transport: 19850000, comms: 2500000, office: 6000000, other: 7500000 },   // уровень 2026, в месяц при 625 постах; растёт с числом постов
      opexIdx: { 2022: 0.78, 2023: 0.84, 2024: 0.89, 2025: 0.94, 2026: 1 },
      faGross0: 150000000, accDep0: 40000000, depMonths: 60, cash0: 300000000, inventory: 43926000, charter: 100000000,
      reserve: { rate: 0.05, cap: 0.15 },   // резервный капитал по уставу (решение учредителя в демо): 31.12 — 5 % чистой прибыли года, пока резерв < 15 % уставного капитала
      leasing: { day: idxOf(2026,4,12), amount: 70000000, rate: 0.18, pay: 3250000 },
      capex: [ [idxOf(2022,5,10), 26000000], [idxOf(2023,8,14), 39000000], [idxOf(2024,3,2), 30500000], [idxOf(2025,2,18), 32500000], [idxOf(2026,8,9), 16000000] ],
      dividends: [ [idxOf(2022,6,15), 200000000], [idxOf(2023,6,15), 300000000], [idxOf(2024,6,15), 350000000], [idxOf(2025,6,15), 250000000], [idxOf(2025,11,22), 250000000], [idxOf(2026,6,15), 400000000], [idxOf(2026,9,20), 300000000] ],
      system: { monthly: 3000000, implementation: 36000000 },   // BI агентства: подписка ИИ, сервер, сопровождение; запуск — разово, 6 мес.
    };

    // ---------- регионы, заказчики, объекты ----------
    const REGIONS = [
      { r:'Алматы', city:'Алматы', n:115, kinds:['бизнес-центр','ЖК','торговый центр','склад','автостоянка','офис банка'] },
      { r:'Астана', city:'Астана', n:75, kinds:['бизнес-центр','ЖК','гос. учреждение','склад','торговый центр'] },
      { r:'Шымкент', city:'Шымкент', n:40, kinds:['производство','рынок','склад','ЖК'] },
      { r:'Карагандинская', city:'Караганда', n:31, kinds:['производство','склад','ТЭЦ (подряд)'] },
      { r:'Атырауская', city:'Атырау', n:27, kinds:['месторождение','база снабжения'] },
      { r:'Мангистауская', city:'Актау', n:18, kinds:['порт-терминал','месторождение'] },
      { r:'Актюбинская', city:'Актобе', n:22, kinds:['производство','склад'] },
    ];
    const CHANNELS = ['Прямой договор','Тендер / госзакупки','Субподряд партнёра','Заявка с сайта'];
    const customers = [], objects = [];
    let poolId = 0, oid = 1;
    REGIONS.forEach((reg, ri) => {
      for (let k=0;k<reg.n;k++){
        poolId++;
        const s = poolId*7 + ri;
        // кандидат: 34 % — работает с начала 2022, остальные появляются в 2022–2026
        const r0 = h(s,8);
        const start = r0 < 0.42 ? -1 : Math.floor((r0-0.42)/0.58 * (FACT_END - 30)) + 5;
        const accept = start < LAUNCH_DEMO ? h(s,20) < 0.66 : h(s,20) < SC.conv;     // после старта системы конверсия продаж выше
        if (!accept) continue;
        const kind = reg.kinds[Math.floor(h(s,1)*reg.kinds.length)];
        const vahta = kind==='месторождение';
        const is24 = vahta || /производство|порт|ТЭЦ|склад|база/.test(kind) || h(s,2) < 0.5;
        const posts = vahta ? 3 + Math.floor(h(s,3)*2) : (is24 ? 2 + Math.floor(h(s,3)*2.4) : 1 + Math.floor(h(s,3)*2.6));
        let cust = null; const same = customers.filter(c=>c.region===reg.r);
        if (same.length && h(s,4) < 0.35) cust = same[Math.floor(h(s,5)*same.length)];
        if (!cust){
          const id = customers.length+1, bad = h(id,9,ri);
          cust = { id, name:`ТОО «Заказчик-${id}»`, region:reg.r, city:reg.city,
            channel: pickW(h(id,6,ri), [[0.5,CHANNELS[0]],[0.28,CHANNELS[1]],[0.12,CHANNELS[2]],[0.10,CHANNELS[3]]]),
            payDays: [10,15,15,30,30][Math.floor(h(id,7,ri)*5)],
            delayMean: bad < 0.55 ? 2 : (bad < 0.80 ? 9 : (bad < 0.93 ? 22 : 45)), objects: [] };
          customers.push(cust);
        }
        const tk = 0.88 + h(s,10)*0.24;
        // расторжения: до запуска одинаково, после — зависит от варианта (качество охраны, ответы на жалобы)
        let end = DAYS, terminated = null;
        const a0 = Math.max(start, 0);
        if (h(s,30) < 0.16){ const d = a0 + 200 + Math.floor(h(s,31)*700); if (d < LAUNCH_DEMO){ end = d+1; terminated = d; } }
        if (terminated==null && h(s,32) < SC.churn*2.2){ const d = Math.max(a0, LAUNCH_DEMO) + 60 + Math.floor(h(s,33)*600); if (d < FACT_END){ end = d+1; terminated = d; } }
        const o = { id:oid, name:`Объект № ${oid}`, kind: vahta ? 'месторождение (вахта 15/15)' : kind, region:reg.r, city:reg.city, customer:cust,
          is24, posts, sched: vahta ? '15/15 вахта' : (is24 ? 'сутки/трое' : (h(s,11)<0.55 ? '2/2 дневной' : '5/2 дневной')),
          tk, start, end, terminated, signDay: start>=0 ? start-30 : -1, contractEnd: idxOf(2026, 10 + Math.floor(h(s,12)*14), 1 + Math.floor(h(s,13)*27)), seed:s };
        cust.objects.push(o); objects.push(o); oid++;
      }
    });
    for (let k = customers.length-1; k>=0; k--) if (!customers[k].objects.length) customers.splice(k,1);
    // сюжет: объект со старым тарифом (убыток) и три объекта со «сегодняшними» незакрытыми сменами
    const loss = objects.find(o=>o.start<0 && o.is24 && o.end===DAYS); if (loss){ loss.tk = 0.80; loss.story = 'тариф ниже рынка'; }
    const NARRATIVE = {}; objects.filter(o=>o.start<0 && o.end===DAYS).slice(3,6).forEach((o,k)=>{ NARRATIVE[o.id] = [2,1,1][k]; });
    objects.forEach(o => { o.fte = (o.is24 ? P.fte24 : P.fteDay) * o.posts; o.missedPost = NARRATIVE[o.id] || null; });
    const active = (o,i) => i >= o.start && i < o.end;
    // пересмотр тарифов убыточных объектов через полгода после старта системы (юнит-экономика)
    const revisionDay = LAUNCH + 180;
    const tariff = (o,i) => { let k = o.tk; if (SC.k>0 && i >= revisionDay && o.tk < 0.97) k += 0.08*SC.k; return Math.round((o.is24 ? P.tariff24 : P.tariffDay)[yOf(Math.min(i,DAYS-1))] * k / 1000) * 1000; };

    // ---------- по дням: итоги компании ----------
    const totFte = new Float64Array(DAYS), totPosts = new Float64Array(DAYS);
    for (let i=0;i<DAYS;i++) for (const o of objects) if (active(o,i)){ totFte[i]+=o.fte; totPosts[i]+=o.posts; }
    const dim = i => MONTHS[monthIdx(i)].dim;
    // администрация: без системы растёт вместе с постами; с системой — медленнее (автоматизация кадров, юриста, снабжения, механика)
    const adminCount = i => { const base = 6 + totPosts[Math.min(i,DAYS-1)]/6.5; const e = eff(i); return Math.round(base * (1 - 0.18*Math.min(1,e))); };
    function opexDay(i){
      const y = yOf(i), m = mOf(i), k = P.opexIdx[y]*(0.12 + 0.88*totPosts[i]/625), d = dim(i), e = eff(i);
      return { uniform: P.opex.uniform*k*(m===0||m===9 ? 1.6 : 1)*(1-0.06*e)/d, transport: P.opex.transport*k*(m>=5&&m<=7 ? 1.12 : 1)*(1-0.08*e)/d,
               comms: P.opex.comms*k/d, office: P.opex.office*k/d, other: P.opex.other*k*(1-0.10*e)/d,
               it: i >= LAUNCH_DEMO && SC.k>0 ? (P.system.monthly + (i < LAUNCH_DEMO+182 ? P.system.implementation/6 : 0))/d : 0 };
    }

    // ---------- по объектам: накопительные ряды ----------
    const KEYS = ['rev','guard','direct','overhead','plan','missed','late'];
    objects.forEach(o => { o.c = {}; KEYS.forEach(k => o.c[k] = new Float64Array(DAYS+1)); });
    const companyDirect = new Float64Array(DAYS), companyOverhead = new Float64Array(DAYS), adminCostDay = new Float64Array(DAYS);
    for (let i=0;i<DAYS;i++){
      const ox = opexDay(i), r = R(i), y = yOf(i);
      adminCostDay[i] = adminCount(i) * P.adminSalary[y] * (1+r.employer) / dim(i);
      companyDirect[i] = ox.uniform + ox.transport + ox.comms;
      companyOverhead[i] = adminCostDay[i] + ox.office + ox.other + ox.it;
    }
    for (const o of objects){
      for (let i=0;i<DAYS;i++){
        let rev=0, guard=0, direct=0, over=0, plan=0, missed=0, late=0;
        if (active(o,i)){
          const y = yOf(i), r = R(i), m = monthIdx(i), e = eff(i);
          rev = o.posts * tariff(o,i) / dim(i);
          const ot = 1 + (0.07*h(o.id, m, 77) + (o.story ? 0.08 : 0)) * (1 - 0.5*Math.min(1,e)) * (SC.k===0 && i>=LAUNCH_DEMO ? 1.15 : 1);   // переработки
          guard = o.fte * P.guardSalary[y] * (1+r.employer) * ot / dim(i);
          direct = totFte[i] ? companyDirect[i] * o.fte / totFte[i] : 0;
          over = totPosts[i] ? companyOverhead[i] * o.posts / totPosts[i] : 0;
          plan = o.posts * (o.is24 ? 2 : 1);
          const pm = 0.0085 * (1 - 0.65*Math.min(1.2,e)) * (SC.k===0 && i>=LAUNCH_DEMO ? 1.1 : 1), pl = 0.04 * (1 - 0.5*Math.min(1.2,e));
          if (i === FACT_END){ missed = NARRATIVE[o.id] ? 1 : 0; late = h(o.id,i,3) < pl*plan ? 1 : 0; }
          else { missed = h(o.id,i,1) < pm*plan ? 1 : 0; late = h(o.id,i,2) < pl*plan ? 1 : 0; }
        }
        const c=o.c; c.rev[i+1]=c.rev[i]+rev; c.guard[i+1]=c.guard[i]+guard; c.direct[i+1]=c.direct[i]+direct; c.overhead[i+1]=c.overhead[i]+over;
        c.plan[i+1]=c.plan[i]+plan; c.missed[i+1]=c.missed[i]+missed; c.late[i+1]=c.late[i]+late;
      }
    }
    const sumO = (o,k,from,to) => { const a = Math.max(from,0), b = Math.min(to,DAYS-1); return b < a ? 0 : o.c[k][b+1] - o.c[k][a]; };

    // ---------- книга проводок ----------
    const ACC = ['cash','ar','inv','fa','accdep','ap','salpay','paytax','vat','citpay','leasing','charter','reserve','re','rev','guardC','adminC','uniform','transport','comms','office','other','it','dep','interest','cit','dividends'];
    const A = Object.fromEntries(ACC.map((a,k)=>[a,k])), NA = ACC.length;
    const CF = ['inCustomers','salaries','payrollTaxes','vat','cit','suppliers','capex','leasingPay','dividends'];
    const C = Object.fromEntries(CF.map((a,k)=>[a,k])), NC = CF.length;
    const delta = new Float64Array(DAYS*NA), cfDelta = new Float64Array(DAYS*NC);
    let imbalance = 0;
    function post(i, lines, cfLine){
      if (i < 0 || i >= DAYS) return;
      let s = 0; for (const [a,v] of lines){ delta[i*NA + A[a]] += v; s += v; }
      imbalance += Math.abs(s);
      if (cfLine){ const cash = lines.find(l=>l[0]==='cash'); if (cash) cfDelta[i*NC + C[cfLine]] += cash[1]; }
    }
    const monthAcc = Array.from({length:NY*12}, () => ({ salNet:0, payTax:0, vat:0, cit:0, ap:0 }));
    const decRev = c => c.objects.filter(o=>o.start<0).reduce((s,o)=>s+o.posts*Math.round(P.tariff24[2022]*(o.is24?1:P.tariffDay[2022]/P.tariff24[2022])*0.96*o.tk/1000)*1000,0);
    const dec21 = customers.reduce((s,c)=>s+decRev(c),0);
    const ar0 = dec21*1.12, sal0 = dec21*0.55, pt0 = dec21*0.20, vat0 = dec21*0.12*0.85, ap0 = 5200000;
    const re0 = P.cash0 + ar0 + P.inventory + P.faGross0 - P.accDep0 - ap0 - sal0 - pt0 - vat0 - P.charter;
    post(0, [['cash',P.cash0],['ar',ar0],['inv',P.inventory],['fa',P.faGross0],['accdep',-P.accDep0],['ap',-ap0],['salpay',-sal0],['paytax',-pt0],['vat',-vat0],['charter',-P.charter],['re',-re0]]);
    post(idxOf(Y0,0,5), [['salpay',sal0],['cash',-sal0]], 'salaries');
    post(idxOf(Y0,0,15), [['ap',ap0],['cash',-ap0]], 'suppliers');
    post(idxOf(Y0,0,25), [['paytax',pt0],['vat',vat0],['cash',-(pt0+vat0)]], 'payrollTaxes');
    let leasingBal = 0;
    const OPX = ['uniform','transport','comms','office','other','it'];
    for (let i=0;i<DAYS;i++){
      const r = R(i), m = monthIdx(i), ma = monthAcc[m], ox = opexDay(i);
      let rev=0, guard=0;
      for (const o of objects){ rev += sumO(o,'rev',i,i); guard += sumO(o,'guard',i,i); }
      post(i, [['ar', rev*(1+r.vat)], ['rev', -rev], ['vat', -rev*r.vat]]);
      for (const [acc, E] of [['guardC', guard], ['adminC', adminCostDay[i]]]){
        const gross = E/(1+r.employer);
        post(i, [[acc, E], ['salpay', -gross*(1-r.withholding)], ['paytax', -gross*(r.withholding+r.employer)]]);
        ma.salNet += gross*(1-r.withholding); ma.payTax += gross*(r.withholding+r.employer);
      }
      let opx = 0;
      for (const k of OPX){ const x = ox[k]; if (!x) continue; opx += x; post(i, [[k, x], ['vat', x*r.vat], ['ap', -x*(1+r.vat)]]); ma.ap += x*(1+r.vat); }
      ma.vat += rev*r.vat - opx*r.vat;
      const faGross = P.faGross0 + P.capex.filter(c=>c[0]<=i).reduce((s,c)=>s+c[1],0) + (i>=P.leasing.day ? P.leasing.amount : 0);
      const dep = faGross / P.depMonths / dim(i);
      post(i, [['dep', dep], ['accdep', -dep]]);
      let interest = 0;
      if (i === P.leasing.day){ post(i, [['fa', P.leasing.amount], ['leasing', -P.leasing.amount]]); leasingBal = P.leasing.amount; }
      if (leasingBal > 0){ interest = leasingBal * P.leasing.rate / 365; post(i, [['interest', interest], ['leasing', -interest]]); leasingBal += interest; }
      if (leasingBal > 0 && dOf(i) === 12 && i > P.leasing.day){ const pay = Math.min(P.leasing.pay, leasingBal); post(i, [['leasing', pay], ['cash', -pay]], 'leasingPay'); leasingBal -= pay; }
      const ebt = rev - guard - adminCostDay[i] - opx - dep - interest;
      post(i, [['cit', ebt*r.cit], ['citpay', -ebt*r.cit]]); ma.cit += ebt*r.cit;
    }
    for (let m=0;m<NY*12;m++){
      const ma = monthAcc[m], nx = MONTHS[m].end + 1;
      post(nx+4, [['salpay', ma.salNet], ['cash', -ma.salNet]], 'salaries');
      post(nx+14, [['ap', ma.ap], ['cash', -ma.ap]], 'suppliers');
      post(nx+24, [['paytax', ma.payTax], ['cash', -ma.payTax]], 'payrollTaxes');
      post(nx+24, [['vat', ma.vat], ['cash', -ma.vat]], 'vat');
      post(nx+24, [['citpay', ma.cit], ['cash', -ma.cit]], 'cit');
    }
    P.capex.forEach(([i, amt]) => post(i, [['fa', amt], ['cash', -amt]], 'capex'));
    const divK = i => i < LAUNCH_DEMO ? 1 : ({ none:0.4, pess:0.7, base:1, opt:1.25 })[scnKey] || 1;
    P.dividends.forEach(([i, amt]) => post(i, [['dividends', amt*divK(i)], ['cash', -amt*divK(i)]], 'dividends'));
    // акты и оплаты: после старта системы — напоминания и контроль сроков сокращают задержки; без системы — дисциплина ухудшается
    const acts = [];
    for (const c of customers){
      const c0 = decRev(c)*1.12;
      if (c0 > 0) acts.push({ cust:c, month:-1, actDay:-1, amount:c0, due:-1+c.payDays, pay:-1+c.payDays+Math.round(c.delayMean*(0.4+h(c.id,0,5))) });
      for (let m=0;m<NY*12;m++){
        const M0 = MONTHS[m]; let amt = 0;
        for (const o of c.objects) amt += sumO(o,'rev',M0.start,M0.end) * (1+RATES[M0.y].vat);
        if (amt <= 0) continue;
        const e = eff(M0.end), trend = SC.arTrend && M0.end >= LAUNCH_DEMO ? 1 + SC.arTrend*(M0.end-LAUNCH_DEMO)/365 : 1;
        const dm = c.delayMean * (1 - 0.6*Math.min(1,e)) * trend;
        const late = Math.round(dm*(0.4+1.2*h(c.id,m,5))) - (h(c.id,m,6)<0.15 ? 4 : 0);
        acts.push({ cust:c, month:m, actDay:M0.end, amount:amt, due:M0.end+c.payDays, pay:M0.end+c.payDays+late, dm });
      }
    }
    if (loss) acts.filter(a => a.cust===loss.customer && a.actDay >= idxOf(2026,7,1)).forEach(a => a.pay = a.due + 95);
    acts.forEach(a => post(a.pay, [['cash', a.amount], ['ar', -a.amount]], 'inCustomers'));
    // индекс актов по заказчику и месяцу: дебиторка, сроки и прогноз 13 недель не перебирают все акты
    const actsByCust = new Map(), actByCustMonth = new Map();
    for (const a of acts){ let l = actsByCust.get(a.cust); if (!l){ l = []; actsByCust.set(a.cust, l); actByCustMonth.set(a.cust, new Map()); } l.push(a); actByCustMonth.get(a.cust).set(a.month, a); }

    const cum = new Float64Array((DAYS+1)*NA), cfCum = new Float64Array((DAYS+1)*NC);
    const buildCum = () => { for (let i=0;i<DAYS;i++){ for (let a=0;a<NA;a++) cum[(i+1)*NA+a] = cum[i*NA+a] + delta[i*NA+a]; for (let a=0;a<NC;a++) cfCum[(i+1)*NC+a] = cfCum[i*NC+a] + cfDelta[i*NC+a]; } };
    buildCum();
    const bal = (acc, i) => i < 0 ? 0 : cum[(Math.min(i,DAYS-1)+1)*NA + A[acc]];
    const turn = (acc, from, to) => bal(acc,to) - bal(acc,from-1);
    const cfTurn = (line, from, to) => cfCum[(Math.min(to,DAYS-1)+1)*NC + C[line]] - cfCum[Math.max(from,0)*NC + C[line]];

    // ---------- отчёты компании ----------
    const PL_EXP = ['guardC','adminC','uniform','transport','comms','office','other','it','dep','interest','cit'];
    function pl(from, to){
      const x = { revenue: -turn('rev',from,to) };
      PL_EXP.forEach(k => x[k] = turn(k,from,to));
      x.opex = x.uniform + x.transport + x.comms + x.office + x.other + x.it;
      x.ebitda = x.revenue - x.guardC - x.adminC - x.opex;
      x.ebit = x.ebitda - x.dep; x.ebt = x.ebit - x.interest; x.net = x.ebt - x.cit;
      return x;
    }
    const plCum = to => to < 0 ? 0 : -['rev',...PL_EXP].reduce((s,k)=>s+bal(k,to),0);
    // резервный капитал: 31.12 каждого года Дт «нераспределённая прибыль» Кт «резервный капитал» — внутри капитала, итог капитала не меняется
    const reserveLog = [];
    { let res = 0;
      for (let y=Y0; y<Y0+NY; y++){
        const a = idxOf(y,0,1), z = idxOf(y,11,31), net = plCum(z) - plCum(a-1);
        const x = Math.round(Math.max(0, Math.min(P.reserve.rate*net, P.reserve.cap*P.charter - res)));
        reserveLog.push({ y, day:z, net, amount:x, after:res + x });
        if (x > 0){ post(z, [['re', x], ['reserve', -x]]); res += x; }
      }
      buildCum();
    }
    const RE0 = re0;
    // капитал по составу на конец дня i (i < 0 — входящие остатки 01.01.2022)
    const equityAt = i => i < 0 ? { charter:P.charter, reserve:0, re:RE0 } : { charter:-bal('charter',i), reserve:-bal('reserve',i), re:-bal('re',i) + plCum(i) - bal('dividends',i) };
    function balance(i){
      const yStart = idxOf(yOf(i),0,1), v = k => bal(k,i);
      const x = { cash: v('cash'), ar: v('ar'), inv: v('inv'), faNet: v('fa') + v('accdep'), faGross: v('fa'),
        ap: -v('ap'), salpay: -v('salpay'), paytax: -v('paytax'), vat: -v('vat'), citpay: -v('citpay'), leasing: -v('leasing'), charter: -v('charter'),
        reserve: -v('reserve'), toReserveYear: -(v('reserve') - bal('reserve',yStart-1)), profitYear: plCum(i) - plCum(yStart-1), dividendsYear: bal('dividends',i) - bal('dividends',yStart-1) };
      x.reStart = -v('re') + x.toReserveYear + plCum(yStart-1) - bal('dividends',yStart-1);                 // нераспределённая прибыль на 01.01 (без резерва)
      x.re = x.reStart + x.profitYear - x.dividendsYear - x.toReserveYear;                                   // нераспределённая прибыль на дату
      x.assets = x.cash + x.ar + x.inv + x.faNet; x.taxes = x.paytax + x.vat + x.citpay;
      x.liabilities = x.ap + x.salpay + x.taxes + x.leasing; x.equity = x.charter + x.reserve + x.re;
      x.netAssets = x.assets - x.liabilities; x.equityStart = x.charter + x.reserve - x.toReserveYear + x.reStart;
      x.diff = x.assets - x.liabilities - x.equity;
      return x;
    }
    // отчёт об изменениях капитала за период (МСФО IAS 1): остаток на начало + прибыль − дивиденды ± резерв ± уставный = остаток на конец
    function equityChanges(from, to){
      from = Math.max(0, from); to = Math.min(to, DAYS-1);
      const open = equityAt(from-1), close = equityAt(to), sum = e => e.charter + e.reserve + e.re;
      const profit = pl(from,to).net, dividends = turn('dividends',from,to), toReserve = -turn('reserve',from,to), charterChange = close.charter - open.charter;
      const total = { open: sum(open), close: sum(close) };
      const other = total.close - total.open - (profit - dividends + charterChange);
      return { from, to, open, close, profit, dividends, toReserve, charterChange, other, total, check: total.close - balance(to).equity };
    }
    function cashflow(from, to){
      const x = { open: from <= 0 ? P.cash0 : bal('cash',from-1), close: bal('cash',to) };
      CF.forEach(k => x[k] = cfTurn(k,from,to));
      x.operating = x.inCustomers + x.salaries + x.payrollTaxes + x.vat + x.cit + x.suppliers;
      x.investing = x.capex; x.financing = x.leasingPay + x.dividends; x.net = x.close - x.open;
      return x;
    }
    function receivables(i, filterCust){
      const out = { total:0, billed:0, unbilled:0, overdue:0, overdue30:0, byCust:new Map() };
      for (const [cust, list] of actsByCust){ if (filterCust && !filterCust(cust)) continue; for (const a of list){
        if (a.actDay > i) break;                                  // акты заказчика идут по возрастанию даты
        if (a.pay > i){
          const e = out.byCust.get(a.cust) || { cust:a.cust, debt:0, overdue:0, maxDays:0 };
          e.debt += a.amount; out.billed += a.amount;
          if (a.due < i){ e.overdue += a.amount; out.overdue += a.amount; e.maxDays = Math.max(e.maxDays, i - a.due); if (i - a.due > 30) out.overdue30 += a.amount; }
          out.byCust.set(a.cust, e);
        }
      } }
      const M0 = MONTHS[monthIdx(Math.min(i,DAYS-1))];
      if (i < M0.end) for (const c of customers){ if (filterCust && !filterCust(c)) continue; let u=0; for (const o of c.objects) u += sumO(o,'rev',M0.start,i)*(1+RATES[M0.y].vat); out.unbilled += u; }
      out.total = out.billed + out.unbilled;
      return out;
    }
    function aging(i, filterCust){
      const b = { notDue:0, d30:0, d60:0, d90:0, d90p:0 };
      for (const [cust, list] of actsByCust){ if (filterCust && !filterCust(cust)) continue; for (const a of list){ if (a.actDay > i) break; if (a.pay <= i) continue;
        const late = i - a.due; if (late <= 0) b.notDue += a.amount; else if (late <= 30) b.d30 += a.amount; else if (late <= 60) b.d60 += a.amount; else if (late <= 90) b.d90 += a.amount; else b.d90p += a.amount; } }
      return b;
    }
    function forecast13(i){
      const weeks = Array.from({length:13}, (_,w) => ({ w, from: i+1+7*w, to: i+7+7*w, inflow:0, salaries:0, taxes:0, suppliers:0 }));
      const wk = d => { const k = Math.floor((d - i - 1)/7); return k>=0 && k<13 ? weeks[k] : null; };
      for (const a of acts){ if (a.actDay > i || a.pay <= i) continue; const w = wk(Math.max(i+1, a.due + Math.round(a.dm ?? a.cust.delayMean))); if (w) w.inflow += a.amount; }
      const mi = monthIdx(i), lastFull = MONTHS[mi].end === i ? mi : mi-1, ref = monthAcc[Math.max(0,lastFull)];
      for (let m = lastFull+1; m < Math.min(NY*12, mi+5); m++){ const M0 = MONTHS[m]; for (const c of customers){ const cm = actByCustMonth.get(c), ra = cm && cm.get(Math.max(0,lastFull)); if (!ra || !c.objects.some(o=>active(o,i))) continue; const w = wk(M0.end + c.payDays + Math.round(ra.dm ?? c.delayMean)); if (w) w.inflow += ra.amount; } }
      for (let m = Math.max(0, mi-1); m < Math.min(NY*12, mi+4); m++){ const acc = m <= lastFull ? monthAcc[m] : ref, nx = MONTHS[m].end + 1; let w; if ((w = wk(nx+4))) w.salaries += acc.salNet; if ((w = wk(nx+14))) w.suppliers += acc.ap; if ((w = wk(nx+24))) w.taxes += acc.payTax + acc.vat + acc.cit; }
      let cash = bal('cash', i);
      weeks.forEach(w => { w.outflow = w.salaries + w.taxes + w.suppliers; cash += w.inflow - w.outflow; w.cash = cash; });
      return weeks;
    }
    function taxes(from, to){
      const r = R(to), x = { fotGross:0, opv:0, vosms:0, ipn:0, so:0, oosms:0, opvr:0, sn:0, vat:0 };   // каждый день — по ставкам своего года
      for (let i=Math.max(0,from); i<=Math.min(to,DAYS-1); i++){ const ri=R(i); let g=0; for (const o of objects) g += sumO(o,'guard',i,i); const f = (g + adminCostDay[i])/(1+ri.employer);
        x.fotGross += f; x.opv += f*ri.opv; x.vosms += f*ri.vosms; x.ipn += f*(1-ri.opv-ri.vosms)*ri.ipn; x.so += f*ri.so; x.oosms += f*ri.oosms; x.opvr += f*ri.opvr; x.sn += f*Math.max(0, ri.sn-ri.so);
        x.vat += (-turn('rev',i,i) - OPX.reduce((s2,k)=>s2+turn(k,i,i),0))*ri.vat; }
      x.cit = turn('cit',from,to);
      x.employee = x.opv + x.vosms + x.ipn; x.employerSum = x.so + x.oosms + x.opvr + x.sn; x.total = x.employee + x.employerSum + x.vat + x.cit;
      x.paid = -(cfTurn('payrollTaxes',from,to) + cfTurn('vat',from,to) + cfTurn('cit',from,to)); x.rates = r;
      return x;
    }
    function upcoming(i){
      const m = monthIdx(i), d = dOf(i);
      const sm = d < 5 ? m-1 : m, tm = d < 25 ? m-1 : m;
      const sal = sm >= 0 ? monthAcc[sm].salNet : 0, tax = tm >= 0 ? monthAcc[tm].payTax + monthAcc[tm].vat + monthAcc[tm].cit : 0;
      const nx = k => MONTHS[Math.min(NY*12-1, k+1)].start;
      const tA = tm >= 0 ? monthAcc[tm] : { payTax:0, vat:0, cit:0 };
      return { salDay: (sm>=0 ? nx(sm) : 0) + 4, sal, salFor: sm, taxDay: (tm>=0 ? nx(tm) : 0) + 24, tax, taxFor: tm, taxPay: tA.payTax, taxVat: tA.vat, taxCit: tA.cit };
    }
    function objView(o, from, to, asOf){
      const rev = sumO(o,'rev',from,to), guard = sumO(o,'guard',from,to), direct = sumO(o,'direct',from,to), overhead = sumO(o,'overhead',from,to), profit = rev - guard - direct - overhead;
      return { o, rev, guard, direct, overhead, profit, margin: rev ? profit/rev*100 : 0, plan: sumO(o,'plan',from,to), missed: sumO(o,'missed',from,to), late: sumO(o,'late',from,to), activeNow: active(o, asOf), tariffNow: tariff(o, Math.min(asOf,DAYS-1)) };
    }

    // ---------- кадры ----------
    const hrCum = { hires:new Float64Array(DAYS+1), fires:new Float64Array(DAYS+1) };
    const guardsReq = i => Math.round(totFte[Math.min(i,DAYS-1)] * 1.03);
    const turnoverRate = i => { const e = eff(i); return SC.k===0 && i>=LAUNCH_DEMO ? 0.36 : 0.32*(1 - 0.45*Math.min(1.2,e)); };
    for (let i=0;i<DAYS;i++){
      const need = guardsReq(i), prev = i ? guardsReq(i-1) : need;
      const p = need*turnoverRate(i)/365, base = Math.floor(p), fires = base + (h(i,901) < p-base ? 1 : 0);
      hrCum.hires[i+1] = hrCum.hires[i] + fires + Math.max(0, need - prev); hrCum.fires[i+1] = hrCum.fires[i] + fires + Math.max(0, prev - need);
    }
    function hr(i){
      const guards = guardsReq(i), admin = adminCount(i), total = guards + admin, m = mOf(i);
      const vac = Math.round(guards * 0.065 * (m>=5&&m<=7 ? 1.7 : (m===11 ? 1.3 : 1)) * (0.85+0.3*h(i,903)));
      const sick = Math.round(guards * 0.022 * (m<=2||m>=10 ? 1.5 : 0.9) * (0.8+0.4*h(i,904)));
      const absent = objects.reduce((s,o)=>s+sumO(o,'missed',i,i),0);
      const cert30 = Math.round(guards * (0.045 + 0.04*h(Math.floor(i/7),905)) * (1 - 0.4*Math.min(1,eff(i))));
      return { guards, admin, total, vac, sick, absent, cert30, cert90: Math.round(cert30*2.6), training: Math.round(guards*0.05), medical: Math.round(guards*0.028), permits: 2 + Math.floor(h(Math.floor(i/14),906)*3) };
    }
    const hrRange = (from, to) => { const a = Math.max(from,0), b = Math.min(to,DAYS-1); return { hires: hrCum.hires[b+1]-hrCum.hires[a], fires: hrCum.fires[b+1]-hrCum.fires[a] }; };

    // ---------- события ----------
    const INC_TYPES = [[0.30,'ложное срабатывание сигнализации'],[0.22,'нарушение пропускного режима'],[0.14,'дисциплина охранника'],[0.12,'жалоба заказчика'],[0.10,'попытка проникновения'],[0.07,'медицинский случай'],[0.05,'повреждение имущества']];
    const RESULT = { 'ложное срабатывание сигнализации':'проверено ГБР, ложное', 'нарушение пропускного режима':'пресечено, передано заказчику', 'дисциплина охранника':'объяснительная, разбор', 'жалоба заказчика':'разбор с начальником объекта, ответ заказчику', 'попытка проникновения':'пресечена, вызвана полиция', 'медицинский случай':'первая помощь, скорая', 'повреждение имущества':'акт, претензия виновнику' };
    const incidents = [];
    for (const o of objects) for (let i=0;i<=FACT_END;i++){
      if (!active(o,i)) continue; const e = eff(i);
      if (h(o.id,i,31) < (o.is24 ? 0.0105 : 0.006) * (o.posts/2) * (1 - 0.3*Math.min(1,e))){
        const type = pickW(h(o.id,i,32), INC_TYPES);
        incidents.push({ day:i, time: String(Math.floor(h(o.id,i,33)*24)).padStart(2,'0')+':'+String(Math.floor(h(o.id,i,34)*60)).padStart(2,'0'), obj:o, type, result:RESULT[type], closeDay: i + 1 + Math.floor(h(o.id,i,35)*6*(1-0.4*Math.min(1,e))), react: Math.round((6 + h(o.id,i,36)*12)*(1-0.25*Math.min(1,e))) });
      }
    }
    incidents.sort((a,b)=>b.day-a.day || b.time.localeCompare(a.time));
    const checks = [];
    for (const o of objects) for (let m=0;m<NY*12;m++){
      const M0 = MONTHS[m]; if (M0.start > FACT_END) break;
      const e = eff(M0.start), n = h(o.id,m,40) < (0.55 + 0.45*Math.min(1,e)) ? 1 : 0;          // с системой проверки — каждый месяц
      if (!n) continue;
      const day = M0.start + Math.floor(h(o.id,m,41)*M0.dim); if (day > FACT_END || !active(o,day)) continue;
      const score = pickW(h(o.id,m,42), [[0.55,5],[0.28,4],[0.12,3],[0.05,2]]);
      const who = pickW(h(o.id,m,43), [[0.5,'Начальник охраны'],[0.35,'Зам. по регионам'],[0.15,'Исп. директор']]);
      const ch = { day, obj:o, who, score, result: score>=5?'замечаний нет':(score===4?'мелкие замечания, устранены на месте':'нарушение — выдано предписание') };
      if (score <= 3) ch.presc = { what: pickW(h(o.id,m,44), [[0.3,'журнал приёма-сдачи ведётся с пропусками'],[0.25,'форма не по сезону'],[0.2,'нет освещения поста'],[0.15,'не обновлена инструкция поста'],[0.1,'неисправна рация']]), fixDay: day + 2 + Math.floor(h(o.id,m,45)*10*(1-0.5*Math.min(1,e))) };
      checks.push(ch);
    }
    checks.sort((a,b)=>b.day-a.day);
    const prescOpen = i => checks.filter(c => c.presc && c.day <= i && c.presc.fixDay > i);

    // ---------- продажи ----------
    const reqs = [];
    for (let i=0;i<=FACT_END;i++) if (h(i,51) < 0.5 + 0.15*Math.min(1,eff(i))){
      const e = eff(i), kp = h(i,52) < 0.62 + 0.15*Math.min(1,e), neg = kp && h(i,53) < 0.48 + 0.12*Math.min(1,e);
      reqs.push({ day:i, kpDay: kp ? i+3 : null, negDay: neg ? i+10 : null });
    }
    function funnel(from, to, f){
      const inR = d => d!=null && d>=from && d<=to, os = objects.filter(o => !f || f(o));
      return { requests: reqs.filter(r=>inR(r.day)).length, kp: reqs.filter(r=>inR(r.kpDay)).length, neg: reqs.filter(r=>inR(r.negDay)).length,
        signed: os.filter(o=>inR(o.signDay)).length, launched: os.filter(o=>inR(o.start)).length, terminated: os.filter(o=>inR(o.terminated)).length };
    }
    const CAC = { 'Прямой договор':380000, 'Тендер / госзакупки':920000, 'Субподряд партнёра':150000, 'Заявка с сайта':450000 };

    // ---------- автопарк, 1С, документы, задачи ----------
    function fleetAt(cars, i){
      return cars.map(c => {
        const kmMonth = c.role.includes('ГБР') ? 2900 : (c.role.includes('развозка') ? 3400 : 2100);
        const kmAt = Math.max(0, Math.round(c.km - kmMonth*(FACT_END - i)/30.4)); const next = Math.ceil((kmAt+1)/10000)*10000;
        const anniv = s => { const [y,m,d] = s.split('-').map(Number); let a = idxOf(y,m-1,d); while (a - 365 > i) a -= 365; while (a < i) a += 365; return a; };
        const ins = anniv(c.insurance), insp = anniv(c.inspection);
        return { ...c, kmAt, toLeft: next - kmAt, insDay: ins, inspDay: insp, insLeft: ins - i, inspLeft: insp - i };
      });
    }
    // расходы автопарка = строка «Транспорт и ГСМ» ОПиУ, распределённая по машинам долей их нормы расходов
    const fleetCost = (cars, from, to) => { const t = pl(Math.max(0,from), Math.min(to,DAYS-1)).transport; return cars.reduce((s,c)=>s + t*c.costM/P.opex.transport, 0); };
    function onec(i){
      const fail = i === FACT_END ? 'effector' : (h(i,61) < 0.012 ? 'export' : null);
      const used = Math.min(0.83, 0.40 + 0.43*Math.max(0, i - idxOf(2025,0,1))/(FACT_END - idxOf(2025,0,1)));
      return { exportsOk: fail==='export' ? 143 - Math.floor(h(i,62)*5) : 144, exportsTotal:144, effectorOk: fail!=='effector', exportRejected: fail==='export', sessions: 5 + Math.floor(h(i,63)*5), errors: fail ? 3 : Math.floor(h(i,64)*3), diskBackupFree: Math.max(0.17, 1 - used), cpu: 18 + Math.floor(h(i,65)*25), ram: 52 + Math.floor(h(i,66)*16), live: i >= LAUNCH_DEMO && SC.k>0 };
    }
    const DOC_TYPES = [['Приказ',1.1],['Служебная записка',0.25],['Акт проверки',0.6],['Договор / допсоглашение',0.15],['График смен',1.55],['Табель',1.55],['Заявка на закупку',0.14],['Акт неисправности',0.1],['Отчёт директору',1.0],['Претензия / ответ',0.07]];
    function docs(from, to){ return DOC_TYPES.map(([t, perDay], k) => { let n = 0; for (let i=Math.max(0,from); i<=Math.min(to,FACT_END); i++){ const x = perDay * (t==='График смен'||t==='Табель' ? (dOf(i)<=3 ? 15 : 0) : 1); n += Math.floor(x) + (h(i,k,71) < x%1 ? 1 : 0); } return { type:t, n }; }); }
    const TASK_OWN = ['Начальник охраны','Кадровик','Юрист','Бухгалтер','Снабженец','Механик','Коммерческий директор','Администратор системы'];
    const TASK_TXT = { 'Начальник охраны':'Закрыть смену / разобрать замечание', 'Кадровик':'Приказ и обновление графика', 'Юрист':'Проверка проекта договора / ответа заказчику', 'Бухгалтер':'Сверка оплат и акт сверки', 'Снабженец':'Заявка на имущество для поста', 'Механик':'ТО / страховка автомобиля', 'Коммерческий директор':'Письмо заказчику по оплате / тарифу', 'Администратор системы':'Проверка копий и выгрузок 1С' };
    const TASK_SRC = ['сигнал','регламент','поручение','срок документа','дебиторка','проверка'];
    const tasksAll = [];
    for (let i=Math.max(0,LAUNCH_DEMO-60);i<=FACT_END;i++){ const n = 1 + Math.floor(h(i,81)*3); for (let k=0;k<n;k++){ const own = TASK_OWN[Math.floor(h(i,k,82)*TASK_OWN.length)], life = 1 + Math.floor(h(i,k,83)*7), obj = objects[Math.floor(h(i,k,84)*objects.length)]; tasksAll.push({ no:'T-'+(1000+tasksAll.length), title: TASK_TXT[own] + ' — ' + obj.name, owner:own, src: TASK_SRC[Math.floor(h(i,k,85)*TASK_SRC.length)], created:i, due: i+life, done: h(i,k,86) < 0.08 ? i+life+2+Math.floor(h(i,k,87)*4) : i+life-Math.floor(h(i,k,88)*life), pr: h(i,k,89)<0.15?'срочно':(h(i,k,90)<0.4?'высокий':'средний') }); } }
    objects.filter(o=>o.missedPost).forEach((o,k)=>tasksAll.push({ no:'T-'+(5000+k), title:`Закрыть смену: ${o.name}, пост ${o.missedPost} — замена из резерва`, owner:'Начальник охраны', src:'сигнал', created:FACT_END, due:FACT_END, done:9999, pr:'срочно', story:true }));
    tasksAll.push({ no:'T-5010', title:'Перенести старые копии на архивный диск (без удаления), повторить задание Effector Saver', owner:'Администратор системы', src:'1С', created:FACT_END, due:FACT_END, done:9999, pr:'срочно', story:true, wait:true });
    function tasksAt(i){ return tasksAll.filter(t => t.created <= i && t.done > i).map(t => { const age = i - t.created, life = Math.max(1, t.due - t.created); return { ...t, status: t.wait ? 'ждёт разрешения' : (age/life < 0.4 ? 'в работе' : (age/life < 0.8 ? 'на проверке' : 'на согласовании')), overdue: t.due < i }; }); }
    const tasksDone = (from, to) => tasksAll.filter(t => t.done >= from && t.done <= to);
    const tasksCreated = (from, to) => tasksAll.filter(t => t.created >= from && t.created <= to).length;
    function budget(from, to){
      const f = pl(from, to); let k = 0, n = 0;
      for (let m=monthIdx(Math.max(from,0)); m<=monthIdx(Math.min(to,DAYS-1)); m++){ k += 1 + 0.06*(h(m,91)-0.35); n++; }
      const kr = n ? k/n : 1;
      const plan = { revenue: f.revenue*kr, guardC: f.guardC*kr*0.985, adminC: f.adminC, uniform: f.uniform*1.02, transport: f.transport*0.95, comms: f.comms, office: f.office, other: f.other*1.08, it: f.it };
      plan.opex = plan.uniform + plan.transport + plan.comms + plan.office + plan.other + plan.it; plan.ebitda = plan.revenue - plan.guardC - plan.adminC - plan.opex;
      return { plan, fact: f };
    }

    return { scenario: scnKey, SC, SCENARIOS, Y0, NY, DAYS, FACT_END, LAUNCH_DEMO, LAUNCH, DAY0, MONTHS, toDate, idxOf, fmt, fmtShort, iso, fromIso, yOf, mOf, dOf, monthIdx, RATES, R, FX, fx, P, REGIONS, CHANNELS, CAC,
      customers, objects, active, tariff, sumO, objView, upcoming, pl, balance, equityChanges, equityAt, reserveLog, accBal: bal, accTurn: turn, cashflow, receivables, aging, forecast13, taxes, hr, hrRange, incidents, checks, prescOpen, funnel, fleetAt, fleetCost, onec, docs, tasksAt, tasksDone, tasksCreated, budget, acts, eff,
      totPosts: i => totPosts[Math.max(0,Math.min(i,DAYS-1))], totFte: i => totFte[Math.max(0,Math.min(i,DAYS-1))], adminCount, ledgerImbalance: () => imbalance };
  }

  const cache = {};
  window.buildWorld = key => cache[key] || (cache[key] = build(key));
  window.SCENARIOS = SCENARIOS;
  window.WORLD = window.buildWorld('base');
})();
