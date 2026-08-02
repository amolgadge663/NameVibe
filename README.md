# NameVibe — Chaldean Numerology Name Calculator

**NameVibe** is a single-page, fully responsive static website that calculates the **Chaldean numerology** value of any name — its **compound number**, **single (root) digit**, ruling planet and meaning — and suggests favourable spelling variations.

Available in **English**, **हिंदी (Hindi)** and **मराठी (Marathi)**.

> Crafted with care by **Amol Gadage**.

---

## ✨ Features

- **Chaldean method** — the authentic 1–8 letter mapping (the number **9 is sacred** and never assigned to a letter).
- **Live calculation** — results update in real time as you type; no button needed, with subtle flip/fade animations whenever a value changes.
- **Compound + single digit** — shows the full total and its digit-by-digit reduction to a root number (1–9).
- **Compound number meaning** — the classic Cheiro/Chaldean compound-number interpretations (10–52), each flagged *fortunate* or *caution*, explaining the deeper hidden influence behind a name.
- **Favourability meter (explainable)** — an animated percentage bar *plus* a transparent breakdown showing exactly how the score was reached (root-number strength + fortunate/caution compound bonus + harmony between the inner numbers), so it is never a black-box figure.
- **Personality & life-path profile** — six hand-written paragraphs per name root number covering **behaviour & social connection 🤝**, **body & health tendencies 🧘**, **love life 💞**, **career path 💼**, **money & wealth mindset 💰** and **life lessons & growth 🌱**, translated in full in all three languages.
- **Inner numbers — Soul Urge & Personality** — two genuinely different, complementary numbers shown side by side: the **Soul Urge / Heart's Desire** (from the *vowels*) is the inner craving; the **Personality number** (from the *consonants*) is the outer impression you make on others.
- **Lucky essentials** — lucky days, numbers, dates, colours (with live swatches), presiding deity, gemstone/metal, **lucky plant / tree**, favourable direction, and **lucky world cities** split into places that favour a thriving **career** and places that favour **long, peaceful living**.
- **Best life events & important dates** — the turning-point ages/years for each root number and the kind of event most likely to shine then.
- **Personalised remedies** — practical, area-wise guidance keyed to your name number across six life areas: **money 💰, career 📈, job 💼, health 🩺, marriage 💍 and love life 💖** — so the reading turns into concrete things to do.
- **Kua number (Feng Shui)** — a **gender-dependent, era-correct** calculation (`10 − yr` / `5 + yr` for pre-2000 births; `9 − yr` / `6 + yr` for 2000 onward, with the traditional 5→2/8 substitution), plus the auspicious East/West group and lucky directions.
- **Lo Shu grid & planes** — a 3×3 grid built from the date of birth, showing repeated/missing numbers and how many **planes** (complete rows, columns or diagonals) are formed, **with practical remedies** for how to add and strengthen each missing number.
- **Downloadable PDF report** — one click exports the full reading and all suggestions to a clean, multi-page PDF. It re-themes the result to a **print-friendly light palette** during capture (crisp colours instead of the dark screen theme), preserves Hindi/Marathi and colour swatches, adds a first-page title, and stamps a soft diagonal **"AmolSoftware's · Amol Gadage"** watermark on every page.
- **Favourable choices checker** — live-checks whether an **email ID**, **social media username/handle**, **business/brand name**, **bank/company name** or any word harmonises with your number.
- **Relationship compatibility** — enter a **marriage partner's** or **friend's** name to see how their number matches yours.
- **Mobile Number numerology** — a standalone checker (works without entering a name): every digit of your mobile number is added and reduced to a root digit (1–9), with its ruling planet and a favourable/neutral/testing verdict.
- **Vehicle Number Plate numerology** — a standalone checker: the plate's letters (Chaldean value) plus its digits are combined and reduced to a root digit, so you can check a registration number before you finalise it.
- **Personal Day / Month / Year numbers** — short-term numerology cycles layered on top of your lifelong Mulank/Bhagyank, computed from your date of birth and today's date, so the reading feels fresh on every visit.
- **Shareable result card** — one click renders a branded, portrait share image (name, root number, favourability %) and downloads it, while a ready-to-paste caption — with a link back to the site — is copied to your clipboard for WhatsApp/Instagram/Facebook.
- **Career guidance** — favourable career fields for each root number.
- **Gender selector** — a male/female switch that drives the Kua calculation and tailors the baby-name suggestions.
- **Birth place (optional)** — free autocomplete powered by **OpenStreetMap Nominatim** (no API key needed).
- **Mulank & Bhagyank effects** — each birth number's meaning shown inline, plus its ruling planet.
- **Lucky Indian baby-name ideas** — 100+ auspicious Hindu names (boys/girls) whose Chaldean root is favourable, each with a short meaning (translated in all three languages) and its textual source — Rigveda, Upanishads, Puranas, the Ramayana/Mahabharata, or general Sanskrit — with a "More" button for fresh sets.
- **Letter-by-letter breakdown** — see exactly how each letter contributes.
- **Date of birth (optional)** — computes **Mulank** (birth number) and **Bhagyank** (destiny number).
- **Compatibility check** — tells you whether your **Name number**, **Mulank** and **Bhagyank** are *Friendly / Neutral / Not Friendly* with each other, using the numerology friendship matrix.
- **Name suggestions** — proposes small spelling variations whose numbers reduce to a favourable root (1, 3, 5 or 6), showing the general list *and* highlighting the single **strongest** variant (⭐) among them.
- **Meanings reference** — interpretation and ruling planet for every root number 1–9.
- **Auto-hiding header** — the top bar slides away when scrolling down and swipes back in when scrolling up, for a clean reading experience.
- **Trilingual** — instant switching between English, Hindi and Marathi (choice remembered in the browser).
- **Fully responsive** — mobile-first layout tuned for phone, tablet and desktop.
- **Zero build** — plain HTML, CSS and JavaScript; just static files. The only external scripts are `jsPDF` + `html2canvas` (loaded on demand from a CDN, purely for the optional PDF download — the whole site works without them).
- **Colourful decoration** — animated inline-SVG celestial motifs (a spinning mandala and a sun) in the hero, plus a **page-wide drifting-and-twinkling layer** of nature-and-astrology motifs (stars, crescent moons, glowing orbs, suns, leaves, sprouts, faceted diamonds, sunflowers and ringed planets). The pieces are confined to the **side margins** (never behind the reading column, so nothing feels congested), kept sparse and subtle, hidden on narrow screens with no gutters, and all respect `prefers-reduced-motion`.
- **Cursor sparkle trail** — on hover-capable devices, a colourful sparkle drops from the pointer as it moves (with a small burst on click); disabled on touch devices and under `prefers-reduced-motion`.
- **Eczar** (Latin/English) + **Laila** (Devanagari) Google Fonts — Laila shapes Hindi/Marathi conjuncts (जोडाक्षर) and matras like `सूर्य` crisply, with line-heights tuned so nothing is cropped.
- **Smooth date input** — Day / Month / Year dropdowns (with translated month names) instead of the clumsy native date picker; fast to use on any phone or tablet.
- **Animated language switch** — headings cross-fade when you change language.
- **SEO-ready & crawler-friendly** — rich `<title>`/meta description, keywords, `robots`/`googlebot` (index, follow), a `canonical` URL, Open Graph + Twitter cards with a share image, `hreflang` for English/Hindi/Marathi (+`x-default`), JSON-LD structured data (`WebApplication` + `FAQPage` for rich results), a `robots.txt` and an `hreflang`-annotated `sitemap.xml`.

---

## 🩹 Personalised Remedies

Below the life-events panel the app shows six **area-wise remedy tiles**, chosen by your **name root number (1–9)** and translated into all three languages:

| Icon | Area | What it covers |
|:---:|:---|:---|
| 💰 | Money & Wealth | saving habits, donations and planet-based wealth tips |
| 📈 | Career & Growth | favourable fields and how to advance |
| 💼 | Job & Workplace | day-to-day work conduct and lucky objects |
| 🩺 | Health | body areas to guard and calming routines |
| 💍 | Marriage | what keeps the marriage harmonious |
| 💖 | Love Life | how you give and attract affection |

Each remedy is a full, practical sentence (e.g. root **1** money: *“Donate to the needy on Sundays and keep your word in deals — solar integrity attracts steady wealth.”*). The data lives in `LIFE_REMEDIES` in `script.js`.

---

## 🔎 SEO & search-engine indexing

The site ships ready for Google/Bing indexing. **One token to replace before you go live:**
search-and-replace **`YOUR-USERNAME.github.io/namevibe`** with your real published URL in three files:

- `index.html` — `canonical`, Open Graph `og:url`/`og:image`, Twitter image, all `hreflang` links and the JSON-LD `url` fields.
- `robots.txt` — the `Sitemap:` line.
- `sitemap.xml` — every `<loc>` and `hreflang` href, plus the `<lastmod>` date.

After deploying, submit the sitemap in **Google Search Console** (and **Bing Webmaster Tools**) to speed up indexing. `robots.txt` already allows all crawlers (`Allow: /`) and the pages are marked `index, follow`, so nothing blocks indexing. The `og-image.svg` is the social-share card (used by WhatsApp, LinkedIn, X, Facebook).

> Tip: if you use a **custom domain**, add a `CNAME` file with the domain and use `https://your-domain/` (no repo path) as the token replacement.

---

## 🧮 The Chaldean Chart

| Value | Letters |
|:---:|:---|
| 1 | A · I · J · Q · Y |
| 2 | B · K · R |
| 3 | C · G · L · S |
| 4 | D · M · T |
| 5 | E · H · N · X |
| 6 | U · V · W |
| 7 | O · Z |
| 8 | F · P |

*9 is never assigned to a letter — it is considered sacred.*

### How the calculation works

1. Convert each letter of the name to its Chaldean value (1–8).
2. Add all values → the **compound number**.
3. Reduce the compound number by adding its digits until a single digit remains → the **root number**.
4. Read the meaning of the root (and compound) number.

**Example — `AMOL`**
`A(1) + M(4) + O(7) + L(3) = 15` → `1 + 5 = 6` → root **6** (Venus, favourable).

### Birth numbers (from Date of Birth)

- **Mulank (Birth Number)** = the day of the month, reduced to a single digit.
  E.g. born on the **15th** → `1 + 5 = 6`.
- **Bhagyank (Destiny Number)** = all digits of the full date (DD + MM + YYYY) added and reduced.
  E.g. **15-08-1990** → `1+5+0+8+1+9+9+0 = 33 → 3+3 = 6`.

### Compatibility (friendly or not)

The site compares three pairs — **Name ↔ Mulank**, **Name ↔ Bhagyank**, and **Mulank ↔ Bhagyank** — against a numerology *friendship matrix* and labels each pair **Friendly**, **Neutral** or **Not Friendly**. This shows at a glance whether a name harmonises with the birth chart.

### Inner numbers — Soul Urge vs Personality

These are two **different** concepts and the site shows both:

- **Soul Urge / Heart's Desire** — sum of the **vowels** (A, E, I, O, U, Y), reduced to a single digit. It describes what the heart secretly craves.
- **Personality number** — sum of the **consonants**, reduced to a single digit. It describes the outer impression you make on others before they know you.

### How the favourability % is calculated

The percentage is deliberately *explainable*, not arbitrary. It blends three traditional factors, each shown as a line item:

1. **Root-number strength** — the base score of the name's root digit (1, 3, 5, 6 score highest; 8 and 4 lowest).
2. **Compound number** — a bonus if the compound number is *fortunate*, a penalty if it carries a *caution*.
3. **Inner harmony** — a small bonus/penalty depending on whether the Soul Urge and Personality numbers are friendly or clashing.

The result is clamped to a sensible 5–99% range.

### Kua number (Feng Shui) — corrected formula

Calculated from the **year of birth** and **gender**, with the correct split by era (`yr` = last two digits of the year reduced to one digit):

- **Born before 2000:** Male = `10 − yr`, Female = `5 + yr`
- **Born 2000 or later:** Male = `9 − yr`, Female = `6 + yr`

The result is reduced to 1–9; a Kua of **5** is replaced by **2** (male) or **8** (female). Kua numbers split into the **East group** (1, 3, 4, 9) and **West group** (2, 5, 6, 7, 8), each with its own lucky directions.

### Lo Shu grid & planes

Every digit of the date of birth is placed into a fixed 3×3 grid. Repeated digits strengthen a trait; absent digits mark areas to develop. When a full row, column or diagonal is present, a **plane** (e.g. the Mind, Practical or Will plane) is formed — the site counts and names each one.

### Mobile Number numerology

Every digit of the phone number (formatting characters like `+`, spaces and dashes are ignored) is added together and reduced to a single root digit (1–9), then compared against the same traditional strength scale (`FAVOUR_PCT`) used for the favourability meter.

### Vehicle Number Plate numerology

The plate's **letters** are converted with the same Chaldean chart used for names, and its **digits** are summed at face value; the two sums are added together and reduced to a single root digit. This treats the plate as one combined vibration rather than only its numeric part.

### Personal Day / Month / Year numbers

A standard numerology "forecast" technique that layers short-term cycles on top of the lifelong Mulank/Bhagyank:

- **Personal Year** = digits of (birth day + birth month + current year), reduced to one digit.
- **Personal Month** = (Personal Year + current month), reduced to one digit.
- **Personal Day** = (Personal Month + current day), reduced to one digit.

---

## 📁 Project structure

```
namevibe/
├── index.html      # markup + content + SEO meta / JSON-LD
├── styles.css      # mobile-first responsive styling
├── script.js       # Chaldean engine, suggestions & i18n
├── logo.svg         # full logo (icon + "NameVibe" wordmark)
├── logo-icon.svg    # square icon mark (app / apple-touch icon)
├── favicon.svg      # simplified favicon (legible at 16–32px)
├── og-image.svg    # social share card (Open Graph / Twitter)
├── robots.txt      # allows all crawlers + points to the sitemap
├── sitemap.xml     # URL list with hreflang for search engines
├── .nojekyll       # tells GitHub Pages to serve files as-is
└── README.md
```

---

## 🚀 Run locally

No build step. Open `index.html` directly, or serve it:

```bash
# Python 3
python -m http.server 8000
# then open http://localhost:8000
```

---

## 🌐 Deploy to GitHub Pages

1. Create a repository and push these files to the `main` branch:

   ```bash
   git init
   git add .
   git commit -m "Chaldean Numerology calculator"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo>.git
   git push -u origin main
   ```

2. On GitHub: **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Select branch **`main`** and folder **`/ (root)`**, then **Save**.
5. Your site goes live at `https://<your-username>.github.io/<repo>/` within a minute or two.

> The included `.nojekyll` file ensures GitHub Pages serves the files without Jekyll processing.

---

## 🌍 Adding or editing translations

All UI strings and meanings live in `script.js`:

- `I18N` — interface labels for `en` / `hi` / `mr`.
- `NUMBER_MEANINGS` — the 1–9 interpretations per language.
- `PLANET_NAMES` — ruling-planet names per language.
- `CAREERS` — favourable career fields per root number, per language.
- `LUCKY` — days, numbers, colours, deity, gem/metal and direction per root number.
- `LUCKY_CITIES` — lucky world cities (career vs long-living) per root number.
- `LIFE_EVENTS` — turning-point ages and best events per root number, per language.
- `LOSHU_PLANES` — the plane names per language.
- `LOSHU_REMEDIES` — how to strengthen each missing Lo Shu number, per language.
- `LIFE_REMEDIES` — area-wise remedies (money, career, job, health, marriage, love) per root number, per language.
- `INDIAN_NAMES` — the pool of auspicious Hindu boy/girl names.
- `COMPOUND_MEANINGS_HI` / `COMPOUND_MEANINGS_MR` — Hindi/Marathi titles & text for the 10–52 compound-number table (the fortunate/caution flag is shared from the English `COMPOUND_MEANINGS`).
- `DIR_I18N` / `KUA_GROUP_I18N` / `CITY_I18N` — translate compass directions, the Kua East/West group label and lucky-city names for the Lucky Essentials and Kua panels.

To add a language, copy an existing block (e.g. `en`), translate the values, add a matching `PLANET_NAMES` entry, and add a `<button class="lang-btn" data-lang="xx">` in `index.html`.

---

## ⚠️ Disclaimer

Numerology is a belief system provided here for **entertainment and self-reflection**. Interpretations vary between practitioners and should not replace professional advice.

---

## 📜 License

Free to use and adapt. Attribution to **Amol Gadage** is appreciated.
