/* =========================================================
   Chaldean Numerology Engine + i18n
   Author: Amol Gadage
   ========================================================= */

/* ---------- 1. Chaldean letter map ----------
   Values 1–8 only. 9 is sacred and never assigned to a letter. */
const CHALDEAN = {
  A:1, I:1, J:1, Q:1, Y:1,
  B:2, K:2, R:2,
  C:3, G:3, L:3, S:3,
  D:4, M:4, T:4,
  E:5, H:5, N:5, X:5,
  U:6, V:6, W:6,
  O:7, Z:7,
  F:8, P:8
};

/* Chart display, grouped by value */
const CHART_GROUPS = [
  { num: 1, letters: 'A I J Q Y' },
  { num: 2, letters: 'B K R' },
  { num: 3, letters: 'C G L S' },
  { num: 4, letters: 'D M T' },
  { num: 5, letters: 'E H N X' },
  { num: 6, letters: 'U V W' },
  { num: 7, letters: 'O Z' },
  { num: 8, letters: 'F P' },
];

/* Ruling planet per single digit */
const PLANETS = {
  1: 'Sun', 2: 'Moon', 3: 'Jupiter', 4: 'Rahu (Uranus)', 5: 'Mercury',
  6: 'Venus', 7: 'Ketu (Neptune)', 8: 'Saturn', 9: 'Mars'
};

/* Which single digits are traditionally considered favourable for a name */
const FAVOURABLE_SINGLE = new Set([1, 3, 5, 6]);

/* Number friendship matrix (widely used Chaldean/Vedic numerology table).
   For each number 1–9: which numbers are Friendly / Enemy. Anything not
   listed in either is treated as Neutral. */
const FRIENDS = {
  1: [1, 2, 3, 5, 6, 9],
  2: [1, 2, 3, 5],
  3: [1, 2, 3, 5, 9],
  4: [1, 5, 6, 7],
  5: [1, 2, 3, 5, 6, 9],
  6: [1, 5, 6, 7, 8],
  7: [1, 4, 5, 6, 7],
  8: [5, 6, 8],
  9: [1, 3, 5, 9],
};
const ENEMIES = {
  1: [8],
  2: [7, 8],
  3: [8],
  4: [8, 9],
  5: [],
  6: [9],
  7: [8, 9],
  8: [1, 2, 4, 9],
  9: [2, 4, 8],
};

/** Relationship between two single digits: 'good' | 'neutral' | 'warn'.
    Friendship/enmity is inherently mutual, but the FRIENDS/ENEMIES tables
    above are hand-authored per-number lists and don't all list their mirror
    entry (e.g. 4 lists 1 as a friend, but 1 doesn't list 4 back) — so the
    lookup checks both directions rather than assuming the tables are symmetric. */
function relation(a, b) {
  const isFriend = (x, y) => (FRIENDS[x] && FRIENDS[x].includes(y));
  const isEnemy  = (x, y) => (ENEMIES[x] && ENEMIES[x].includes(y));
  if (isFriend(a, b) || isFriend(b, a)) return 'good';
  if (isEnemy(a, b) || isEnemy(b, a)) return 'warn';
  return 'neutral';
}

/** Parse a yyyy-mm-dd date string into Mulank & Bhagyank.
    Mulank   = day of month reduced to a single digit.
    Bhagyank = full date (d+m+y digits) reduced to a single digit. */
function calcDob(dobStr) {
  if (!dobStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobStr);
  if (!m) return null;
  const [, year, month, day] = m;

  const mulank = reduceToSingle(Number(day)).single;

  const allDigits = (day + month + year).split('')
    .reduce((s, d) => s + Number(d), 0);
  const bhagyank = reduceToSingle(allDigits).single;

  return { mulank, bhagyank };
}

/* =========================================================
   2. Core Chaldean math
   ========================================================= */

/** Sum every A–Z letter's Chaldean value. Everything else is ignored. */
function letterBreakdown(name) {
  const items = [];
  for (const raw of name.toUpperCase()) {
    if (CHALDEAN[raw]) items.push({ letter: raw, value: CHALDEAN[raw] });
  }
  return items;
}

/** Reduce a number to a single digit (1–9), keeping the reduction trail. */
function reduceToSingle(n) {
  const trail = [n];
  while (n > 9) {
    n = String(n).split('').reduce((s, d) => s + Number(d), 0);
    trail.push(n);
  }
  return { single: n, trail };
}

/** Full calculation for a name. */
function calculate(name) {
  const items = letterBreakdown(name);
  const compound = items.reduce((s, it) => s + it.value, 0);
  const { single, trail } = reduceToSingle(compound);
  return { items, compound, single, trail };
}

/** Mobile number numerology: sum every digit (ignoring +, spaces, dashes,
    parentheses), then reduce to a single digit (1–9). Returns null if the
    input has no digits at all. */
function calculateMobile(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  const compound = digits.split('').reduce((s, d) => s + Number(d), 0);
  const { single, trail } = reduceToSingle(compound);
  return { digits, compound, single, trail };
}

/** Vehicle registration-plate numerology: Chaldean value for every letter
    (state/RTO code) PLUS the face value of every digit (the plate's own
    number), summed and reduced to a single digit. This mirrors how Vedic/
    Chaldean vehicle-numerology treats a plate as one combined value rather
    than only its numeric part. Returns null if there's nothing countable. */
function calculateVehicle(raw) {
  const items = letterBreakdown(raw);
  const letterSum = items.reduce((s, it) => s + it.value, 0);
  const digitSum = (raw || '').replace(/\D/g, '').split('').reduce((s, d) => s + Number(d), 0);
  const compound = letterSum + digitSum;
  if (!compound) return null;
  const { single, trail } = reduceToSingle(compound);
  return { items, letterSum, digitSum, compound, single, trail };
}

/** Personal Day / Month / Year numbers (standard numerology "forecast"
    numbers): reduce (birth day + birth month) with the CURRENT year/month/day
    to get short-term cyclical numbers layered on top of the lifelong Mulank/
    Bhagyank. `dobStr` is 'yyyy-mm-dd'; `today` is a Date. */
function personalCycleNumbers(dobStr, today) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobStr || '');
  if (!m) return null;
  const [, , birthMonth, birthDay] = m;
  const y = today.getFullYear(), mo = today.getMonth() + 1, d = today.getDate();

  const digitSum = (s) => String(s).split('').reduce((sum, ch) => sum + Number(ch), 0);

  const personalYear = reduceToSingle(digitSum(birthDay) + digitSum(birthMonth) + digitSum(y)).single;
  const personalMonth = reduceToSingle(personalYear + mo).single;
  const personalDay = reduceToSingle(personalMonth + d).single;

  return { personalYear, personalMonth, personalDay };
}

/** Soul Urge / Heart's Desire number = Chaldean sum of the VOWELS only,
    reduced to a single digit. (In Chaldean practice these two names refer
    to the same vowel-based number.) Y is treated as a vowel here. */
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U', 'Y']);

/** Soul Urge (a.k.a. Heart's Desire) — the sum of the VOWELS only.
    Reveals inner motivation and what the heart truly craves. */
function soulUrge(name) {
  let sum = 0;
  for (const ch of name.toUpperCase()) {
    if (VOWELS.has(ch) && CHALDEAN[ch]) sum += CHALDEAN[ch];
  }
  if (!sum) return null;
  const { single, trail } = reduceToSingle(sum);
  return { compound: sum, single, trail };
}

/** Personality number — the sum of the CONSONANTS only.
    The genuine counterpart to the Soul Urge: it describes the outer self —
    the impression you make on others, before they know you. */
function personalityNumber(name) {
  let sum = 0;
  for (const ch of name.toUpperCase()) {
    if (!VOWELS.has(ch) && CHALDEAN[ch]) sum += CHALDEAN[ch];
  }
  if (!sum) return null;
  const { single, trail } = reduceToSingle(sum);
  return { compound: sum, single, trail };
}

/** Base favourability of each root digit (0–100), from tradition:
    1,3,5,6 are the strong "favourable" roots; 8 & 4 the most testing. */
const FAVOUR_PCT = { 1: 85, 2: 70, 3: 90, 4: 55, 5: 95, 6: 92, 7: 65, 8: 45, 9: 75 };

/** Transparent favourability score for a whole name, with the reasons.
    Blends three traditional factors so the % is explainable, not arbitrary:
      • base   — the root digit's traditional strength (FAVOUR_PCT)
      • compound — bonus if the compound number is "fortunate", penalty if "caution"
      • balance  — small bonus when soul & personality numbers are friendly
    Returns { pct, factors:[{labelKey, delta}] , base, single }. */
function favourability(name) {
  const { compound, single } = calculate(name);
  const base = FAVOUR_PCT[single] || 50;
  const factors = [{ key: 'favorFactorBase', delta: base, single }];
  let pct = base;

  const cm = compoundMeaning(compound);
  if (cm) {
    const fortunate = cm[2];
    const delta = fortunate ? 8 : -12;
    factors.push({ key: fortunate ? 'favorFactorCompoundGood' : 'favorFactorCompoundWarn', delta });
    pct += delta;
  }

  const su = soulUrge(name), pn = personalityNumber(name);
  if (su && pn) {
    const rel = relation(su.single, pn.single);
    const delta = rel === 'good' ? 5 : rel === 'warn' ? -5 : 0;
    if (delta) {
      factors.push({ key: rel === 'good' ? 'favorFactorHarmonyGood' : 'favorFactorHarmonyWarn', delta });
      pct += delta;
    }
  }

  pct = Math.max(5, Math.min(99, Math.round(pct)));
  return { pct, factors, base, single };
}

/** Look up the compound-number meaning ([title, text, fortunate]).
    Returns null when the total is a plain single digit (no compound to read)
    or beyond the classic table (>52, rare for names). */
function compoundMeaning(compound) {
  if (compound <= 9) return null;
  const en = COMPOUND_MEANINGS[compound];
  if (!en) return null;
  // Localise title + text; the fortunate flag [2] always comes from the base table.
  const loc = currentLang === 'hi' ? COMPOUND_MEANINGS_HI[compound]
            : currentLang === 'mr' ? COMPOUND_MEANINGS_MR[compound]
            : null;
  return loc ? [loc[0], loc[1], en[2]] : en;
}

/** Pick favourable Indian/Hindu names for a gender whose Chaldean root is
    favourable (1, 3, 5, 6), with a short Vedic/Puranic meaning attached in
    the current language. `offset` rotates the selection for variety. */
function favourableIndianNames(gender, count = 8, offset = 0) {
  const pool = INDIAN_NAMES[gender] || [];
  const matches = pool
    .map(n => ({ name: n.name, meaning: n['meaning' + currentLang.toUpperCase()] || n.meaningEN,
                 source: n.source, ...calculate(n.name) }))
    .filter(r => FAVOURABLE_SINGLE.has(r.single));
  // rotate by offset so repeated clicks show fresh names
  const rotated = matches.slice(offset % Math.max(matches.length, 1))
    .concat(matches.slice(0, offset % Math.max(matches.length, 1)));
  return rotated.slice(0, count);
}

/* =========================================================
   3. Name spelling suggestions
   Try single-letter tweaks (double a letter, drop a repeat, swap an
   ending vowel) to reach a favourable single digit. Purely spelling
   variations — never changes pronunciation drastically.
   ========================================================= */
function suggestSpellings(name) {
  const base = calculate(name);
  const baseGood = FAVOURABLE_SINGLE.has(base.single);

  const seen = new Set([name.trim().toUpperCase()]);
  const out = [];
  const candidates = new Set();

  // If the current name already reduces to a favourable number, keep it as the
  // TOP-PRIORITY entry rather than hiding it — it's the best possible choice.
  if (baseGood && name.trim()) {
    const cm = compoundMeaning(base.compound);
    const strength = (FAVOUR_PCT[base.single] || 50) + (cm ? (cm[2] ? 8 : -12) : 0);
    out.push({ name: name.trim(), compound: base.compound, single: base.single, strength, existing: true });
  }

  const letters = name.split('');

  // a) Double each letter once (common numerology tweak, e.g. Amol -> Ammol)
  for (let i = 0; i < letters.length; i++) {
    if (/[a-zA-Z]/.test(letters[i])) {
      candidates.add(letters.slice(0, i + 1).join('') + letters[i] + letters.slice(i + 1).join(''));
    }
  }
  // b) Append a soft vowel/consonant to the last word (e.g. -> Amola, Amolh)
  for (const suffix of ['A', 'E', 'H', 'I']) {
    candidates.add(name + suffix);
  }
  // c) Remove one duplicated adjacent letter (in case name already doubled)
  for (let i = 1; i < letters.length; i++) {
    if (letters[i].toUpperCase() === letters[i - 1].toUpperCase()) {
      candidates.add(letters.slice(0, i).join('') + letters.slice(i + 1).join(''));
    }
  }

  for (const cand of candidates) {
    const key = cand.trim().toUpperCase();
    if (seen.has(key) || !cand.trim()) continue;
    seen.add(key);
    const r = calculate(cand);
    if (FAVOURABLE_SINGLE.has(r.single)) {
      // Strength = how auspicious this variant is (root % + fortunate-compound bonus).
      const cm = compoundMeaning(r.compound);
      const strength = (FAVOUR_PCT[r.single] || 50) + (cm ? (cm[2] ? 8 : -12) : 0);
      out.push({ name: cand, compound: r.compound, single: r.single, strength });
    }
  }

  // Sort: existing (already-favourable) name always first; then strongest, then
  // smallest change (shortest name). Show up to 5 suggestions.
  out.sort((a, b) =>
    (b.existing ? 1 : 0) - (a.existing ? 1 : 0) ||
    b.strength - a.strength ||
    a.name.length - b.name.length ||
    a.single - b.single);
  return out.slice(0, 5);
}

/** Of a suggestion list, pick the single STRONGEST variant (highest strength).
    An already-favourable existing name takes top priority. */
function strongestSuggestion(list) {
  if (!list.length) return null;
  const existing = list.find(s => s.existing);
  if (existing) return existing;
  return list.reduce((best, s) => (s.strength > best.strength ? s : best), list[0]);
}

/* =========================================================
   4. Translations (en / hi / mr)
   ========================================================= */
const I18N = {
  en: {
    _label: 'English',
    brandName: 'NameVibe',
    heroTitle: 'Chaldean Numerology Name Calculator',
    heroSubtitle: 'Discover the hidden vibration of your name. Enter a name to reveal its compound number, single (root) digit and their meanings.',
    inputLabel: 'Enter your name',
    inputPlaceholder: 'e.g. Amol Gadage',
    dobLabel: 'Date of birth (optional)',
    clearBtn: 'Clear',
    inputHint: 'Results update as you type. Only letters A–Z are counted; spaces, numbers and symbols are ignored.',
    compoundLabel: 'Compound Number',
    singleLabel: 'Single (Root) Digit',
    rulerLabel: 'Ruling Planet',
    breakdownTitle: 'Letter-by-letter Breakdown',
    meaningTitle: 'Meaning of Your Name Number',
    suggestTitle: 'Favourable Name Spelling Suggestions',
    chartTitle: 'The Chaldean Number Chart',
    chartSub: 'In the Chaldean system, letters are assigned values 1–8. The number 9 is considered sacred and is never assigned to a letter.',
    chartNote: 'Note: values are based on the sound & vibration of each letter, which is why Chaldean numerology differs from the Pythagorean (Western) system.',
    allMeaningsTitle: 'Single Digit Meanings (1–9)',
    howTitle: 'How the Calculation Works',
    disclaimer: 'Numerology is a belief system offered here for entertainment and self-reflection. Interpretations vary between practitioners and should not replace professional advice.',
    madeBy: 'Crafted with care by',
    followUs: 'Follow us',
    footerNote: 'Chaldean Numerology · Static site hosted on GitHub Pages',
    favGood: 'Favourable',
    favWarn: 'Consider Adjusting',
    dayLabel: 'Day',
    monthLabel: 'Month',
    yearLabel: 'Year',
    months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    dobPanelTitle: 'Birth Numbers & Compatibility',
    mulankLabel: 'Mulank (Birth No.)',
    bhagyankLabel: 'Bhagyank (Destiny No.)',
    compatNameMulank: 'Name Number ↔ Mulank',
    compatNameBhagyank: 'Name Number ↔ Bhagyank',
    compatMulankBhagyank: 'Mulank ↔ Bhagyank',
    relGood: 'Friendly',
    relNeutral: 'Neutral',
    relWarn: 'Not Friendly',
    relGoodDesc: 'These vibrations support each other — a harmonious, lucky combination.',
    relNeutralDesc: 'A balanced pairing — neither strongly helpful nor harmful.',
    relWarnDesc: 'These numbers tend to clash — extra care or a name adjustment may help.',
    compoundEffectTitle: 'Compound Number & Its Effect',
    compoundIntro: 'The compound (double-digit) number reveals the deeper, hidden influence behind your name — the outer circumstances and karmic forces surrounding you.',
    compoundNone: 'Your name total is already a single digit, so it has no separate compound-number reading. See the root-number meaning below.',
    mulankEffectLabel: 'Effect of Mulank',
    bhagyankEffectLabel: 'Effect of Bhagyank',
    indianTitle: 'Lucky Indian Baby Name Ideas',
    indianIntro: 'Auspicious Hindu names whose Chaldean number falls on a favourable root (1, 3, 5 or 6) — with a short meaning and its source (Rigveda, Upanishads, Puranas, the Ramayana/Mahabharata, or general Sanskrit).',
    genderBoy: 'Boys',
    genderGirl: 'Girls',
    moreNames: '↻ More',
    genderLabel: 'Gender',
    genderMale: 'Male',
    genderFemale: 'Female',
    placeLabel: 'Birth place (optional)',
    placePlaceholder: 'Start typing a city…',
    placeSearching: 'Searching…',
    favorMeterTitle: 'How Favourable Is This Name?',
    favorMeterText: (pct) => `Your name scores about ${pct}% on the traditional favourability scale. This is calculated below from your root number, compound number and the harmony between your inner numbers — not a random figure.`,
    favorHowTitle: 'How this % is calculated',
    profileTitle: 'Your Personality & Life Path',
    profileIntro: 'A closer look at how your name number tends to shape behaviour and social connection, physical/health tendencies, love life and career path.',
    profileSocial: '🤝 Behaviour & Social Connect',
    profileBody: '🧘 Body & Health Tendencies',
    profileLove: '💞 Love Life',
    profileCareer: '💼 Career Path',
    profileMoney: '💰 Money & Wealth Mindset',
    profileGrowth: '🌱 Life Lessons & Growth',
    favorFactorBase: (f) => `Root number ${f.single} — traditional strength`,
    favorFactorCompoundGood: 'Fortunate compound number',
    favorFactorCompoundWarn: 'Compound number needs caution',
    favorFactorHarmonyGood: 'Soul & Personality numbers in harmony',
    favorFactorHarmonyWarn: 'Soul & Personality numbers clash',
    soulTitle: 'Your Inner Numbers',
    soulIntro: 'Two different, complementary numbers: the Soul Urge (from your vowels) is what your heart secretly wants; the Personality number (from your consonants) is the outer impression you make on others.',
    soulLabel: 'Soul Urge (Vowels)',
    soulPlanetLabel: 'Planet',
    persoLabel: 'Personality (Consonants)',
    persoPlanetLabel: 'Planet',
    luckyTitle: 'Your Lucky Essentials',
    luckyDays: 'Lucky Days', luckyNums: 'Lucky Numbers', luckyDates: 'Lucky Dates',
    luckyColors: 'Lucky Colours', luckyGod: 'Deity to Worship', luckyMetal: 'Gem / Metal', luckyDir: 'Lucky Direction',
    luckyPlant: 'Lucky Plant / Tree',
    luckyCareerCity: 'Lucky Cities (Career)', luckyLivingCity: 'Lucky Cities (Long Living)',
    lifeTitle: 'Best Life Events & Important Dates',
    lifeYearsLabel: 'Turning-point ages / years',
    lifeBestLabel: 'Events most likely to shine',
    remedyTitle: 'Personalised Remedies to Improve Your Life',
    remedyIntro: 'Simple, area-wise guidance based on your name number — small habits that help money, career, health, marriage and love.',
    remedy_money: 'Money & Wealth', remedy_career: 'Career & Growth', remedy_job: 'Job & Workplace',
    remedy_health: 'Health', remedy_marriage: 'Marriage', remedy_love: 'Love Life',
    practicalTitle: 'Favourable Choices Checker',
    practicalIntro: 'Check whether an email ID, social handle, business name, bank/company name or any word harmonises with your number.',
    emailPlaceholder: 'Email ID (e.g. amol123)',
    bankPlaceholder: 'Bank / company name',
    socialPlaceholder: 'Social media username / handle (e.g. @amol.gadage)',
    businessPlaceholder: 'Business / brand name',
    relationTitle: 'Relationship Compatibility',
    relationIntro: "Enter a partner's or friend's name to see how their number matches yours.",
    partnerPlaceholder: "Partner's name (marriage)",
    friendPlaceholder: "Friend's name",
    kuaTitle: 'Kua Number (Feng Shui)',
    kuaIntro: 'Your Kua number (gender-based) reveals your favourable directions for sleeping, working and success.',
    kuaLabel: 'Kua Number',
    kuaGroupLabel: 'Group / Lucky Directions',
    loshuTitle: 'Lo Shu Grid & Planes',
    loshuIntro: 'Built from your date of birth. Repeated numbers strengthen a trait; missing numbers show areas to develop. Completed lines form "planes".',
    loshuPlanesLabel: 'Planes formed',
    loshuMissingLabel: 'Missing numbers',
    loshuNoneMissing: 'None missing — a well-balanced grid!',
    loshuNoPlanes: 'No complete plane formed yet.',
    loshuImproveTitle: 'How to add & strengthen your missing numbers',
    careerTitle: 'Favourable Career Fields',
    checkFavGood: 'Favourable — number {n}, friendly with yours ({y}).',
    checkFavNeutral: 'Neutral — number {n}, balanced with yours ({y}).',
    checkFavWarn: 'Not ideal — number {n}, clashes with yours ({y}).',
    checkNeedName: 'Enter your name above first.',
    suggestFavGood: 'Your name already reduces to a favourable number — no change needed.',
    suggestIntro: 'Small spelling variations whose numbers reduce to a favourable root (1, 3, 5 or 6):',
    suggestBestLabel: 'Strongest recommendation:',
    suggestCurrentBest: 'Best choice — your current name:',
    suggestEmpty: 'No simple spelling variation reached a favourable number. A professional numerologist can explore fuller options.',
    downloadPdf: '⬇ Download PDF Report',
    pdfBuilding: 'Preparing your report…',
    shareBtn: '📤 Share My Report',
    shareBuilding: 'Preparing your share card…',
    shareCaption: (name, single, pct) => `✨ I just discovered my Chaldean numerology number using NameVibe!\n\nName: ${name}\nName Number: ${single}\nFavourability: ${pct}%\n\nFind your own free numerology report — try NameVibe: {url}`,
    shareCopied: 'Caption copied! Image downloaded — paste the caption when you share it. 🎉',
    shareTitle: 'Share Your Report',
    shareIntro: 'Download a shareable image card of your result, plus a ready-to-paste caption for WhatsApp, Instagram or Facebook.',
    mobileTitle: '📱 Mobile Number Numerology',
    mobileIntro: 'Check whether your mobile number is numerologically favourable for you. Every digit is added and reduced to a single number (1–9), then compared with your Name Number (enter your name above for a personalised verdict).',
    mobilePlaceholder: 'Enter mobile number (e.g. +91 98765 43210)',
    mobileResultLabel: 'Mobile Number reduces to',
    vehicleTitle: '🚗 Vehicle Number Plate Numerology',
    vehicleIntro: 'Check whether your vehicle registration number is favourable for you — letters (Chaldean value) plus digits are combined, reduced and compared with your Name Number (enter your name above for a personalised verdict).',
    vehiclePlaceholder: 'Enter registration number (e.g. MH12AB1234)',
    vehicleResultLabel: 'Vehicle Number reduces to',
    numCheckEmpty: 'Enter a number above to see its numerology.',
    numCheckFav: 'Favourable — a strong, supportive number.',
    numCheckNeutral: 'Neutral — an average, workable number.',
    numCheckWarn: 'Testing — a challenging number; use with awareness.',
    numCheckVsYours: 'compared with your number ({y})',
    personalizeToggle: 'Personalise using my name/DOB above',
    numCheckNeedAnchor: 'Enter your name or date of birth above to personalise this check.',
    cycleTitle: '📆 Your Personal Day, Month & Year Numbers',
    cycleIntro: 'Short-term cycles layered on your lifelong numbers — what today, this month and this year favour for you.',
    cycleDayLabel: 'Personal Day',
    cycleMonthLabel: 'Personal Month',
    cycleYearLabel: 'Personal Year',
    cycleNeedDob: 'Enter your date of birth above to see your personal cycle numbers.',
    reductionText: (c, trail) => `Total = <strong>${c}</strong>${trail.length > 1 ? ' → ' + trail.join(' → ') : ''} → Root digit <strong>${trail[trail.length - 1]}</strong>`,
    emptyName: 'Please type a name with at least one letter.',
    stepsIntro: 'Steps',
    steps: [
      'Convert every letter of the name to its Chaldean value (1–8) using the chart above.',
      'Add all the values together to get the <strong>compound number</strong>.',
      'Reduce the compound number by adding its digits until you reach a single digit (1–9) — the <strong>root number</strong>.',
      'Read the meaning of the root (and compound) number to understand the name\'s vibration.'
    ]
  },

  hi: {
    _label: 'हिंदी',
    brandName: 'NameVibe',
    heroTitle: 'चाल्डियन नाम अंकशास्त्र कैलकुलेटर',
    heroSubtitle: 'अपने नाम का छिपा हुआ कंपन जानें। नाम दर्ज करें और उसका यौगिक अंक, मूल अंक तथा उनके अर्थ देखें।',
    inputLabel: 'अपना नाम लिखें',
    inputPlaceholder: 'जैसे Amol Gadage',
    dobLabel: 'जन्म तिथि (वैकल्पिक)',
    clearBtn: 'साफ़ करें',
    inputHint: 'परिणाम टाइप करते ही अपडेट होते हैं। केवल A–Z अक्षर गिने जाते हैं; खाली स्थान, अंक व चिह्न नहीं।',
    compoundLabel: 'यौगिक अंक',
    singleLabel: 'मूल अंक',
    rulerLabel: 'स्वामी ग्रह',
    breakdownTitle: 'अक्षर-दर-अक्षर विवरण',
    meaningTitle: 'आपके नाम अंक का अर्थ',
    suggestTitle: 'शुभ नाम वर्तनी सुझाव',
    chartTitle: 'चाल्डियन अंक तालिका',
    chartSub: 'चाल्डियन प्रणाली में अक्षरों को 1–8 मान दिए जाते हैं। अंक 9 पवित्र माना जाता है और किसी अक्षर को नहीं दिया जाता।',
    chartNote: 'ध्यान दें: मान प्रत्येक अक्षर की ध्वनि व कंपन पर आधारित हैं, इसीलिए चाल्डियन अंकशास्त्र पाइथागोरियन (पश्चिमी) प्रणाली से भिन्न है।',
    allMeaningsTitle: 'मूल अंकों के अर्थ (1–9)',
    howTitle: 'गणना कैसे होती है',
    disclaimer: 'अंकशास्त्र एक विश्वास प्रणाली है, जो यहाँ मनोरंजन व आत्म-चिंतन हेतु दी गई है। व्याख्याएँ भिन्न हो सकती हैं और पेशेवर सलाह का स्थान नहीं लेतीं।',
    madeBy: 'सादर निर्मित —',
    followUs: 'हमें फ़ॉलो करें',
    footerNote: 'चाल्डियन अंकशास्त्र · GitHub Pages पर होस्ट किया गया स्थैतिक वेबसाइट',
    favGood: 'शुभ',
    favWarn: 'सुधार पर विचार करें',
    dayLabel: 'दिन',
    monthLabel: 'माह',
    yearLabel: 'वर्ष',
    months: ['जनवरी','फ़रवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'],
    dobPanelTitle: 'जन्म अंक व अनुकूलता',
    mulankLabel: 'मूलांक (जन्म अंक)',
    bhagyankLabel: 'भाग्यांक (भाग्य अंक)',
    compatNameMulank: 'नाम अंक ↔ मूलांक',
    compatNameBhagyank: 'नाम अंक ↔ भाग्यांक',
    compatMulankBhagyank: 'मूलांक ↔ भाग्यांक',
    relGood: 'मित्रवत',
    relNeutral: 'तटस्थ',
    relWarn: 'अमित्र',
    relGoodDesc: 'ये कंपन एक-दूसरे का साथ देते हैं — सामंजस्यपूर्ण, भाग्यशाली संयोजन।',
    relNeutralDesc: 'संतुलित जोड़ी — न विशेष लाभकारी न हानिकारक।',
    relWarnDesc: 'ये अंक प्रायः टकराते हैं — सावधानी या नाम में बदलाव सहायक हो सकता है।',
    compoundEffectTitle: 'यौगिक अंक व उसका प्रभाव',
    compoundIntro: 'यौगिक (दो-अंकीय) संख्या आपके नाम के पीछे छिपे गहरे प्रभाव को दर्शाती है — आपके चारों ओर की बाहरी परिस्थितियाँ व कर्म-शक्तियाँ।',
    compoundNone: 'आपके नाम का योग पहले से ही एक अंक है, अतः कोई अलग यौगिक-अंक व्याख्या नहीं है। नीचे मूल अंक का अर्थ देखें।',
    mulankEffectLabel: 'मूलांक का प्रभाव',
    bhagyankEffectLabel: 'भाग्यांक का प्रभाव',
    indianTitle: 'शुभ भारतीय नाम सुझाव',
    indianIntro: 'शुभ हिंदू नाम जिनका चाल्डियन अंक शुभ मूल (1, 3, 5 या 6) पर आता है — संक्षिप्त अर्थ व स्रोत (ऋग्वेद, उपनिषद, पुराण, रामायण/महाभारत या सामान्य संस्कृत) के साथ।',
    genderBoy: 'लड़के',
    genderGirl: 'लड़कियाँ',
    moreNames: '↻ और',
    genderLabel: 'लिंग',
    genderMale: 'पुरुष',
    genderFemale: 'महिला',
    placeLabel: 'जन्म स्थान (वैकल्पिक)',
    placePlaceholder: 'शहर टाइप करना शुरू करें…',
    placeSearching: 'खोज रहे हैं…',
    favorMeterTitle: 'यह नाम कितना शुभ है?',
    favorMeterText: (pct) => `आपका नाम पारंपरिक शुभता पैमाने पर लगभग ${pct}% अंक पाता है। यह नीचे आपके मूल अंक, यौगिक अंक व आंतरिक अंकों के तालमेल से गणना किया गया है — कोई मनमाना आँकड़ा नहीं।`,
    favorHowTitle: 'यह % कैसे गणना हुआ',
    profileTitle: 'आपका व्यक्तित्व व जीवन-पथ',
    profileIntro: 'आपका नाम अंक व्यवहार व सामाजिक जुड़ाव, शारीरिक/स्वास्थ्य प्रवृत्तियों, प्रेम जीवन व करियर पथ को किस तरह आकार देता है, इस पर एक करीबी नज़र।',
    profileSocial: '🤝 व्यवहार व सामाजिक जुड़ाव',
    profileBody: '🧘 शरीर व स्वास्थ्य प्रवृत्तियाँ',
    profileLove: '💞 प्रेम जीवन',
    profileCareer: '💼 करियर पथ',
    profileMoney: '💰 धन व समृद्धि सोच',
    profileGrowth: '🌱 जीवन-शिक्षा व विकास',
    favorFactorBase: (f) => `मूल अंक ${f.single} — पारंपरिक शक्ति`,
    favorFactorCompoundGood: 'शुभ यौगिक अंक',
    favorFactorCompoundWarn: 'यौगिक अंक में सावधानी आवश्यक',
    favorFactorHarmonyGood: 'सोल व व्यक्तित्व अंक तालमेल में',
    favorFactorHarmonyWarn: 'सोल व व्यक्तित्व अंक टकराव में',
    soulTitle: 'आपके आंतरिक अंक',
    soulIntro: 'दो अलग व पूरक अंक: सोल अर्ज (स्वरों से) आपके हृदय की गुप्त चाह है; व्यक्तित्व अंक (व्यंजनों से) वह बाहरी छाप है जो आप दूसरों पर छोड़ते हैं।',
    soulLabel: 'सोल अर्ज (स्वर)',
    soulPlanetLabel: 'ग्रह',
    persoLabel: 'व्यक्तित्व (व्यंजन)',
    persoPlanetLabel: 'ग्रह',
    luckyTitle: 'आपकी शुभ बातें',
    luckyDays: 'शुभ दिन', luckyNums: 'शुभ अंक', luckyDates: 'शुभ तिथियाँ',
    luckyColors: 'शुभ रंग', luckyGod: 'आराध्य देव', luckyMetal: 'रत्न / धातु', luckyDir: 'शुभ दिशा',
    luckyPlant: 'शुभ पौधा / वृक्ष',
    luckyCareerCity: 'शुभ शहर (करियर)', luckyLivingCity: 'शुभ शहर (दीर्घ जीवन)',
    lifeTitle: 'श्रेष्ठ जीवन घटनाएँ व महत्वपूर्ण तिथियाँ',
    lifeYearsLabel: 'निर्णायक आयु / वर्ष',
    lifeBestLabel: 'सबसे शुभ घटनाएँ',
    remedyTitle: 'जीवन सुधारने के व्यक्तिगत उपाय',
    remedyIntro: 'आपके नाम अंक पर आधारित सरल, क्षेत्रवार मार्गदर्शन — छोटी आदतें जो धन, करियर, स्वास्थ्य, विवाह व प्रेम में सहायक हैं।',
    remedy_money: 'धन व संपत्ति', remedy_career: 'करियर व प्रगति', remedy_job: 'नौकरी व कार्यस्थल',
    remedy_health: 'स्वास्थ्य', remedy_marriage: 'विवाह', remedy_love: 'प्रेम जीवन',
    practicalTitle: 'शुभ विकल्प जाँचक',
    practicalIntro: 'जाँचें कि कोई ईमेल आईडी, सोशल मीडिया हैंडल, बिज़नेस नाम, बैंक/कंपनी नाम या शब्द आपके अंक से मेल खाता है या नहीं।',
    emailPlaceholder: 'ईमेल आईडी (जैसे amol123)',
    bankPlaceholder: 'बैंक / कंपनी नाम',
    socialPlaceholder: 'सोशल मीडिया यूज़रनेम / हैंडल (जैसे @amol.gadage)',
    businessPlaceholder: 'बिज़नेस / ब्रांड नाम',
    relationTitle: 'संबंध अनुकूलता',
    relationIntro: 'साथी या मित्र का नाम दर्ज करें और देखें उनका अंक आपसे कैसे मेल खाता है।',
    partnerPlaceholder: 'साथी का नाम (विवाह)',
    friendPlaceholder: 'मित्र का नाम',
    kuaTitle: 'कुआ अंक (फेंग शुई)',
    kuaIntro: 'आपका कुआ अंक (लिंग-आधारित) सोने, काम व सफलता के लिए शुभ दिशाएँ बताता है।',
    kuaLabel: 'कुआ अंक',
    kuaGroupLabel: 'समूह / शुभ दिशाएँ',
    loshuTitle: 'लो शू ग्रिड व तल',
    loshuIntro: 'आपकी जन्म तिथि से बना। दोहराए अंक गुण बढ़ाते हैं; अनुपस्थित अंक विकास के क्षेत्र दिखाते हैं। पूर्ण पंक्तियाँ "तल" बनाती हैं।',
    loshuPlanesLabel: 'बने तल',
    loshuMissingLabel: 'अनुपस्थित अंक',
    loshuNoneMissing: 'कोई अंक अनुपस्थित नहीं — संतुलित ग्रिड!',
    loshuNoPlanes: 'अभी तक कोई पूर्ण तल नहीं बना।',
    loshuImproveTitle: 'अपने अनुपस्थित अंकों को कैसे जोड़ें व मज़बूत करें',
    careerTitle: 'शुभ करियर क्षेत्र',
    checkFavGood: 'शुभ — अंक {n}, आपके अंक ({y}) से मित्रवत।',
    checkFavNeutral: 'तटस्थ — अंक {n}, आपके अंक ({y}) से संतुलित।',
    checkFavWarn: 'उपयुक्त नहीं — अंक {n}, आपके अंक ({y}) से टकराव।',
    checkNeedName: 'पहले ऊपर अपना नाम दर्ज करें।',
    suggestFavGood: 'आपका नाम पहले से ही शुभ अंक देता है — किसी बदलाव की आवश्यकता नहीं।',
    suggestIntro: 'ऐसी छोटी वर्तनी विविधताएँ जिनका अंक शुभ मूल (1, 3, 5 या 6) देता है:',
    suggestBestLabel: 'सबसे मज़बूत सुझाव:',
    suggestCurrentBest: 'सर्वोत्तम विकल्प — आपका वर्तमान नाम:',
    suggestEmpty: 'किसी सरल वर्तनी परिवर्तन से शुभ अंक नहीं मिला। एक पेशेवर अंकशास्त्री अधिक विकल्प सुझा सकते हैं।',
    downloadPdf: '⬇ PDF रिपोर्ट डाउनलोड करें',
    pdfBuilding: 'आपकी रिपोर्ट तैयार हो रही है…',
    shareBtn: '📤 मेरी रिपोर्ट शेयर करें',
    shareBuilding: 'आपका शेयर कार्ड तैयार हो रहा है…',
    shareCaption: (name, single, pct) => `✨ मैंने NameVibe से अपना केल्डियन न्यूमेरोलॉजी अंक जाना!\n\nनाम: ${name}\nनाम अंक: ${single}\nशुभता: ${pct}%\n\nअपनी मुफ़्त रिपोर्ट पाएँ — NameVibe आज़माएँ: {url}`,
    shareCopied: 'कैप्शन कॉपी हो गया! इमेज डाउनलोड हो गई है — शेयर करते समय कैप्शन पेस्ट करें। 🎉',
    shareTitle: 'अपनी रिपोर्ट शेयर करें',
    shareIntro: 'अपने परिणाम का शेयर करने योग्य इमेज कार्ड डाउनलोड करें, साथ ही WhatsApp, Instagram या Facebook के लिए तैयार कैप्शन।',
    mobileTitle: '📱 मोबाइल नंबर न्यूमेरोलॉजी',
    mobileIntro: 'जाँचें कि आपका मोबाइल नंबर आपके लिए अंकशास्त्रीय रूप से शुभ है या नहीं। हर अंक को जोड़कर एक अंक (1–9) में घटाया जाता है, फिर आपके नाम अंक से तुलना की जाती है (व्यक्तिगत परिणाम हेतु ऊपर अपना नाम दर्ज करें)।',
    mobilePlaceholder: 'मोबाइल नंबर दर्ज करें (जैसे +91 98765 43210)',
    mobileResultLabel: 'मोबाइल नंबर घटकर बनता है',
    vehicleTitle: '🚗 वाहन नंबर प्लेट न्यूमेरोलॉजी',
    vehicleIntro: 'जाँचें कि आपकी गाड़ी की रजिस्ट्रेशन संख्या आपके लिए शुभ है या नहीं — अक्षर (केल्डियन मूल्य) और अंक मिलाकर घटाए जाते हैं, फिर आपके नाम अंक से तुलना की जाती है (व्यक्तिगत परिणाम हेतु ऊपर अपना नाम दर्ज करें)।',
    vehiclePlaceholder: 'रजिस्ट्रेशन नंबर दर्ज करें (जैसे MH12AB1234)',
    vehicleResultLabel: 'वाहन नंबर घटकर बनता है',
    numCheckEmpty: 'न्यूमेरोलॉजी देखने के लिए ऊपर एक नंबर दर्ज करें।',
    numCheckFav: 'शुभ — एक मज़बूत, सहायक अंक।',
    numCheckNeutral: 'तटस्थ — एक सामान्य, उपयोगी अंक।',
    numCheckWarn: 'परीक्षा — एक चुनौतीपूर्ण अंक; सावधानी से उपयोग करें।',
    numCheckVsYours: 'आपके अंक ({y}) से तुलना',
    personalizeToggle: 'ऊपर मेरे नाम/जन्मतिथि से व्यक्तिगत करें',
    numCheckNeedAnchor: 'इसे व्यक्तिगत बनाने के लिए ऊपर अपना नाम या जन्मतिथि दर्ज करें।',
    cycleTitle: '📆 आपके व्यक्तिगत दिन, माह व वर्ष अंक',
    cycleIntro: 'आपके जीवनभर के अंकों पर आधारित अल्पकालिक चक्र — आज, इस माह व इस वर्ष आपके लिए क्या अनुकूल है।',
    cycleDayLabel: 'व्यक्तिगत दिन',
    cycleMonthLabel: 'व्यक्तिगत माह',
    cycleYearLabel: 'व्यक्तिगत वर्ष',
    cycleNeedDob: 'अपने व्यक्तिगत चक्र अंक देखने के लिए ऊपर अपनी जन्मतिथि दर्ज करें।',
    reductionText: (c, trail) => `कुल = <strong>${c}</strong>${trail.length > 1 ? ' → ' + trail.join(' → ') : ''} → मूल अंक <strong>${trail[trail.length - 1]}</strong>`,
    emptyName: 'कृपया कम से कम एक अक्षर वाला नाम लिखें।',
    stepsIntro: 'चरण',
    steps: [
      'ऊपर दी गई तालिका से नाम के प्रत्येक अक्षर को उसके चाल्डियन मान (1–8) में बदलें।',
      'सभी मानों को जोड़कर <strong>यौगिक अंक</strong> प्राप्त करें।',
      'यौगिक अंक के अंकों को तब तक जोड़ें जब तक एक अंक (1–9) न मिले — यही <strong>मूल अंक</strong> है।',
      'नाम का कंपन समझने के लिए मूल (और यौगिक) अंक का अर्थ पढ़ें।'
    ]
  },

  mr: {
    _label: 'मराठी',
    brandName: 'NameVibe',
    heroTitle: 'चाल्डियन नाव अंकशास्त्र कॅल्क्युलेटर',
    heroSubtitle: 'आपल्या नावाचे लपलेले स्पंदन जाणून घ्या. नाव टाका आणि त्याचा संयुक्त अंक, मूळ अंक व त्यांचे अर्थ पहा.',
    inputLabel: 'आपले नाव लिहा',
    inputPlaceholder: 'उदा. Amol Gadage',
    dobLabel: 'जन्मतारीख (ऐच्छिक)',
    clearBtn: 'साफ करा',
    inputHint: 'टाइप करताच निकाल बदलतात. फक्त A–Z अक्षरे मोजली जातात; रिकाम्या जागा, अंक व चिन्हे नाहीत.',
    compoundLabel: 'संयुक्त अंक',
    singleLabel: 'मूळ अंक',
    rulerLabel: 'स्वामी ग्रह',
    breakdownTitle: 'अक्षर-निहाय तपशील',
    meaningTitle: 'आपल्या नाव अंकाचा अर्थ',
    suggestTitle: 'शुभ नाव स्पेलिंग सूचना',
    chartTitle: 'चाल्डियन अंक तक्ता',
    chartSub: 'चाल्डियन पद्धतीत अक्षरांना 1–8 मूल्ये दिली जातात. अंक 9 पवित्र मानला जातो व कोणत्याही अक्षराला दिला जात नाही.',
    chartNote: 'टीप: मूल्ये प्रत्येक अक्षराच्या ध्वनी व स्पंदनावर आधारित आहेत, म्हणूनच चाल्डियन अंकशास्त्र पायथागोरियन (पाश्चात्त्य) पद्धतीपेक्षा वेगळे आहे.',
    allMeaningsTitle: 'मूळ अंकांचे अर्थ (1–9)',
    howTitle: 'गणना कशी होते',
    disclaimer: 'अंकशास्त्र ही एक श्रद्धा प्रणाली आहे, जी येथे मनोरंजन व आत्मचिंतनासाठी दिली आहे. अर्थ भिन्न असू शकतात व व्यावसायिक सल्ल्याची जागा घेत नाहीत.',
    madeBy: 'आदराने साकारले —',
    followUs: 'आम्हाला फॉलो करा',
    footerNote: 'चाल्डियन अंकशास्त्र · GitHub Pages वर होस्ट केलेली स्थिर वेबसाइट',
    favGood: 'शुभ',
    favWarn: 'बदल करण्याचा विचार करा',
    dayLabel: 'दिवस',
    monthLabel: 'महिना',
    yearLabel: 'वर्ष',
    months: ['जानेवारी','फेब्रुवारी','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टेंबर','ऑक्टोबर','नोव्हेंबर','डिसेंबर'],
    dobPanelTitle: 'जन्म अंक व सुसंगतता',
    mulankLabel: 'मूलांक (जन्म अंक)',
    bhagyankLabel: 'भाग्यांक (भाग्य अंक)',
    compatNameMulank: 'नाव अंक ↔ मूलांक',
    compatNameBhagyank: 'नाव अंक ↔ भाग्यांक',
    compatMulankBhagyank: 'मूलांक ↔ भाग्यांक',
    relGood: 'मैत्रीपूर्ण',
    relNeutral: 'तटस्थ',
    relWarn: 'अमैत्रीपूर्ण',
    relGoodDesc: 'ही स्पंदने एकमेकांना साथ देतात — सामंजस्यपूर्ण, भाग्यवान संयोजन.',
    relNeutralDesc: 'संतुलित जोडी — विशेष लाभदायक ना हानिकारक.',
    relWarnDesc: 'हे अंक बहुधा एकमेकांशी भिडतात — काळजी किंवा नावात बदल उपयुक्त ठरू शकतो.',
    compoundEffectTitle: 'संयुक्त अंक व त्याचा प्रभाव',
    compoundIntro: 'संयुक्त (दोन-अंकी) संख्या आपल्या नावामागील खोल, लपलेला प्रभाव दर्शवते — आपल्या भोवतालची बाह्य परिस्थिती व कर्म-शक्ती.',
    compoundNone: 'आपल्या नावाची बेरीज आधीच एक अंक आहे, त्यामुळे स्वतंत्र संयुक्त-अंक अर्थ नाही. खाली मूळ अंकाचा अर्थ पहा.',
    mulankEffectLabel: 'मूलांकाचा प्रभाव',
    bhagyankEffectLabel: 'भाग्यांकाचा प्रभाव',
    indianTitle: 'शुभ भारतीय नाव सूचना',
    indianIntro: 'शुभ हिंदू नावे ज्यांचा चाल्डियन अंक शुभ मूळावर (1, 3, 5 किंवा 6) येतो — संक्षिप्त अर्थ व स्रोत (ऋग्वेद, उपनिषद, पुराण, रामायण/महाभारत किंवा सामान्य संस्कृत) यासह.',
    genderBoy: 'मुलगे',
    genderGirl: 'मुली',
    moreNames: '↻ आणखी',
    genderLabel: 'लिंग',
    genderMale: 'पुरुष',
    genderFemale: 'स्त्री',
    placeLabel: 'जन्मस्थान (ऐच्छिक)',
    placePlaceholder: 'शहर टाइप करा…',
    placeSearching: 'शोधत आहे…',
    favorMeterTitle: 'हे नाव किती शुभ आहे?',
    favorMeterText: (pct) => `आपले नाव पारंपरिक शुभता मापनावर सुमारे ${pct}% गुण मिळवते. हे खाली आपल्या मूळ अंक, यौगिक अंक व आंतरिक अंकांच्या सुसंगततेवरून काढले आहे — कोणताही मनमानी आकडा नाही.`,
    favorHowTitle: 'हे % कसे काढले',
    profileTitle: 'तुमचे व्यक्तिमत्त्व व जीवन-मार्ग',
    profileIntro: 'तुमचा नाव अंक वागणूक व सामाजिक जोडणी, शारीरिक/आरोग्य प्रवृत्ती, प्रेम जीवन व करिअर मार्गाला कसा आकार देतो, यावर एक जवळून दृष्टिक्षेप.',
    profileSocial: '🤝 वागणूक व सामाजिक जोडणी',
    profileBody: '🧘 शरीर व आरोग्य प्रवृत्ती',
    profileLove: '💞 प्रेम जीवन',
    profileCareer: '💼 करिअर मार्ग',
    profileMoney: '💰 पैसा व समृद्धी दृष्टिकोन',
    profileGrowth: '🌱 जीवन-धडे व विकास',
    favorFactorBase: (f) => `मूळ अंक ${f.single} — पारंपरिक शक्ती`,
    favorFactorCompoundGood: 'शुभ यौगिक अंक',
    favorFactorCompoundWarn: 'यौगिक अंकात सावधगिरी आवश्यक',
    favorFactorHarmonyGood: 'सोल व व्यक्तिमत्त्व अंक सुसंगत',
    favorFactorHarmonyWarn: 'सोल व व्यक्तिमत्त्व अंक विसंगत',
    soulTitle: 'आपले आंतरिक अंक',
    soulIntro: 'दोन वेगळे व पूरक अंक: सोल अर्ज (स्वरांवरून) ही आपल्या हृदयाची गुप्त ओढ; व्यक्तिमत्त्व अंक (व्यंजनांवरून) ही इतरांवर पडणारी बाह्य छाप.',
    soulLabel: 'सोल अर्ज (स्वर)',
    soulPlanetLabel: 'ग्रह',
    persoLabel: 'व्यक्तिमत्त्व (व्यंजन)',
    persoPlanetLabel: 'ग्रह',
    luckyTitle: 'आपल्या शुभ गोष्टी',
    luckyDays: 'शुभ दिवस', luckyNums: 'शुभ अंक', luckyDates: 'शुभ तिथी',
    luckyColors: 'शुभ रंग', luckyGod: 'आराध्य दैवत', luckyMetal: 'रत्न / धातू', luckyDir: 'शुभ दिशा',
    luckyPlant: 'शुभ वनस्पती / वृक्ष',
    luckyCareerCity: 'शुभ शहरे (करिअर)', luckyLivingCity: 'शुभ शहरे (दीर्घ जीवन)',
    lifeTitle: 'सर्वोत्तम जीवन घटना व महत्त्वाच्या तारखा',
    lifeYearsLabel: 'निर्णायक वय / वर्षे',
    lifeBestLabel: 'सर्वाधिक शुभ घटना',
    remedyTitle: 'जीवन सुधारण्यासाठी वैयक्तिक उपाय',
    remedyIntro: 'तुमच्या नाव अंकावर आधारित सोपे, क्षेत्रनिहाय मार्गदर्शन — पैसा, करिअर, आरोग्य, विवाह व प्रेमात मदत करणाऱ्या छोट्या सवयी.',
    remedy_money: 'पैसा व संपत्ती', remedy_career: 'करिअर व प्रगती', remedy_job: 'नोकरी व कार्यस्थळ',
    remedy_health: 'आरोग्य', remedy_marriage: 'विवाह', remedy_love: 'प्रेम जीवन',
    practicalTitle: 'शुभ निवड तपासक',
    practicalIntro: 'ईमेल आयडी, सोशल मीडिया हँडल, बिझनेस नाव, बँक/कंपनी नाव किंवा शब्द आपल्या अंकाशी जुळतो का ते तपासा.',
    emailPlaceholder: 'ईमेल आयडी (उदा. amol123)',
    bankPlaceholder: 'बँक / कंपनी नाव',
    socialPlaceholder: 'सोशल मीडिया युजरनेम / हँडल (उदा. @amol.gadage)',
    businessPlaceholder: 'बिझनेस / ब्रँड नाव',
    relationTitle: 'नातेसंबंध सुसंगतता',
    relationIntro: 'जोडीदार किंवा मित्राचे नाव टाका आणि त्यांचा अंक आपल्याशी कसा जुळतो पहा.',
    partnerPlaceholder: 'जोडीदाराचे नाव (विवाह)',
    friendPlaceholder: 'मित्राचे नाव',
    kuaTitle: 'कुआ अंक (फेंग शुई)',
    kuaIntro: 'आपला कुआ अंक (लिंग-आधारित) झोप, काम व यशासाठी शुभ दिशा दर्शवतो.',
    kuaLabel: 'कुआ अंक',
    kuaGroupLabel: 'गट / शुभ दिशा',
    loshuTitle: 'लो शू ग्रिड व स्तर',
    loshuIntro: 'आपल्या जन्मतारखेवरून तयार. पुनरावृत्त अंक गुण वाढवतात; अनुपस्थित अंक विकासाची क्षेत्रे दर्शवतात. पूर्ण ओळी "स्तर" बनवतात.',
    loshuPlanesLabel: 'तयार स्तर',
    loshuMissingLabel: 'अनुपस्थित अंक',
    loshuNoneMissing: 'कोणताही अंक अनुपस्थित नाही — संतुलित ग्रिड!',
    loshuNoPlanes: 'अजून कोणतेही पूर्ण तल तयार झालेले नाही.',
    loshuImproveTitle: 'आपले अनुपस्थित अंक कसे जोडावे व बळकट करावे',
    careerTitle: 'शुभ करिअर क्षेत्रे',
    checkFavGood: 'शुभ — अंक {n}, आपल्या अंकाशी ({y}) मैत्रीपूर्ण.',
    checkFavNeutral: 'तटस्थ — अंक {n}, आपल्या अंकाशी ({y}) संतुलित.',
    checkFavWarn: 'योग्य नाही — अंक {n}, आपल्या अंकाशी ({y}) मतभेद.',
    checkNeedName: 'प्रथम वर आपले नाव टाका.',
    suggestFavGood: 'आपले नाव आधीच शुभ अंक देते — बदलाची गरज नाही.',
    suggestIntro: 'अशा लहान स्पेलिंग बदल ज्यांचा अंक शुभ मूळ (1, 3, 5 किंवा 6) देतो:',
    suggestBestLabel: 'सर्वात बळकट शिफारस:',
    suggestCurrentBest: 'सर्वोत्तम पर्याय — तुमचे सध्याचे नाव:',
    suggestEmpty: 'कोणत्याही सोप्या स्पेलिंग बदलाने शुभ अंक मिळाला नाही. व्यावसायिक अंकशास्त्रज्ञ अधिक पर्याय सुचवू शकतात.',
    downloadPdf: '⬇ PDF अहवाल डाउनलोड करा',
    pdfBuilding: 'आपला अहवाल तयार होत आहे…',
    shareBtn: '📤 माझा अहवाल शेअर करा',
    shareBuilding: 'तुमचे शेअर कार्ड तयार होत आहे…',
    shareCaption: (name, single, pct) => `✨ मी NameVibe वरून माझा कॅल्डियन न्यूमरॉलॉजी अंक शोधला!\n\nनाव: ${name}\nनाव अंक: ${single}\nशुभता: ${pct}%\n\nतुमचा मोफत अहवाल मिळवा — NameVibe वापरून पहा: {url}`,
    shareCopied: 'कॅप्शन कॉपी झाले! इमेज डाउनलोड झाली आहे — शेअर करताना कॅप्शन पेस्ट करा. 🎉',
    shareTitle: 'तुमचा अहवाल शेअर करा',
    shareIntro: 'तुमच्या परिणामाचे शेअर करण्यायोग्य इमेज कार्ड डाउनलोड करा, तसेच WhatsApp, Instagram किंवा Facebook साठी तयार कॅप्शन.',
    mobileTitle: '📱 मोबाईल नंबर न्यूमरॉलॉजी',
    mobileIntro: 'तुमचा मोबाईल नंबर तुमच्यासाठी अंकशास्त्रीय दृष्टीने शुभ आहे का ते तपासा. प्रत्येक अंक जोडून एका अंकात (1–9) घटवला जातो, नंतर तुमच्या नाव अंकाशी तुलना केली जाते (वैयक्तिक निकालासाठी वर तुमचे नाव टाका).',
    mobilePlaceholder: 'मोबाईल नंबर टाका (उदा. +91 98765 43210)',
    mobileResultLabel: 'मोबाईल नंबर घटून बनतो',
    vehicleTitle: '🚗 वाहन नंबर प्लेट न्यूमरॉलॉजी',
    vehicleIntro: 'तुमच्या वाहनाचा नोंदणी क्रमांक तुमच्यासाठी शुभ आहे का ते तपासा — अक्षरे (कॅल्डियन मूल्य) व अंक एकत्र करून घटवले जातात, नंतर तुमच्या नाव अंकाशी तुलना केली जाते (वैयक्तिक निकालासाठी वर तुमचे नाव टाका).',
    vehiclePlaceholder: 'नोंदणी क्रमांक टाका (उदा. MH12AB1234)',
    vehicleResultLabel: 'वाहन नंबर घटून बनतो',
    numCheckEmpty: 'न्यूमरॉलॉजी पाहण्यासाठी वर एक नंबर टाका.',
    numCheckFav: 'शुभ — एक मजबूत, साहाय्यक अंक.',
    numCheckNeutral: 'तटस्थ — एक सामान्य, उपयुक्त अंक.',
    numCheckWarn: 'कसोटी — एक आव्हानात्मक अंक; जागरूकतेने वापरा.',
    numCheckVsYours: 'तुमच्या अंकाशी ({y}) तुलना',
    personalizeToggle: 'वर माझे नाव/जन्मतारीख वापरून वैयक्तिकृत करा',
    numCheckNeedAnchor: 'हे वैयक्तिकृत करण्यासाठी वर तुमचे नाव किंवा जन्मतारीख टाका.',
    cycleTitle: '📆 तुमचे वैयक्तिक दिवस, महिना व वर्ष अंक',
    cycleIntro: 'तुमच्या आजीवन अंकांवर आधारित अल्पकालीन चक्रे — आज, हा महिना व हे वर्ष तुमच्यासाठी काय अनुकूल आहे.',
    cycleDayLabel: 'वैयक्तिक दिवस',
    cycleMonthLabel: 'वैयक्तिक महिना',
    cycleYearLabel: 'वैयक्तिक वर्ष',
    cycleNeedDob: 'तुमचे वैयक्तिक चक्र अंक पाहण्यासाठी वर तुमची जन्मतारीख टाका.',
    reductionText: (c, trail) => `एकूण = <strong>${c}</strong>${trail.length > 1 ? ' → ' + trail.join(' → ') : ''} → मूळ अंक <strong>${trail[trail.length - 1]}</strong>`,
    emptyName: 'कृपया किमान एक अक्षर असलेले नाव लिहा.',
    stepsIntro: 'पायऱ्या',
    steps: [
      'वरील तक्त्यानुसार नावातील प्रत्येक अक्षर त्याच्या चाल्डियन मूल्यात (1–8) रूपांतरित करा.',
      'सर्व मूल्ये एकत्र करून <strong>संयुक्त अंक</strong> मिळवा.',
      'संयुक्त अंकाचे अंक एकत्र करत जा जोपर्यंत एकच अंक (1–9) मिळत नाही — तोच <strong>मूळ अंक</strong>.',
      'नावाचे स्पंदन समजून घेण्यासाठी मूळ (व संयुक्त) अंकाचा अर्थ वाचा.'
    ]
  }
};

/* Single-digit meanings per language: [title, text] */
const NUMBER_MEANINGS = {
  en: {
    1: ['The Leader', 'Independent, pioneering and ambitious. A number of leadership, originality and strong will. Favourable for those who wish to stand out and lead.'],
    2: ['The Diplomat', 'Sensitive, cooperative and intuitive. Ruled by the Moon — gentle, imaginative and peace-loving, but can be indecisive.'],
    3: ['The Communicator', 'Expressive, creative and optimistic. Ruled by Jupiter — brings luck, popularity, learning and success in creative fields.'],
    4: ['The Builder', 'Practical, disciplined and hardworking. A number of structure. Considered unpredictable in Chaldean tradition and often reworked in names.'],
    5: ['The Free Spirit', 'Versatile, quick and communicative. Ruled by Mercury — highly favourable for business, travel and adaptability; recovers fast from setbacks.'],
    6: ['The Nurturer', 'Loving, artistic and harmonious. Ruled by Venus — attracts beauty, comfort, relationships and material ease. Very favourable for names.'],
    7: ['The Seeker', 'Philosophical, spiritual and independent. Ruled by Ketu — intuitive and wise, but restless and unconventional in worldly matters.'],
    8: ['The Powerhouse', 'Ambitious, resilient and karmic. Ruled by Saturn — brings extremes of success or struggle; a heavy, testing vibration in names.'],
    9: ['The Humanitarian', 'Courageous, energetic and idealistic. Ruled by Mars — the sacred number of completion; powerful but combative if unbalanced.']
  },
  hi: {
    1: ['नेता', 'स्वतंत्र, अग्रणी व महत्वाकांक्षी। नेतृत्व, मौलिकता व दृढ़ इच्छाशक्ति का अंक। आगे बढ़ने व नेतृत्व करने वालों के लिए शुभ।'],
    2: ['राजनयिक', 'संवेदनशील, सहयोगी व सहज-बुद्धि वाला। चंद्रमा द्वारा शासित — कोमल, कल्पनाशील व शांतिप्रिय, पर निर्णय में ढुलमुल।'],
    3: ['संचारक', 'अभिव्यक्तिशील, रचनात्मक व आशावादी। बृहस्पति द्वारा शासित — भाग्य, लोकप्रियता, ज्ञान व रचनात्मक सफलता।'],
    4: ['निर्माता', 'व्यावहारिक, अनुशासित व परिश्रमी। संरचना का अंक। चाल्डियन परंपरा में अनिश्चित माना जाता है व नामों में अक्सर बदला जाता है।'],
    5: ['स्वच्छंद आत्मा', 'बहुमुखी, तेज़ व संवादप्रिय। बुध द्वारा शासित — व्यापार, यात्रा व अनुकूलन के लिए अत्यंत शुभ; असफलता से शीघ्र उबरता है।'],
    6: ['पालनकर्ता', 'प्रेममय, कलात्मक व सामंजस्यपूर्ण। शुक्र द्वारा शासित — सौंदर्य, सुख, संबंध व भौतिक सुविधा। नामों के लिए अति शुभ।'],
    7: ['खोजी', 'दार्शनिक, आध्यात्मिक व स्वतंत्र। केतु द्वारा शासित — सहज-बुद्धि व बुद्धिमान, पर सांसारिक मामलों में बेचैन।'],
    8: ['शक्ति-केंद्र', 'महत्वाकांक्षी, दृढ़ व कर्म-प्रधान। शनि द्वारा शासित — सफलता या संघर्ष की चरम स्थिति; नामों में भारी, परीक्षा लेने वाला कंपन।'],
    9: ['मानवतावादी', 'साहसी, ऊर्जावान व आदर्शवादी। मंगल द्वारा शासित — पूर्णता का पवित्र अंक; शक्तिशाली पर असंतुलित होने पर संघर्षशील।']
  },
  mr: {
    1: ['नेता', 'स्वतंत्र, अग्रेसर व महत्त्वाकांक्षी. नेतृत्व, मौलिकता व दृढ इच्छाशक्तीचा अंक. पुढे येऊ पाहणाऱ्यांसाठी शुभ.'],
    2: ['मुत्सद्दी', 'संवेदनशील, सहकार्यशील व अंतर्ज्ञानी. चंद्राच्या अधिपत्याखाली — मृदू, कल्पक व शांतताप्रिय, पण निर्णयात द्विधा.'],
    3: ['संवादक', 'अभिव्यक्तिशील, सर्जनशील व आशावादी. गुरूच्या अधिपत्याखाली — भाग्य, लोकप्रियता, ज्ञान व सर्जनशील यश.'],
    4: ['निर्माता', 'व्यवहारी, शिस्तबद्ध व कष्टाळू. रचनेचा अंक. चाल्डियन परंपरेत अनिश्चित मानला जातो व नावांत अनेकदा बदलला जातो.'],
    5: ['मुक्त आत्मा', 'बहुमुखी, चपळ व संवादप्रिय. बुधाच्या अधिपत्याखाली — व्यापार, प्रवास व जुळवून घेण्यासाठी अत्यंत शुभ; अपयशातून लवकर सावरतो.'],
    6: ['पोषणकर्ता', 'प्रेमळ, कलात्मक व सामंजस्यपूर्ण. शुक्राच्या अधिपत्याखाली — सौंदर्य, सुख, नातेसंबंध व भौतिक सुबत्ता. नावांसाठी अति शुभ.'],
    7: ['शोधक', 'तत्त्वज्ञ, आध्यात्मिक व स्वतंत्र. केतूच्या अधिपत्याखाली — अंतर्ज्ञानी व शहाणा, पण सांसारिक बाबतीत अस्वस्थ.'],
    8: ['शक्तिकेंद्र', 'महत्त्वाकांक्षी, चिवट व कर्मप्रधान. शनीच्या अधिपत्याखाली — यश किंवा संघर्षाची टोके; नावांत जड, परीक्षा पाहणारे स्पंदन.'],
    9: ['मानवतावादी', 'धाडसी, ऊर्जावान व आदर्शवादी. मंगळाच्या अधिपत्याखाली — पूर्णत्वाचा पवित्र अंक; शक्तिशाली पण असंतुलित असल्यास संघर्षशील.']
  }
};

/* Planet names per language for the ruler stat */
const PLANET_NAMES = {
  en: PLANETS,
  hi: { 1:'सूर्य', 2:'चंद्र', 3:'बृहस्पति', 4:'राहु', 5:'बुध', 6:'शुक्र', 7:'केतु', 8:'शनि', 9:'मंगल' },
  mr: { 1:'सूर्य', 2:'चंद्र', 3:'गुरु', 4:'राहू', 5:'बुध', 6:'शुक्र', 7:'केतू', 8:'शनि', 9:'मंगळ' }
};

/* =========================================================
   4b. Compound (double-digit) number meanings
   Based on the classic Cheiro / Chaldean "Compound Numbers" (10–52).
   Each: [title, meaning, fortunate?]  — anything not listed reduces to
   its own text via its single digit but is still shown as fortunate:true
   unless it is one of the traditional "warning" numbers.
   ========================================================= */
const COMPOUND_MEANINGS = {
  10: ['The Wheel of Fortune', 'Rise and fall, honour and faith, self-confidence. A number of self-reliance that tends to bring good or bad according to one\'s effort.', true],
  11: ['The Clenched Hand / A Lion Muzzled', 'A warning of hidden dangers, trials and treachery from others. One must be patient and rely on inner strength.', false],
  12: ['The Sacrifice / The Victim', 'Suffering and anxiety of mind; the sacrifice of self for others\' plans. Warns against being deceived — think for yourself.', false],
  13: ['Regeneration / Change', 'Upheaval and change, not "unlucky" but a warning of the unknown. Adapted well, it brings power through transformation.', false],
  14: ['Movement / Challenge', 'Money dealings, speculation and travel. Fortunate through movement and dealings with others, but guard against overconfidence and risk.', true],
  15: ['The Magician / Good Fortune', 'A number of magic, charm and material gain. Deep grace and the gift of drawing others; very fortunate for money and favours.', true],
  16: ['The Shattered Citadel / The Tower', 'A warning of accidents and defeat of plans. Danger of a fall from a high place; act with foresight to soften its effect.', false],
  17: ['The Star of the Magi', 'The highly spiritual number of immortality — rising above trials and difficulties. A very fortunate number of peace and legacy.', true],
  18: ['Materialism destroying the Spiritual', 'A difficult karmic number — bitter quarrels, deception and treachery. Warns of turmoil; rise above materialism to overcome it.', false],
  19: ['The Prince of Heaven / The Sun', 'One of the most fortunate numbers — success, honour, happiness and fulfilment of plans. A promise of victory.', true],
  20: ['The Awakening / Judgement', 'A call to action for a great purpose; new plans and ambitions. Fortunate, though it may face delays before the awakening.', true],
  21: ['The Crown / The Universe', 'Advancement, honour, elevation and success after struggle. A very fortunate number — victory is assured after effort.', true],
  22: ['Caution / The Good People', 'A warning of illusion and delusion — good people who are deceived. Beware false judgement and living in a "fool\'s paradise".', false],
  23: ['The Royal Star of the Lion', 'A most fortunate number — success, help from superiors and protection. Promises success in all ventures.', true],
  24: ['Gain through Love & Rank', 'Fortunate — assistance and gain through the love and help of those of rank and position. Favourable for relationships.', true],
  25: ['Strength through Experience', 'Success gained through observation and hard-won experience, not luck. Fortunate in the second half of life.', true],
  26: ['Grave Warnings / Partnerships', 'A warning of failures through bad partnerships, associations and speculation. Guard against ruin from others\' advice.', false],
  27: ['The Sceptre', 'A promise of authority, power and command — the reward of the productive intellect. Fortunate; carry out plans fearlessly.', true],
  28: ['The Trusting Lamb / Loss', 'Great promise wrecked by contradictions — loss through trust, opposition and law. Warns against lending money or over-trusting.', false],
  29: ['Grave Warnings / Uncertainty', 'Uncertainties, treachery and deception from others; grief from the opposite side. Demands courage and caution in relationships.', false],
  30: ['Thoughtful Deduction / The Recluse', 'Mental superiority and reflection — neither fortunate nor unfortunate, its outcome depends entirely on one\'s own choices.', true],
  31: ['The Recluse / Self-contained', 'Like 30 but more self-contained and lonely. A thinker set apart from worldly affairs; fortunate for the wise but isolating.', true],
  32: ['Communication / The Magic Number', 'Like 23 and 14 — magnetic and fortunate if one holds to one\'s own judgement and does not yield to others\' opinions.', true],
  33: ['Same as 24', 'Carries the vibration of 24 — gain and favour through love and people of rank. Fortunate.', true],
  34: ['Same as 25', 'Carries the vibration of 25 — strength gained through experience. Fortunate later in life.', true],
  35: ['Same as 26', 'Carries the vibration of 26 — a warning against bad partnerships and speculation.', false],
  36: ['Same as 27', 'Carries the vibration of 27 — authority and reward of the intellect. Fortunate.', true],
  37: ['Good Friendships & Partnerships', 'A fortunate number of good and lasting friendships, and success in partnership and love.', true],
  38: ['Same as 29', 'Carries the vibration of 29 — a warning of deception and uncertainty from others.', false],
  39: ['Same as 30', 'Carries the vibration of 30 — mental brilliance whose result depends on the person.', true],
  40: ['Same as 31', 'Carries the vibration of 31 — the thoughtful recluse; wise but detached.', true],
  41: ['Same as 32', 'Carries the vibration of 32 — magnetic and fortunate when holding to one\'s own judgement.', true],
  42: ['Same as 24', 'Carries the vibration of 24 — favour and gain through love and rank.', true],
  43: ['Revolution / Upheaval', 'An unfortunate number of revolution, upheaval and conflict. Warns of failure of plans through strife.', false],
  44: ['Same as 26', 'Carries the vibration of 26 — a warning against ruinous partnerships and speculation.', false],
  45: ['Same as 27', 'Carries the vibration of 27 — the sceptre of authority and reward. Fortunate.', true],
  46: ['Same as 37', 'Carries the vibration of 37 — good friendships and fortunate partnerships.', true],
  47: ['Same as 29', 'Carries the vibration of 29 — a warning of deception and uncertainty.', false],
  48: ['Same as 30', 'Carries the vibration of 30 — reflective mind; outcome depends on the person.', true],
  49: ['Same as 31', 'Carries the vibration of 31 — the self-contained thinker.', true],
  50: ['Same as 32', 'Carries the vibration of 32 — magnetic and fortunate with firm self-judgement.', true],
  51: ['The Warrior / Sudden Advancement', 'A powerful number of the warrior — sudden advancement, but dangerous for those in high position. Guard against enemies.', true],
  52: ['Same as 43', 'Carries the vibration of 43 — a warning of upheaval and conflict.', false],
};

/* Hindi translations of the compound-number meanings (title + text).
   The fortunate flag is shared from COMPOUND_MEANINGS, so only [title, text]. */
const COMPOUND_MEANINGS_HI = {
  10: ['भाग्य का चक्र', 'उत्थान और पतन, सम्मान और आस्था, आत्मविश्वास। आत्मनिर्भरता का अंक — व्यक्ति के प्रयास के अनुसार शुभ या अशुभ फल देता है।'],
  11: ['बंधी हुई मुट्ठी / बंधा हुआ सिंह', 'छिपे खतरों, परीक्षाओं और दूसरों के छल की चेतावनी। धैर्य रखें और अपनी आंतरिक शक्ति पर भरोसा करें।'],
  12: ['बलिदान / पीड़ित', 'मानसिक चिंता और कष्ट; दूसरों की योजनाओं के लिए स्वयं का त्याग। छले जाने से बचें — स्वयं सोचें।'],
  13: ['पुनर्जन्म / परिवर्तन', 'उथल-पुथल और बदलाव, "अशुभ" नहीं बल्कि अज्ञात की चेतावनी। सही ढंग से अपनाने पर यह परिवर्तन से शक्ति देता है।'],
  14: ['गति / चुनौती', 'धन-लेनदेन, सट्टा और यात्रा। गति और दूसरों से व्यवहार में शुभ, पर अति-आत्मविश्वास और जोखिम से बचें।'],
  15: ['जादूगर / सौभाग्य', 'जादू, आकर्षण और भौतिक लाभ का अंक। गहरी कृपा और दूसरों को आकर्षित करने की क्षमता; धन और अनुग्रह के लिए अत्यंत शुभ।'],
  16: ['टूटा हुआ दुर्ग / मीनार', 'दुर्घटनाओं और योजनाओं की हार की चेतावनी। ऊँचाई से गिरने का खतरा; दूरदर्शिता से इसका प्रभाव कम करें।'],
  17: ['मागी का तारा', 'अमरत्व का अत्यंत आध्यात्मिक अंक — कष्टों और कठिनाइयों से ऊपर उठना। शांति और विरासत का बहुत शुभ अंक।'],
  18: ['आध्यात्म को नष्ट करता भौतिकवाद', 'कठिन कर्म-अंक — कटु झगड़े, छल और विश्वासघात। उथल-पुथल की चेतावनी; भौतिकवाद से ऊपर उठकर इसे जीतें।'],
  19: ['स्वर्ग का राजकुमार / सूर्य', 'सबसे शुभ अंकों में से एक — सफलता, सम्मान, सुख और योजनाओं की पूर्ति। विजय का वादा।'],
  20: ['जागृति / न्याय', 'किसी महान उद्देश्य के लिए कार्य का आह्वान; नई योजनाएँ और महत्वाकांक्षाएँ। शुभ, यद्यपि जागृति से पहले विलंब हो सकता है।'],
  21: ['मुकुट / ब्रह्मांड', 'संघर्ष के बाद उन्नति, सम्मान, उत्थान और सफलता। बहुत शुभ अंक — प्रयास के बाद विजय निश्चित है।'],
  22: ['सावधानी / भले लोग', 'भ्रम और मोह की चेतावनी — भले लोग जो छले जाते हैं। गलत निर्णय और "मूर्ख के स्वर्ग" में जीने से बचें।'],
  23: ['सिंह का राजसी तारा', 'सर्वाधिक शुभ अंक — सफलता, वरिष्ठों से सहायता और सुरक्षा। सभी कार्यों में सफलता का वादा।'],
  24: ['प्रेम व पद से लाभ', 'शुभ — पद और प्रतिष्ठा वालों के प्रेम व सहायता से लाभ। संबंधों के लिए अनुकूल।'],
  25: ['अनुभव से शक्ति', 'भाग्य से नहीं, बल्कि अवलोकन और कठिन अनुभव से प्राप्त सफलता। जीवन के उत्तरार्ध में शुभ।'],
  26: ['गंभीर चेतावनी / साझेदारी', 'बुरी साझेदारी, संगति और सट्टे से असफलता की चेतावनी। दूसरों की सलाह से बर्बादी से बचें।'],
  27: ['राजदंड', 'अधिकार, शक्ति और आदेश का वादा — उत्पादक बुद्धि का पुरस्कार। शुभ; निडर होकर योजनाएँ पूरी करें।'],
  28: ['भरोसेमंद मेमना / हानि', 'बड़ी संभावना पर विरोधाभासों से नष्ट — भरोसे, विरोध और कानून से हानि। धन उधार देने या अति-भरोसे से बचें।'],
  29: ['गंभीर चेतावनी / अनिश्चितता', 'दूसरों से अनिश्चितता, विश्वासघात और छल; विपरीत पक्ष से दुःख। संबंधों में साहस और सावधानी आवश्यक।'],
  30: ['विचारशील मनन / एकांतवासी', 'मानसिक श्रेष्ठता और चिंतन — न शुभ न अशुभ, इसका परिणाम पूरी तरह व्यक्ति के अपने चुनाव पर निर्भर है।'],
  31: ['एकांतवासी / आत्मनिर्भर', '30 जैसा पर अधिक आत्मनिर्भर और एकाकी। सांसारिक मामलों से अलग एक विचारक; ज्ञानी के लिए शुभ पर एकाकी करने वाला।'],
  32: ['संचार / जादुई अंक', '23 और 14 जैसा — चुंबकीय और शुभ यदि व्यक्ति अपने निर्णय पर टिका रहे और दूसरों की राय के आगे न झुके।'],
  33: ['24 के समान', '24 का कंपन धारण करता है — पद और प्रेम से लाभ व अनुग्रह। शुभ।'],
  34: ['25 के समान', '25 का कंपन धारण करता है — अनुभव से प्राप्त शक्ति। जीवन में बाद में शुभ।'],
  35: ['26 के समान', '26 का कंपन धारण करता है — बुरी साझेदारी और सट्टे के विरुद्ध चेतावनी।'],
  36: ['27 के समान', '27 का कंपन धारण करता है — अधिकार और बुद्धि का पुरस्कार। शुभ।'],
  37: ['अच्छी मित्रता व साझेदारी', 'अच्छी और स्थायी मित्रता, तथा साझेदारी और प्रेम में सफलता का शुभ अंक।'],
  38: ['29 के समान', '29 का कंपन धारण करता है — दूसरों से छल और अनिश्चितता की चेतावनी।'],
  39: ['30 के समान', '30 का कंपन धारण करता है — मानसिक प्रतिभा जिसका परिणाम व्यक्ति पर निर्भर है।'],
  40: ['31 के समान', '31 का कंपन धारण करता है — विचारशील एकांतवासी; ज्ञानी पर अलिप्त।'],
  41: ['32 के समान', '32 का कंपन धारण करता है — अपने निर्णय पर टिके रहने पर चुंबकीय और शुभ।'],
  42: ['24 के समान', '24 का कंपन धारण करता है — प्रेम और पद से अनुग्रह व लाभ।'],
  43: ['क्रांति / उथल-पुथल', 'क्रांति, उथल-पुथल और संघर्ष का अशुभ अंक। कलह से योजनाओं की असफलता की चेतावनी।'],
  44: ['26 के समान', '26 का कंपन धारण करता है — विनाशकारी साझेदारी और सट्टे के विरुद्ध चेतावनी।'],
  45: ['27 के समान', '27 का कंपन धारण करता है — अधिकार और पुरस्कार का राजदंड। शुभ।'],
  46: ['37 के समान', '37 का कंपन धारण करता है — अच्छी मित्रता और शुभ साझेदारी।'],
  47: ['29 के समान', '29 का कंपन धारण करता है — छल और अनिश्चितता की चेतावनी।'],
  48: ['30 के समान', '30 का कंपन धारण करता है — चिंतनशील मन; परिणाम व्यक्ति पर निर्भर।'],
  49: ['31 के समान', '31 का कंपन धारण करता है — आत्मनिर्भर विचारक।'],
  50: ['32 के समान', '32 का कंपन धारण करता है — दृढ़ आत्म-निर्णय के साथ चुंबकीय और शुभ।'],
  51: ['योद्धा / आकस्मिक उन्नति', 'योद्धा का शक्तिशाली अंक — आकस्मिक उन्नति, पर उच्च पद वालों के लिए खतरनाक। शत्रुओं से सावधान रहें।'],
  52: ['43 के समान', '43 का कंपन धारण करता है — उथल-पुथल और संघर्ष की चेतावनी।'],
};

/* Marathi translations of the compound-number meanings (title + text). */
const COMPOUND_MEANINGS_MR = {
  10: ['भाग्याचे चक्र', 'उत्कर्ष आणि पतन, सन्मान आणि श्रद्धा, आत्मविश्वास. आत्मनिर्भरतेचा अंक — व्यक्तीच्या प्रयत्नांनुसार शुभ किंवा अशुभ फळ देतो.'],
  11: ['आवळलेली मूठ / बांधलेला सिंह', 'लपलेले धोके, कसोट्या आणि इतरांकडून विश्वासघाताचा इशारा. संयम ठेवा आणि आपल्या आंतरिक शक्तीवर विसंबून राहा.'],
  12: ['त्याग / बळी', 'मानसिक काळजी आणि दुःख; इतरांच्या योजनांसाठी स्वतःचा त्याग. फसवले जाण्यापासून सावध राहा — स्वतः विचार करा.'],
  13: ['पुनर्जन्म / बदल', 'उलथापालथ आणि बदल, "अशुभ" नव्हे तर अज्ञाताचा इशारा. योग्य रीतीने स्वीकारल्यास परिवर्तनातून शक्ती मिळते.'],
  14: ['गती / आव्हान', 'पैशाचे व्यवहार, सट्टा आणि प्रवास. गती आणि इतरांशी व्यवहारातून शुभ, पण अति-आत्मविश्वास व जोखमीपासून सावध राहा.'],
  15: ['जादूगार / सौभाग्य', 'जादू, आकर्षण आणि भौतिक लाभाचा अंक. खोल कृपा आणि इतरांना आकर्षित करण्याची देणगी; पैसा व अनुग्रहासाठी अत्यंत शुभ.'],
  16: ['भग्न किल्ला / मनोरा', 'अपघात आणि योजनांच्या पराभवाचा इशारा. उंचावरून पडण्याचा धोका; दूरदृष्टीने त्याचा परिणाम कमी करा.'],
  17: ['मागींचा तारा', 'अमरत्वाचा अत्यंत आध्यात्मिक अंक — कष्ट व अडचणींवर मात करणे. शांती व वारशाचा अतिशय शुभ अंक.'],
  18: ['अध्यात्माचा नाश करणारा भौतिकवाद', 'कठीण कर्म-अंक — कटू भांडणे, फसवणूक आणि विश्वासघात. उलथापालथीचा इशारा; भौतिकवादावर मात करून यावर विजय मिळवा.'],
  19: ['स्वर्गाचा राजकुमार / सूर्य', 'सर्वात शुभ अंकांपैकी एक — यश, सन्मान, आनंद आणि योजनांची पूर्तता. विजयाचे वचन.'],
  20: ['जागृती / न्याय', 'एका महान उद्देशासाठी कृतीचे आवाहन; नव्या योजना व महत्त्वाकांक्षा. शुभ, तरी जागृतीपूर्वी विलंब होऊ शकतो.'],
  21: ['मुकुट / विश्व', 'संघर्षानंतर प्रगती, सन्मान, उन्नती आणि यश. अतिशय शुभ अंक — प्रयत्नांनंतर विजय निश्चित.'],
  22: ['सावधगिरी / भले लोक', 'भ्रम आणि मोहाचा इशारा — भले लोक जे फसवले जातात. चुकीचा निर्णय व "मूर्खाच्या स्वर्गात" जगण्यापासून सावध राहा.'],
  23: ['सिंहाचा राजस तारा', 'सर्वाधिक शुभ अंक — यश, वरिष्ठांकडून मदत आणि संरक्षण. सर्व कार्यांत यशाचे वचन.'],
  24: ['प्रेम व पदातून लाभ', 'शुभ — पद व प्रतिष्ठा असलेल्यांच्या प्रेम व मदतीतून लाभ. नात्यांसाठी अनुकूल.'],
  25: ['अनुभवातून शक्ती', 'नशिबाने नव्हे तर निरीक्षण व कठीण अनुभवातून मिळालेले यश. आयुष्याच्या उत्तरार्धात शुभ.'],
  26: ['गंभीर इशारा / भागीदारी', 'वाईट भागीदारी, संगत आणि सट्ट्यातून अपयशाचा इशारा. इतरांच्या सल्ल्याने होणाऱ्या नाशापासून सावध राहा.'],
  27: ['राजदंड', 'अधिकार, शक्ती आणि आज्ञेचे वचन — उत्पादक बुद्धीचे बक्षीस. शुभ; निर्भयपणे योजना पूर्ण करा.'],
  28: ['विश्वासू कोकरू / हानी', 'मोठ्या शक्यतेचा विरोधाभासांनी नाश — विश्वास, विरोध व कायद्यातून हानी. पैसे उधार देणे किंवा अति-विश्वासापासून सावध राहा.'],
  29: ['गंभीर इशारा / अनिश्चितता', 'इतरांकडून अनिश्चितता, विश्वासघात व फसवणूक; विरुद्ध बाजूकडून दुःख. नात्यांत धैर्य व सावधगिरी आवश्यक.'],
  30: ['विचारपूर्वक अनुमान / एकांतवासी', 'मानसिक श्रेष्ठता आणि चिंतन — शुभ ना अशुभ, याचा परिणाम पूर्णतः व्यक्तीच्या स्वतःच्या निवडीवर अवलंबून.'],
  31: ['एकांतवासी / स्वयंपूर्ण', '30 सारखा पण अधिक स्वयंपूर्ण व एकाकी. सांसारिक गोष्टींपासून वेगळा विचारवंत; ज्ञानीसाठी शुभ पण एकटे पाडणारा.'],
  32: ['संवाद / जादुई अंक', '23 व 14 सारखा — चुंबकीय आणि शुभ जर व्यक्ती स्वतःच्या निर्णयावर ठाम राहिली व इतरांच्या मताला बळी पडली नाही.'],
  33: ['24 प्रमाणे', '24 चे स्पंदन धारण करतो — पद व प्रेमातून लाभ व अनुग्रह. शुभ.'],
  34: ['25 प्रमाणे', '25 चे स्पंदन धारण करतो — अनुभवातून मिळालेली शक्ती. आयुष्यात नंतर शुभ.'],
  35: ['26 प्रमाणे', '26 चे स्पंदन धारण करतो — वाईट भागीदारी व सट्ट्याविरुद्ध इशारा.'],
  36: ['27 प्रमाणे', '27 चे स्पंदन धारण करतो — अधिकार व बुद्धीचे बक्षीस. शुभ.'],
  37: ['चांगली मैत्री व भागीदारी', 'चांगली व टिकाऊ मैत्री, आणि भागीदारी व प्रेमात यशाचा शुभ अंक.'],
  38: ['29 प्रमाणे', '29 चे स्पंदन धारण करतो — इतरांकडून फसवणूक व अनिश्चिततेचा इशारा.'],
  39: ['30 प्रमाणे', '30 चे स्पंदन धारण करतो — मानसिक तेज ज्याचा परिणाम व्यक्तीवर अवलंबून.'],
  40: ['31 प्रमाणे', '31 चे स्पंदन धारण करतो — विचारशील एकांतवासी; ज्ञानी पण अलिप्त.'],
  41: ['32 प्रमाणे', '32 चे स्पंदन धारण करतो — स्वतःच्या निर्णयावर ठाम राहिल्यास चुंबकीय व शुभ.'],
  42: ['24 प्रमाणे', '24 चे स्पंदन धारण करतो — प्रेम व पदातून अनुग्रह व लाभ.'],
  43: ['क्रांती / उलथापालथ', 'क्रांती, उलथापालथ व संघर्षाचा अशुभ अंक. कलहामुळे योजनांच्या अपयशाचा इशारा.'],
  44: ['26 प्रमाणे', '26 चे स्पंदन धारण करतो — विनाशकारी भागीदारी व सट्ट्याविरुद्ध इशारा.'],
  45: ['27 प्रमाणे', '27 चे स्पंदन धारण करतो — अधिकार व बक्षिसाचा राजदंड. शुभ.'],
  46: ['37 प्रमाणे', '37 चे स्पंदन धारण करतो — चांगली मैत्री व शुभ भागीदारी.'],
  47: ['29 प्रमाणे', '29 चे स्पंदन धारण करतो — फसवणूक व अनिश्चिततेचा इशारा.'],
  48: ['30 प्रमाणे', '30 चे स्पंदन धारण करतो — चिंतनशील मन; परिणाम व्यक्तीवर अवलंबून.'],
  49: ['31 प्रमाणे', '31 चे स्पंदन धारण करतो — स्वयंपूर्ण विचारवंत.'],
  50: ['32 प्रमाणे', '32 चे स्पंदन धारण करतो — ठाम आत्म-निर्णयासह चुंबकीय व शुभ.'],
  51: ['योद्धा / आकस्मिक प्रगती', 'योद्ध्याचा शक्तिशाली अंक — आकस्मिक प्रगती, पण उच्च पदावरील लोकांसाठी धोकादायक. शत्रूंपासून सावध राहा.'],
  52: ['43 प्रमाणे', '43 चे स्पंदन धारण करतो — उलथापालथ व संघर्षाचा इशारा.'],
};

/* =========================================================
   4c. Favourable Indian / Hindu name pool
   Used to suggest culturally-appropriate names whose Chaldean root
   is favourable (1, 3, 5, 6) — grouped by gender. Each entry carries a
   short meaning (EN/HI/MR) and its textual source: Rigveda, Upanishads,
   Puranas, the Ramayana/Mahabharata, or general Sanskrit. A few widely
   used names are Persian/Arabic/modern in origin rather than Vedic —
   those are marked "Popular" instead of a false scriptural source.
   ========================================================= */
const INDIAN_NAMES = {
  boy: [
    { name:'Aarav', source:'Sanskrit', meaningEN:'Peaceful, wise', meaningHI:'शांत, ज्ञानी', meaningMR:'शांत, ज्ञानी' },
    { name:'Advait', source:'Upanishads', meaningEN:'Non-dual, one without a second — the core Vedantic concept', meaningHI:'अद्वैत — वेदांत का मूल सिद्धांत, एक और अद्वितीय', meaningMR:'अद्वैत — वेदांताचे मूळ तत्त्व, एक व अद्वितीय' },
    { name:'Arjun', source:'Mahabharata', meaningEN:'Bright, shining — the heroic third Pandava, Krishna\'s disciple in the Gita', meaningHI:'उज्ज्वल, तेजस्वी — तीसरे पांडव, गीता में कृष्ण के शिष्य', meaningMR:'उज्ज्वल, तेजस्वी — तिसरे पांडव, गीतेत कृष्णाचे शिष्य' },
    { name:'Aryan', source:'Rigveda', meaningEN:'Noble one — the Rigveda\'s own word for a person of noble conduct', meaningHI:'श्रेष्ठ, आर्य — ऋग्वेद में उत्तम आचरण वाले के लिए प्रयुक्त', meaningMR:'श्रेष्ठ, आर्य — ऋग्वेदात उत्तम आचरण असलेल्यासाठी वापरलेला शब्द' },
    { name:'Dhruv', source:'Puranas', meaningEN:'Fixed, immovable — the boy-devotee who became the Pole Star (Vishnu Purana)', meaningHI:'अचल, स्थिर — विष्णु पुराण में भक्त बालक जो ध्रुव तारा बना', meaningMR:'अचल, स्थिर — विष्णू पुराणातील बालभक्त जो ध्रुव तारा बनला' },
    { name:'Ishaan', source:'Puranas', meaningEN:'Direction of the northeast; also an epithet of Shiva', meaningHI:'ईशान दिशा (उत्तर-पूर्व); शिव का एक नाम', meaningMR:'ईशान्य दिशा; शिवाचे एक नाव' },
    { name:'Kabir', source:'Popular', meaningEN:'Great, mighty (Perso-Arabic origin) — also the name of the 15th-century mystic-poet', meaningHI:'महान, विशाल (फ़ारसी-अरबी मूल) — संत-कवि कबीर का नाम', meaningMR:'महान, थोर (फार्सी-अरबी मूळ) — संत-कवी कबीराचे नाव' },
    { name:'Karan', source:'Sanskrit', meaningEN:'Cause, reason; instrument', meaningHI:'कारण, साधन', meaningMR:'कारण, साधन' },
    { name:'Krishna', source:'Bhagavad Gita', meaningEN:'Dark, all-attractive — the eighth avatar of Vishnu, speaker of the Gita', meaningHI:'श्याम, सर्वाकर्षक — विष्णु के आठवें अवतार, गीता के वक्ता', meaningMR:'श्याम, सर्वाकर्षक — विष्णूचा आठवा अवतार, गीतेचा उपदेशक' },
    { name:'Laksh', source:'Sanskrit', meaningEN:'Aim, goal, target', meaningHI:'लक्ष्य, उद्देश्य', meaningMR:'लक्ष्य, उद्दिष्ट' },
    { name:'Manav', source:'Puranas', meaningEN:'Human being — from Manu, progenitor of humankind', meaningHI:'मनुष्य — मनु से, मानवजाति के आदि पुरुष', meaningMR:'मानव — मनूपासून, मानवजातीचा आदिपुरुष' },
    { name:'Neel', source:'Sanskrit', meaningEN:'Blue — the hue traditionally associated with Krishna and Vishnu', meaningHI:'नीला — कृष्ण व विष्णु से जुड़ा रंग', meaningMR:'निळा — कृष्ण व विष्णूशी संबंधित रंग' },
    { name:'Om', source:'Upanishads', meaningEN:'The primordial sacred sound representing Brahman (Mandukya Upanishad)', meaningHI:'आदि पवित्र नाद, ब्रह्म का प्रतीक (मांडूक्य उपनिषद)', meaningMR:'आदि पवित्र नाद, ब्रह्माचे प्रतीक (मांडूक्य उपनिषद)' },
    { name:'Parth', source:'Bhagavad Gita', meaningEN:'Son of Pritha (Kunti) — how Krishna addresses Arjuna in the Gita', meaningHI:'पृथा (कुंती) के पुत्र — गीता में कृष्ण द्वारा अर्जुन को संबोधन', meaningMR:'पृथेचा (कुंतीचा) पुत्र — गीतेत कृष्णाने अर्जुनाला केलेली संबोधना' },
    { name:'Pranav', source:'Upanishads', meaningEN:'Another name for the sacred syllable Om', meaningHI:'ओम् का दूसरा नाम', meaningMR:'ओम् चे दुसरे नाव' },
    { name:'Rohan', source:'Sanskrit', meaningEN:'Ascending, rising', meaningHI:'आरोहण करने वाला, उभरता हुआ', meaningMR:'चढणारा, उगवणारा' },
    { name:'Rudra', source:'Rigveda', meaningEN:'The fierce storm-deity of the Rigveda, later identified with Shiva', meaningHI:'ऋग्वेद के प्रचंड तूफानी देवता, बाद में शिव से समरूप', meaningMR:'ऋग्वेदातील प्रचंड वादळ-देवता, नंतर शिवाशी समरूप' },
    { name:'Samarth', source:'Sanskrit', meaningEN:'Capable, powerful, competent', meaningHI:'सक्षम, शक्तिशाली', meaningMR:'सक्षम, शक्तिशाली' },
    { name:'Shaurya', source:'Sanskrit', meaningEN:'Valour, bravery, heroism', meaningHI:'शौर्य, वीरता', meaningMR:'शौर्य, वीरता' },
    { name:'Siddharth', source:'Popular', meaningEN:'One who has accomplished his goal — birth name of Gautam Buddha', meaningHI:'जिसने अपना लक्ष्य पूर्ण किया — गौतम बुद्ध का जन्म-नाम', meaningMR:'ज्याने आपले लक्ष्य साध्य केले — गौतम बुद्धांचे जन्मनाव' },
    { name:'Tejas', source:'Sanskrit', meaningEN:'Brilliance, lustre, radiance', meaningHI:'तेज, चमक, कांति', meaningMR:'तेज, चकाकी, कांती' },
    { name:'Ved', source:'Vedic', meaningEN:'Sacred knowledge — refers to the Vedas themselves', meaningHI:'पवित्र ज्ञान — वेदों का प्रतीक', meaningMR:'पवित्र ज्ञान — वेदांचे प्रतीक' },
    { name:'Vihaan', source:'Sanskrit', meaningEN:'Dawn, morning', meaningHI:'प्रभात, सुबह', meaningMR:'पहाट, सकाळ' },
    { name:'Viraj', source:'Rigveda', meaningEN:'Resplendent — the cosmic being described in the Purusha Sukta', meaningHI:'तेजस्वी — पुरुष सूक्त में वर्णित विराट पुरुष', meaningMR:'तेजस्वी — पुरुष सूक्तात वर्णिलेला विराट पुरुष' },
    { name:'Yash', source:'Sanskrit', meaningEN:'Fame, glory, success', meaningHI:'यश, कीर्ति, सफलता', meaningMR:'यश, कीर्ती, सफलता' },
    { name:'Aditya', source:'Rigveda', meaningEN:'Son of Aditi — an epithet of Surya, the Vedic sun-god', meaningHI:'अदिति के पुत्र — सूर्य का नाम', meaningMR:'अदितीचा पुत्र — सूर्याचे नाव' },
    { name:'Ansh', source:'Sanskrit', meaningEN:'Part, portion — a part of the divine', meaningHI:'अंश, भाग — ईश्वर का अंश', meaningMR:'अंश, भाग — ईश्वराचा अंश' },
    { name:'Devansh', source:'Sanskrit', meaningEN:'A part of the divine', meaningHI:'देवता का अंश', meaningMR:'देवाचा अंश' },
    { name:'Reyansh', source:'Popular', meaningEN:'A ray of light / part of a compassionate one (modern coinage)', meaningHI:'प्रकाश की किरण / दयालु का अंश (आधुनिक नाम)', meaningMR:'प्रकाशाचा किरण / दयाळूचा अंश (आधुनिक नाव)' },
    { name:'Shivansh', source:'Sanskrit', meaningEN:'A part of Lord Shiva', meaningHI:'शिव का अंश', meaningMR:'शिवाचा अंश' },
    { name:'Atharv', source:'Vedic', meaningEN:'Relates to the Atharva Veda, the fourth of the four Vedas', meaningHI:'अथर्ववेद से संबंधित — चार वेदों में से चौथा', meaningMR:'अथर्ववेदाशी संबंधित — चार वेदांपैकी चौथा' },
    { name:'Kiaan', source:'Popular', meaningEN:'Grace, king (modern name, Persian-influenced)', meaningHI:'अनुग्रह, राजा (आधुनिक नाम, फ़ारसी प्रभाव)', meaningMR:'अनुग्रह, राजा (आधुनिक नाव, फार्सी प्रभाव)' },
    { name:'Nirvaan', source:'Upanishads', meaningEN:'Liberation from the cycle of rebirth', meaningHI:'मोक्ष, जन्म-मृत्यु के चक्र से मुक्ति', meaningMR:'मोक्ष, जन्म-मृत्यूच्या फेऱ्यातून मुक्ती' },
    { name:'Vivaan', source:'Sanskrit', meaningEN:'Full of life, giver of life', meaningHI:'जीवन से भरपूर, जीवनदाता', meaningMR:'जीवनाने भरलेला, जीवनदाता' },
    { name:'Agastya', source:'Rigveda', meaningEN:'A revered Vedic sage, credited with several Rigvedic hymns', meaningHI:'ऋग्वेद के आदरणीय ऋषि, कई ऋचाओं के रचयिता', meaningMR:'ऋग्वेदातील आदरणीय ऋषी, अनेक ऋचांचे रचनाकार' },
    { name:'Dhananjay', source:'Mahabharata', meaningEN:'Conqueror of wealth — another name of Arjuna', meaningHI:'धन के विजेता — अर्जुन का एक नाम', meaningMR:'धनाचा विजेता — अर्जुनाचे एक नाव' },
    { name:'Gopal', source:'Puranas', meaningEN:'Protector of cows — a beloved name of Krishna', meaningHI:'गायों के रक्षक — कृष्ण का प्रिय नाम', meaningMR:'गायींचा रक्षक — कृष्णाचे प्रिय नाव' },
    { name:'Harsh', source:'Sanskrit', meaningEN:'Joy, happiness', meaningHI:'हर्ष, आनंद', meaningMR:'हर्ष, आनंद' },
    { name:'Indra', source:'Rigveda', meaningEN:'King of the Devas, god of thunder and rain — the most invoked deity in the Rigveda', meaningHI:'देवराज, वर्षा व मेघ के देवता — ऋग्वेद में सर्वाधिक स्तुत देवता', meaningMR:'देवराज, पर्जन्य व मेघांचा देव — ऋग्वेदातील सर्वाधिक स्तुत देवता' },
    { name:'Kashyap', source:'Rigveda', meaningEN:'A revered sage, one of the Saptarishi (seven great sages)', meaningHI:'सप्तर्षियों में से एक आदरणीय ऋषि', meaningMR:'सप्तर्षींपैकी एक आदरणीय ऋषी' },
    { name:'Lakshman', source:'Ramayana', meaningEN:'Auspicious sign — Rama\'s devoted younger brother', meaningHI:'शुभ चिह्न — राम के अनुगत छोटे भाई', meaningMR:'शुभ चिन्ह — रामाचे अनुगत लहान बंधू' },
    { name:'Madhav', source:'Bhagavad Gita', meaningEN:'Sweet as honey — an epithet of Krishna/Vishnu', meaningHI:'मधुर, मधु के समान — कृष्ण/विष्णु का नाम', meaningMR:'मधुर, मधासारखा — कृष्ण/विष्णूचे नाव' },
    { name:'Nakul', source:'Mahabharata', meaningEN:'The fourth Pandava, celebrated for beauty and skill with horses', meaningHI:'चौथे पांडव, सुंदरता व अश्व-विद्या में निपुण', meaningMR:'चौथे पांडव, सौंदर्य व अश्वविद्येत निपुण' },
    { name:'Narayan', source:'Upanishads', meaningEN:'One who pervades the waters — a principal name of Vishnu', meaningHI:'जल में निवास करने वाला — विष्णु का प्रमुख नाम', meaningMR:'जलात निवास करणारा — विष्णूचे प्रमुख नाव' },
    { name:'Rishabh', source:'Sanskrit', meaningEN:'The best, supreme; also a bull — symbol of strength', meaningHI:'सर्वश्रेष्ठ; वृषभ — शक्ति का प्रतीक', meaningMR:'सर्वश्रेष्ठ; वृषभ — शक्तीचे प्रतीक' },
    { name:'Vedant', source:'Upanishads', meaningEN:'The essence/culmination of the Vedas — the Vedanta philosophy', meaningHI:'वेदों का सार — वेदांत दर्शन', meaningMR:'वेदांचे सार — वेदांत दर्शन' },
    { name:'Manu', source:'Puranas', meaningEN:'The progenitor of humankind, giver of the Manusmriti', meaningHI:'मानवजाति के आदि पुरुष, मनुस्मृति के रचयिता', meaningMR:'मानवजातीचा आदिपुरुष, मनुस्मृतीचा रचनाकार' },
    { name:'Girish', source:'Puranas', meaningEN:'Lord of the mountain — an epithet of Shiva', meaningHI:'पर्वतों के स्वामी — शिव का नाम', meaningMR:'पर्वतांचा स्वामी — शिवाचे नाव' },
    { name:'Satyajit', source:'Sanskrit', meaningEN:'Conqueror of truth', meaningHI:'सत्य के विजेता', meaningMR:'सत्याचा विजेता' },
  ],
  girl: [
    { name:'Aadya', source:'Puranas', meaningEN:'The primal power — an epithet of Goddess Durga/Adi Shakti', meaningHI:'आदि शक्ति — देवी दुर्गा का नाम', meaningMR:'आदि शक्ती — देवी दुर्गेचे नाव' },
    { name:'Aanya', source:'Sanskrit', meaningEN:'Full of grace, inexhaustible', meaningHI:'कृपापूर्ण, अक्षय', meaningMR:'कृपापूर्ण, अक्षय' },
    { name:'Aarohi', source:'Sanskrit', meaningEN:'One who ascends; an ascending musical scale', meaningHI:'आरोहण करने वाली; संगीत का आरोही स्वर', meaningMR:'आरोहण करणारी; संगीताचा आरोही स्वर' },
    { name:'Ananya', source:'Sanskrit', meaningEN:'Unique, matchless, without another', meaningHI:'अद्वितीय, अनुपम', meaningMR:'अद्वितीय, अनुपम' },
    { name:'Anvi', source:'Sanskrit', meaningEN:'A seeker, one who searches for knowledge', meaningHI:'खोजी, ज्ञान की जिज्ञासु', meaningMR:'शोधक, ज्ञानाची जिज्ञासू' },
    { name:'Avni', source:'Sanskrit', meaningEN:'The earth', meaningHI:'पृथ्वी, धरा', meaningMR:'पृथ्वी, धरा' },
    { name:'Diya', source:'Sanskrit', meaningEN:'Lamp, light', meaningHI:'दीप, प्रकाश', meaningMR:'दिवा, प्रकाश' },
    { name:'Gauri', source:'Puranas', meaningEN:'The fair one — an epithet of Goddess Parvati', meaningHI:'गौरवर्णा — देवी पार्वती का नाम', meaningMR:'गौरवर्णा — देवी पार्वतीचे नाव' },
    { name:'Ira', source:'Rigveda', meaningEN:'Goddess of speech and libation invoked in Vedic sacrifice', meaningHI:'वाणी व हविष्य की देवी — वैदिक यज्ञ में आवाहित', meaningMR:'वाणी व हविष्याची देवी — वैदिक यज्ञात आवाहित' },
    { name:'Ishita', source:'Sanskrit', meaningEN:'One who is desired; supreme', meaningHI:'वांछित, सर्वोच्च', meaningMR:'वांछित, सर्वोच्च' },
    { name:'Kavya', source:'Sanskrit', meaningEN:'Poetry', meaningHI:'काव्य, कविता', meaningMR:'काव्य, कविता' },
    { name:'Kiara', source:'Popular', meaningEN:'Beam of light (modern, Italian-influenced)', meaningHI:'प्रकाश की किरण (आधुनिक नाम)', meaningMR:'प्रकाशाचा किरण (आधुनिक नाव)' },
    { name:'Lavanya', source:'Sanskrit', meaningEN:'Grace, beauty, charm', meaningHI:'सौंदर्य, आकर्षण', meaningMR:'सौंदर्य, आकर्षण' },
    { name:'Meera', source:'Popular', meaningEN:'Ocean; also the name of the saint-poetess devoted to Krishna', meaningHI:'सागर; कृष्ण-भक्त संत-कवयित्री मीराबाई का नाम', meaningMR:'सागर; कृष्णभक्त संत-कवयित्री मीराबाईचे नाव' },
    { name:'Myra', source:'Popular', meaningEN:'Beloved, admirable (Latin/Greek-influenced, modern usage)', meaningHI:'प्रिय, प्रशंसनीय (आधुनिक नाम)', meaningMR:'प्रिय, प्रशंसनीय (आधुनिक नाव)' },
    { name:'Navya', source:'Sanskrit', meaningEN:'New, young', meaningHI:'नवीन, युवा', meaningMR:'नवीन, तरुण' },
    { name:'Nitya', source:'Upanishads', meaningEN:'Eternal, everlasting — a key Vedantic term', meaningHI:'नित्य, चिरस्थायी — वेदांत का प्रमुख शब्द', meaningMR:'नित्य, चिरस्थायी — वेदांताचा प्रमुख शब्द' },
    { name:'Pari', source:'Popular', meaningEN:'Fairy, angel (Persian origin)', meaningHI:'परी, देवदूत (फ़ारसी मूल)', meaningMR:'परी, देवदूत (फार्सी मूळ)' },
    { name:'Prisha', source:'Sanskrit', meaningEN:'Beloved, God\'s gift', meaningHI:'प्रिय, ईश्वर का उपहार', meaningMR:'प्रिय, ईश्वराची देणगी' },
    { name:'Riya', source:'Sanskrit', meaningEN:'Singer; graceful', meaningHI:'गायिका; सुंदर', meaningMR:'गायिका; सुंदर' },
    { name:'Saanvi', source:'Puranas', meaningEN:'An epithet of Goddess Lakshmi', meaningHI:'देवी लक्ष्मी का नाम', meaningMR:'देवी लक्ष्मीचे नाव' },
    { name:'Sara', source:'Popular', meaningEN:'Princess (Hebrew origin)', meaningHI:'राजकुमारी (हिब्रू मूल)', meaningMR:'राजकुमारी (हिब्रू मूळ)' },
    { name:'Shreya', source:'Sanskrit', meaningEN:'Auspicious, fortunate, the better one', meaningHI:'शुभ, कल्याणकारी', meaningMR:'शुभ, कल्याणकारी' },
    { name:'Siya', source:'Ramayana', meaningEN:'Another name for Sita, Rama\'s consort', meaningHI:'सीता का दूसरा नाम', meaningMR:'सीतेचे दुसरे नाव' },
    { name:'Tara', source:'Puranas', meaningEN:'Star — also a revered goddess figure', meaningHI:'तारा — एक पूजनीय देवी', meaningMR:'तारा — एक पूजनीय देवी' },
    { name:'Trisha', source:'Sanskrit', meaningEN:'Thirst, deep desire (Trishna)', meaningHI:'तृष्णा, गहरी इच्छा', meaningMR:'तृष्णा, तीव्र इच्छा' },
    { name:'Vanya', source:'Sanskrit', meaningEN:'Forest-born; a gracious gift', meaningHI:'वन में जन्मी; अनुग्रह का उपहार', meaningMR:'वनात जन्मलेली; अनुग्रहाची देणगी' },
    { name:'Aaradhya', source:'Sanskrit', meaningEN:'Worthy of worship, one who is worshipped', meaningHI:'आराधना के योग्य, पूजनीय', meaningMR:'आराधनेस योग्य, पूजनीय' },
    { name:'Anika', source:'Sanskrit', meaningEN:'Grace, favour, brilliance', meaningHI:'अनुग्रह, तेज', meaningMR:'अनुग्रह, तेज' },
    { name:'Ishani', source:'Puranas', meaningEN:'Goddess, ruler — an epithet of Goddess Parvati', meaningHI:'ईशानी — देवी पार्वती का नाम', meaningMR:'ईशानी — देवी पार्वतीचे नाव' },
    { name:'Mahi', source:'Rigveda', meaningEN:'The earth — invoked as a goddess in the Rigveda', meaningHI:'पृथ्वी — ऋग्वेद में देवी रूप में आवाहित', meaningMR:'पृथ्वी — ऋग्वेदात देवीरूपात आवाहित' },
    { name:'Pihu', source:'Popular', meaningEN:'The chirp of a bird; a term of endearment', meaningHI:'पक्षी की चहचहाहट; प्रेमसूचक नाम', meaningMR:'पक्ष्याचा किलबिलाट; प्रेमळ नाव' },
    { name:'Saira', source:'Popular', meaningEN:'One who travels; noble (Persian/Arabic origin)', meaningHI:'यात्रा करने वाली; श्रेष्ठ (फ़ारसी-अरबी मूल)', meaningMR:'प्रवास करणारी; श्रेष्ठ (फार्सी-अरबी मूळ)' },
    { name:'Zara', source:'Popular', meaningEN:'Princess, blooming flower (Arabic origin)', meaningHI:'राजकुमारी, खिलता फूल (अरबी मूल)', meaningMR:'राजकुमारी, फुलणारे फूल (अरबी मूळ)' },
    { name:'Aditi', source:'Rigveda', meaningEN:'Boundless, without bonds — mother of the Adityas in the Rigveda', meaningHI:'असीम, अबाध्य — ऋग्वेद में आदित्यों की माता', meaningMR:'असीम, अबाध्य — ऋग्वेदात आदित्यांची माता' },
    { name:'Divya', source:'Sanskrit', meaningEN:'Divine, heavenly', meaningHI:'दिव्य, स्वर्गीय', meaningMR:'दिव्य, स्वर्गीय' },
    { name:'Bhavani', source:'Puranas', meaningEN:'Giver of existence — an epithet of Goddess Parvati', meaningHI:'अस्तित्व की दात्री — देवी पार्वती का नाम', meaningMR:'अस्तित्वाची दाती — देवी पार्वतीचे नाव' },
    { name:'Draupadi', source:'Mahabharata', meaningEN:'Daughter of King Drupada, born from sacred fire, wife of the Pandavas', meaningHI:'राजा द्रुपद की पुत्री, यज्ञ की अग्नि से जन्मी, पांडवों की पत्नी', meaningMR:'राजा द्रुपदाची कन्या, यज्ञातील अग्नीतून जन्मलेली, पांडवांची पत्नी' },
    { name:'Ganga', source:'Puranas', meaningEN:'The sacred river personified as a goddess', meaningHI:'पवित्र नदी का देवी रूप', meaningMR:'पवित्र नदीचे देवीरूप' },
    { name:'Indira', source:'Puranas', meaningEN:'Beauty, splendour — an epithet of Goddess Lakshmi', meaningHI:'सौंदर्य, वैभव — देवी लक्ष्मी का नाम', meaningMR:'सौंदर्य, वैभव — देवी लक्ष्मीचे नाव' },
    { name:'Janaki', source:'Ramayana', meaningEN:'Daughter of King Janaka — another name for Sita', meaningHI:'राजा जनक की पुत्री — सीता का नाम', meaningMR:'राजा जनकाची कन्या — सीतेचे नाव' },
    { name:'Lopamudra', source:'Rigveda', meaningEN:'Wife of sage Agastya and a Vedic seer-poetess in her own right', meaningHI:'ऋषि अगस्त्य की पत्नी, स्वयं एक वैदिक ऋषिका', meaningMR:'ऋषी अगस्त्यांची पत्नी, स्वतः एक वैदिक ऋषिका' },
    { name:'Maitreyi', source:'Upanishads', meaningEN:'A female philosopher in the Brihadaranyaka Upanishad, wife of sage Yajnavalkya', meaningHI:'बृहदारण्यक उपनिषद की विदुषी, ऋषि याज्ञवल्क्य की पत्नी', meaningMR:'बृहदारण्यक उपनिषदातील विदुषी, ऋषी याज्ञवल्क्यांची पत्नी' },
    { name:'Nandini', source:'Puranas', meaningEN:'One who brings joy; the divine cow of sage Vasishtha', meaningHI:'आनंद देने वाली; ऋषि वसिष्ठ की दिव्य गाय', meaningMR:'आनंद देणारी; ऋषी वसिष्ठांची दिव्य गाय' },
    { name:'Padma', source:'Puranas', meaningEN:'Lotus — an epithet of Goddess Lakshmi', meaningHI:'कमल — देवी लक्ष्मी का नाम', meaningMR:'कमळ — देवी लक्ष्मीचे नाव' },
    { name:'Radhika', source:'Puranas', meaningEN:'Beloved of Krishna, symbol of divine love', meaningHI:'कृष्ण की प्रिय, दिव्य प्रेम का प्रतीक', meaningMR:'कृष्णाची प्रिय, दिव्य प्रेमाचे प्रतीक' },
    { name:'Sati', source:'Puranas', meaningEN:'Shiva\'s consort in her first incarnation', meaningHI:'शिव की पहली अवतार वाली पत्नी', meaningMR:'शिवाची पहिल्या अवतारातील पत्नी' },
    { name:'Uma', source:'Puranas', meaningEN:'Another name for Goddess Parvati', meaningHI:'देवी पार्वती का नाम', meaningMR:'देवी पार्वतीचे नाव' },
    { name:'Yashoda', source:'Puranas', meaningEN:'Foster mother of Krishna', meaningHI:'कृष्ण की पालक माता', meaningMR:'कृष्णाची पालक माता' },
    { name:'Gargi', source:'Upanishads', meaningEN:'A learned female philosopher who debates in the Brihadaranyaka Upanishad', meaningHI:'बृहदारण्यक उपनिषद की विदुषी दार्शनिक', meaningMR:'बृहदारण्यक उपनिषदातील विदुषी तत्त्वज्ञ' },
    { name:'Savitri', source:'Mahabharata', meaningEN:'The devoted wife who won back her husband\'s life from Yama; also a Vedic hymn/goddess', meaningHI:'यमराज से पति का जीवन पुनः प्राप्त करने वाली साध्वी; एक वैदिक स्तुति/देवी', meaningMR:'यमराजाकडून पतीचे जीवन परत मिळवणारी साध्वी; एक वैदिक स्तुती/देवी' },
    { name:'Rukmini', source:'Puranas', meaningEN:'Chief queen and consort of Krishna', meaningHI:'कृष्ण की प्रमुख रानी', meaningMR:'कृष्णाची प्रमुख राणी' },
    { name:'Kaushalya', source:'Ramayana', meaningEN:'Mother of Rama, queen of Ayodhya', meaningHI:'राम की माता, अयोध्या की रानी', meaningMR:'रामाची माता, अयोध्येची राणी' },
    { name:'Sita', source:'Ramayana', meaningEN:'Daughter of the earth, devoted consort of Rama', meaningHI:'धरती की पुत्री, राम की पतिव्रता पत्नी', meaningMR:'धरतीची कन्या, रामाची पतिव्रता पत्नी' },
    { name:'Parvati', source:'Puranas', meaningEN:'Daughter of the mountains, consort of Shiva', meaningHI:'पर्वतराज की पुत्री, शिव की पत्नी', meaningMR:'पर्वतराजाची कन्या, शिवाची पत्नी' },
    { name:'Saraswati', source:'Rigveda', meaningEN:'Goddess of knowledge, speech and learning — also a major Vedic river-goddess', meaningHI:'ज्ञान, वाणी व विद्या की देवी — एक प्रमुख वैदिक नदी-देवी', meaningMR:'ज्ञान, वाणी व विद्येची देवी — एक प्रमुख वैदिक नदी-देवी' },
    { name:'Lakshmi', source:'Rigveda', meaningEN:'Goddess of wealth and prosperity, praised in the Sri Sukta', meaningHI:'धन-समृद्धि की देवी, श्री सूक्त में स्तुत', meaningMR:'धनधाराची देवी, श्री सूक्तात स्तुत' },
    { name:'Chandrika', source:'Sanskrit', meaningEN:'Moonlight', meaningHI:'चंद्रमा की रोशनी', meaningMR:'चंद्रप्रकाश' },
    { name:'Vasudha', source:'Sanskrit', meaningEN:'The earth, bearer of wealth', meaningHI:'धरा, वसुधा', meaningMR:'धरा, वसुधा' },
  ],
};

/* =========================================================
   4d. Per-number "lucky essentials" (root digit 1–9)
   Each: { days:[wk], numbers:[...], colorsEN, colorsHI, colorsMR,
           colorHex:[...], godEN/HI/MR, metalEN/HI/MR, direction }
   Days: 0=Sun .. 6=Sat (JS getDay order).
   ========================================================= */
const LUCKY = {
  1: { days:[0,1], numbers:[1,10,19,28], colorHex:['#E9B949','#D98C2B','#8B5E3C'],
       colorsEN:'Gold, Orange, Bronze', colorsHI:'सुनहरा, नारंगी, कांस्य', colorsMR:'सोनेरी, नारिंगी, कांस्य',
       godEN:'Sun (Surya) / Lord Vishnu', godHI:'सूर्य / भगवान विष्णु', godMR:'सूर्य / भगवान विष्णू',
       metalEN:'Gold, Ruby', metalHI:'सोना, माणिक', metalMR:'सोने, माणिक', dir:'East',
       plantEN:'Sunflower / Banyan tree', plantHI:'सूरजमुखी / बरगद', plantMR:'सूर्यफूल / वड' },
  2: { days:[1,0], numbers:[2,11,20,29], colorHex:['#DCE3EA','#BFD3E6','#EDE9DF'],
       colorsEN:'White, Cream, Light Green', colorsHI:'सफेद, क्रीम, हल्का हरा', colorsMR:'पांढरा, क्रीम, फिकट हिरवा',
       godEN:'Moon (Chandra) / Goddess Parvati', godHI:'चंद्र / माता पार्वती', godMR:'चंद्र / देवी पार्वती',
       metalEN:'Silver, Pearl', metalHI:'चांदी, मोती', metalMR:'चांदी, मोती', dir:'North-West',
       plantEN:'Jasmine / Moonflower', plantHI:'चमेली / रातरानी', plantMR:'जाई-जुई / रातराणी' },
  3: { days:[4,2], numbers:[3,12,21,30], colorHex:['#F2C14E','#C8A2C8','#F4A259'],
       colorsEN:'Yellow, Purple, Saffron', colorsHI:'पीला, बैंगनी, केसरी', colorsMR:'पिवळा, जांभळा, केशरी',
       godEN:'Jupiter (Guru) / Lord Vishnu', godHI:'बृहस्पति / भगवान विष्णु', godMR:'गुरु / भगवान विष्णू',
       metalEN:'Yellow Sapphire', metalHI:'पुखराज', metalMR:'पुष्कराज', dir:'North-East',
       plantEN:'Peepal tree / Marigold', plantHI:'पीपल / गेंदा', plantMR:'पिंपळ / झेंडू' },
  4: { days:[0,6], numbers:[4,13,22,31], colorHex:['#8FA3AD','#6E7F80','#B0B7BC'],
       colorsEN:'Grey, Electric Blue, Khaki', colorsHI:'ग्रे, नीला, खाकी', colorsMR:'करडा, निळा, खाकी',
       godEN:'Rahu / Lord Ganesha', godHI:'राहु / भगवान गणेश', godMR:'राहू / भगवान गणेश',
       metalEN:'Hessonite (Gomed)', metalHI:'गोमेद', metalMR:'गोमेद', dir:'South-West',
       plantEN:'Durva grass / Money plant', plantHI:'दूर्वा घास / मनी प्लांट', plantMR:'दूर्वा / मनी प्लांट' },
  5: { days:[3,5], numbers:[5,14,23,32], colorHex:['#8CD790','#BFE3C0','#EFEFEF'],
       colorsEN:'Green, Light Grey, White', colorsHI:'हरा, हल्का ग्रे, सफेद', colorsMR:'हिरवा, फिकट करडा, पांढरा',
       godEN:'Mercury (Budh) / Lord Vishnu', godHI:'बुध / भगवान विष्णु', godMR:'बुध / भगवान विष्णू',
       metalEN:'Emerald', metalHI:'पन्ना', metalMR:'पाचू', dir:'North',
       plantEN:'Tulsi (Holy Basil) / Mint', plantHI:'तुलसी / पुदीना', plantMR:'तुळस / पुदिना' },
  6: { days:[5,4], numbers:[6,15,24,33], colorHex:['#7EC8E3','#F7CAC9','#E6E6FA'],
       colorsEN:'Blue, Pink, Pastels', colorsHI:'नीला, गुलाबी, पेस्टल', colorsMR:'निळा, गुलाबी, पेस्टल',
       godEN:'Venus (Shukra) / Goddess Lakshmi', godHI:'शुक्र / माता लक्ष्मी', godMR:'शुक्र / देवी लक्ष्मी',
       metalEN:'Diamond', metalHI:'हीरा', metalMR:'हिरा', dir:'South-East',
       plantEN:'Rose / Lotus', plantHI:'गुलाब / कमल', plantMR:'गुलाब / कमळ' },
  7: { days:[1,0], numbers:[7,16,25,34], colorHex:['#BFD3E6','#C7E0D4','#E8E1F0'],
       colorsEN:'Light Blue, Sea Green, White', colorsHI:'हल्का नीला, समुद्री हरा, सफेद', colorsMR:'फिकट निळा, सागरी हिरवा, पांढरा',
       godEN:'Ketu / Lord Shiva', godHI:'केतु / भगवान शिव', godMR:'केतू / भगवान शिव',
       metalEN:"Cat's Eye", metalHI:'लहसुनिया', metalMR:'लसणी', dir:'North-West',
       plantEN:'Ashwagandha / Water Lily', plantHI:'अश्वगंधा / कुमुदिनी', plantMR:'अश्वगंधा / कुमुदिनी' },
  8: { days:[6,0], numbers:[8,17,26,35], colorHex:['#2E2E38','#3B3B4F','#5A4B6B'],
       colorsEN:'Black, Dark Blue, Purple', colorsHI:'काला, गहरा नीला, बैंगनी', colorsMR:'काळा, गडद निळा, जांभळा',
       godEN:'Saturn (Shani) / Lord Hanuman', godHI:'शनि / भगवान हनुमान', godMR:'शनि / भगवान हनुमान',
       metalEN:'Blue Sapphire', metalHI:'नीलम', metalMR:'नीलम', dir:'West',
       plantEN:'Shami tree / Black Sesame', plantHI:'शमी वृक्ष / काला तिल', plantMR:'शमी वृक्ष / काळे तीळ' },
  9: { days:[2,4], numbers:[9,18,27,36], colorHex:['#E1493B','#C0392B','#E8746A'],
       colorsEN:'Red, Crimson, Rose', colorsHI:'लाल, क्रिमसन, गुलाबी', colorsMR:'लाल, किरमिजी, गुलाबी',
       godEN:'Mars (Mangal) / Lord Kartikeya', godHI:'मंगल / भगवान कार्तिकेय', godMR:'मंगळ / भगवान कार्तिकेय',
       metalEN:'Red Coral', metalHI:'मूंगा', metalMR:'पोवळा', dir:'South',
       plantEN:'Red Hibiscus / Khair tree', plantHI:'लाल गुड़हल / खैर वृक्ष', plantMR:'लाल जास्वंद / खैर वृक्ष' },
};
function luckyColors(n) { const L = LUCKY[n]; return L['colors' + currentLang.toUpperCase()] || L.colorsEN; }
function luckyGod(n)    { const L = LUCKY[n]; return L['god' + currentLang.toUpperCase()] || L.godEN; }
function luckyMetal(n)  { const L = LUCKY[n]; return L['metal' + currentLang.toUpperCase()] || L.metalEN; }
function luckyPlant(n)  { const L = LUCKY[n]; return L['plant' + currentLang.toUpperCase()] || L.plantEN; }

/* Compass directions — translate the English tokens (both full names like
   "North-West" used by LUCKY, and abbreviations like "NW" used by Kua). */
const DIR_I18N = {
  hi: { East:'पूर्व', West:'पश्चिम', North:'उत्तर', South:'दक्षिण',
        'North-East':'ईशान (उत्तर-पूर्व)', 'North-West':'वायव्य (उत्तर-पश्चिम)',
        'South-East':'आग्नेय (दक्षिण-पूर्व)', 'South-West':'नैऋत्य (दक्षिण-पश्चिम)',
        N:'उत्तर', S:'दक्षिण', E:'पूर्व', W:'पश्चिम', NE:'ईशान', NW:'वायव्य', SE:'आग्नेय', SW:'नैऋत्य' },
  mr: { East:'पूर्व', West:'पश्चिम', North:'उत्तर', South:'दक्षिण',
        'North-East':'ईशान्य (उत्तर-पूर्व)', 'North-West':'वायव्य (उत्तर-पश्चिम)',
        'South-East':'आग्नेय (दक्षिण-पूर्व)', 'South-West':'नैऋत्य (दक्षिण-पश्चिम)',
        N:'उत्तर', S:'दक्षिण', E:'पूर्व', W:'पश्चिम', NE:'ईशान्य', NW:'वायव्य', SE:'आग्नेय', SW:'नैऋत्य' },
};
function dirLabel(token) {
  token = token.trim();
  if (currentLang === 'en') return token;
  return (DIR_I18N[currentLang] && DIR_I18N[currentLang][token]) || token;
}
function dirListLabel(str) { return str.split(',').map(dirLabel).join(', '); }

/* Kua East/West group name, localised. */
const KUA_GROUP_I18N = {
  hi: { East: 'पूर्व समूह', West: 'पश्चिम समूह' },
  mr: { East: 'पूर्व गट', West: 'पश्चिम गट' },
};
function kuaGroupLabel(g) {
  if (currentLang === 'en') return g;
  return (KUA_GROUP_I18N[currentLang] && KUA_GROUP_I18N[currentLang][g]) || g;
}

/* Lucky-city names transliterated into Devanagari (shared by Hindi & Marathi;
   falls back to the English name for anything not listed). */
const CITY_I18N = {
  'New York':'न्यूयॉर्क', 'Dubai':'दुबई', 'Singapore':'सिंगापूर', 'Geneva':'जिनेव्हा', 'Kyoto':'क्योटो',
  'London':'लंडन', 'Amsterdam':'ॲम्स्टरडॅम', 'Vancouver':'व्हँकुव्हर', 'Reykjavik':'रेक्याविक', 'Lucerne':'ल्युसर्न',
  'Zurich':'झुरिच', 'Frankfurt':'फ्रँकफर्ट', 'Boston':'बॉस्टन', 'Vienna':'व्हिएन्ना', 'Rishikesh':'ऋषिकेश',
  'Tokyo':'टोकियो', 'Seoul':'सेऊल', 'Bengaluru':'बंगळुरू', 'Helsinki':'हेलसिंकी', 'Auckland':'ऑकलंड',
  'Hong Kong':'हाँगकाँग', 'Mumbai':'मुंबई', 'San Francisco':'सॅन फ्रान्सिस्को', 'Barcelona':'बार्सिलोना', 'Nice':'नीस',
  'Paris':'पॅरिस', 'Milan':'मिलान', 'Los Angeles':'लॉस एंजेलिस', 'Florence':'फ्लॉरेन्स', 'Udaipur':'उदयपूर',
  'Edinburgh':'एडिनबर्ग', 'Cambridge':'केंब्रिज', 'Bern':'बर्न', 'Varanasi':'वाराणसी', 'Sedona':'सेडोना',
  'Chicago':'शिकागो', 'Shanghai':'शांघाय', 'Toronto':'टोरांटो', 'Oslo':'ऑस्लो', 'Wellington':'वेलिंग्टन',
  'Sydney':'सिडनी', 'Berlin':'बर्लिन', 'Houston':'ह्युस्टन', 'Cape Town':'केप टाऊन', 'Pune':'पुणे',
};
function cityLabel(en) { return currentLang === 'en' ? en : (CITY_I18N[en] || en); }
function cityListLabel(arr) { return arr.map(cityLabel).join(', '); }

/* Career guidance per root digit */
const CAREERS = {
  en: {
    1: 'Leadership, government, entrepreneurship, administration, defence.',
    2: 'Diplomacy, HR, counselling, hospitality, arts, public relations.',
    3: 'Teaching, law, writing, media, finance, consulting, spirituality.',
    4: 'Engineering, IT, real estate, logistics, research, systems work.',
    5: 'Business, sales, marketing, travel, communication, stock markets.',
    6: 'Design, fashion, hospitality, medicine, luxury goods, the arts.',
    7: 'Research, science, philosophy, spirituality, analytics, healing.',
    8: 'Finance, law, mining, construction, large-scale industry, politics.',
    9: 'Defence, sports, surgery, engineering, social work, leadership.',
  },
  hi: {
    1: 'नेतृत्व, सरकार, उद्यमिता, प्रशासन, रक्षा।',
    2: 'कूटनीति, मानव संसाधन, परामर्श, आतिथ्य, कला, जनसंपर्क।',
    3: 'शिक्षण, कानून, लेखन, मीडिया, वित्त, परामर्श, अध्यात्म।',
    4: 'इंजीनियरिंग, आईटी, रियल एस्टेट, लॉजिस्टिक्स, अनुसंधान।',
    5: 'व्यापार, बिक्री, विपणन, यात्रा, संचार, शेयर बाजार।',
    6: 'डिज़ाइन, फैशन, आतिथ्य, चिकित्सा, विलासिता, कला।',
    7: 'अनुसंधान, विज्ञान, दर्शन, अध्यात्म, विश्लेषण, उपचार।',
    8: 'वित्त, कानून, खनन, निर्माण, बड़े उद्योग, राजनीति।',
    9: 'रक्षा, खेल, शल्य-चिकित्सा, इंजीनियरिंग, समाज सेवा, नेतृत्व।',
  },
  mr: {
    1: 'नेतृत्व, सरकार, उद्योजकता, प्रशासन, संरक्षण.',
    2: 'मुत्सद्देगिरी, मनुष्यबळ, समुपदेशन, आदरातिथ्य, कला, जनसंपर्क.',
    3: 'अध्यापन, कायदा, लेखन, माध्यमे, वित्त, सल्ला, अध्यात्म.',
    4: 'अभियांत्रिकी, आयटी, स्थावर मालमत्ता, लॉजिस्टिक्स, संशोधन.',
    5: 'व्यवसाय, विक्री, विपणन, प्रवास, संवाद, शेअर बाजार.',
    6: 'डिझाइन, फॅशन, आदरातिथ्य, वैद्यक, चैनीच्या वस्तू, कला.',
    7: 'संशोधन, विज्ञान, तत्त्वज्ञान, अध्यात्म, विश्लेषण, उपचार.',
    8: 'वित्त, कायदा, खाणकाम, बांधकाम, मोठे उद्योग, राजकारण.',
    9: 'संरक्षण, क्रीडा, शस्त्रक्रिया, अभियांत्रिकी, समाजकार्य, नेतृत्व.',
  },
};

/* Lucky world cities per root digit — split into places that favour a
   thriving CAREER and places that favour a long, peaceful life. */
const LUCKY_CITIES = {
  1: { career:['New York','Dubai','Singapore'], living:['Geneva','Kyoto'] },
  2: { career:['London','Amsterdam','Vancouver'], living:['Reykjavik','Lucerne'] },
  3: { career:['Zurich','Frankfurt','Boston'], living:['Vienna','Rishikesh'] },
  4: { career:['Tokyo','Seoul','Bengaluru'], living:['Helsinki','Auckland'] },
  5: { career:['Hong Kong','Mumbai','San Francisco'], living:['Barcelona','Nice'] },
  6: { career:['Paris','Milan','Los Angeles'], living:['Florence','Udaipur'] },
  7: { career:['Edinburgh','Cambridge','Bern'], living:['Varanasi','Sedona'] },
  8: { career:['Chicago','Shanghai','Toronto'], living:['Oslo','Wellington'] },
  9: { career:['Sydney','Berlin','Houston'], living:['Cape Town','Pune'] },
};

/* Life-event guidance per root digit: the ages/years that tend to bring
   turning points, and the kind of event most likely to shine then. */
const LIFE_EVENTS = {
  en: {
    1: { years:'Ages 1, 10, 19, 28, 37, 46', best:'New ventures, promotions, leadership roles and bold fresh starts.' },
    2: { years:'Ages 2, 11, 20, 29, 38, 47', best:'Marriage, partnerships, reconciliations and important collaborations.' },
    3: { years:'Ages 3, 12, 21, 30, 39, 48', best:'Education milestones, publishing, recognition, spiritual growth.' },
    4: { years:'Ages 4, 13, 22, 31, 40, 49', best:'Property, long-term contracts, building systems and steady expansion.' },
    5: { years:'Ages 5, 14, 23, 32, 41, 50', best:'Travel, business deals, communication wins and lucrative change.' },
    6: { years:'Ages 6, 15, 24, 33, 42, 51', best:'Marriage, family growth, home-buying, artistic and financial success.' },
    7: { years:'Ages 7, 16, 25, 34, 43, 52', best:'Research breakthroughs, spiritual awakening, travel over water.' },
    8: { years:'Ages 8, 17, 26, 35, 44, 53', best:'Major financial gains, real estate, hard-won authority (after effort).' },
    9: { years:'Ages 9, 18, 27, 36, 45, 54', best:'Achievement, courage-led wins, property and completion of big goals.' },
  },
  hi: {
    1: { years:'आयु 1, 10, 19, 28, 37, 46', best:'नए उद्यम, पदोन्नति, नेतृत्व और साहसी शुरुआत।' },
    2: { years:'आयु 2, 11, 20, 29, 38, 47', best:'विवाह, साझेदारी, मेल-मिलाप और महत्वपूर्ण सहयोग।' },
    3: { years:'आयु 3, 12, 21, 30, 39, 48', best:'शिक्षा उपलब्धि, प्रकाशन, सम्मान, आध्यात्मिक विकास।' },
    4: { years:'आयु 4, 13, 22, 31, 40, 49', best:'संपत्ति, दीर्घकालिक अनुबंध, व्यवस्था-निर्माण, स्थिर विस्तार।' },
    5: { years:'आयु 5, 14, 23, 32, 41, 50', best:'यात्रा, व्यापारिक सौदे, संचार सफलता और लाभकारी परिवर्तन।' },
    6: { years:'आयु 6, 15, 24, 33, 42, 51', best:'विवाह, परिवार-वृद्धि, गृह-खरीद, कलात्मक व आर्थिक सफलता।' },
    7: { years:'आयु 7, 16, 25, 34, 43, 52', best:'शोध सफलता, आध्यात्मिक जागृति, जल-यात्रा।' },
    8: { years:'आयु 8, 17, 26, 35, 44, 53', best:'बड़ा आर्थिक लाभ, अचल संपत्ति, परिश्रम से मिली सत्ता।' },
    9: { years:'आयु 9, 18, 27, 36, 45, 54', best:'उपलब्धि, साहस से विजय, संपत्ति और बड़े लक्ष्यों की पूर्ति।' },
  },
  mr: {
    1: { years:'वय 1, 10, 19, 28, 37, 46', best:'नवे उपक्रम, बढती, नेतृत्व आणि धाडसी सुरुवात.' },
    2: { years:'वय 2, 11, 20, 29, 38, 47', best:'विवाह, भागीदारी, समेट आणि महत्त्वाचे सहकार्य.' },
    3: { years:'वय 3, 12, 21, 30, 39, 48', best:'शिक्षण यश, प्रकाशन, सन्मान, आध्यात्मिक प्रगती.' },
    4: { years:'वय 4, 13, 22, 31, 40, 49', best:'मालमत्ता, दीर्घकालीन करार, व्यवस्था-उभारणी, स्थिर विस्तार.' },
    5: { years:'वय 5, 14, 23, 32, 41, 50', best:'प्रवास, व्यापारी करार, संवाद यश आणि फायदेशीर बदल.' },
    6: { years:'वय 6, 15, 24, 33, 42, 51', best:'विवाह, कुटुंब-वाढ, घर-खरेदी, कलात्मक व आर्थिक यश.' },
    7: { years:'वय 7, 16, 25, 34, 43, 52', best:'संशोधन यश, आध्यात्मिक जागृती, जल-प्रवास.' },
    8: { years:'वय 8, 17, 26, 35, 44, 53', best:'मोठा आर्थिक लाभ, स्थावर मालमत्ता, कष्टाने मिळालेली सत्ता.' },
    9: { years:'वय 9, 18, 27, 36, 45, 54', best:'यश, धाडसाने विजय, मालमत्ता आणि मोठ्या ध्येयांची पूर्ती.' },
  },
};

/* =========================================================
   4d-2. Personality & life-path prediction paragraphs (per root 1–9)
   Four topics per root number: social (behaviour & connection with others),
   body (health & physical tendencies), love (romantic life) and career
   (professional path — a longer, narrative companion to the short CAREERS
   list above). One full paragraph each, per language.
   ========================================================= */
const PERSONALITY_PROFILES = {
  en: {
    1: {
      social: "You lead rather than follow — in groups you naturally become the one others look to for direction. This independence can read as aloofness to people who don't know you yet, but those close to you value your straightforwardness and the confidence you bring into any room.",
      body: "Ruled by the Sun, you carry strong vitality and recover from setbacks quickly, but you're prone to overworking through fatigue and headaches brought on by stress. Regular time away from responsibility — even short breaks — keeps your natural resilience intact.",
      love: "You fall in love the way you do everything else: decisively. You need a partner who respects your independence rather than competing for control, and relationships thrive when both people have room to lead in their own domains.",
      career: "Entrepreneurship, leadership and pioneering roles suit you far better than routine positions where you answer to layers of process. You do your best work when given ownership of an outcome and the freedom to reach it your own way — government, defence, administration and founding your own venture are all traditionally strong paths.",
      money: "You earn through initiative rather than caution — money tends to arrive when you back your own ideas rather than wait for a salary to grow. The risk is ego-spending: buying to signal status or leadership. Wealth builds fastest when you treat money as a tool for independence rather than a scoreboard, and reinvest into ventures you personally drive.",
      growth: "Your central life lesson is that leadership is not the same as doing everything alone. Learning to delegate, to accept help without feeling diminished, and to soften the drive to always be first is where your real growth lies. The years you stop needing to prove your strength are the years you become genuinely powerful.",
    },
    2: {
      social: "You read a room before you speak in it, and that sensitivity makes you the person others confide in. Diplomacy comes naturally, though it can tip into indecision when you're the one who has to choose rather than mediate.",
      body: "The Moon's influence gives you an emotionally-tied constitution — stress shows up first as sleep disturbance or digestive upset rather than obvious illness. A calm, low-drama routine and steady sleep hours matter more for you than for most other numbers.",
      love: "You love deeply and give generously of your attention, sometimes to the point of losing your own preferences in the relationship. You're happiest with a partner who reciprocates the emotional effort rather than simply receiving it.",
      career: "Roles built around people — counselling, HR, diplomacy, hospitality, public relations — let your intuition and tact become your biggest professional asset. You do less well isolated at a desk with no human contact; collaborative environments bring out your real strengths.",
      money: "Your finances move in cycles like the Moon that rules you — flush one season, tight the next — so a steady reserve matters more for your peace of mind than for most numbers. You spend generously on others and on your home; the discipline to save a fixed amount before that generosity kicks in is what turns comfort into security.",
      growth: "Your life lesson is to value your own needs as much as everyone else's. Learning to make a decision without seeking constant reassurance, and to set a boundary without guilt, is the growth that frees you. Your sensitivity is a gift — but only once you stop letting others' moods dictate your own.",
    },
    3: {
      social: "Your optimism is contagious, and people are drawn to your company because conversations with you rarely stay flat for long. You're a natural communicator, though your enthusiasm for the next idea can outpace your follow-through on the current one.",
      body: "Jupiter's expansive influence tends to show up physically as a love of good food, which without moderation becomes weight and liver-related strain over time. Movement that you actually enjoy — dance, sport, walking with company — works far better for you than a disciplined solo gym routine.",
      love: "You need a partner who can keep up with your ideas and your social calendar, and who doesn't take your restlessness for disinterest. Long stretches of routine without novelty are what strain your relationships, not lack of affection.",
      career: "Teaching, law, writing, media and consulting reward the exact mix of expression and quick thinking you carry naturally. Structured creative fields — where you're producing ideas but within a framework — tend to outperform either pure freelance chaos or rigid, idea-free corporate roles for you.",
      money: "Money comes to you through many streams rather than one — Jupiter's luck favours you, but scattered income needs structure or it slips away as fast as it arrives. Your weakness is optimistic overspending on experiences and generosity to friends. A simple habit of setting aside a share of every windfall does more for you than any complex plan.",
      growth: "Your life lesson is follow-through: turning your abundance of ideas into finished things. Scattering your energy across ten half-started projects is the pattern to outgrow. Learning to finish, to go deep instead of only wide, and to let a few commitments mature is what converts your natural talent into lasting achievement.",
    },
    4: {
      social: "You're the reliable one — the friend people call when they need something actually done, not just sympathised with. That dependability sometimes gets mistaken for stubbornness, since you build trust slowly and don't warm up to new circles quickly.",
      body: "Rahu's unpredictable influence in Chaldean tradition means your health runs steady for long periods and then dips suddenly rather than gradually — regular check-ups matter more for you than for numbers with more even patterns. Structure in diet and sleep timing keeps that unpredictability in check.",
      love: "You show love through consistency and provision rather than grand gestures, and you need a partner who reads that correctly rather than mistaking steadiness for a lack of passion. Once committed, you are exceptionally loyal.",
      career: "Engineering, IT, real estate, logistics and systems-heavy work reward your patience for detail and your comfort with long-term projects that don't pay off immediately. You build things that last — which is precisely why quick, high-churn environments frustrate you.",
      money: "You are the natural saver of the numbers — steady, careful, and more comfortable building wealth slowly through property and fixed assets than through risk. That prudence is your strength; the trap is holding on so tightly that fear of loss blocks the sensible risks that would grow it. Money is safest with you, but it grows when you occasionally trust it out into the world.",
      growth: "Your life lesson is flexibility — learning that not everything can be controlled, planned or made perfectly stable. The sudden upheavals your number is prone to are teachers, not just misfortunes: they push you to adapt. Loosening your grip, embracing change instead of resisting it, is the growth that turns your solid foundation into a living one.",
    },
    5: {
      social: "You're the easiest number to get along with in any new setting — quick with conversation, comfortable with strangers, and genuinely energised by variety in the people around you. The tradeoff is that close, unchanging routines with the same small circle can start to feel confining.",
      body: "Mercury's quicksilver influence gives you a nervous, highly-responsive system — you recover fast from illness but are more susceptible to stress-related nervous and digestive issues than most. Frequent small changes of scene (even a walk, a new route, a short trip) genuinely help regulate you.",
      love: "You need freedom inside a relationship more than most numbers do, and partners who try to pin you down too tightly will feel you pulling away. The right partner gives you room to roam and trusts you to come back — because you do.",
      career: "Business, sales, marketing, travel and communication-heavy roles let your adaptability become an asset instead of a liability. Anything that keeps you moving, talking to new people, or working across varied projects suits you better than a single unchanging desk job.",
      money: "You have a real gift for making money move — trading, deals, side ventures and quick opportunities all come naturally. The flip side is impulsive spending and a taste for risk that can swing your finances sharply. Wealth builds when you channel your quick instincts into a few disciplined bets rather than a constant churn of speculation.",
      growth: "Your life lesson is commitment — learning that freedom and consistency are not enemies. The restlessness that makes you adaptable can also keep you from finishing what you start or staying long enough to reap the reward. Growth for you is choosing to root down in the right places while keeping your love of variety alive within them.",
    },
    6: {
      social: "You're a natural nurturer — people gravitate to you for comfort, taste and warmth, and you're often the one quietly holding a group or family together. The risk is over-giving: you can end up managing everyone else's needs before your own.",
      body: "Venus's influence tends to show up as a love of comfort and rich living, which without balance leans toward weight gain and sluggishness. Because your wellbeing is closely tied to your surroundings, a genuinely pleasant, uncluttered living space does more for your health than strict discipline alone.",
      love: "Love and romance sit close to the centre of your life, more than for almost any other number, and you invest deeply once committed. You thrive with a partner who appreciates beauty, home and family the way you do, and struggle in relationships that stay purely practical with no warmth.",
      career: "Design, fashion, hospitality, medicine, the arts and any field built around beauty, care or comfort draw out your natural talents. You do your best work when the outcome improves someone's life or surroundings directly — you're drawn to service, not abstraction.",
      money: "Venus gives you a comfortable relationship with money and often a knack for attracting it, but also a genuine love of beautiful, expensive things. You spend on home, family and quality of life without much guilt. Your finances stay healthy as long as your generosity toward loved ones doesn't outrun your income — set a comfort budget and let the rest compound.",
      growth: "Your life lesson is balance — learning to receive care as freely as you give it, and to serve others without dissolving into their needs. Over-responsibility and worry for everyone around you is the pattern to outgrow. Your growth is discovering that you can nurture from a full cup, not an empty one, and that saying no is sometimes the most loving act.",
    },
    7: {
      social: "You keep a wider circle at a comfortable distance and reserve real closeness for very few — not from coldness, but because you process the world internally first. People often describe you as hard to read, which is fair, since you rarely perform emotions you're not actually having.",
      body: "Ketu's influence tends to make you more sensitive to environment and diet than most, with a nervous system that reacts to noise, crowding or poor sleep faster than it shows outwardly. Quiet, solitary recovery time isn't optional for you — it's how you actually recharge.",
      love: "You need a partner who doesn't take your need for solitude personally, and who is comfortable with silence rather than constant reassurance. Once someone earns your trust, the bond tends to be unusually deep and enduring.",
      career: "Research, science, philosophy, spirituality, analytics and any field that rewards depth over speed let your natural inclination toward solitary, focused thinking become an advantage rather than a social liability. Fast-paced, people-heavy environments drain you faster than they would most other numbers.",
      money: "Money is rarely your primary motivation, and you're happiest when it simply frees you to pursue what interests you rather than being an end in itself. You can be surprisingly detached about wealth, which protects you from greed but can leave practical finances neglected. A simple, automated system suits you — set it up once so your mind stays free for deeper things.",
      growth: "Your life lesson is trust — learning to open to others and to life rather than retreating into analysis and solitude whenever things feel uncertain. Your depth is a rare gift, but isolation can curdle into loneliness or cynicism. Growth for you is letting faith, connection and a few trusted people back into a world you tend to keep at arm's length.",
    },
    8: {
      social: "You carry natural authority, and people sense it even when you're not asserting it directly — which makes you a strong leader but occasionally an intimidating presence in casual settings. Saturn's discipline in you means you take relationships seriously and don't invest lightly.",
      body: "Saturn's heavier influence in Chaldean tradition tends to show up as bone, joint or knee-related strain and a susceptibility to chronic stress over time — your health responds better to steady, disciplined routines than to sudden intense efforts. Rest is not a luxury for you; it's maintenance.",
      love: "You love with commitment and endurance rather than constant displays of affection, and can be misread as distant when you're actually deeply invested. A partner who values loyalty and long-term building over short-term romance suits you best.",
      career: "Finance, law, large-scale industry, construction and positions of real authority reward your capacity to carry weight others can't. Success often comes later and harder-won than for other numbers, but tends to be more durable once achieved.",
      money: "You are built for long-term wealth — Saturn rewards patience, discipline and the willingness to endure lean years for a solid result. Money tends to come slowly, then substantially. Your risk is either extreme caution that misses opportunity, or over-leveraging in pursuit of the status you quietly crave. Steady, disciplined building is where your fortune is genuinely made.",
      growth: "Your life lesson is that success measured only in material terms leaves you empty. Learning to lighten your seriousness, to trust that the universe isn't only obstacles, and to find meaning beyond achievement is your deepest growth. The hardships your number attracts early in life are the very things that forge your later strength — if you don't let them harden you.",
    },
    9: {
      social: "You're drawn to causes bigger than yourself, and people notice your intensity before they notice anything else about you. That same fire makes you a natural leader in a crisis, but it can also tip into combativeness when you feel an injustice needs correcting immediately.",
      body: "Mars's influence gives you strong physical energy and a fast metabolism, but also a temper that runs hot — unresolved anger tends to surface as inflammation, blood pressure or accident-proneness over time. Physical outlets for that energy (sport, intense exercise) matter more for you than for calmer numbers.",
      love: "You love passionately and protectively, sometimes fiercely enough to overwhelm a quieter partner. The relationships that last are the ones where your intensity is met with equal honesty rather than avoidance or placation.",
      career: "Defence, sports, surgery, engineering and social work all rewards the same trait: the willingness to act decisively where others hesitate. You're built for roles with real stakes and clear outcomes, not slow-moving bureaucratic ones.",
      money: "You earn through drive and courage — Mars favours bold action, and money often follows the risks others won't take. But that same fire makes you spend impulsively and act before calculating, so windfalls can vanish as fast as they come. Wealth builds when you pause between impulse and purchase, and put your energy into building rather than proving.",
      growth: "Your life lesson is channelling your fire — learning to fight for causes without becoming combative, and to act decisively without acting rashly. Patience and forgiveness are the hardest and most transformative lessons for you. When you learn to direct your immense energy at what you're building rather than at what angers you, you become genuinely unstoppable.",
    },
  },
  hi: {
    1: {
      social: "आप अनुसरण करने के बजाय नेतृत्व करते हैं — समूह में स्वाभाविक रूप से वही व्यक्ति बन जाते हैं जिसकी ओर सब दिशा के लिए देखते हैं। यह स्वतंत्रता उन लोगों को दूरी जैसी लग सकती है जो आपको नहीं जानते, पर करीबी लोग आपकी स्पष्टवादिता और आत्मविश्वास को महत्व देते हैं।",
      body: "सूर्य के प्रभाव से आपमें प्रबल जीवनशक्ति है और आप असफलताओं से जल्दी उठ खड़े होते हैं, पर तनाव से सिरदर्द व अधिक काम की थकान का खतरा रहता है। जिम्मेदारियों से नियमित छोटा विश्राम आपकी सहज सहनशक्ति बनाए रखता है।",
      love: "आप प्रेम में भी निर्णायक होते हैं। आपको ऐसे साथी की ज़रूरत है जो आपकी स्वतंत्रता का सम्मान करे, नियंत्रण के लिए प्रतिस्पर्धा न करे — जब दोनों को अपने क्षेत्र में नेतृत्व की जगह मिलती है, रिश्ता फलता-फूलता है।",
      career: "उद्यमिता, नेतृत्व व अग्रणी भूमिकाएँ आपके लिए नियमित पदों से कहीं बेहतर हैं जहाँ आपको कई स्तरों की प्रक्रिया का पालन करना पड़े। परिणाम की स्वयं ज़िम्मेदारी व अपने तरीके से पहुँचने की स्वतंत्रता मिलने पर आप सर्वश्रेष्ठ काम करते हैं — सरकार, रक्षा, प्रशासन व स्वयं का उद्यम आरंभ करना परंपरागत रूप से शक्तिशाली मार्ग हैं।",
      money: "आप सतर्कता से नहीं, पहल से कमाते हैं — पैसा तब आता है जब आप अपने विचारों पर भरोसा करते हैं, न कि वेतन बढ़ने की प्रतीक्षा करते हैं। जोखिम है अहं-खर्च: रुतबा दिखाने के लिए खरीदना। जब आप पैसे को स्कोरबोर्ड नहीं बल्कि स्वतंत्रता का साधन मानते हैं और स्वयं चलाए उद्यमों में पुनर्निवेश करते हैं, तब धन सबसे तेज़ बढ़ता है।",
      growth: "आपका मुख्य जीवन-पाठ यह है कि नेतृत्व सब कुछ अकेले करना नहीं है। कार्य सौंपना सीखना, कमज़ोर महसूस किए बिना मदद स्वीकार करना, और हमेशा प्रथम रहने की चाह को नरम करना — यहीं आपका असली विकास है। जिन वर्षों में आप अपनी शक्ति सिद्ध करने की ज़रूरत छोड़ देते हैं, वही वर्ष आपको सचमुच शक्तिशाली बनाते हैं।",
    },
    2: {
      social: "आप बोलने से पहले माहौल को समझते हैं, और यही संवेदनशीलता आपको वह व्यक्ति बनाती है जिससे लोग अपनी बात साझा करते हैं। कूटनीति स्वाभाविक है, पर जब आपको ही निर्णय लेना हो — न कि मध्यस्थता करनी हो — तो यह अनिर्णय में बदल सकती है।",
      body: "चंद्रमा का प्रभाव आपकी संरचना को भावनाओं से जोड़ता है — तनाव सबसे पहले स्पष्ट बीमारी के रूप में नहीं, बल्कि नींद की गड़बड़ी या पाचन समस्या के रूप में दिखता है। शांत, कम उथल-पुथल वाली दिनचर्या व नियमित नींद आपके लिए अन्य अंकों से अधिक महत्वपूर्ण है।",
      love: "आप गहराई से प्रेम करते हैं और अपना ध्यान उदारता से देते हैं, कभी-कभी इस हद तक कि रिश्ते में अपनी पसंद खो देते हैं। ऐसे साथी के साथ आप सबसे प्रसन्न रहते हैं जो भावनात्मक प्रयास का बदला दे, न कि केवल प्राप्त करे।",
      career: "परामर्श, मानव संसाधन, कूटनीति, आतिथ्य व जनसंपर्क जैसी लोगों-केंद्रित भूमिकाएँ आपकी सहज-बुद्धि व चतुराई को आपकी सबसे बड़ी व्यावसायिक संपत्ति बनाती हैं। मानवीय संपर्क रहित एकाकी डेस्क-कार्य में आप कम प्रभावी रहते हैं; सहयोगी माहौल आपकी वास्तविक शक्तियाँ सामने लाता है।",
      money: "आपका धन आपके स्वामी चंद्रमा की तरह चक्रों में चलता है — एक मौसम भरा-पूरा, अगला तंग — इसलिए मन की शांति के लिए एक स्थिर बचत अन्य अंकों से अधिक ज़रूरी है। आप दूसरों पर व अपने घर पर उदारता से खर्च करते हैं; उस उदारता से पहले एक निश्चित राशि बचाने का अनुशासन ही आराम को सुरक्षा में बदलता है।",
      growth: "आपका जीवन-पाठ है अपनी ज़रूरतों को सबकी ज़रूरतों जितना ही महत्व देना। निरंतर आश्वासन खोजे बिना निर्णय लेना, और अपराधबोध के बिना सीमा तय करना सीखना — यही विकास आपको मुक्त करता है। आपकी संवेदनशीलता एक उपहार है — पर तभी जब आप दूसरों के मूड को अपना मूड तय करने देना बंद करते हैं।",
    },
    3: {
      social: "आपका उत्साह संक्रामक है, और लोग आपकी संगति की ओर खिंचते हैं क्योंकि आपसे बातचीत शायद ही कभी नीरस रहती है। आप स्वाभाविक संचारक हैं, पर अगले विचार का उत्साह वर्तमान को पूरा करने की गति से आगे निकल सकता है।",
      body: "बृहस्पति के विस्तारशील प्रभाव से अच्छे भोजन का प्रेम शारीरिक रूप में दिखता है, जो संयम के बिना समय के साथ वज़न व लिवर संबंधी तनाव बन सकता है। आपके लिए वह गतिविधि बेहतर है जो आपको वास्तव में पसंद हो — नृत्य, खेल, साथ में चलना — अकेले अनुशासित जिम-दिनचर्या से बेहतर।",
      love: "आपको ऐसे साथी की ज़रूरत है जो आपके विचारों व सामाजिक व्यस्तता के साथ चल सके, और आपकी बेचैनी को उदासीनता न समझे। रिश्तों पर तनाव नवीनता की कमी से आता है, स्नेह की कमी से नहीं।",
      career: "शिक्षण, कानून, लेखन, मीडिया व परामर्श आपकी अभिव्यक्ति व त्वरित सोच के स्वाभाविक मिश्रण को पुरस्कृत करते हैं। संरचित रचनात्मक क्षेत्र — जहाँ आप एक ढाँचे के भीतर विचार उत्पन्न करते हैं — शुद्ध स्वतंत्र अव्यवस्था या सख्त, विचार-रहित कॉर्पोरेट भूमिकाओं से आपके लिए बेहतर परिणाम देते हैं।",
      money: "पैसा आपके पास एक नहीं, कई स्रोतों से आता है — बृहस्पति का सौभाग्य आपका साथ देता है, पर बिखरी आय को संरचना चाहिए वरना जितनी तेज़ी से आती है उतनी ही तेज़ी से फिसल जाती है। आपकी कमज़ोरी है अनुभवों पर आशावादी अति-खर्च व मित्रों पर उदारता। हर आकस्मिक लाभ का एक हिस्सा अलग रखने की सरल आदत किसी जटिल योजना से अधिक काम करती है।",
      growth: "आपका जीवन-पाठ है परिणति — विचारों की अपनी प्रचुरता को पूर्ण की गई चीज़ों में बदलना। दस अधूरे प्रोजेक्टों में ऊर्जा बिखेरना वह प्रवृत्ति है जिससे आगे बढ़ना है। पूरा करना, केवल विस्तार नहीं बल्कि गहराई में जाना, और कुछ प्रतिबद्धताओं को परिपक्व होने देना सीखना ही आपकी प्रतिभा को स्थायी उपलब्धि में बदलता है।",
    },
    4: {
      social: "आप भरोसेमंद व्यक्ति हैं — वह मित्र जिसे लोग तब बुलाते हैं जब उन्हें केवल सहानुभूति नहीं, बल्कि वास्तव में काम पूरा करने वाला कोई चाहिए। यह भरोसा कभी-कभी ज़िद समझ लिया जाता है, क्योंकि आप धीरे-धीरे विश्वास बनाते हैं और नए दायरों में जल्दी नहीं घुलते।",
      body: "चाल्डियन परंपरा में राहु का अप्रत्याशित प्रभाव यह दर्शाता है कि आपका स्वास्थ्य लंबे समय तक स्थिर रहता है और फिर धीरे-धीरे नहीं बल्कि अचानक गिरता है — नियमित जांच आपके लिए अन्य अंकों से अधिक महत्वपूर्ण है। आहार व नींद के समय में अनुशासन इस अप्रत्याशितता को नियंत्रित रखता है।",
      love: "आप प्रेम बड़े इशारों से नहीं, स्थिरता व सहयोग से दिखाते हैं, और आपको ऐसे साथी की ज़रूरत है जो इसे सही ढंग से समझे, न कि स्थिरता को जोश की कमी माने। एक बार प्रतिबद्ध होने पर आप असाधारण रूप से वफादार होते हैं।",
      career: "इंजीनियरिंग, आईटी, रियल एस्टेट, लॉजिस्टिक्स व व्यवस्था-प्रधान कार्य आपके विवरण के प्रति धैर्य व दीर्घकालीन परियोजनाओं में सहजता को पुरस्कृत करते हैं। आप वह बनाते हैं जो टिकता है — यही कारण है कि तेज़, बार-बार बदलने वाले माहौल आपको निराश करते हैं।",
      money: "आप अंकों में स्वाभाविक बचतकर्ता हैं — स्थिर, सतर्क, और जोखिम की बजाय संपत्ति व स्थिर परिसंपत्तियों के ज़रिए धीरे-धीरे धन बनाने में अधिक सहज। यही विवेक आपकी शक्ति है; जाल यह है कि इतनी कसकर पकड़ें कि हानि का भय उन समझदार जोखिमों को रोक दे जो इसे बढ़ाते। पैसा आपके पास सबसे सुरक्षित है, पर बढ़ता तब है जब आप कभी-कभी उसे दुनिया में भरोसे से निकलने देते हैं।",
      growth: "आपका जीवन-पाठ है लचीलापन — यह सीखना कि हर चीज़ को नियंत्रित, नियोजित या पूरी तरह स्थिर नहीं किया जा सकता। आपके अंक की अचानक उथल-पुथल केवल दुर्भाग्य नहीं, शिक्षक हैं: वे आपको अनुकूलन के लिए प्रेरित करती हैं। पकड़ ढीली करना, बदलाव का विरोध करने के बजाय उसे अपनाना — यही विकास आपकी ठोस नींव को एक जीवंत नींव में बदलता है।",
    },
    5: {
      social: "किसी भी नए माहौल में आप सबसे सहज व्यक्ति हैं — बातचीत में तेज़, अजनबियों के साथ सहज, और लोगों की विविधता से वास्तव में ऊर्जावान। पर यही स्थिर, अपरिवर्तित दिनचर्या व एक ही छोटे दायरे में बंधे रहना आपको सीमित महसूस करा सकता है।",
      body: "बुध के तेज़ प्रभाव से आपका तंत्रिका तंत्र अत्यंत संवेदनशील होता है — आप बीमारी से जल्दी उबरते हैं पर तनाव-जनित तंत्रिका व पाचन समस्याओं के प्रति अधिक संवेदनशील हैं। दृश्य में बार-बार छोटे बदलाव (यहाँ तक कि एक सैर, नया रास्ता, छोटी यात्रा) वास्तव में आपको संतुलित रखते हैं।",
      love: "आपको रिश्ते के भीतर स्वतंत्रता की ज़रूरत अधिकांश अंकों से अधिक है, और जो साथी आपको बहुत बांधने की कोशिश करते हैं, आप उनसे दूर खिंचते महसूस करेंगे। सही साथी आपको घूमने की जगह देता है और आपके लौट आने पर भरोसा करता है — क्योंकि आप लौटते हैं।",
      career: "व्यापार, बिक्री, मार्केटिंग, यात्रा व संचार-प्रधान भूमिकाएँ आपकी अनुकूलनशीलता को बोझ नहीं, संपत्ति बनाती हैं। जो भी आपको गतिशील रखे, नए लोगों से बात कराए, या विविध परियोजनाओं में काम कराए, वह एक ही अपरिवर्तित डेस्क-नौकरी से बेहतर है।",
      money: "आपमें पैसे को गतिमान करने की सचमुच प्रतिभा है — व्यापार, सौदे, अतिरिक्त उद्यम व त्वरित अवसर सब स्वाभाविक रूप से आते हैं। दूसरा पहलू है आवेगपूर्ण खर्च व जोखिम का शौक जो आपके धन को तेज़ी से झुला सकता है। धन तब बनता है जब आप अपनी त्वरित प्रवृत्ति को निरंतर सट्टेबाज़ी की बजाय कुछ अनुशासित दांवों में लगाते हैं।",
      growth: "आपका जीवन-पाठ है प्रतिबद्धता — यह सीखना कि स्वतंत्रता व निरंतरता शत्रु नहीं हैं। जो बेचैनी आपको अनुकूल बनाती है, वही आपको शुरू किए काम को पूरा करने या पर्याप्त समय तक टिकने से रोक सकती है। आपके लिए विकास है सही जगहों पर जड़ें जमाना, साथ ही उनके भीतर विविधता के अपने प्रेम को जीवित रखना।",
    },
    6: {
      social: "आप स्वाभाविक पालनहार हैं — लोग आराम, रुचि व स्नेह के लिए आपकी ओर आते हैं, और अक्सर आप ही चुपचाप किसी समूह या परिवार को जोड़े रखते हैं। जोखिम यह है कि अति-त्याग में आप अपनी ज़रूरतों से पहले सबकी ज़रूरतें संभालने लगते हैं।",
      body: "शुक्र का प्रभाव आराम व समृद्ध जीवन के प्रेम में दिखता है, जो संतुलन के बिना वज़न बढ़ने व सुस्ती की ओर झुक सकता है। आपकी भलाई परिवेश से गहराई से जुड़ी है, इसलिए एक सचमुच सुखद, व्यवस्थित रहने का स्थान सख्त अनुशासन से अधिक आपके स्वास्थ्य के लिए करता है।",
      love: "प्रेम व रोमांस आपके जीवन के केंद्र के करीब बैठते हैं, लगभग किसी भी अन्य अंक से अधिक, और प्रतिबद्ध होने पर आप गहराई से निवेश करते हैं। जो साथी सौंदर्य, घर व परिवार को आपके जैसा महत्व दे, उसके साथ आप फलते-फूलते हैं; पूरी तरह व्यावहारिक, स्नेह-रहित रिश्तों में आप संघर्ष करते हैं।",
      career: "डिज़ाइन, फैशन, आतिथ्य, चिकित्सा, कला व सौंदर्य-देखभाल-आराम पर आधारित कोई भी क्षेत्र आपकी स्वाभाविक प्रतिभा को उभारता है। जब परिणाम किसी के जीवन या परिवेश को सीधे सुधारे, तब आप सर्वश्रेष्ठ काम करते हैं — आप सेवा की ओर आकर्षित हैं, अमूर्तता की ओर नहीं।",
      money: "शुक्र आपको पैसे के साथ एक आरामदायक रिश्ता और अक्सर उसे आकर्षित करने की कला देता है, पर सुंदर, महंगी चीज़ों का सच्चा प्रेम भी। आप घर, परिवार व जीवन की गुणवत्ता पर बिना अधिक अपराधबोध के खर्च करते हैं। जब तक प्रियजनों के प्रति आपकी उदारता आय से आगे न निकले, आपका धन स्वस्थ रहता है — एक आराम-बजट तय करें और बाकी को बढ़ने दें।",
      growth: "आपका जीवन-पाठ है संतुलन — देने जितनी सहजता से देखभाल स्वीकार करना, और दूसरों की सेवा उनमें विलीन हुए बिना करना सीखना। अति-ज़िम्मेदारी व सबकी चिंता वह प्रवृत्ति है जिससे आगे बढ़ना है। आपका विकास यह पता लगाना है कि आप भरे प्याले से पोषण दे सकते हैं, खाली से नहीं, और कभी-कभी 'ना' कहना ही सबसे प्रेमपूर्ण कार्य है।",
    },
    7: {
      social: "आप व्यापक दायरे को आरामदायक दूरी पर रखते हैं और वास्तविक निकटता बहुत कम लोगों के लिए आरक्षित रखते हैं — ठंडेपन से नहीं, बल्कि इसलिए कि आप दुनिया को पहले भीतर ही समझते हैं। लोग अक्सर आपको समझने में कठिन कहते हैं, जो सही है, क्योंकि आप वे भावनाएँ शायद ही कभी दिखाते हैं जो आप वास्तव में नहीं अनुभव कर रहे।",
      body: "केतु का प्रभाव आपको अधिकांश लोगों से अधिक पर्यावरण व आहार के प्रति संवेदनशील बनाता है, और आपका तंत्रिका तंत्र शोर, भीड़ या खराब नींद पर बाहर दिखने से पहले ही प्रतिक्रिया करता है। शांत, एकांत विश्राम समय आपके लिए वैकल्पिक नहीं है — यही आपकी वास्तविक पुनर्भरण विधि है।",
      love: "आपको ऐसे साथी की ज़रूरत है जो आपकी एकांत की आवश्यकता को व्यक्तिगत रूप से न ले, और निरंतर आश्वासन के बजाय शांति में सहज हो। एक बार कोई आपका विश्वास जीत ले, तो बंधन असामान्य रूप से गहरा व स्थायी होता है।",
      career: "शोध, विज्ञान, दर्शन, अध्यात्म, विश्लेषण व गहराई को गति से अधिक पुरस्कृत करने वाला कोई भी क्षेत्र आपकी एकाकी, केंद्रित सोच की सहज प्रवृत्ति को सामाजिक कमज़ोरी नहीं, बल्कि लाभ बनाता है। तेज़-गति, लोगों-भरे माहौल आपको अन्य अधिकांश अंकों से जल्दी थका देते हैं।",
      money: "पैसा शायद ही कभी आपकी मुख्य प्रेरणा होता है, और आप तब सबसे प्रसन्न रहते हैं जब वह केवल आपको अपनी रुचि का पीछा करने की स्वतंत्रता दे, स्वयं में एक लक्ष्य न बने। आप धन के प्रति आश्चर्यजनक रूप से निर्लिप्त रह सकते हैं, जो आपको लोभ से बचाता है पर व्यावहारिक वित्त की उपेक्षा करा सकता है। एक सरल, स्वचालित प्रणाली आपके लिए उपयुक्त है — एक बार सेट करें ताकि मन गहरी बातों के लिए मुक्त रहे।",
      growth: "आपका जीवन-पाठ है भरोसा — यह सीखना कि जब भी चीज़ें अनिश्चित लगें, विश्लेषण व एकांत में सिमटने के बजाय दूसरों व जीवन के प्रति खुलना। आपकी गहराई एक दुर्लभ उपहार है, पर एकांत अकेलेपन या निराशावाद में बदल सकता है। आपके लिए विकास है विश्वास, जुड़ाव व कुछ भरोसेमंद लोगों को उस दुनिया में वापस आने देना जिसे आप दूरी पर रखते हैं।",
    },
    8: {
      social: "आप स्वाभाविक अधिकार रखते हैं, और लोग इसे तब भी महसूस करते हैं जब आप इसे सीधे व्यक्त नहीं कर रहे — जो आपको एक मज़बूत नेता बनाता है पर कभी-कभी सामान्य परिवेश में डरावना उपस्थिति भी। आपमें शनि का अनुशासन रिश्तों को गंभीरता से लेता है और आप हल्के में निवेश नहीं करते।",
      body: "चाल्डियन परंपरा में शनि का भारी प्रभाव अक्सर हड्डी, जोड़ या घुटने संबंधी तनाव व समय के साथ दीर्घकालिक तनाव की संवेदनशीलता में दिखता है — आपका स्वास्थ्य अचानक तीव्र प्रयासों की बजाय स्थिर, अनुशासित दिनचर्या पर बेहतर प्रतिक्रिया देता है। आराम आपके लिए विलासिता नहीं, अनुरक्षण है।",
      love: "आप निरंतर स्नेह प्रदर्शन के बजाय प्रतिबद्धता व सहनशक्ति से प्रेम करते हैं, और जब आप वास्तव में गहराई से निवेशित हों तब भी दूर समझे जा सकते हैं। जो साथी वफादारी व दीर्घकालीन निर्माण को अल्पकालिक रोमांस से अधिक महत्व दे, वह आपके लिए सबसे उपयुक्त है।",
      career: "वित्त, कानून, बड़े पैमाने के उद्योग, निर्माण व वास्तविक अधिकार के पद आपकी वह भार वहन करने की क्षमता पुरस्कृत करते हैं जो अन्य नहीं उठा सकते। सफलता अक्सर अन्य अंकों की तुलना में देर से व अधिक कठिनाई से आती है, पर एक बार प्राप्त होने पर अधिक स्थायी रहती है।",
      money: "आप दीर्घकालीन धन के लिए बने हैं — शनि धैर्य, अनुशासन व ठोस परिणाम के लिए दुबले वर्ष सहने की इच्छा को पुरस्कृत करता है। पैसा धीरे आता है, फिर पर्याप्त मात्रा में। आपका जोखिम है या तो अत्यधिक सतर्कता जो अवसर चूक जाए, या उस रुतबे की चाह में अति-कर्ज़ जिसे आप चुपचाप चाहते हैं। स्थिर, अनुशासित निर्माण में ही आपका सच्चा भाग्य बनता है।",
      growth: "आपका जीवन-पाठ यह है कि केवल भौतिक रूप में मापी गई सफलता आपको खाली छोड़ देती है। अपनी गंभीरता को हल्का करना, यह भरोसा करना कि ब्रह्मांड केवल बाधाएँ नहीं है, और उपलब्धि से परे अर्थ खोजना ही आपका सबसे गहरा विकास है। जीवन में जल्दी आने वाली कठिनाइयाँ ही आपकी बाद की शक्ति गढ़ती हैं — यदि आप उन्हें स्वयं को कठोर न बनाने दें।",
    },
    9: {
      social: "आप स्वयं से बड़े उद्देश्यों की ओर आकर्षित होते हैं, और लोग आपके बारे में कुछ और नोटिस करने से पहले आपकी तीव्रता को नोटिस करते हैं। यही अग्नि आपको संकट में स्वाभाविक नेता बनाती है, पर जब आपको लगे कि अन्याय को तुरंत ठीक करना है, तो यह टकराव में भी बदल सकती है।",
      body: "मंगल का प्रभाव आपको प्रबल शारीरिक ऊर्जा व तेज़ मेटाबॉलिज़्म देता है, पर स्वभाव भी गर्म रहता है — अनसुलझा क्रोध समय के साथ सूजन, रक्तचाप या दुर्घटना-प्रवणता के रूप में सामने आ सकता है। उस ऊर्जा के लिए शारीरिक निकास (खेल, तीव्र व्यायाम) शांत अंकों से अधिक आपके लिए महत्वपूर्ण है।",
      love: "आप जोश व सुरक्षात्मक भाव से प्रेम करते हैं, कभी-कभी इतनी तीव्रता से कि शांत साथी अभिभूत हो जाए। जो रिश्ते टिकते हैं वे वही हैं जहाँ आपकी तीव्रता को समान ईमानदारी से जवाब मिले, टालमटोल या मनुहार से नहीं।",
      career: "रक्षा, खेल, शल्य चिकित्सा, इंजीनियरिंग व सामाजिक कार्य — सभी एक ही गुण को पुरस्कृत करते हैं: जहाँ अन्य हिचकते हैं वहाँ निर्णायक रूप से कार्य करने की इच्छाशक्ति। आप वास्तविक दांव व स्पष्ट परिणामों वाली भूमिकाओं के लिए बने हैं, धीमी नौकरशाही वाली नहीं।",
      money: "आप जोश व साहस से कमाते हैं — मंगल साहसिक कर्म का पक्ष लेता है, और पैसा अक्सर उन जोखिमों के पीछे आता है जो अन्य नहीं लेते। पर यही अग्नि आवेगपूर्ण खर्च कराती है व गणना से पहले कार्य कराती है, इसलिए आकस्मिक लाभ जितनी तेज़ी से आते हैं उतनी ही तेज़ी से लुप्त हो सकते हैं। धन तब बनता है जब आप आवेग व खरीद के बीच रुकते हैं, और अपनी ऊर्जा सिद्ध करने की बजाय निर्माण में लगाते हैं।",
      growth: "आपका जीवन-पाठ है अपनी अग्नि को दिशा देना — टकराव में बदले बिना उद्देश्यों के लिए लड़ना, और उतावली के बिना निर्णायक रूप से कार्य करना सीखना। धैर्य व क्षमा आपके लिए सबसे कठिन व सबसे परिवर्तनकारी पाठ हैं। जब आप अपनी विशाल ऊर्जा को क्रोध की बजाय अपने निर्माण की ओर लगाना सीखते हैं, तब आप सचमुच अजेय बन जाते हैं।",
    },
  },
  mr: {
    1: {
      social: "तुम्ही अनुसरण करण्याऐवजी नेतृत्व करता — गटात स्वाभाविकपणे तीच व्यक्ती बनता ज्याकडे इतर दिशेसाठी पाहतात. ही स्वातंत्र्यता जे तुम्हाला ओळखत नाहीत त्यांना अलिप्तता वाटू शकते, पण जवळचे लोक तुमच्या स्पष्टवक्तेपणाला व आत्मविश्वासाला महत्त्व देतात.",
      body: "सूर्याच्या प्रभावाने तुमच्यात मजबूत चैतन्य आहे व तुम्ही अपयशांतून लवकर उभे राहता, पण तणावामुळे डोकेदुखी व अति-कामाचा थकवा होण्याची शक्यता असते. जबाबदाऱ्यांपासून नियमित लहान विश्रांती तुमची सहज सहनशक्ती टिकवते.",
      love: "प्रेमातही तुम्ही निर्णायक असता. तुम्हाला अशा जोडीदाराची गरज आहे जो तुमच्या स्वातंत्र्याचा आदर करेल, नियंत्रणासाठी स्पर्धा करणार नाही — दोघांनाही आपल्या क्षेत्रात नेतृत्वाची जागा मिळाल्यास नाते फुलते.",
      career: "उद्योजकता, नेतृत्व व अग्रणी भूमिका तुमच्यासाठी नियमित पदांपेक्षा खूप चांगल्या आहेत जिथे तुम्हाला अनेक स्तरांच्या प्रक्रियेचे पालन करावे लागते. परिणामाची स्वतः जबाबदारी व स्वतःच्या पद्धतीने पोहोचण्याचे स्वातंत्र्य मिळाल्यावर तुम्ही सर्वोत्तम काम करता — सरकार, संरक्षण, प्रशासन व स्वतःचा उद्योग सुरू करणे हे परंपरागतरित्या सशक्त मार्ग आहेत.",
      money: "तुम्ही सावधगिरीने नव्हे, पुढाकाराने कमावता — पैसा तेव्हा येतो जेव्हा तुम्ही स्वतःच्या कल्पनांवर विश्वास ठेवता, पगार वाढण्याची वाट पाहत नाही. धोका आहे अहं-खर्च: दर्जा दाखवण्यासाठी खरेदी. जेव्हा तुम्ही पैशाला गुणपट्टिका नव्हे तर स्वातंत्र्याचे साधन मानता आणि स्वतः चालवलेल्या उद्योगांत पुनर्गुंतवणूक करता, तेव्हा संपत्ती सर्वात वेगाने वाढते.",
      growth: "तुमचा मुख्य जीवन-धडा हा आहे की नेतृत्व म्हणजे सर्वकाही एकट्याने करणे नव्हे. काम सोपवायला शिकणे, कमी वाटल्याशिवाय मदत स्वीकारणे, आणि नेहमी पहिले राहण्याची ओढ मऊ करणे — इथेच तुमचा खरा विकास आहे. ज्या वर्षांत तुम्ही आपली शक्ती सिद्ध करण्याची गरज सोडता, तीच वर्षे तुम्हाला खरोखर सामर्थ्यवान बनवतात.",
    },
    2: {
      social: "तुम्ही बोलण्याआधी वातावरण समजून घेता, आणि हीच संवेदनशीलता तुम्हाला अशी व्यक्ती बनवते जिच्याशी लोक आपले मन मोकळे करतात. मुत्सद्देगिरी सहज आहे, पण जेव्हा तुम्हालाच निर्णय घ्यावा लागतो — मध्यस्थी नव्हे — तेव्हा ती अनिर्णयात बदलू शकते.",
      body: "चंद्राचा प्रभाव तुमची रचना भावनांशी जोडतो — तणाव आधी स्पष्ट आजारापेक्षा झोपेतील अडथळा किंवा पचनाच्या समस्येच्या रूपात दिसतो. शांत, कमी गोंधळाची दैनंदिनी व नियमित झोप तुमच्यासाठी इतर अंकांपेक्षा अधिक महत्त्वाची आहे.",
      love: "तुम्ही गहिरे प्रेम करता आणि आपले लक्ष उदारपणे देता, कधी कधी इतक्या प्रमाणात की नात्यात स्वतःची पसंती गमावता. अशा जोडीदारासोबत तुम्ही सर्वाधिक आनंदी राहता जो भावनिक प्रयत्नांची परतफेड करतो, केवळ घेत नाही.",
      career: "समुपदेशन, मानव संसाधन, मुत्सद्देगिरी, आतिथ्य व जनसंपर्क यांसारख्या लोक-केंद्रित भूमिका तुमच्या सहजबुद्धी व चतुराईला तुमची सर्वात मोठी व्यावसायिक संपत्ती बनवतात. मानवी संपर्काशिवाय एकाकी डेस्क-कामात तुम्ही कमी प्रभावी राहता; सहयोगी वातावरण तुमची खरी शक्ती समोर आणते.",
      money: "तुमचा पैसा तुमचा स्वामी चंद्राप्रमाणे चक्रांत फिरतो — एक हंगाम भरलेला, पुढचा तंग — म्हणून मनःशांतीसाठी स्थिर बचत तुम्हाला इतर अंकांपेक्षा अधिक महत्त्वाची आहे. तुम्ही इतरांवर व आपल्या घरावर उदारपणे खर्च करता; त्या उदारतेआधी ठराविक रक्कम बाजूला ठेवण्याची शिस्तच आरामाला सुरक्षिततेत बदलते.",
      growth: "तुमचा जीवन-धडा आहे स्वतःच्या गरजांना इतर सर्वांच्या गरजांइतकेच महत्त्व देणे. सतत आश्वासन न शोधता निर्णय घेणे, आणि अपराधभावाशिवाय मर्यादा आखणे शिकणे — हाच विकास तुम्हाला मुक्त करतो. तुमची संवेदनशीलता ही देणगी आहे — पण तेव्हाच जेव्हा तुम्ही इतरांच्या मनःस्थितीला तुमची मनःस्थिती ठरवू देणे थांबवता.",
    },
    3: {
      social: "तुमचा उत्साह संसर्गजन्य आहे, आणि लोक तुमच्या सोबतीकडे खेचले जातात कारण तुमच्याशी संभाषण फार क्वचित निरस राहते. तुम्ही स्वाभाविक संवादक आहात, पण पुढील कल्पनेचा उत्साह सध्याची पूर्ण करण्याच्या गतीपेक्षा पुढे जाऊ शकतो.",
      body: "गुरूच्या विस्तारशील प्रभावाने चांगल्या अन्नाची आवड शारीरिकरित्या दिसते, जी संयमाशिवाय काळाबरोबर वजन व यकृताशी संबंधित तणाव बनू शकते. तुमच्यासाठी अशी हालचाल चांगली आहे जी तुम्हाला खरोखर आवडते — नृत्य, खेळ, सोबत चालणे — एकट्या शिस्तबद्ध जिम-दैनंदिनीपेक्षा.",
      love: "तुम्हाला अशा जोडीदाराची गरज आहे जो तुमच्या कल्पना व सामाजिक व्यस्ततेसोबत टिकू शकेल, आणि तुमच्या अस्वस्थतेला उदासीनता समजणार नाही. नात्यांवर ताण नवीनतेच्या कमतरतेमुळे येतो, प्रेमाच्या कमतरतेमुळे नाही.",
      career: "शिक्षण, कायदा, लेखन, माध्यम व सल्ला हे तुमच्या अभिव्यक्ती व जलद विचारांच्या नैसर्गिक मिश्रणाला बक्षीस देतात. संरचित सर्जनशील क्षेत्रे — जिथे तुम्ही एका चौकटीत कल्पना निर्माण करता — शुद्ध मुक्त अव्यवस्था किंवा कठोर, कल्पनाविरहित कॉर्पोरेट भूमिकांपेक्षा तुमच्यासाठी चांगले परिणाम देतात.",
      money: "पैसा तुमच्याकडे एका नव्हे, अनेक स्रोतांतून येतो — गुरूचे भाग्य तुमची साथ देते, पण विखुरलेल्या उत्पन्नाला रचना हवी नाहीतर जितक्या वेगाने येते तितक्याच वेगाने निसटते. तुमची कमजोरी आहे अनुभवांवर आशावादी अति-खर्च व मित्रांवर उदारता. प्रत्येक अनपेक्षित लाभाचा एक भाग बाजूला ठेवण्याची साधी सवय कोणत्याही गुंतागुंतीच्या योजनेपेक्षा अधिक काम करते.",
      growth: "तुमचा जीवन-धडा आहे पूर्णत्व — कल्पनांच्या तुमच्या विपुलतेला पूर्ण केलेल्या गोष्टींत बदलणे. दहा अर्धवट प्रकल्पांत ऊर्जा विखुरणे ही सवय ओलांडायची आहे. पूर्ण करणे, केवळ विस्तार नव्हे तर खोलात जाणे, आणि काही वचनबद्धता परिपक्व होऊ देणे शिकणे हेच तुमच्या प्रतिभेला चिरस्थायी यशात बदलते.",
    },
    4: {
      social: "तुम्ही विश्वासार्ह व्यक्ती आहात — तो मित्र ज्याला लोक बोलावतात जेव्हा त्यांना केवळ सहानुभूती नव्हे, तर खरोखर काम पूर्ण करणारे कोणी हवे असते. हा विश्वास कधी कधी हट्टीपणा समजला जातो, कारण तुम्ही हळूहळू विश्वास निर्माण करता आणि नव्या वर्तुळांत लवकर मिसळत नाही.",
      body: "कॅल्डियन परंपरेत राहूचा अनपेक्षित प्रभाव दर्शवतो की तुमचे आरोग्य दीर्घकाळ स्थिर राहते आणि नंतर हळूहळू नव्हे तर अचानक घसरते — नियमित तपासणी तुमच्यासाठी इतर अंकांपेक्षा अधिक महत्त्वाची आहे. आहार व झोपेच्या वेळेत शिस्त ही अनपेक्षितता नियंत्रणात ठेवते.",
      love: "तुम्ही प्रेम मोठ्या इशाऱ्यांनी नव्हे, स्थिरता व पुरवठ्याने दाखवता, आणि तुम्हाला अशा जोडीदाराची गरज आहे जो हे योग्यरित्या समजेल, स्थिरतेला उत्कटतेची कमतरता समजणार नाही. एकदा वचनबद्ध झाल्यावर तुम्ही अपवादात्मकरित्या निष्ठावान असता.",
      career: "अभियांत्रिकी, आयटी, स्थावर मालमत्ता, लॉजिस्टिक्स व व्यवस्था-प्रधान काम तुमच्या तपशिलाबद्दलच्या संयमाला व दीर्घकालीन प्रकल्पांतील सहजतेला बक्षीस देतात. तुम्ही असे बनवता जे टिकते — हेच कारण आहे की जलद, वारंवार बदलणारे वातावरण तुम्हाला निराश करते.",
      money: "तुम्ही अंकांतील नैसर्गिक बचतकर्ते आहात — स्थिर, काळजीपूर्वक, आणि जोखमीपेक्षा मालमत्ता व स्थिर संपत्तीद्वारे हळूहळू संपत्ती उभारण्यात अधिक सहज. हाच विवेक तुमची शक्ती आहे; सापळा असा की इतक्या घट्ट धरता की तोट्याची भीती त्या समंजस जोखमींना रोखते ज्या ती वाढवतील. पैसा तुमच्याकडे सर्वात सुरक्षित आहे, पण वाढतो तेव्हा जेव्हा तुम्ही कधीकधी त्याला विश्वासाने जगात जाऊ देता.",
      growth: "तुमचा जीवन-धडा आहे लवचिकता — हे शिकणे की प्रत्येक गोष्ट नियंत्रित, नियोजित किंवा पूर्णतः स्थिर करता येत नाही. तुमच्या अंकाला प्रवण असलेली अचानक उलथापालथ केवळ दुर्दैव नव्हे, शिक्षक आहेत: ती तुम्हाला जुळवून घ्यायला भाग पाडतात. पकड सैल करणे, बदलाला विरोध करण्याऐवजी स्वीकारणे — हाच विकास तुमच्या भक्कम पायाला जिवंत पायात बदलतो.",
    },
    5: {
      social: "कोणत्याही नव्या वातावरणात तुम्ही सर्वात सहज व्यक्ती आहात — संभाषणात जलद, अनोळखी व्यक्तींसोबत सहज, आणि लोकांच्या विविधतेने खरोखर उत्साही. पण हीच स्थिर, न बदलणारी दैनंदिनी व एकाच लहान वर्तुळात बांधलेले राहणे तुम्हाला बंधनकारक वाटू शकते.",
      body: "बुधाच्या जलद प्रभावाने तुमची तंत्रिका प्रणाली अत्यंत संवेदनशील असते — तुम्ही आजारातून लवकर बरे होता पण तणाव-जनित तंत्रिका व पचन समस्यांना अधिक संवेदनशील आहात. दृश्यात वारंवार लहान बदल (एक फेरी, नवीन मार्ग, लहान सहल) खरोखर तुम्हाला संतुलित ठेवतात.",
      love: "तुम्हाला नात्यात स्वातंत्र्याची गरज बहुतांश अंकांपेक्षा अधिक आहे, आणि जे जोडीदार तुम्हाला खूप बांधण्याचा प्रयत्न करतात, त्यांच्यापासून तुम्ही दूर खेचले जाता असे वाटेल. योग्य जोडीदार तुम्हाला भटकण्याची जागा देतो व तुमच्या परत येण्यावर विश्वास ठेवतो — कारण तुम्ही परत येता.",
      career: "व्यापार, विक्री, मार्केटिंग, प्रवास व संवाद-प्रधान भूमिका तुमच्या अनुकूलतेला भार नव्हे, संपत्ती बनवतात. जे काही तुम्हाला गतिमान ठेवते, नवीन लोकांशी बोलायला लावते, किंवा विविध प्रकल्पांत काम करायला लावते, ते एका न बदलणाऱ्या डेस्क-नोकरीपेक्षा चांगले आहे.",
      money: "तुमच्यात पैसा गतिमान करण्याची खरी देणगी आहे — व्यापार, सौदे, अतिरिक्त उद्योग व झटपट संधी सर्व सहजपणे येतात. दुसरी बाजू म्हणजे आवेगपूर्ण खर्च व जोखमीची आवड जी तुमच्या आर्थिक स्थितीला तीव्रपणे झुलवू शकते. संपत्ती तेव्हा उभी राहते जेव्हा तुम्ही आपल्या झटपट प्रवृत्तीला सततच्या सट्टेबाजीऐवजी काही शिस्तबद्ध पैजांत वळवता.",
      growth: "तुमचा जीवन-धडा आहे वचनबद्धता — हे शिकणे की स्वातंत्र्य व सातत्य शत्रू नाहीत. जी अस्वस्थता तुम्हाला अनुकूल बनवते, तीच तुम्हाला सुरू केलेले पूर्ण करण्यापासून किंवा फळ मिळेपर्यंत टिकण्यापासून रोखू शकते. तुमच्यासाठी विकास म्हणजे योग्य ठिकाणी मुळे रोवणे, त्याचबरोबर त्यांच्या आत विविधतेचे तुमचे प्रेम जिवंत ठेवणे.",
    },
    6: {
      social: "तुम्ही स्वाभाविक पालनकर्ता आहात — लोक आराम, अभिरुची व स्नेहासाठी तुमच्याकडे येतात, आणि बहुधा तुम्हीच शांतपणे एखादा गट किंवा कुटुंब एकत्र ठेवता. धोका हा आहे की अति-त्यागात तुम्ही स्वतःच्या गरजांपूर्वी सर्वांच्या गरजा सांभाळू लागता.",
      body: "शुक्राचा प्रभाव आराम व समृद्ध जीवनाच्या प्रेमात दिसतो, जो समतोलाशिवाय वजन वाढणे व सुस्तीकडे झुकू शकतो. तुमचे आरोग्य परिसराशी खोलवर जोडलेले आहे, म्हणून खरोखर आनंददायी, नीटनेटकी राहण्याची जागा कठोर शिस्तीपेक्षा तुमच्या आरोग्यासाठी अधिक करते.",
      love: "प्रेम व रोमान्स तुमच्या जीवनाच्या केंद्राजवळ बसतात, जवळजवळ इतर कोणत्याही अंकापेक्षा अधिक, आणि वचनबद्ध झाल्यावर तुम्ही गहिरी गुंतवणूक करता. जो जोडीदार सौंदर्य, घर व कुटुंबाला तुमच्यासारखेच महत्त्व देतो, त्याच्यासोबत तुम्ही फुलता; पूर्णतः व्यावहारिक, स्नेहविरहित नात्यांत तुम्ही झगडता.",
      career: "डिझाईन, फॅशन, आतिथ्य, वैद्यकशास्त्र, कला व सौंदर्य-काळजी-आरामावर आधारित कोणतेही क्षेत्र तुमची नैसर्गिक प्रतिभा उलगडते. जेव्हा परिणाम एखाद्याचे जीवन किंवा परिसर थेट सुधारतो, तेव्हा तुम्ही सर्वोत्तम काम करता — तुम्ही सेवेकडे आकर्षित आहात, अमूर्ततेकडे नाही.",
      money: "शुक्र तुम्हाला पैशासोबत एक आरामदायक नाते आणि अनेकदा तो आकर्षित करण्याची कला देतो, पण सुंदर, महागड्या गोष्टींचे खरे प्रेमही. तुम्ही घर, कुटुंब व जीवनाच्या दर्जावर फारशा अपराधभावाशिवाय खर्च करता. जोपर्यंत प्रियजनांप्रती तुमची उदारता उत्पन्नाच्या पुढे जात नाही, तोपर्यंत तुमची आर्थिक स्थिती निरोगी राहते — एक आराम-अंदाजपत्रक ठरवा आणि बाकी वाढू द्या.",
      growth: "तुमचा जीवन-धडा आहे समतोल — देण्याइतक्याच सहजतेने काळजी स्वीकारणे, आणि इतरांच्या गरजांत विरघळल्याशिवाय त्यांची सेवा करणे शिकणे. अति-जबाबदारी व सर्वांची चिंता ही सवय ओलांडायची आहे. तुमचा विकास म्हणजे हे शोधणे की तुम्ही भरलेल्या पेल्यातून पोषण देऊ शकता, रिकाम्यातून नाही, आणि कधीकधी 'नाही' म्हणणे हीच सर्वात प्रेमळ कृती आहे.",
    },
    7: {
      social: "तुम्ही विस्तृत वर्तुळाला आरामदायक अंतरावर ठेवता आणि खरी जवळीक फार कमी लोकांसाठी राखता — थंडपणामुळे नव्हे, तर तुम्ही जगाला आधी आतून समजून घेता म्हणून. लोक अनेकदा तुम्हाला समजणे कठीण म्हणतात, जे बरोबर आहे, कारण तुम्ही क्वचितच अशा भावना दाखवता ज्या तुम्हाला खरोखर वाटत नाहीत.",
      body: "केतूचा प्रभाव तुम्हाला बहुतांश लोकांपेक्षा वातावरण व आहाराबद्दल अधिक संवेदनशील बनवतो, आणि तुमची तंत्रिका प्रणाली आवाज, गर्दी किंवा वाईट झोपेवर बाहेरून दिसण्याआधीच प्रतिक्रिया देते. शांत, एकांत विश्रांतीचा वेळ तुमच्यासाठी पर्यायी नाही — हीच तुमची खरी पुनर्भरण पद्धत आहे.",
      love: "तुम्हाला अशा जोडीदाराची गरज आहे जो तुमच्या एकांताच्या गरजेला व्यक्तिगत घेणार नाही, आणि सतत आश्वासनाऐवजी शांततेत सहज असेल. एकदा कोणी तुमचा विश्वास जिंकला, की बंध विलक्षण गहिरा व टिकाऊ असतो.",
      career: "संशोधन, विज्ञान, तत्त्वज्ञान, अध्यात्म, विश्लेषण व गतीपेक्षा गहनतेला बक्षीस देणारे कोणतेही क्षेत्र तुमच्या एकाकी, केंद्रित विचारसरणीच्या नैसर्गिक कलाला सामाजिक कमजोरी नव्हे, फायदा बनवते. जलद-गती, लोकांनी भरलेली वातावरणे तुम्हाला इतर बहुतांश अंकांपेक्षा लवकर थकवतात.",
      money: "पैसा क्वचितच तुमची मुख्य प्रेरणा असतो, आणि तुम्ही तेव्हा सर्वाधिक आनंदी असता जेव्हा तो केवळ तुम्हाला आपल्या आवडीचा पाठलाग करण्याचे स्वातंत्र्य देतो, स्वतःच एक ध्येय बनत नाही. तुम्ही संपत्तीबद्दल आश्चर्यकारकरित्या अलिप्त राहू शकता, जे तुम्हाला लोभापासून वाचवते पण व्यावहारिक अर्थकारणाकडे दुर्लक्ष करवू शकते. एक साधी, स्वयंचलित प्रणाली तुम्हाला योग्य आहे — एकदा उभारा जेणेकरून मन खोल गोष्टींसाठी मोकळे राहील.",
      growth: "तुमचा जीवन-धडा आहे विश्वास — हे शिकणे की जेव्हा जेव्हा गोष्टी अनिश्चित वाटतात, तेव्हा विश्लेषण व एकांतात मागे हटण्याऐवजी इतरांप्रती व जीवनाप्रती उघडणे. तुमची गहनता ही दुर्मिळ देणगी आहे, पण एकांत एकटेपणात किंवा निराशावादात बदलू शकतो. तुमच्यासाठी विकास म्हणजे श्रद्धा, जोड व काही विश्वासू लोकांना त्या जगात परत येऊ देणे जे तुम्ही अंतरावर ठेवता.",
    },
    8: {
      social: "तुमच्यात नैसर्गिक अधिकार आहे, आणि लोक हे जाणवतात जरी तुम्ही ते थेट व्यक्त करत नसाल — जे तुम्हाला एक मजबूत नेता बनवते पण कधी कधी सामान्य वातावरणात भीतीदायक उपस्थिती देखील. तुमच्यातील शनीची शिस्त नात्यांना गंभीरतेने घेते आणि तुम्ही हलक्यात गुंतवणूक करत नाही.",
      body: "कॅल्डियन परंपरेत शनीचा भारी प्रभाव अनेकदा हाडे, सांधे किंवा गुडघ्यांशी संबंधित तणावात व काळाबरोबर दीर्घकालीन तणावाच्या संवेदनशीलतेत दिसतो — तुमचे आरोग्य अचानक तीव्र प्रयत्नांपेक्षा स्थिर, शिस्तबद्ध दैनंदिनीवर चांगले प्रतिसाद देते. विश्रांती तुमच्यासाठी चोचला नाही, ती देखभाल आहे.",
      love: "तुम्ही सतत स्नेह प्रदर्शनाऐवजी वचनबद्धता व सहनशक्तीने प्रेम करता, आणि तुम्ही खरोखर गहिरी गुंतवणूक करत असतानाही दूरचे समजले जाऊ शकता. जो जोडीदार निष्ठा व दीर्घकालीन उभारणीला अल्पकालीन रोमान्सपेक्षा अधिक महत्त्व देतो, तो तुमच्यासाठी सर्वात योग्य आहे.",
      career: "वित्त, कायदा, मोठ्या प्रमाणातील उद्योग, बांधकाम व खऱ्या अधिकाराची पदे तुमच्या इतर कोणी न उचलू शकणारा भार वाहण्याच्या क्षमतेला बक्षीस देतात. यश अनेकदा इतर अंकांपेक्षा उशिरा व अधिक कष्टाने येते, पण एकदा मिळाल्यावर अधिक टिकाऊ राहते.",
      money: "तुम्ही दीर्घकालीन संपत्तीसाठी घडलेले आहात — शनी संयम, शिस्त व भक्कम परिणामासाठी दुबळी वर्षे सहन करण्याच्या इच्छेला बक्षीस देतो. पैसा हळू येतो, मग भरपूर. तुमचा धोका म्हणजे एकतर संधी हुकवणारी अति-सावधगिरी, किंवा तुम्ही मुकाट्याने इच्छिता त्या दर्जाच्या पाठलागात अति-कर्ज. स्थिर, शिस्तबद्ध उभारणीतच तुमचे खरे भाग्य घडते.",
      growth: "तुमचा जीवन-धडा हा आहे की केवळ भौतिक मापाने मोजलेले यश तुम्हाला रिकामे ठेवते. आपली गंभीरता हलकी करणे, विश्व केवळ अडथळे नाही यावर विश्वास ठेवणे, आणि यशापलीकडे अर्थ शोधणे हाच तुमचा सर्वात खोल विकास आहे. आयुष्यात लवकर येणाऱ्या कष्टांतूनच तुमची पुढील शक्ती घडते — जर तुम्ही त्यांना स्वतःला कठोर बनवू दिले नाही तर.",
    },
    9: {
      social: "तुम्ही स्वतःपेक्षा मोठ्या उद्देशांकडे आकर्षित होता, आणि लोक तुमच्याबद्दल आणखी काही लक्षात येण्याआधी तुमची तीव्रता लक्षात घेतात. हीच आग तुम्हाला संकटात नैसर्गिक नेता बनवते, पण जेव्हा तुम्हाला वाटते की अन्याय त्वरित सुधारायचा आहे, तेव्हा ती संघर्षातही बदलू शकते.",
      body: "मंगळाचा प्रभाव तुम्हाला मजबूत शारीरिक ऊर्जा व जलद चयापचय देतो, पण स्वभावही तापट राहतो — न सुटलेला राग काळाबरोबर सूज, रक्तदाब किंवा अपघातप्रवणतेच्या रूपात समोर येऊ शकतो. त्या ऊर्जेसाठी शारीरिक मार्ग (खेळ, तीव्र व्यायाम) शांत अंकांपेक्षा तुमच्यासाठी अधिक महत्त्वाचे आहेत.",
      love: "तुम्ही उत्कटतेने व संरक्षणात्मक भावनेने प्रेम करता, कधी कधी इतक्या तीव्रतेने की शांत जोडीदार भारावून जाईल. जी नाती टिकतात ती तीच आहेत जिथे तुमच्या तीव्रतेला समान प्रामाणिकपणाने प्रतिसाद मिळतो, टाळाटाळ किंवा मनधरणीने नाही.",
      career: "संरक्षण, क्रीडा, शस्त्रक्रिया, अभियांत्रिकी व सामाजिक कार्य — सर्व एकाच गुणाला बक्षीस देतात: जिथे इतर कचरतात तिथे निर्णायकपणे कृती करण्याची इच्छाशक्ती. तुम्ही खऱ्या पैजा व स्पष्ट परिणाम असलेल्या भूमिकांसाठी बनलेले आहात, संथ नोकरशाहीसाठी नाही.",
      money: "तुम्ही जोश व धैर्याने कमावता — मंगळ धाडसी कृतीला अनुकूल असतो, आणि पैसा अनेकदा इतर घेत नाहीत त्या जोखमींच्या मागे येतो. पण हीच आग आवेगपूर्ण खर्च करवते व गणनेआधी कृती करवते, म्हणून अनपेक्षित लाभ जितक्या वेगाने येतात तितक्याच वेगाने नाहीसे होऊ शकतात. संपत्ती तेव्हा उभी राहते जेव्हा तुम्ही आवेग व खरेदी यांच्यात थांबता, आणि आपली ऊर्जा सिद्ध करण्याऐवजी उभारणीत लावता.",
      growth: "तुमचा जीवन-धडा आहे आपल्या आगीला दिशा देणे — संघर्षात न बदलता ध्येयांसाठी लढणे, आणि उतावळेपणाशिवाय निर्णायकपणे कृती करणे शिकणे. संयम व क्षमा हे तुमच्यासाठी सर्वात कठीण व सर्वात परिवर्तनकारी धडे आहेत. जेव्हा तुम्ही आपली प्रचंड ऊर्जा रागाऐवजी आपल्या उभारणीकडे वळवायला शिकता, तेव्हा तुम्ही खरोखर अजिंक्य बनता.",
    },
  },
};

/* =========================================================
   4e. Lo Shu grid — planes (rows / columns / diagonals)
   Cell layout (traditional):   4 9 2 / 3 5 7 / 8 1 6
   A "plane" is complete when all three of its numbers are present.
   ========================================================= */
const LOSHU_LAYOUT = [4, 9, 2, 3, 5, 7, 8, 1, 6];   // grid order (top-left → bottom-right)
const LOSHU_PLANES = {
  en: [
    { cells:[4,9,2], name:'Mental Plane (Thought)' },
    { cells:[3,5,7], name:'Emotional Plane (Soul)' },
    { cells:[8,1,6], name:'Practical Plane (Action)' },
    { cells:[4,3,8], name:'Thought Plane (Planning)' },
    { cells:[9,5,1], name:'Will Plane (Determination)' },
    { cells:[2,7,6], name:'Action Plane (Doing)' },
    { cells:[4,5,6], name:'Golden Diagonal (Prosperity)' },
    { cells:[2,5,8], name:'Silver Diagonal (Spirituality)' },
  ],
  hi: [
    { cells:[4,9,2], name:'मानसिक तल (विचार)' },
    { cells:[3,5,7], name:'भावनात्मक तल (आत्मा)' },
    { cells:[8,1,6], name:'व्यावहारिक तल (कर्म)' },
    { cells:[4,3,8], name:'चिंतन तल (योजना)' },
    { cells:[9,5,1], name:'इच्छाशक्ति तल (संकल्प)' },
    { cells:[2,7,6], name:'क्रिया तल (कार्य)' },
    { cells:[4,5,6], name:'स्वर्ण विकर्ण (समृद्धि)' },
    { cells:[2,5,8], name:'रजत विकर्ण (आध्यात्म)' },
  ],
  mr: [
    { cells:[4,9,2], name:'मानसिक स्तर (विचार)' },
    { cells:[3,5,7], name:'भावनिक स्तर (आत्मा)' },
    { cells:[8,1,6], name:'व्यावहारिक स्तर (कर्म)' },
    { cells:[4,3,8], name:'चिंतन स्तर (नियोजन)' },
    { cells:[9,5,1], name:'इच्छाशक्ती स्तर (संकल्प)' },
    { cells:[2,7,6], name:'कृती स्तर (कार्य)' },
    { cells:[4,5,6], name:'सुवर्ण कर्ण (समृद्धी)' },
    { cells:[2,5,8], name:'रजत कर्ण (अध्यात्म)' },
  ],
};

/* Practical remedies to strengthen a MISSING Lo Shu number — how to "add"
   a digit you weren't born with (through habit, colour, mantra or objects). */
const LOSHU_REMEDIES = {
  en: {
    1: 'Build confidence & individuality — journal daily, take the lead in small decisions, wear gold tones.',
    2: 'Nurture relationships & intuition — spend time with family, practise listening, keep silver or pearls.',
    3: 'Feed the mind — read, learn, chant, and place a small idol/photo of your deity on your desk.',
    4: 'Add discipline & order — keep a routine, tidy your space, use grey/earth tones and stay organised.',
    5: 'Improve communication & balance — travel a little, express ideas, meditate to steady the mind.',
    6: 'Invite love & beauty — care for your home, enjoy art/music, keep fresh flowers and pastel colours.',
    7: 'Deepen spirituality — meditate, spend quiet time near water, read philosophy.',
    8: 'Strengthen focus & finance — set clear goals, be consistent, respect elders and save regularly.',
    9: 'Cultivate courage & compassion — exercise, serve others, and channel anger into constructive work.',
  },
  hi: {
    1: 'आत्मविश्वास व व्यक्तित्व बढ़ाएँ — रोज़ लिखें, छोटे निर्णय स्वयं लें, सुनहरे रंग पहनें।',
    2: 'रिश्ते व अंतर्ज्ञान पोषित करें — परिवार के साथ समय बिताएँ, सुनना सीखें, चांदी/मोती रखें।',
    3: 'मन को पोषण दें — पढ़ें, सीखें, जप करें, अपने इष्ट देव की छोटी मूर्ति/चित्र मेज़ पर रखें।',
    4: 'अनुशासन व व्यवस्था लाएँ — दिनचर्या बनाएँ, स्थान व्यवस्थित रखें, ग्रे/मिट्टी रंग अपनाएँ।',
    5: 'संचार व संतुलन सुधारें — थोड़ा यात्रा करें, विचार व्यक्त करें, ध्यान करें।',
    6: 'प्रेम व सौंदर्य आमंत्रित करें — घर संवारें, कला/संगीत का आनंद लें, ताज़े फूल व पेस्टल रंग रखें।',
    7: 'आध्यात्म गहरा करें — ध्यान करें, जल के पास शांत समय बिताएँ, दर्शन पढ़ें।',
    8: 'एकाग्रता व वित्त मज़बूत करें — स्पष्ट लक्ष्य बनाएँ, नियमित रहें, बड़ों का आदर करें, बचत करें।',
    9: 'साहस व करुणा विकसित करें — व्यायाम करें, सेवा करें, क्रोध को रचनात्मक कार्य में लगाएँ।',
  },
  mr: {
    1: 'आत्मविश्वास व व्यक्तिमत्त्व वाढवा — रोज लिहा, छोटे निर्णय स्वतः घ्या, सोनेरी रंग वापरा.',
    2: 'नातेसंबंध व अंतर्ज्ञान जोपासा — कुटुंबासोबत वेळ द्या, ऐकायला शिका, चांदी/मोती ठेवा.',
    3: 'मनाला खुराक द्या — वाचा, शिका, जप करा, इष्ट देवतेची छोटी मूर्ती/फोटो टेबलावर ठेवा.',
    4: 'शिस्त व सुव्यवस्था आणा — दिनक्रम ठेवा, जागा नीटनेटकी ठेवा, करडे/मातीचे रंग वापरा.',
    5: 'संवाद व संतुलन सुधारा — थोडा प्रवास करा, विचार मांडा, ध्यान करा.',
    6: 'प्रेम व सौंदर्य आमंत्रित करा — घर सजवा, कला/संगीताचा आनंद घ्या, ताजी फुले व पेस्टल रंग ठेवा.',
    7: 'अध्यात्म खोलवा — ध्यान करा, पाण्याजवळ शांत वेळ घालवा, तत्त्वज्ञान वाचा.',
    8: 'एकाग्रता व अर्थकारण बळकट करा — स्पष्ट ध्येये ठरवा, सातत्य ठेवा, वडीलधाऱ्यांचा आदर करा, बचत करा.',
    9: 'धैर्य व करुणा जोपासा — व्यायाम करा, सेवा करा, रागाला रचनात्मक कामात वळवा.',
  },
};

/* Personalised life-area remedies, keyed by the NAME root number (1–9).
   Each entry offers guidance for money, career, job, health, marriage & love. */
const LIFE_REMEDIES = {
  en: {
    1: { money:'Donate to the needy on Sundays and keep your word in deals — solar integrity attracts steady wealth.',
         career:'Take initiative and aim for leadership; offer water to the rising Sun daily for confidence and status.',
         job:'Be punctual and decisive; wear gold/copper and avoid ego clashes with seniors to rise faster.',
         health:'Protect the heart, eyes and bones — early-morning sunlight, vitamin D and steady sleep.',
         marriage:'Lead with warmth, not dominance; respect your partner’s space to keep harmony.',
         love:'Express feelings openly and be loyal; grand gestures win, but arrogance repels.' },
    2: { money:'Save in silver and avoid impulsive spending on new-moon days; steady trickle beats big gambles.',
         career:'Choose collaborative, caring or creative fields; partnerships bring your best luck.',
         job:'Work well in teams, listen more than you speak, and keep a pearl or silver item at your desk.',
         health:'Guard against anxiety, sleep and digestive issues — meditate and keep a calm routine.',
         marriage:'Emotional security is everything; gentle communication and patience keep the bond strong.',
         love:'Nurture slowly and sincerely; moonlit evenings and honest talks deepen affection.' },
    3: { money:'Give to teachers, students or temples on Thursdays; wisdom and generosity multiply money.',
         career:'Teaching, law, finance, writing and advisory roles thrive — keep learning and mentoring.',
         job:'Share knowledge, stay optimistic, and wear yellow tones on Thursdays for growth.',
         health:'Watch the liver, weight and fat intake — walk daily and eat in moderation.',
         marriage:'Respect, shared values and spiritual bonding sustain the marriage.',
         love:'Be a guide and cheerleader; sincerity and encouragement attract lasting love.' },
    4: { money:'Avoid shortcuts and shady schemes; disciplined saving and clear paperwork prevent losses.',
         career:'Unconventional, tech, research or reform-driven work suits you — think differently.',
         job:'Stay organised, honour deadlines, and keep your workspace clutter-free and grounded.',
         health:'Mind the nervous system and sudden ailments — regular routine, less screen time, deep breathing.',
         marriage:'Communicate expectations clearly; sudden decisions and secrecy strain the bond.',
         love:'Be reliable and transparent; unpredictability excites but consistency keeps love safe.' },
    5: { money:'Turn ideas into income through communication and trade; keep emerald green near your workspace.',
         career:'Business, media, marketing, travel and networking are goldmines for you.',
         job:'Adapt fast, communicate clearly, and use your wit — but finish what you start.',
         health:'Protect the nerves and skin — reduce stimulants, meditate, and rest the restless mind.',
         marriage:'Keep conversation alive and give freedom; boredom is your only real threat.',
         love:'Be playful and expressive; mental connection and fresh experiences keep romance alive.' },
    6: { money:'Invest in beauty, property and comforts wisely; Venus rewards taste, not waste.',
         career:'Arts, design, hospitality, luxury, beauty and relationship-based work flourish.',
         job:'Create a pleasant environment, build rapport, and keep fresh flowers at your desk.',
         health:'Care for the throat, kidneys and reproductive system — balanced diet and hydration.',
         marriage:'You are the natural home-maker; love, comfort and loyalty make marriage blissful.',
         love:'Romance comes easily — give affection freely, but avoid over-attachment and jealousy.' },
    7: { money:'Earn through knowledge, research or spiritual/creative work; avoid speculation and loans.',
         career:'Research, spirituality, analysis, healing, writing and the unseen sciences suit you.',
         job:'Work in calm, independent settings; keep clear water near you and trust your intuition.',
         health:'Protect against stress, addictions and immune dips — meditate, time near water heals.',
         marriage:'Seek a soul connection over show; give space for reflection and honour privacy.',
         love:'Depth over drama — quiet understanding and shared silence bond you more than words.' },
    8: { money:'Save relentlessly and clear debts; serve labourers/elders on Saturdays to ease Saturn.',
         career:'Real estate, law, mining, finance, administration and long-haul careers reward patience.',
         job:'Work hard without shortcuts; discipline and endurance turn late success into lasting power.',
         health:'Guard joints, teeth, knees and chronic issues — routine, warmth and regular check-ups.',
         marriage:'Show your softer side; duty must be balanced with warmth to avoid coldness.',
         love:'Loyalty runs deep but expression is slow — put feelings into words and small gestures.' },
    9: { money:'Control impulsive spending and anger-driven decisions; donate red items/lentils on Tuesdays.',
         career:'Defence, sports, surgery, engineering, real estate and action-led fields ignite your fire.',
         job:'Channel energy productively, lead courageously, and avoid conflict with colleagues.',
         health:'Watch blood pressure, injuries, inflammation and accidents — exercise and cool the temper.',
         marriage:'Temper passion with patience; anger management is the key to a peaceful home.',
         love:'Bold, protective and passionate — love fiercely, but guard against jealousy and haste.' },
  },
  hi: {
    1: { money:'रविवार को ज़रूरतमंदों को दान दें और सौदों में वचन निभाएँ — सूर्य की सत्यनिष्ठा स्थिर धन लाती है।',
         career:'पहल करें और नेतृत्व का लक्ष्य रखें; रोज़ उगते सूर्य को जल दें — आत्मविश्वास व प्रतिष्ठा बढ़ेगी।',
         job:'समय के पाबंद व निर्णायक बनें; सोना/तांबा पहनें और वरिष्ठों से अहं-टकराव टालें।',
         health:'हृदय, आँख व हड्डियों की रक्षा करें — सुबह की धूप, विटामिन-D और नियमित नींद।',
         marriage:'प्रभुत्व नहीं, गर्मजोशी से नेतृत्व करें; साथी को स्थान दें, तभी सामंजस्य रहेगा।',
         love:'भावनाएँ खुलकर व्यक्त करें और वफ़ादार रहें; अहंकार प्रेम को दूर करता है।' },
    2: { money:'चांदी में बचत करें और अमावस्या के दिन आवेगपूर्ण खर्च टालें; धीमी बचत बड़े जुए से बेहतर है।',
         career:'सहयोगी, देखभाल या रचनात्मक क्षेत्र चुनें; साझेदारी आपके लिए भाग्यशाली है।',
         job:'टीम में अच्छा काम करें, बोलने से अधिक सुनें, मेज़ पर मोती/चांदी रखें।',
         health:'चिंता, नींद व पाचन का ध्यान रखें — ध्यान करें और शांत दिनचर्या रखें।',
         marriage:'भावनात्मक सुरक्षा सर्वोपरि है; कोमल संवाद व धैर्य बंधन को मज़बूत रखते हैं।',
         love:'धीरे व सच्चाई से प्रेम पोषित करें; चाँदनी शामें व ईमानदार बातें स्नेह गहरा करती हैं।' },
    3: { money:'गुरुवार को शिक्षक, विद्यार्थी या मंदिर को दान दें; ज्ञान व उदारता धन बढ़ाते हैं।',
         career:'शिक्षण, विधि, वित्त, लेखन व सलाहकार भूमिकाएँ फलती हैं — सीखते व मार्गदर्शन देते रहें।',
         job:'ज्ञान बाँटें, आशावादी रहें, गुरुवार को पीले रंग पहनें।',
         health:'यकृत, वज़न व वसा का ध्यान रखें — रोज़ टहलें व संयम से खाएँ।',
         marriage:'सम्मान, साझा मूल्य व आध्यात्मिक जुड़ाव विवाह को टिकाते हैं।',
         love:'मार्गदर्शक व प्रेरक बनें; सच्चाई व प्रोत्साहन स्थायी प्रेम लाते हैं।' },
    4: { money:'शॉर्टकट व संदिग्ध योजनाओं से बचें; अनुशासित बचत व स्पष्ट कागज़ात हानि रोकते हैं।',
         career:'अपरंपरागत, तकनीक, शोध या सुधार-केंद्रित कार्य आपके लिए उपयुक्त — अलग सोचें।',
         job:'व्यवस्थित रहें, समय-सीमा का सम्मान करें, कार्यस्थल साफ़ व स्थिर रखें।',
         health:'तंत्रिका तंत्र व अचानक रोगों का ध्यान — नियमित दिनचर्या, कम स्क्रीन, गहरी साँस।',
         marriage:'अपेक्षाएँ स्पष्ट रखें; अचानक निर्णय व गोपनीयता बंधन पर दबाव डालते हैं।',
         love:'भरोसेमंद व पारदर्शी बनें; निरंतरता प्रेम को सुरक्षित रखती है।' },
    5: { money:'संचार व व्यापार से विचारों को आय बनाएँ; कार्यस्थल के पास पन्ना/हरा रंग रखें।',
         career:'व्यापार, मीडिया, मार्केटिंग, यात्रा व नेटवर्किंग आपके लिए सोने की खान हैं।',
         job:'तेज़ी से ढलें, स्पष्ट संवाद करें, बुद्धि का उपयोग करें — पर काम पूरा करें।',
         health:'तंत्रिका व त्वचा की रक्षा करें — उत्तेजक कम करें, ध्यान करें, बेचैन मन को विश्राम दें।',
         marriage:'बातचीत जीवंत रखें व स्वतंत्रता दें; ऊब ही आपका असली खतरा है।',
         love:'चंचल व अभिव्यक्तिपूर्ण बनें; मानसिक जुड़ाव व नए अनुभव रोमांस बनाए रखते हैं।' },
    6: { money:'सौंदर्य, संपत्ति व सुख-सुविधाओं में समझदारी से निवेश करें; शुक्र रुचि को पुरस्कृत करते हैं, फ़िज़ूलख़र्ची को नहीं।',
         career:'कला, डिज़ाइन, आतिथ्य, विलासिता, सौंदर्य व संबंध-आधारित कार्य फलते हैं।',
         job:'सुखद वातावरण बनाएँ, तालमेल बिठाएँ, मेज़ पर ताज़े फूल रखें।',
         health:'गला, गुर्दे व प्रजनन तंत्र का ध्यान रखें — संतुलित आहार व जल-सेवन।',
         marriage:'आप स्वाभाविक गृहस्थ हैं; प्रेम, सुविधा व वफ़ादारी विवाह को सुखमय बनाते हैं।',
         love:'रोमांस सहज आता है — स्नेह मुक्त रूप से दें, पर अति-आसक्ति व ईर्ष्या से बचें।' },
    7: { money:'ज्ञान, शोध या आध्यात्मिक/रचनात्मक कार्य से कमाएँ; सट्टा व ऋण से बचें।',
         career:'शोध, आध्यात्म, विश्लेषण, चिकित्सा, लेखन व गूढ़ विज्ञान आपके लिए उपयुक्त।',
         job:'शांत, स्वतंत्र वातावरण में काम करें; पास स्वच्छ जल रखें व अंतर्ज्ञान पर भरोसा करें।',
         health:'तनाव, व्यसन व प्रतिरोधक-क्षमता का ध्यान — ध्यान करें, जल के पास समय उपचार देता है।',
         marriage:'दिखावे से अधिक आत्मिक जुड़ाव खोजें; चिंतन हेतु स्थान दें व निजता का सम्मान करें।',
         love:'नाटक नहीं, गहराई — मौन समझ शब्दों से अधिक जोड़ती है।' },
    8: { money:'लगातार बचत करें व ऋण चुकाएँ; शनिवार को श्रमिकों/बुज़ुर्गों की सेवा करें।',
         career:'रियल एस्टेट, विधि, खनन, वित्त, प्रशासन व दीर्घकालिक करियर धैर्य को पुरस्कृत करते हैं।',
         job:'बिना शॉर्टकट कठिन परिश्रम करें; अनुशासन व सहनशीलता स्थायी सफलता देते हैं।',
         health:'जोड़ों, दाँत, घुटनों व पुरानी बीमारियों का ध्यान — दिनचर्या, गर्माहट व नियमित जाँच।',
         marriage:'अपना कोमल पक्ष दिखाएँ; कर्तव्य के साथ गर्मजोशी का संतुलन रखें।',
         love:'वफ़ादारी गहरी है पर अभिव्यक्ति धीमी — भावनाओं को शब्द व छोटे भाव दें।' },
    9: { money:'आवेगपूर्ण खर्च व क्रोध-प्रेरित निर्णय रोकें; मंगलवार को लाल वस्तु/मसूर दान करें।',
         career:'रक्षा, खेल, शल्य-चिकित्सा, इंजीनियरिंग, रियल एस्टेट व क्रिया-प्रधान क्षेत्र आपकी ऊर्जा जगाते हैं।',
         job:'ऊर्जा को रचनात्मक दिशा दें, साहस से नेतृत्व करें, सहकर्मियों से टकराव टालें।',
         health:'रक्तचाप, चोट, सूजन व दुर्घटनाओं का ध्यान — व्यायाम करें व क्रोध शांत रखें।',
         marriage:'जुनून को धैर्य से संतुलित करें; क्रोध-प्रबंधन शांत घर की कुंजी है।',
         love:'साहसी, रक्षक व भावुक — गहरा प्रेम करें, पर ईर्ष्या व जल्दबाज़ी से बचें।' },
  },
  mr: {
    1: { money:'रविवारी गरजूंना दान द्या व व्यवहारात शब्द पाळा — सूर्याची सत्यनिष्ठा स्थिर संपत्ती आणते.',
         career:'पुढाकार घ्या व नेतृत्वाचे ध्येय ठेवा; रोज उगवत्या सूर्याला जल अर्पण करा.',
         job:'वक्तशीर व निर्णयक्षम राहा; सोने/तांबे वापरा आणि वरिष्ठांशी अहं-संघर्ष टाळा.',
         health:'हृदय, डोळे व हाडांचे रक्षण करा — सकाळचे ऊन, व्हिटॅमिन-D व नियमित झोप.',
         marriage:'वर्चस्व नव्हे तर उबेने नेतृत्व करा; जोडीदाराला मोकळीक द्या.',
         love:'भावना मोकळेपणाने व्यक्त करा व निष्ठावान राहा; अहंकार प्रेम दूर करतो.' },
    2: { money:'चांदीत बचत करा व अमावस्येला आवेगी खर्च टाळा; संथ बचत मोठ्या जुगारापेक्षा चांगली.',
         career:'सहयोगी, काळजी घेणारी किंवा सर्जनशील क्षेत्रे निवडा; भागीदारी भाग्यकारक.',
         job:'संघात चांगले काम करा, बोलण्यापेक्षा जास्त ऐका, टेबलावर मोती/चांदी ठेवा.',
         health:'चिंता, झोप व पचनाची काळजी घ्या — ध्यान करा व शांत दिनक्रम ठेवा.',
         marriage:'भावनिक सुरक्षा सर्वोच्च; सौम्य संवाद व संयम नाते बळकट ठेवतात.',
         love:'हळू व प्रामाणिकपणे प्रेम जोपासा; चांदण्या संध्याकाळी व प्रामाणिक संवाद स्नेह वाढवतात.' },
    3: { money:'गुरुवारी शिक्षक, विद्यार्थी किंवा मंदिराला दान द्या; ज्ञान व औदार्य संपत्ती वाढवतात.',
         career:'शिक्षण, कायदा, वित्त, लेखन व सल्लागार भूमिका बहरतात — शिकत व मार्गदर्शन करत राहा.',
         job:'ज्ञान वाटा, आशावादी राहा, गुरुवारी पिवळे रंग वापरा.',
         health:'यकृत, वजन व स्निग्धांशाची काळजी घ्या — रोज चाला व संयमाने खा.',
         marriage:'आदर, समान मूल्ये व आध्यात्मिक जोड विवाह टिकवतात.',
         love:'मार्गदर्शक व प्रेरक बना; प्रामाणिकपणा व प्रोत्साहन टिकाऊ प्रेम आणतात.' },
    4: { money:'शॉर्टकट व संशयास्पद योजना टाळा; शिस्तबद्ध बचत व स्पष्ट कागदपत्रे तोटा रोखतात.',
         career:'अपारंपरिक, तंत्रज्ञान, संशोधन किंवा सुधारणा-केंद्रित काम योग्य — वेगळा विचार करा.',
         job:'नीटनेटके राहा, मुदती पाळा, कार्यस्थळ स्वच्छ व स्थिर ठेवा.',
         health:'मज्जासंस्था व अचानक आजारांची काळजी — नियमित दिनक्रम, कमी स्क्रीन, दीर्घ श्वास.',
         marriage:'अपेक्षा स्पष्ट ठेवा; अचानक निर्णय व गुप्तता नात्यावर ताण आणतात.',
         love:'विश्वासार्ह व पारदर्शक राहा; सातत्य प्रेम सुरक्षित ठेवते.' },
    5: { money:'संवाद व व्यापारातून कल्पनांचे उत्पन्न करा; कार्यस्थळाजवळ पाचू/हिरवा रंग ठेवा.',
         career:'व्यवसाय, मीडिया, मार्केटिंग, प्रवास व नेटवर्किंग तुमच्यासाठी सोन्याची खाण.',
         job:'झटपट जुळवून घ्या, स्पष्ट संवाद करा, बुद्धी वापरा — पण काम पूर्ण करा.',
         health:'मज्जा व त्वचेचे रक्षण करा — उत्तेजक कमी करा, ध्यान करा, अस्वस्थ मनाला विश्रांती द्या.',
         marriage:'संवाद जिवंत ठेवा व स्वातंत्र्य द्या; कंटाळा हाच खरा धोका.',
         love:'खेळकर व अभिव्यक्तिशील राहा; मानसिक जोड व नवे अनुभव प्रणय टिकवतात.' },
    6: { money:'सौंदर्य, मालमत्ता व सुखसोयींत शहाणपणाने गुंतवणूक करा; शुक्र अभिरुचीला बक्षीस देतो, उधळपट्टीला नाही.',
         career:'कला, डिझाइन, आतिथ्य, चैन, सौंदर्य व नातेसंबंध-आधारित काम बहरते.',
         job:'आल्हाददायक वातावरण तयार करा, सूर जुळवा, टेबलावर ताजी फुले ठेवा.',
         health:'घसा, मूत्रपिंड व प्रजनन संस्थेची काळजी घ्या — संतुलित आहार व पाणी.',
         marriage:'तुम्ही नैसर्गिक गृहस्थ आहात; प्रेम, सुख व निष्ठा विवाह सुखमय करतात.',
         love:'प्रणय सहज येतो — स्नेह मुक्तपणे द्या, पण अति-आसक्ती व मत्सर टाळा.' },
    7: { money:'ज्ञान, संशोधन किंवा आध्यात्मिक/सर्जनशील कामातून कमवा; सट्टा व कर्ज टाळा.',
         career:'संशोधन, अध्यात्म, विश्लेषण, उपचार, लेखन व गूढ विज्ञान योग्य.',
         job:'शांत, स्वतंत्र वातावरणात काम करा; जवळ स्वच्छ पाणी ठेवा व अंतर्ज्ञानावर विश्वास ठेवा.',
         health:'तणाव, व्यसने व प्रतिकारशक्तीची काळजी — ध्यान करा, पाण्याजवळचा वेळ बरे करतो.',
         marriage:'दिखाव्यापेक्षा आत्मिक जोड शोधा; चिंतनासाठी मोकळीक द्या व खासगीपणाचा आदर करा.',
         love:'नाट्यापेक्षा खोली — शांत समज शब्दांपेक्षा अधिक जोडते.' },
    8: { money:'सातत्याने बचत करा व कर्ज फेडा; शनिवारी कामगार/वृद्धांची सेवा करा.',
         career:'स्थावर मालमत्ता, कायदा, खाणकाम, वित्त, प्रशासन व दीर्घकालीन करिअर संयमाला बक्षीस देतात.',
         job:'शॉर्टकटशिवाय कष्ट करा; शिस्त व सहनशीलता टिकाऊ यश देतात.',
         health:'सांधे, दात, गुडघे व जुनाट आजारांची काळजी — दिनक्रम, ऊब व नियमित तपासणी.',
         marriage:'तुमची हळवी बाजू दाखवा; कर्तव्यासोबत उबेचा समतोल ठेवा.',
         love:'निष्ठा खोल असते पण अभिव्यक्ती संथ — भावना शब्द व छोट्या कृतीत मांडा.' },
    9: { money:'आवेगी खर्च व रागातून घेतलेले निर्णय रोखा; मंगळवारी लाल वस्तू/मसूर दान करा.',
         career:'संरक्षण, क्रीडा, शस्त्रक्रिया, अभियांत्रिकी, स्थावर मालमत्ता व कृती-प्रधान क्षेत्रे तुमची ऊर्जा पेटवतात.',
         job:'ऊर्जेला रचनात्मक दिशा द्या, धैर्याने नेतृत्व करा, सहकाऱ्यांशी संघर्ष टाळा.',
         health:'रक्तदाब, दुखापती, सूज व अपघातांची काळजी — व्यायाम करा व राग शांत ठेवा.',
         marriage:'उत्कटतेला संयमाने संतुलित करा; राग-नियंत्रण शांत घराची गुरुकिल्ली.',
         love:'धाडसी, रक्षणकर्ता व उत्कट — तीव्र प्रेम करा, पण मत्सर व घाई टाळा.' },
  },
};

/** Build a Lo Shu digit-frequency map from a DOB (all digits of DDMMYYYY). */
function loShuFromDob(dobStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobStr || '');
  if (!m) return null;
  const [, y, mo, d] = m;
  const counts = { 1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0 };
  for (const ch of (d + mo + y)) { const n = Number(ch); if (n >= 1 && n <= 9) counts[n]++; }
  return counts;
}

/* Kua (Gua) number — Feng Shui, gender-dependent.
   Standard formula, split by era (this is the piece that was wrong before):
     • Born BEFORE 2000:  male = 10 − yr,  female = 5 + yr
     • Born 2000 OR LATER: male =  9 − yr,  female = 6 + yr
   where yr = the last two digits of the birth year reduced to a single digit.
   A Kua of 5 is substituted: → 2 for males, → 8 for females. */
function kuaNumber(year, gender) {
  const fullYear = Number(year);
  const yr = reduceToSingle(Number(String(year).slice(-2))).single;
  const female = (gender === 'girl' || gender === 'female');
  const before2000 = fullYear < 2000;

  let kua;
  if (female) {
    kua = reduceToSingle((before2000 ? 5 : 6) + yr).single;
  } else {
    kua = reduceToSingle((before2000 ? 10 : 9) - yr).single;
  }
  if (kua === 0) kua = 9;                // 9 − 9 wraps to 9
  if (kua === 5) kua = female ? 8 : 2;   // traditional substitution
  return kua;
}
const KUA_GROUP = {   // East vs West group + auspicious directions
  1:{group:'East', dirs:'SE, E, S, N'}, 3:{group:'East', dirs:'S, N, SE, E'},
  4:{group:'East', dirs:'N, S, E, SE'}, 9:{group:'East', dirs:'E, SE, N, S'},
  2:{group:'West', dirs:'NE, W, NW, SW'}, 6:{group:'West', dirs:'W, NE, SW, NW'},
  7:{group:'West', dirs:'NW, SW, NE, W'}, 8:{group:'West', dirs:'SW, NW, W, NE'},
};

/* =========================================================
   5. State + rendering
   ========================================================= */
let currentLang = 'en';
let lastName = '';
let lastDob = '';
let userGender = 'boy';        // 'boy' = male, 'girl' = female
let indianGender = 'boy';
let indianOffset = 0;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function t() { return I18N[currentLang]; }

/** Update an element's text/html only if it changed, replaying an animation. */
function setAnimated(el, value, { html = false, anim = 'value-flip' } = {}) {
  if (!el) return;
  const current = html ? el.innerHTML : el.textContent;
  if (String(current) === String(value)) return; // no change → no replay
  if (html) el.innerHTML = value; else el.textContent = value;
  el.classList.remove(anim);
  void el.offsetWidth;      // force reflow so the animation restarts
  el.classList.add(anim);
}

/** Apply static translations to all [data-i18n] / [data-i18n-attr] nodes. */
function applyStaticTranslations() {
  const dict = t();
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] != null) el.textContent = dict[key];
  });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    const [attr, key] = el.getAttribute('data-i18n-attr').split(':');
    if (dict[key] != null) el.setAttribute(attr, dict[key]);
  });
}

/** Build the Chaldean chart. */
function renderChart() {
  const grid = $('#chartGrid');
  grid.innerHTML = CHART_GROUPS.map(g => `
    <div class="chart-cell">
      <div class="cc-num">${g.num}</div>
      <div class="cc-letters">${g.letters}</div>
    </div>`).join('');
}

/** Build the 1–9 meanings reference. */
function renderMeaningsReference() {
  const grid = $('#meaningsGrid');
  const m = NUMBER_MEANINGS[currentLang];
  const planets = PLANET_NAMES[currentLang];
  let html = '';
  for (let n = 1; n <= 9; n++) {
    html += `
      <div class="meaning-card">
        <div class="mc-head">
          <div class="mc-num">${n}</div>
          <div>
            <div class="mc-planet">${m[n][0]}</div>
            <div class="mc-title">${planets[n]}</div>
          </div>
        </div>
        <p class="mc-text">${m[n][1]}</p>
      </div>`;
  }
  grid.innerHTML = html;
}

/** Build the "how it works" steps. */
function renderSteps() {
  const list = $('#stepsList');
  list.innerHTML = t().steps.map(s => `<li>${s}</li>`).join('');
}

/** Render the calculation results for the current name + language. */
function renderResults() {
  const dict = t();
  const name = lastName.trim();
  const results = $('#results');

  if (!letterBreakdown(name).length) {
    results.hidden = true;
    return;
  }

  const { items, compound, single, trail } = calculate(name);
  const m = NUMBER_MEANINGS[currentLang][single];

  // Stat cards (animated on change)
  setAnimated($('#compoundValue'), compound);
  setAnimated($('#singleValue'), single);
  setAnimated($('#rulerValue'), PLANET_NAMES[currentLang][single]);

  // Breakdown chips
  $('#breakdown').innerHTML = items.map(it => `
    <div class="letter-chip">
      <span class="lc-letter">${it.letter}</span>
      <span class="lc-value">${it.value}</span>
    </div>`).join('');
  $('#reductionLine').innerHTML = dict.reductionText(compound, trail);

  // Compound number & its effect
  renderCompound(compound);

  // Favourability meter, personality/life-path profile, inner numbers, Lucky essentials, Career, life events
  renderFavourMeter(name);
  renderProfile(single);
  renderInnerNumbers(name);
  renderLucky(single);
  renderCareer(single);
  renderLifeEvents(single);
  renderRemedies(single);

  // Meaning (fade-swap when it changes)
  setAnimated($('#meaningHeadline'), m[0], { anim: 'text-swap' });
  setAnimated($('#meaningText'), m[1], { anim: 'text-swap' });

  const badge = $('#favorBadge');
  const good = FAVOURABLE_SINGLE.has(single);
  badge.textContent = good ? dict.favGood : dict.favWarn;
  badge.className = 'favor-badge ' + (good ? 'good' : 'warn');

  // Suggestions — up to 5 favourable spellings. If the current name is already
  // favourable it is kept as the top-priority pick (flagged ⭐) instead of hidden.
  const suggestIntro = $('#suggestIntro');
  const suggestBox = $('#suggestions');
  const sugg = suggestSpellings(name);
  if (sugg.length) {
    const best = strongestSuggestion(sugg);
    suggestIntro.textContent = good ? dict.suggestFavGood : dict.suggestIntro;
    // General list — every favourable variant, with the strongest one flagged.
    suggestBox.innerHTML = sugg.map(s => {
      const isBest = s.name === best.name;
      const tag = s.existing ? '✓ ' : (isBest ? '⭐ ' : '');
      return `<span class="suggest-chip${isBest ? ' is-best' : ''}${s.existing ? ' is-current' : ''}">${
        tag}${s.name}<span class="sc-num">${s.compound}/${s.single}</span></span>`;
    }).join('');
    // Callout for the single strongest recommendation.
    $('#suggestBest').innerHTML =
      `<span class="sb-label">${best.existing ? dict.suggestCurrentBest : dict.suggestBestLabel}</span>
       <span class="sb-name">${best.name}</span>
       <span class="sb-num">${best.compound}/${best.single}</span>`;
    $('#suggestBest').hidden = false;
  } else {
    suggestIntro.textContent = dict.suggestEmpty;
    suggestBox.innerHTML = '';
    $('#suggestBest').hidden = true;
  }

  // DOB: Mulank, Bhagyank & compatibility
  renderDob(single);

  // Kua (Feng Shui) & Lo Shu grid — need DOB
  renderKua();
  renderLoShu();

  // Personal Day / Month / Year cycle — needs DOB
  renderPersonalCycle();

  // Re-evaluate practical / relationship checks against the new name number
  refreshChecks(single);

  // Indian/Hindu lucky name ideas
  renderIndianNames();

  results.hidden = false;

  // More data on the page → scatter more celestial motifs for extra vibes.
  scheduleDecorRefresh();
}

/** Render the compound-number effect panel. */
function renderCompound(compound) {
  const dict = t();
  const panel = $('#compoundPanel');
  const cm = compoundMeaning(compound);

  if (!cm) {
    // Total is a single digit (or beyond the classic table): hide the panel.
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  const [title, text, fortunate] = cm;
  setAnimated($('#compoundHeadline'), `${compound} · ${title}`, { anim: 'text-swap' });
  setAnimated($('#compoundText'), text, { anim: 'text-swap' });

  const badge = $('#compoundBadge');
  badge.textContent = fortunate ? dict.favGood : dict.favWarn;
  badge.className = 'favor-badge ' + (fortunate ? 'good' : 'warn');
}

/** Favourability meter + a transparent breakdown of HOW the % was reached. */
function renderFavourMeter(name) {
  const dict = t();
  const { pct, factors } = favourability(name);
  const fill = $('#favorMeterFill');
  fill.style.width = pct + '%';
  fill.className = 'meter-fill ' + (pct >= 80 ? 'is-good' : pct >= 60 ? 'is-neutral' : 'is-warn');
  setAnimated($('#favorPct'), pct + '%');
  $('#favorMeterText').textContent = dict.favorMeterText(pct);

  // Show the factors so the score is explainable, not a black box.
  $('#favorFactors').innerHTML = factors.map(f => {
    const sign = f.delta > 0 ? '+' : '';
    const cls = f.delta > 0 ? 'is-good' : f.delta < 0 ? 'is-warn' : 'is-neutral';
    const label = typeof dict[f.key] === 'function' ? dict[f.key](f) : dict[f.key];
    return `<li class="favor-factor ${cls}"><span>${label}</span><strong>${sign}${f.delta}</strong></li>`;
  }).join('');
}

/** Personality & life-path prediction paragraphs (behaviour/social, body/
    health, love, career) for the name's root digit. Hand-authored per root
    number — not blended from DOB — so the reading stays coherent; DOB-driven
    numbers (Mulank/Bhagyank/Kua) get their own dedicated panels elsewhere. */
function renderProfile(single) {
  const dict = t();
  const profile = PERSONALITY_PROFILES[currentLang][single];
  if (!profile) return;
  const TOPICS = [
    { key: 'social', labelKey: 'profileSocial' },
    { key: 'body',   labelKey: 'profileBody' },
    { key: 'love',   labelKey: 'profileLove' },
    { key: 'career', labelKey: 'profileCareer' },
    { key: 'money',  labelKey: 'profileMoney' },
    { key: 'growth', labelKey: 'profileGrowth' },
  ];
  $('#profileGrid').innerHTML = TOPICS.map(tp => `
    <div class="profile-card">
      <h3 class="profile-card-title">${dict[tp.labelKey]}</h3>
      <p class="profile-card-text">${profile[tp.key]}</p>
    </div>`).join('');
}

/** Inner numbers: Soul Urge (vowels) and Personality (consonants) —
    two genuinely DIFFERENT concepts, shown side by side with meanings. */
function renderInnerNumbers(name) {
  const panel = $('#soulPanel');
  const su = soulUrge(name);
  const pn = personalityNumber(name);
  if (!su && !pn) { panel.hidden = true; return; }
  panel.hidden = false;

  const meanings = NUMBER_MEANINGS[currentLang];
  const planets = PLANET_NAMES[currentLang];

  // Soul Urge = inner desire (vowels)
  if (su) {
    setAnimated($('#soulValue'), su.single);
    setAnimated($('#soulPlanet'), planets[su.single]);
    $('#soulEffect').innerHTML =
      `<span class="effect-label">${meanings[su.single][0]}:</span> ${meanings[su.single][1]}`;
  }
  // Personality = outer self (consonants)
  if (pn) {
    setAnimated($('#persoValue'), pn.single);
    setAnimated($('#persoPlanet'), planets[pn.single]);
    $('#persoEffect').innerHTML =
      `<span class="effect-label">${meanings[pn.single][0]}:</span> ${meanings[pn.single][1]}`;
  }
}

/** Lucky essentials tiles: days, numbers, dates, colours, deity, gem/metal, direction. */
function renderLucky(single) {
  const dict = t();
  const L = LUCKY[single];
  const DAY_NAMES = {
    en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
    hi: ['रविवार','सोमवार','मंगलवार','बुधवार','गुरुवार','शुक्रवार','शनिवार'],
    mr: ['रविवार','सोमवार','मंगळवार','बुधवार','गुरुवार','शुक्रवार','शनिवार'],
  };
  const days = L.days.map(d => DAY_NAMES[currentLang][d]).join(', ');
  const swatches = L.colorHex.map(c =>
    `<span class="swatch" style="background:${c}"></span>`).join('');

  const cities = LUCKY_CITIES[single] || { career: [], living: [] };
  const tiles = [
    { icon:'📅', label: dict.luckyDays,  value: days },
    { icon:'🔢', label: dict.luckyNums,  value: L.numbers.join(', ') },
    { icon:'📆', label: dict.luckyDates, value: L.numbers.filter(n => n <= 31).join(', ') },
    { icon:'🎨', label: dict.luckyColors, value: `${swatches} ${luckyColors(single)}` },
    { icon:'🕉️', label: dict.luckyGod,   value: luckyGod(single) },
    { icon:'💎', label: dict.luckyMetal, value: luckyMetal(single) },
    { icon:'🪴', label: dict.luckyPlant, value: luckyPlant(single) },
    { icon:'🧭', label: dict.luckyDir,   value: dirLabel(L.dir) },
    { icon:'🏙️', label: dict.luckyCareerCity, value: cityListLabel(cities.career) },
    { icon:'🌿', label: dict.luckyLivingCity, value: cityListLabel(cities.living) },
  ];
  $('#luckyGrid').innerHTML = tiles.map(tl => `
    <div class="lucky-tile">
      <span class="lt-icon" aria-hidden="true">${tl.icon}</span>
      <div class="lt-body">
        <div class="lt-label">${tl.label}</div>
        <div class="lt-value">${tl.value}</div>
      </div>
    </div>`).join('');
}

/** Career guidance text for the name's root digit. */
function renderCareer(single) {
  $('#careerText').textContent = CAREERS[currentLang][single];
}

/** Best life events & the important years/ages they tend to arrive in. */
function renderLifeEvents(single) {
  const ev = LIFE_EVENTS[currentLang][single];
  if (!ev) return;
  $('#lifeYears').textContent = ev.years;
  $('#lifeBest').textContent = ev.best;
}

/** Personalised remedies across life areas, based on the name root number. */
const REMEDY_AREAS = [
  { key:'money',    icon:'💰' },
  { key:'career',   icon:'📈' },
  { key:'job',      icon:'💼' },
  { key:'health',   icon:'🩺' },
  { key:'marriage', icon:'💍' },
  { key:'love',     icon:'💖' },
];
function renderRemedies(single) {
  const dict = t();
  const r = LIFE_REMEDIES[currentLang][single];
  if (!r) return;
  $('#remedyGrid').innerHTML = REMEDY_AREAS.map(a => `
    <div class="remedy-tile">
      <span class="rt-icon" aria-hidden="true">${a.icon}</span>
      <div class="rt-body">
        <div class="rt-label">${dict['remedy_' + a.key]}</div>
        <div class="rt-value">${r[a.key]}</div>
      </div>
    </div>`).join('');
}

/** Kua (Feng Shui) number — needs birth year + gender. */
function renderKua() {
  const panel = $('#kuaPanel');
  const m = /^(\d{4})-/.exec(lastDob || '');
  if (!m) { panel.hidden = true; return; }
  panel.hidden = false;

  const kua = kuaNumber(m[1], userGender);
  const info = KUA_GROUP[kua] || { group: '—', dirs: '—' };
  setAnimated($('#kuaValue'), kua);
  setAnimated($('#kuaGroup'), `${kuaGroupLabel(info.group)} — ${dirListLabel(info.dirs)}`);
}

/** Personal Day / Month / Year cycle numbers — needs DOB. Reference date is
    the real "today", passed in explicitly so it stays testable. */
function renderPersonalCycle(today = new Date()) {
  const panel = $('#cyclePanel');
  const cycle = personalCycleNumbers(lastDob, today);
  if (!cycle) { panel.hidden = true; return; }
  panel.hidden = false;
  setAnimated($('#cycleDayValue'), cycle.personalDay);
  setAnimated($('#cycleMonthValue'), cycle.personalMonth);
  setAnimated($('#cycleYearValue'), cycle.personalYear);
}

/** Lo Shu grid, missing numbers and planes formed — needs DOB. */
function renderLoShu() {
  const dict = t();
  const panel = $('#loshuPanel');
  const counts = loShuFromDob(lastDob);
  if (!counts) { panel.hidden = true; return; }
  panel.hidden = false;

  // Grid cells
  $('#loshuGrid').innerHTML = LOSHU_LAYOUT.map(n => {
    const c = counts[n];
    const filled = c > 0;
    const repeated = filled ? String(n).repeat(c) : '—';
    return `<div class="loshu-cell ${filled ? 'is-filled' : 'is-empty'}">
      <span class="loshu-digits">${repeated}</span>
    </div>`;
  }).join('');

  // Missing numbers
  const missing = [];
  for (let n = 1; n <= 9; n++) if (!counts[n]) missing.push(n);
  $('#loshuMissing').innerHTML = missing.length
    ? `<span class="lm-label">${dict.loshuMissingLabel}:</span> ${missing.join(', ')}`
    : `<span class="lm-label">${dict.loshuNoneMissing}</span>`;

  // Planes formed (all three cells present)
  const planes = LOSHU_PLANES[currentLang].filter(p => p.cells.every(n => counts[n] > 0));
  setAnimated($('#loshuPlanesCount'), planes.length);
  $('#loshuPlanes').innerHTML = planes.length
    ? planes.map(p => `<span class="plane-chip">${p.name}</span>`).join('')
    : `<span class="plane-empty">${dict.loshuNoPlanes}</span>`;

  // How to strengthen a missing number — a practical remedy per digit.
  const box = $('#loshuImprove');
  if (missing.length) {
    box.innerHTML = `<h3 class="loshu-improve-title">${dict.loshuImproveTitle}</h3>
      <ul class="loshu-improve-list">${
        missing.map(n => `<li><strong>${n}</strong> — ${LOSHU_REMEDIES[currentLang][n]}</li>`).join('')
      }</ul>`;
  } else {
    box.innerHTML = `<p class="loshu-improve-none">${dict.loshuNoneMissing}</p>`;
  }
}

/** Evaluate a checked word against the user's name number → verdict element. */
function evalCheck(inputEl, verdictEl, nameSingle) {
  const dict = t();
  const val = inputEl.value.trim();
  if (!val) { verdictEl.textContent = ''; verdictEl.className = 'check-verdict'; return; }
  if (!nameSingle) {
    verdictEl.textContent = dict.checkNeedName;
    verdictEl.className = 'check-verdict';
    return;
  }
  const r = calculate(val);
  if (!r.compound) { verdictEl.textContent = ''; return; }
  const rel = relation(nameSingle, r.single);
  const tmpl = rel === 'good' ? dict.checkFavGood : rel === 'warn' ? dict.checkFavWarn : dict.checkFavNeutral;
  verdictEl.textContent = tmpl.replace('{n}', r.single).replace('{y}', nameSingle);
  verdictEl.className = 'check-verdict is-' + rel;
}

/** The number this session should personalise Mobile/Vehicle checks against:
    prefer the entered Name Number, fall back to Mulank (birth day) if only a
    DOB was given, or null if neither is available yet. */
function personalAnchorSingle() {
  if (letterBreakdown(lastName).length) return calculate(lastName).single;
  const dob = calcDob(lastDob);
  return dob ? dob.mulank : null;
}

/** Classify a mobile/vehicle root digit. When a personal anchor (Name Number
    or Mulank) is available, compare the two via the same friendship matrix
    used everywhere else on the site (relation()) — a number is only
    "favourable" if it's actually in harmony with *you*, not on some absolute
    scale. Without an anchor yet, fall back to the number's own traditional
    strength (FAVOUR_PCT) so the field still gives useful feedback. */
function numCheckClass(single, anchor) {
  if (anchor) return relation(anchor, single);
  const pct = FAVOUR_PCT[single] || 50;
  if (pct >= 80) return 'good';
  if (pct < 60) return 'warn';
  return 'neutral';
}

/** Render the Mobile Number / Vehicle Number checks. Personalises against the
    user's Name Number (or Mulank) when available AND the card's "Personalise"
    checkbox is on (checked by default); otherwise scores the number on its
    own traditional strength. */
function renderNumCheck(inputEl, resultEl, toggleEl, calcFn, resultLabelKey) {
  const dict = t();
  const val = inputEl.value.trim();
  if (!val) { resultEl.textContent = dict.numCheckEmpty; resultEl.className = 'numcheck-result'; return; }
  const r = calcFn(val);
  if (!r) { resultEl.textContent = dict.numCheckEmpty; resultEl.className = 'numcheck-result'; return; }

  const wantsPersonal = !toggleEl || toggleEl.checked;
  const anchor = wantsPersonal ? personalAnchorSingle() : null;
  const cls = numCheckClass(r.single, anchor);
  const verdict = cls === 'good' ? dict.numCheckFav : cls === 'warn' ? dict.numCheckWarn : dict.numCheckNeutral;
  const planet = PLANET_NAMES[currentLang][r.single];
  const note = anchor ? ` — ${dict.numCheckVsYours.replace('{y}', anchor)}`
             : wantsPersonal ? ` — ${dict.numCheckNeedAnchor}`
             : '';
  resultEl.innerHTML = `<span class="nc-num">${r.single}</span>${dict[resultLabelKey]} <strong>${r.single}</strong> (${planet}) — ${verdict}${note}`;
  resultEl.className = 'numcheck-result is-' + cls;
}

function refreshNumChecks() {
  renderNumCheck($('#mobileCheck'), $('#mobileResult'), $('#mobilePersonalize'), calculateMobile, 'mobileResultLabel');
  renderNumCheck($('#vehicleCheck'), $('#vehicleResult'), $('#vehiclePersonalize'), calculateVehicle, 'vehicleResultLabel');
}

/** Re-run all practical/relationship checks. */
function refreshChecks(nameSingle) {
  evalCheck($('#emailCheck'),    $('#emailVerdict'),    nameSingle);
  evalCheck($('#bankCheck'),     $('#bankVerdict'),     nameSingle);
  evalCheck($('#socialCheck'),   $('#socialVerdict'),   nameSingle);
  evalCheck($('#businessCheck'), $('#businessVerdict'), nameSingle);
  evalCheck($('#partnerCheck'),  $('#partnerVerdict'),  nameSingle);
  evalCheck($('#friendCheck'),   $('#friendVerdict'),   nameSingle);
}

/** Render lucky Indian/Hindu baby name ideas for the chosen gender. */
function renderIndianNames() {
  const box = $('#indianNames');
  if (!box) return;
  const names = favourableIndianNames(indianGender, 8, indianOffset);
  box.innerHTML = names.map(n => `
    <div class="iname-card">
      <div class="iname-head">
        <span class="iname-name">${n.name}</span>
        <span class="sc-num">${n.compound}/${n.single}</span>
      </div>
      <p class="iname-meaning">${n.meaning}</p>
      <span class="iname-source">${n.source}</span>
    </div>`).join('');
}

/** Render the birth-number panel and the friendship checks. */
function renderDob(nameSingle) {
  const dict = t();
  const panel = $('#dobPanel');
  const dob = calcDob(lastDob);

  if (!dob) { panel.hidden = true; return; }
  panel.hidden = false;

  const planets = PLANET_NAMES[currentLang];
  const meanings = NUMBER_MEANINGS[currentLang];
  setAnimated($('#mulankValue'), dob.mulank);
  setAnimated($('#bhagyankValue'), dob.bhagyank);
  setAnimated($('#mulankPlanet'), planets[dob.mulank]);
  setAnimated($('#bhagyankPlanet'), planets[dob.bhagyank]);

  // Effect of Mulank & Bhagyank (the digit's meaning is its effect)
  $('#mulankEffect').innerHTML =
    `<span class="effect-label">${dict.mulankEffectLabel} — ${meanings[dob.mulank][0]}:</span> ${meanings[dob.mulank][1]}`;
  $('#bhagyankEffect').innerHTML =
    `<span class="effect-label">${dict.bhagyankEffectLabel} — ${meanings[dob.bhagyank][0]}:</span> ${meanings[dob.bhagyank][1]}`;

  const rows = [
    { pair: dict.compatNameMulank,     a: nameSingle,  b: dob.mulank },
    { pair: dict.compatNameBhagyank,   a: nameSingle,  b: dob.bhagyank },
    { pair: dict.compatMulankBhagyank, a: dob.mulank,  b: dob.bhagyank },
  ];
  const ICON = { good: '🤝', neutral: '⚖️', warn: '⚠️' };
  const VERDICT = { good: dict.relGood, neutral: dict.relNeutral, warn: dict.relWarn };
  const DESC = { good: dict.relGoodDesc, neutral: dict.relNeutralDesc, warn: dict.relWarnDesc };

  $('#compatList').innerHTML = rows.map(r => {
    const rel = relation(r.a, r.b);
    return `
      <div class="compat-row is-${rel}">
        <span class="compat-icon" aria-hidden="true">${ICON[rel]}</span>
        <div class="compat-body">
          <div class="compat-pair">${r.pair} <span style="opacity:.7">(${r.a} &amp; ${r.b})</span></div>
          <div class="compat-verdict">${VERDICT[rel]}</div>
          <div class="compat-desc">${DESC[rel]}</div>
        </div>
      </div>`;
  }).join('');
}

/* =========================================================
   6. Events
   ========================================================= */

/** Read the three DOB dropdowns into a yyyy-mm-dd string (or '' if incomplete). */
function readDob() {
  const d = $('#dobDay').value, m = $('#dobMonth').value, y = $('#dobYear').value;
  if (!d || !m || !y) return '';
  return `${y}-${m}-${d}`;   // values are already zero-padded
}

/** Live update — called on every keystroke / date change. */
function liveUpdate() {
  lastName = $('#nameInput').value;
  lastDob = readDob();

  // Mobile/Vehicle checks are personalised against the Name Number (or
  // Mulank if only a DOB is given), so they must refresh here too — even
  // when there's no name yet, DOB alone can still supply that anchor.
  refreshNumChecks();

  if (!letterBreakdown(lastName).length) {
    // No name yet: hide name-driven results, but still hide DOB too.
    $('#results').hidden = true;
    return;
  }
  renderResults();
}

function doClear() {
  ['#nameInput', '#dobDay', '#dobMonth', '#dobYear',
   '#placeInput', '#emailCheck', '#bankCheck', '#socialCheck', '#businessCheck',
   '#partnerCheck', '#friendCheck']
    .forEach(sel => { const el = $(sel); if (el) el.value = ''; });
  ['#emailVerdict', '#bankVerdict', '#socialVerdict', '#businessVerdict',
   '#partnerVerdict', '#friendVerdict']
    .forEach(sel => { const el = $(sel); if (el) { el.textContent = ''; el.className = 'check-verdict'; } });
  lastName = '';
  lastDob = '';
  $('#results').hidden = true;
  $('#dobPanel').hidden = true;
  $('#placeResults').hidden = true;
  $('#nameInput').focus();
  // Mobile/Vehicle inputs themselves are left as-is (Clear only resets the
  // name/DOB calculator above), but their personalisation anchor just
  // disappeared, so re-render to fall back to the un-personalised verdict.
  refreshNumChecks();
}

/** Current name's root digit (or 0 if no valid name). */
function currentNameSingle() {
  if (!letterBreakdown(lastName).length) return 0;
  return calculate(lastName).single;
}

/** Build the Day / Month / Year dropdown options (month names translated). */
function populateDobSelects() {
  const dict = t();
  const day = $('#dobDay'), month = $('#dobMonth'), year = $('#dobYear');

  // Preserve any current selection across a language change.
  const keep = { d: day.value, m: month.value, y: year.value };
  const pad = (n) => String(n).padStart(2, '0');

  let dHtml = `<option value="">${dict.dayLabel}</option>`;
  for (let i = 1; i <= 31; i++) dHtml += `<option value="${pad(i)}">${i}</option>`;
  day.innerHTML = dHtml;

  let mHtml = `<option value="">${dict.monthLabel}</option>`;
  dict.months.forEach((name, i) => { mHtml += `<option value="${pad(i + 1)}">${name}</option>`; });
  month.innerHTML = mHtml;

  const maxYear = new Date().getFullYear();
  let yHtml = `<option value="">${dict.yearLabel}</option>`;
  for (let y = maxYear; y >= 1920; y--) yHtml += `<option value="${y}">${y}</option>`;
  year.innerHTML = yHtml;

  day.value = keep.d; month.value = keep.m; year.value = keep.y;
}

function setLanguage(lang, animate = true) {
  if (!I18N[lang]) return;
  currentLang = lang;
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.classList.toggle('is-active', b.dataset.lang === lang));

  const swap = () => {
    applyStaticTranslations();
    populateDobSelects();
    renderMeaningsReference();
    renderSteps();
    if (lastName) renderResults();
    refreshNumChecks(); // mobile/vehicle results show translated text
  };

  // Smooth cross-fade: fade out → swap text → fade back in.
  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!animate || reduceMotion) {
    swap();
  } else {
    document.body.classList.add('lang-changing');
    setTimeout(() => {
      swap();
      window.requestAnimationFrame(() =>
        document.body.classList.remove('lang-changing'));
    }, 180);   // matches the .28s CSS transition midpoint
  }

  try { localStorage.setItem('numLang', lang); } catch (e) {}
}

/** Auto-hide header on scroll down, reveal on scroll up. */
function initHeaderScroll() {
  const header = $('.site-header');
  let lastY = window.scrollY;
  let ticking = false;
  const THRESHOLD = 6;      // ignore tiny jitters
  const REVEAL_TOP = 80;    // always show near the very top

  function onScroll() {
    const y = window.scrollY;
    const diff = y - lastY;

    header.classList.toggle('header-scrolled', y > 4);

    if (Math.abs(diff) > THRESHOLD) {
      if (diff > 0 && y > REVEAL_TOP) {
        header.classList.add('header-hidden');   // scrolling down → hide
      } else {
        header.classList.remove('header-hidden'); // scrolling up → show
      }
      lastY = y;
    }
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
}

/** Birth-place autocomplete via OpenStreetMap Nominatim (free, no API key). */
function initPlaceAutocomplete() {
  const input = $('#placeInput');
  const list = $('#placeResults');
  if (!input || !list) return;

  let timer = null;
  let controller = null;

  function hide() { list.hidden = true; list.innerHTML = ''; }

  function render(items) {
    if (!items.length) { hide(); return; }
    list.innerHTML = items.map(p =>
      `<li class="place-option" role="option" data-name="${p.display_name.replace(/"/g, '&quot;')}">${p.display_name}</li>`
    ).join('');
    list.hidden = false;
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (timer) clearTimeout(timer);
    if (q.length < 3) { hide(); return; }
    timer = setTimeout(() => {
      if (controller) controller.abort();
      controller = new AbortController();
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=0&q='
                + encodeURIComponent(q);
      fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
        .then(r => (r.ok ? r.json() : []))
        .then(data => render(Array.isArray(data) ? data : []))
        .catch(() => {});   // ignore network/abort errors silently
    }, 350);   // debounce — Nominatim asks for ≤1 request/sec
  });

  // Select a suggestion
  list.addEventListener('click', e => {
    const li = e.target.closest('.place-option');
    if (!li) return;
    input.value = li.dataset.name;
    hide();
  });

  // Dismiss the dropdown when clicking away
  document.addEventListener('click', e => {
    if (!list.contains(e.target) && e.target !== input) hide();
  });
}

/** Generate a multi-page PDF of the full report + suggestions.
    Rasterises the live results section (so Hindi/Marathi Devanagari and the
    colour swatches render exactly as on screen) and paginates it onto A4.
    Degrades gracefully if the CDN libs didn't load. */
async function downloadReportPdf() {
  const dict = t();
  const btn = $('#pdfBtn');
  const results = $('#results');
  if (!results || results.hidden) return;

  const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
  if (typeof window.html2canvas !== 'function' || !jsPDFCtor) {
    alert('PDF tools are still loading — please try again in a moment.');
    return;
  }

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = dict.pdfBuilding;

  // Re-theme the results to a clean LIGHT palette just for the capture, so the
  // exported PDF has crisp, print-friendly colours instead of the dark screen theme.
  results.classList.add('pdf-capture');

  try {
    // Measure "atomic" UI blocks (cards/tiles/rows/chips/headings) in the live
    // DOM *before* rasterising, so the pagination loop below can detect when a
    // page-cut would land inside one and shift the whole block to the next
    // page instead of slicing through it.
    const protectSelector = '.stat-card, .calc-card, .inner-card, .lucky-tile, ' +
      '.remedy-tile, .meaning-card, .compat-row, .loshu-cell, .plane-chip, ' +
      '.letter-chip, .suggest-chip, .chart-cell, .panel-title, .iname-card, .profile-card';
    const containerTop = results.getBoundingClientRect().top;
    // A heading only needs a small cushion of its own following content glued
    // to it (so it isn't left alone at the bottom of a page) — NOT the whole
    // panel body, otherwise every tile/row inside that panel would chain-merge
    // into one giant block that can never fit on a page and gets sliced anyway.
    const HEADING_CUSHION_PX = 48;
    const rawRanges = Array.from(results.querySelectorAll(protectSelector)).map(el => {
      const r = el.getBoundingClientRect();
      let top = r.top - containerTop;
      let bottom = r.bottom - containerTop;
      if (el.classList.contains('panel-title')) {
        bottom += HEADING_CUSHION_PX;
      }
      return { top, bottom };
    }).filter(r => r.bottom > r.top).sort((a, b) => a.top - b.top);
    // Merge overlapping/adjacent ranges into single spans, but never past a
    // page's worth of content — an oversized merged range would force a
    // pull-back that can't succeed and defeats the purpose.
    const MAX_MERGED_PX = 1300; // generous cap; real per-page limit is enforced later against actual page height
    const protectedRanges = [];
    for (const r of rawRanges) {
      const last = protectedRanges[protectedRanges.length - 1];
      if (last && r.top <= last.bottom + 1 && (Math.max(last.bottom, r.bottom) - last.top) <= MAX_MERGED_PX) {
        last.bottom = Math.max(last.bottom, r.bottom);
      } else {
        protectedRanges.push({ ...r });
      }
    }
    const preCaptureHeight = results.scrollHeight;

    const canvas = await window.html2canvas(results, {
      backgroundColor: '#ffffff',
      scale: 2,                       // crisp text
      useCORS: true,
      windowWidth: results.scrollWidth,
    });
    // Canvas px per CSS px, derived from the actual capture (robust to any
    // internal rounding html2canvas applies), used to map the ranges above
    // from CSS coordinates into canvas-pixel coordinates.
    const scaleY = canvas.height / preCaptureHeight;

    const pdf = new jsPDFCtor({ unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 28;
    const imgW = pageW - margin * 2;

    // A soft diagonal watermark repeated across every page.
    const stampWatermark = () => {
      const label = "AmolSoftware's  ·  Amol Gadage";
      pdf.saveGraphicsState();
      try { pdf.setGState(new pdf.GState({ opacity: 0.08 })); } catch (e) {}
      pdf.setTextColor(124, 92, 255);
      pdf.setFontSize(30);
      for (let y = 90; y < pageH; y += 150) {
        for (let x = -20; x < pageW; x += 300) {
          pdf.text(label, x, y, { angle: 30 });
        }
      }
      pdf.restoreGraphicsState();
    };

    // Header (first page only) — drawn above the image band, so no overlap.
    // jsPDF's built-in fonts are Latin-only, so the PDF chrome always uses
    // ASCII/English text (the localized content still renders inside the image).
    const paintHeader = () => {
      pdf.setTextColor(58, 31, 140);              // deep violet, strong contrast
      pdf.setFontSize(17);
      pdf.text('Chaldean Numerology Name Report', margin, margin + 4);
      const nm = lastName.trim();
      // Only print the name if it's Latin-representable (jsPDF core fonts can't do Devanagari).
      const latinName = /^[\x00-\x7F]+$/.test(nm) ? nm : '';
      if (latinName) {
        pdf.setFontSize(11);
        pdf.setTextColor(60, 50, 100);
        pdf.text(`Name: ${latinName}`, margin, margin + 22);
      }
    };
    // Footer credit — drawn below the image band.
    const paintFooter = () => {
      pdf.setFontSize(9);
      pdf.setTextColor(90, 80, 130);
      pdf.text("AmolSoftware's · Chaldean Numerology · Amol Gadage", margin, pageH - 14);
    };

    const topOffset = margin + 36;
    const imgH = (canvas.height * imgW) / canvas.width;
    let remaining = imgH;
    let sy = 0;                                   // source y in canvas px
    const pxPerPt = canvas.width / imgW;          // canvas px per PDF pt
    let firstPage = true;

    while (remaining > 0) {
      const avail = (firstPage ? pageH - topOffset - margin : pageH - margin * 2);
      let sliceHpt = Math.min(avail, remaining);
      let sliceHpx = sliceHpt * pxPerPt;

      // If this cut lands inside a protected block (a card/tile/row/chip),
      // pull the cut back to the top of that block so the whole block moves
      // to the next page instead of being sliced in half.
      if (sliceHpt < remaining) {
        const cutY = sy + sliceHpx;
        for (const r of protectedRanges) {
          const rTop = r.top * scaleY, rBottom = r.bottom * scaleY;
          if (rTop > sy && rTop < cutY && cutY < rBottom) {
            const pulledHpx = rTop - sy;
            const pulledHpt = pulledHpx / pxPerPt;
            // Only pull back if a meaningful amount of content still fits on
            // this page — otherwise leave the cut as-is rather than emit a
            // near-empty page (e.g. a single block taller than one page).
            if (pulledHpt > 40) { sliceHpt = pulledHpt; sliceHpx = pulledHpx; }
            break;
          }
        }
      }

      // Draw this slice onto an intermediate canvas (white background)
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.ceil(sliceHpx);
      const sctx = slice.getContext('2d');
      sctx.fillStyle = '#ffffff';
      sctx.fillRect(0, 0, slice.width, slice.height);
      sctx.drawImage(canvas, 0, sy, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);

      const y = firstPage ? topOffset : margin;
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, y, imgW, sliceHpt);

      // Chrome drawn AFTER the image so the watermark shows on top of content.
      if (firstPage) paintHeader();
      paintFooter();
      stampWatermark();

      remaining -= sliceHpt;
      sy += sliceHpx;
      if (remaining > 0) {
        pdf.addPage();
        firstPage = false;
      }
    }

    const safe = (lastName.trim() || 'numerology').replace(/[^a-z0-9]+/gi, '_');
    pdf.save(`${safe}_numerology_report.pdf`);
  } catch (err) {
    alert('Sorry — the PDF could not be generated in this browser.');
  } finally {
    results.classList.remove('pdf-capture');
    btn.disabled = false;
    btn.textContent = original;
  }
}

/** Draw a branded, shareable 1080×1350 result card (portrait — fits
    Instagram/WhatsApp status) and trigger a PNG download. Pure Canvas 2D
    drawing (no html2canvas needed) so the card layout is fully controlled
    and identical across browsers/devices. Also copies a ready-to-paste
    caption (with the site URL) to the clipboard so sharing takes one paste. */
async function shareReport() {
  const dict = t();
  const btn = $('#shareBtn');
  const name = lastName.trim();
  if (!letterBreakdown(name).length) return;

  const { single } = calculate(name);
  const { pct } = favourability(name);

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = dict.shareBuilding;

  try {
    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background — matches the site's dark celestial gradient.
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#2a1a4a');
    bg.addColorStop(0.55, '#241243');
    bg.addColorStop(1, '#160a2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Soft scattered stars.
    ctx.fillStyle = 'rgba(245, 196, 81, 0.55)';
    const starSeedPts = [[110, 130], [940, 170], [890, 1220], [140, 1180], [980, 640], [90, 700]];
    starSeedPts.forEach(([sx, sy]) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? 14 : 6;
        const px = sx + Math.cos(a) * r, py = sy + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    });

    // Brand mark.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5c451';
    ctx.font = "600 46px Georgia, 'Times New Roman', serif";
    ctx.fillText('✦ ' + (dict.brandName || 'NameVibe'), W / 2, 130);

    // Glowing core with the root number.
    const cx = W / 2, cy = 430, r = 150;
    const glow = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy, r);
    glow.addColorStop(0, '#fff6df');
    glow.addColorStop(0.6, '#ffe9a8');
    glow.addColorStop(1, '#f5c451');
    ctx.beginPath();
    ctx.fillStyle = glow;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#2a1a4a';
    ctx.font = '800 150px Arial, Helvetica, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(single), cx, cy + 10);
    ctx.textBaseline = 'alphabetic';

    // Name.
    ctx.fillStyle = '#ffffff';
    ctx.font = "700 54px Georgia, 'Times New Roman', serif";
    const displayName = name.length > 24 ? name.slice(0, 22) + '…' : name;
    ctx.fillText(displayName, W / 2, 660);

    // "Name Number" label.
    ctx.fillStyle = '#c9bce8';
    ctx.font = '30px Arial, Helvetica, sans-serif';
    ctx.fillText((dict.singleLabel || 'Name Number').toUpperCase(), W / 2, 705);

    // Favourability pill.
    const pillW = 420, pillH = 84, pillY = 770;
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const rx = W / 2 - pillW / 2, ry = pillY, rw = pillW, rh = pillH, rr = rh / 2;
    ctx.moveTo(rx + rr, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
    ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr);
    ctx.arcTo(rx, ry + rh, rx, ry, rr);
    ctx.arcTo(rx, ry, rx + rw, ry, rr);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5c451';
    ctx.font = '800 40px Arial, Helvetica, sans-serif';
    ctx.fillText(`${pct}% ${dict.favGood}`, W / 2, pillY + 54);

    // Ruling planet + meaning headline.
    const planet = PLANET_NAMES[currentLang][single];
    const meaning = (NUMBER_MEANINGS[currentLang][single] || [''])[0];
    ctx.fillStyle = '#a98bff';
    ctx.font = '600 32px Arial, Helvetica, sans-serif';
    ctx.fillText(`${planet} · ${meaning}`, W / 2, 920);

    // Footer credit + CTA.
    ctx.fillStyle = '#8f82b8';
    ctx.font = '26px Arial, Helvetica, sans-serif';
    ctx.fillText('Free Chaldean Numerology Calculator', W / 2, 1220);
    ctx.fillStyle = '#c9bce8';
    ctx.font = '600 30px Arial, Helvetica, sans-serif';
    ctx.fillText('Find your report free — search "NameVibe"', W / 2, 1270);
    ctx.fillStyle = '#6b5f96';
    ctx.font = '24px Arial, Helvetica, sans-serif';
    ctx.fillText('by Amol Gadage', W / 2, 1310);

    // Download the card.
    const safe = (name || 'numerology').replace(/[^a-z0-9]+/gi, '_');
    const link = document.createElement('a');
    link.download = `${safe}_namevibe_report.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    // Copy a ready-to-paste caption alongside the image.
    const shareUrl = (document.querySelector('link[rel="canonical"]') || {}).href || window.location.href;
    const caption = dict.shareCaption(name, single, pct).replace('{url}', shareUrl);
    try {
      await navigator.clipboard.writeText(caption);
      alert(dict.shareCopied);
    } catch (e) {
      // Clipboard API unavailable (older browser / permissions) — the image
      // still downloaded, so degrade gracefully without blocking the user.
    }
  } catch (err) {
    alert('Sorry — the share card could not be generated in this browser.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

/* =========================================================
   6b. Ambient decoration — page-wide celestial motifs + cursor sparkles
   ========================================================= */

const REDUCED_MOTION =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Tiny deterministic PRNG so scatter looks organic but doesn't jump every frame.
let _decorSeed = 0x9e3779b9;
function decorRand() {
  _decorSeed ^= _decorSeed << 13; _decorSeed ^= _decorSeed >>> 17; _decorSeed ^= _decorSeed << 5;
  return ((_decorSeed >>> 0) % 100000) / 100000;
}

// Inline SVG factories for each motif — coloured with the site palette.
const DECOR_SVG = {
  star: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path fill="#f5c451" d="M12 1l2.6 7.3L22 9l-5.9 4.6L18 21l-6-4-6 4 1.9-7.4L2 9l7.4-.7z"/></svg>`,
  sparkle: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path fill="#ffe9a8" d="M12 0c.6 5.4 2.6 7.4 8 12-5.4.6-7.4 2.6-8 8-.6-5.4-2.6-7.4-8-8 5.4-.6 7.4-2.6 8-12z"/></svg>`,
  moon: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path fill="#a98bff" d="M16 2a10 10 0 100 20 8 8 0 010-20z"/></svg>`,
  orb: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><defs><radialGradient id="o${(s*7)|0}" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#a98bff"/><stop offset="100%" stop-color="#7c5cff"/></radialGradient></defs><circle cx="12" cy="12" r="11" fill="url(#o${(s*7)|0}) "/></svg>`,
  sun: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><g fill="#f5c451"><circle cx="12" cy="12" r="5"/><g stroke="#f5c451" stroke-width="1.6" stroke-linecap="round"><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M20 4l-2 2M6 18l-2 2"/></g></g></svg>`,
  // Botanical motifs — a leafy sprig and a sprouting seedling (growth / roots).
  leaf: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><g fill="none" stroke="#4bd699" stroke-width="1.6" stroke-linecap="round"><path d="M12 22V7"/><path fill="#4bd699" stroke="none" d="M12 12c0-4 3-7 7-7 0 4-3 7-7 7z"/><path fill="#4bd699" stroke="none" d="M12 16c0-3.5-3-6-6.5-6 0 3.5 3 6 6.5 6z"/></g></svg>`,
  sprout: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><g fill="#4bd699"><path d="M12 21v-8" stroke="#4bd699" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M12 13C12 9 15 7 19 7c0 4-3 6-7 6z"/><path d="M12 15C12 12 9 10 5 10c0 3 3 5 7 5z"/><path d="M9 22h6" stroke="#7c5cff" stroke-width="1.4" fill="none" stroke-linecap="round"/></g></svg>`,
  // Gemstone diamond (lucky stone) — faceted, with a soft gradient.
  diamond: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><defs><linearGradient id="d${(s*3)|0}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#bfe9ff"/><stop offset="100%" stop-color="#7ec8e3"/></linearGradient></defs><g fill="url(#d${(s*3)|0})" stroke="#e8f6ff" stroke-width=".6" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/></g><g fill="none" stroke="#e8f6ff" stroke-width=".6" opacity=".7"><path d="M2 9h20M6 3l6 18M18 3l-6 18M9 3L6 9M15 3l3 6"/></g></svg>`,
  // Sunflower — golden petals around a warm centre.
  sunflower: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><g fill="#f5c451"><g>${
    Array.from({length:12},(_,i)=>`<ellipse cx="12" cy="3.4" rx="1.7" ry="3.4" transform="rotate(${i*30} 12 12)"/>`).join('')
  }</g></g><circle cx="12" cy="12" r="4" fill="#8B5E3C"/></svg>`,
  // Ringed planet (Saturn) — a celestial nod to astrology.
  planet: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><defs><radialGradient id="p${(s*5)|0}" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#ffe9a8"/><stop offset="100%" stop-color="#d98c2b"/></radialGradient></defs><ellipse cx="12" cy="13" rx="11" ry="3.4" fill="none" stroke="#a98bff" stroke-width="1.3" transform="rotate(-20 12 13)"/><circle cx="12" cy="12" r="6" fill="url(#p${(s*5)|0})"/></svg>`,
};
const DECOR_KINDS = [
  { kind: 'star',    cls: 'pd--star',    min: 11, max: 18, op: .5,  weight: 5 },
  { kind: 'sparkle', cls: 'pd--sparkle', min: 9,  max: 15, op: .45, weight: 4 },
  { kind: 'moon',    cls: 'pd--moon',    min: 24, max: 44, op: .2,  weight: 1 },
  { kind: 'orb',     cls: 'pd--orb',     min: 22, max: 42, op: .16, weight: 2 },
  { kind: 'sun',     cls: 'pd--sun',     min: 28, max: 48, op: .18, weight: 1 },
  { kind: 'leaf',    cls: 'pd--leaf',    min: 20, max: 36, op: .22, weight: 2 },
  { kind: 'sprout',  cls: 'pd--sprout',  min: 22, max: 38, op: .22, weight: 2 },
  { kind: 'diamond',   cls: 'pd--diamond',   min: 18, max: 32, op: .28, weight: 2 },
  { kind: 'sunflower', cls: 'pd--sunflower', min: 22, max: 40, op: .2,  weight: 2 },
  { kind: 'planet',    cls: 'pd--planet',    min: 24, max: 44, op: .18, weight: 1 },
];
const DECOR_WEIGHTED = DECOR_KINDS.flatMap(k => Array(k.weight).fill(k));

/** Scatter celestial motifs across a fixed layer, with the count scaled to the
    current page height — so as more result data appears, more decoration does too. */
function populatePageDecor() {
  const layer = document.getElementById('pageDecor');
  if (!layer) return;

  const docH = Math.max(
    document.body.scrollHeight, document.documentElement.scrollHeight, window.innerHeight);
  // Pin the layer to the full document height so motifs aren't clipped.
  layer.style.height = docH + 'px';
  const vw = window.innerWidth;
  // No usable side gutters below ~1040px — CSS hides the layer there too.
  if (vw <= 1040) { while (layer.firstChild) layer.removeChild(layer.firstChild); return; }
  // Keep motifs OUT of the central reading column (max-width 960px) so they never
  // sit behind the text. Only the side gutters are used as the decoration band.
  const CONTENT_W = 960;
  const gutterPx = Math.max(0, (vw - CONTENT_W) / 2);
  const gutterPct = gutterPx / vw;                 // fraction of width per side
  // If the gutters are too thin to decorate cleanly (narrow/tablet screens),
  // place just a few faint motifs hugging the very edges instead.
  const edgeBand = gutterPct < 0.06 ? 0.05 : gutterPct;

  // Sparse by design — roughly one motif per ~230px of page height, so the
  // margins feel alive without ever crowding. Scales with page height.
  const perSide = Math.min(22, Math.max(4, Math.round(docH / 230)));
  const target = perSide * 2;

  const current = layer.childElementCount;
  if (target === current) return;

  if (target < current) {                    // page shrank — trim extras
    for (let i = current - 1; i >= target; i--) layer.children[i].remove();
    return;
  }

  const frag = document.createDocumentFragment();
  for (let i = current; i < target; i++) {
    const spec = DECOR_WEIGHTED[Math.floor(decorRand() * DECOR_WEIGHTED.length)];
    const size = Math.round(spec.min + decorRand() * (spec.max - spec.min));
    const el = document.createElement('span');
    el.className = `pd ${spec.cls}`;
    // Alternate left/right gutter; keep within the edge band (never over text).
    const onLeft = (i % 2 === 0);
    const pos = decorRand() * edgeBand;              // 0..edgeBand from the edge
    el.style.left = (onLeft ? pos * 100 : (1 - pos) * 100).toFixed(2) + '%';
    el.style.top = (decorRand() * docH) + 'px';
    el.style.setProperty('--pd-dur', (10 + decorRand() * 14).toFixed(1) + 's');
    el.style.setProperty('--pd-delay', (-decorRand() * 12).toFixed(1) + 's');
    el.style.setProperty('--pd-op', spec.op.toFixed(2));
    el.innerHTML = DECOR_SVG[spec.kind](size);
    frag.appendChild(el);
  }
  layer.appendChild(frag);
}

/** Sparkle trail that drops from the pointer as it moves. */
function initCursorSparkle() {
  // Skip on touch-only devices (no meaningful hover pointer). We intentionally
  // do NOT gate this on prefers-reduced-motion — it's an explicit opt-in effect.
  if (window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const COLORS = ['#f5c451', '#ffe9a8', '#a98bff', '#7c5cff', '#4bd699'];
  let lastX = 0, lastY = 0, throttle = false;

  const spawn = (x, y) => {
    const s = document.createElement('span');
    s.className = 'cursor-spark';
    const size = 6 + decorRand() * 8;
    const color = COLORS[Math.floor(decorRand() * COLORS.length)];
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.setProperty('--sf-dx', ((decorRand() - .5) * 40).toFixed(0) + 'px');
    s.style.setProperty('--sf-dy', (24 + decorRand() * 46).toFixed(0) + 'px');
    s.style.setProperty('--sf-dur', (700 + decorRand() * 500).toFixed(0) + 'ms');
    s.style.setProperty('--sf-s0', (0.7 + decorRand() * 0.7).toFixed(2));
    s.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="${color}" d="M12 0c.6 5.4 2.6 7.4 8 12-5.4.6-7.4 2.6-8 8-.6-5.4-2.6-7.4-8-8 5.4-.6 7.4-2.6 8-12z"/></svg>`;
    document.body.appendChild(s);
    s.addEventListener('animationend', () => s.remove());
  };

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    if (throttle) return;
    throttle = true;
    requestAnimationFrame(() => { throttle = false; });
    // Only spawn if the pointer actually moved a little (avoids clustering).
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (dx * dx + dy * dy < 36) return;
    lastX = e.clientX; lastY = e.clientY;
    spawn(e.clientX, e.clientY);
  }, { passive: true });

  // A little burst on click for extra delight.
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    for (let i = 0; i < 5; i++) spawn(e.clientX, e.clientY);
  }, { passive: true });
}

let _decorResizeTimer = null;
function scheduleDecorRefresh() {
  clearTimeout(_decorResizeTimer);
  _decorResizeTimer = setTimeout(populatePageDecor, 250);
}

/* =========================================================
   7. Init
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  renderChart();

  // restore saved language
  let saved = 'en';
  try { saved = localStorage.getItem('numLang') || 'en'; } catch (e) {}
  setLanguage(I18N[saved] ? saved : 'en', false);   // no fade on first load

  // Live calculation as the user types / picks a date
  $('#nameInput').addEventListener('input', liveUpdate);
  ['#dobDay', '#dobMonth', '#dobYear'].forEach(sel =>
    $(sel).addEventListener('change', liveUpdate));
  $('#clearBtn').addEventListener('click', doClear);

  document.querySelectorAll('.lang-btn').forEach(btn =>
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang)));

  // Main gender selector — drives Kua calculation & name-idea suggestions.
  document.querySelectorAll('.gender-switch--main .gender-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      userGender = btn.dataset.gender;
      indianGender = userGender;   // keep baby-name ideas in sync with chosen gender
      indianOffset = 0;
      document.querySelectorAll('.gender-switch--main .gender-btn').forEach(b =>
        b.classList.toggle('is-active', b === btn));
      // Mirror the selection onto the Indian-name toggle
      document.querySelectorAll('.iname-btn').forEach(b =>
        b.classList.toggle('is-active', b.dataset.gender === indianGender));
      if (letterBreakdown(lastName).length) renderResults();
      else renderIndianNames();
    }));

  // Indian baby-name gender toggle + "More" button
  document.querySelectorAll('.iname-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      indianGender = btn.dataset.gender;
      indianOffset = 0;
      document.querySelectorAll('.iname-btn').forEach(b =>
        b.classList.toggle('is-active', b === btn));
      renderIndianNames();
    }));
  $('#refreshNames').addEventListener('click', () => {
    indianOffset += 8;
    renderIndianNames();
  });

  // Practical & relationship checkers — re-evaluate live against the current name.
  ['#emailCheck', '#bankCheck', '#socialCheck', '#businessCheck', '#partnerCheck', '#friendCheck'].forEach(sel =>
    $(sel).addEventListener('input', () => refreshChecks(currentNameSingle())));

  // Mobile / Vehicle number numerology — personalised against name/DOB by
  // default; each card's checkbox lets the user opt into a standalone score.
  ['#mobileCheck', '#vehicleCheck', '#mobilePersonalize', '#vehiclePersonalize'].forEach(sel =>
    $(sel).addEventListener('input', refreshNumChecks));
  refreshNumChecks(); // show the "enter a number" placeholder state immediately

  // Birth-place autocomplete (OpenStreetMap Nominatim — free, no key)
  initPlaceAutocomplete();

  // PDF report download
  const pdfBtn = $('#pdfBtn');
  if (pdfBtn) pdfBtn.addEventListener('click', downloadReportPdf);

  // Shareable result card (image + caption)
  const shareBtn = $('#shareBtn');
  if (shareBtn) shareBtn.addEventListener('click', shareReport);

  initHeaderScroll();

  // Ambient decoration + cursor sparkles (both respect prefers-reduced-motion)
  populatePageDecor();
  initCursorSparkle();
  window.addEventListener('resize', scheduleDecorRefresh, { passive: true });
});
