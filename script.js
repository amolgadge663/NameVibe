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

/** Relationship between two single digits: 'good' | 'neutral' | 'warn'. */
function relation(a, b) {
  if (FRIENDS[a] && FRIENDS[a].includes(b)) return 'good';
  if (ENEMIES[a] && ENEMIES[a].includes(b)) return 'warn';
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
    favourable (1, 3, 5, 6). `index` rotates the selection for variety. */
function favourableIndianNames(gender, count = 8, offset = 0) {
  const pool = INDIAN_NAMES[gender] || [];
  const matches = pool
    .map(n => ({ name: n, ...calculate(n) }))
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
    indianIntro: 'Auspicious Hindu names whose Chaldean number falls on a favourable root (1, 3, 5 or 6).',
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
    practicalIntro: 'Check whether an email ID, bank/company name or any word harmonises with your number.',
    emailPlaceholder: 'Email ID (e.g. amol123)',
    bankPlaceholder: 'Bank / company name',
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
    indianIntro: 'शुभ हिंदू नाम जिनका चाल्डियन अंक शुभ मूल (1, 3, 5 या 6) पर आता है।',
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
    practicalIntro: 'जाँचें कि कोई ईमेल आईडी, बैंक/कंपनी नाम या शब्द आपके अंक से मेल खाता है या नहीं।',
    emailPlaceholder: 'ईमेल आईडी (जैसे amol123)',
    bankPlaceholder: 'बैंक / कंपनी नाम',
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
    indianIntro: 'शुभ हिंदू नावे ज्यांचा चाल्डियन अंक शुभ मूळावर (1, 3, 5 किंवा 6) येतो.',
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
    practicalIntro: 'ईमेल आयडी, बँक/कंपनी नाव किंवा शब्द आपल्या अंकाशी जुळतो का ते तपासा.',
    emailPlaceholder: 'ईमेल आयडी (उदा. amol123)',
    bankPlaceholder: 'बँक / कंपनी नाव',
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
   is favourable (1, 3, 5, 6) — grouped by gender.
   ========================================================= */
const INDIAN_NAMES = {
  boy: [
    'Aarav','Advait','Arjun','Aryan','Dhruv','Ishaan','Kabir','Karan','Krishna',
    'Laksh','Manav','Neel','Om','Parth','Pranav','Rohan','Rudra','Samarth',
    'Shaurya','Siddharth','Tejas','Ved','Vihaan','Viraj','Yash','Aditya',
    'Ansh','Devansh','Reyansh','Shivansh','Atharv','Kiaan','Nirvaan','Vivaan',
  ],
  girl: [
    'Aadya','Aanya','Aarohi','Ananya','Anvi','Avni','Diya','Gauri','Ira',
    'Ishita','Kavya','Kiara','Lavanya','Meera','Myra','Navya','Nitya','Pari',
    'Prisha','Riya','Saanvi','Sara','Shreya','Siya','Tara','Trisha','Vanya',
    'Aaradhya','Anika','Ishani','Mahi','Pihu','Saira','Zara','Aditi','Divya',
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

  // Favourability meter, inner numbers, Lucky essentials, Career, life events
  renderFavourMeter(name);
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
    { icon:'📆', label: dict.luckyDates, value: L.numbers.join(', ') },
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

/** Re-run all four practical/relationship checks. */
function refreshChecks(nameSingle) {
  evalCheck($('#emailCheck'),   $('#emailVerdict'),   nameSingle);
  evalCheck($('#bankCheck'),    $('#bankVerdict'),    nameSingle);
  evalCheck($('#partnerCheck'), $('#partnerVerdict'), nameSingle);
  evalCheck($('#friendCheck'),  $('#friendVerdict'),  nameSingle);
}

/** Render lucky Indian/Hindu baby name ideas for the chosen gender. */
function renderIndianNames() {
  const box = $('#indianNames');
  if (!box) return;
  const names = favourableIndianNames(indianGender, 8, indianOffset);
  box.innerHTML = names.map(n => `
    <span class="suggest-chip">${n.name}<span class="sc-num">${n.compound}/${n.single}</span></span>`).join('');
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

  if (!letterBreakdown(lastName).length) {
    // No name yet: hide name-driven results, but still hide DOB too.
    $('#results').hidden = true;
    return;
  }
  renderResults();
}

function doClear() {
  ['#nameInput', '#dobDay', '#dobMonth', '#dobYear',
   '#placeInput', '#emailCheck', '#bankCheck', '#partnerCheck', '#friendCheck']
    .forEach(sel => { const el = $(sel); if (el) el.value = ''; });
  ['#emailVerdict', '#bankVerdict', '#partnerVerdict', '#friendVerdict']
    .forEach(sel => { const el = $(sel); if (el) { el.textContent = ''; el.className = 'check-verdict'; } });
  lastName = '';
  lastDob = '';
  $('#results').hidden = true;
  $('#dobPanel').hidden = true;
  $('#placeResults').hidden = true;
  $('#nameInput').focus();
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

  let yHtml = `<option value="">${dict.yearLabel}</option>`;
  for (let y = 2026; y >= 1920; y--) yHtml += `<option value="${y}">${y}</option>`;
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
    const canvas = await window.html2canvas(results, {
      backgroundColor: '#ffffff',
      scale: 2,                       // crisp text
      useCORS: true,
      windowWidth: results.scrollWidth,
    });

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
      const sliceHpt = Math.min(avail, remaining);
      const sliceHpx = sliceHpt * pxPerPt;

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
  ['#emailCheck', '#bankCheck', '#partnerCheck', '#friendCheck'].forEach(sel =>
    $(sel).addEventListener('input', () => refreshChecks(currentNameSingle())));

  // Birth-place autocomplete (OpenStreetMap Nominatim — free, no key)
  initPlaceAutocomplete();

  // PDF report download
  const pdfBtn = $('#pdfBtn');
  if (pdfBtn) pdfBtn.addEventListener('click', downloadReportPdf);

  initHeaderScroll();

  // Ambient decoration + cursor sparkles (both respect prefers-reduced-motion)
  populatePageDecor();
  initCursorSparkle();
  window.addEventListener('resize', scheduleDecorRefresh, { passive: true });
});
