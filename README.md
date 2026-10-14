# AI voice agent ROI calculators

Written for the web developer putting these on onlinemarketinghelp.co.uk.

Nine calculators. One universal, and eight for the trades we sell into. They work
out what a business's missed calls are worth, then set that against the real
price of our AI voice agent plans.

Plain HTML, CSS and JavaScript. No build step, no framework, no dependencies.

---

## The pages

| File | For |
|---|---|
| `index.html` | The chooser. Nine tiles, one per trade. |
| `any-business.html` | Any business. The general one. |
| `real-estate.html` | Estate and letting agents |
| `dental.html` | Dental practices |
| `clinics.html` | Private clinics and healthcare |
| `plumbers.html` | Plumbers and emergency trades |
| `hvac.html` | Heating and HVAC |
| `contractors.html` | Contractors and home improvement |
| `law-firms.html` | Law firms |
| `car-dealerships.html` | Car dealerships |

`index.html` is a list of tiles, not a dropdown: each calculator is its own page
with its own URL, so you can link the dental service page straight to the dental
calculator.

## What a visitor sees

Three questions in plain English: how many calls a month, how many go
unanswered, and what one customer is worth. Then one sentence with the answer.

The answer is never hidden behind a form. The email form sits underneath it and
offers something extra: the figures written up, and a reply the same working day.
That is the pattern the research supports, and the one it warns against is
putting the result behind the form, where people can tell the gate is bait.

Everything else, the full chain, the assumptions, the sources, the plan sizing,
is folded behind **Show me how you worked that out**. It is all still there and
still editable, it just is not the first thing an owner is asked to understand.

## Where the leads go

The form posts to `https://n8n.srv1836598.hstgr.cloud/webhook/ohm-roi-lead`,
which writes the enquiry into the same lead table the website assistant uses,
marked hot, with the figures the visitor entered. The team is emailed on the
next pass of the notify workflow, usually within five minutes. Speed matters
here: a lead answered within the hour is far likelier to qualify, so do not let
these sit.

The page holds no credentials. The webhook only accepts the OMH domains, so the
calculator cannot be lifted onto someone else's site.

---

## Putting them on the site

Upload the whole folder and link to it. The pages expect `assets/` to sit beside
them, so keep the structure as it is:

```
/roi-calculator/
  index.html
  dental.html
  ... the rest
  assets/style.css
  assets/data.js
  assets/calc.js
```

Then link each service page to its matching calculator, for example the dental
voice agent page to `/roi-calculator/dental.html`.

### Putting one inside an existing page instead

Use an iframe. Each page is self contained:

```html
<iframe src="/roi-calculator/dental.html" title="ROI calculator"
        style="width:100%;height:1400px;border:0"></iframe>
```

The layout is responsive, so give it room on mobile or let it scroll.

---

## Changing the numbers

Everything editable lives in **`assets/data.js`**. Nothing else needs touching.

**Our prices** are at the top, in `PLANS`, plus `OVERAGE`. These come from the
price breakdown agreed with the MD:

| Plan | Monthly | Minutes | Setup | Delivery |
|---|---|---|---|---|
| Starter | £249 | 300 | £795 | 3 working days |
| Growth | £449 | 500 | £1,295 | 5 to 7 working days |
| Scale | £849 | 900 | £1,995 | 12 to 15 working days |

Minutes past the allowance are 60p a minute on every plan. Scale covers up to 3
locations; further sites are £495 setup and £49 a month each. All figures
exclude VAT.

**If the pricing changes, change it in `PLANS` and every calculator updates.**
Do not edit the HTML files; they are generated.

**Industry starting figures** are in `INDUSTRIES`, one block per trade, with the
defaults, the slider ranges and the notes shown at the bottom of the page.

After editing `data.js`, regenerate the pages only if you changed the industry
list itself:

```
python3 build.py
```

---

## How the sum works, and why it is longer than usual

Most calculators in this market do `missed calls x job value` and call the
result lost revenue. That is wrong twice over: it assumes every unanswered call
was a customer, and that an agent would have won all of them.

This one makes every step visible and editable:

```
calls a month
  -> share nobody answers
  -> of those, the share that is genuinely new business
  -> the share the agent captures
  -> the share that converts to a customer
  -> x the value of a customer
```

The third step is the one usually left out. A real call log is full of
suppliers, existing customers chasing, wrong numbers and spam.

Cost is the plan fee plus any overage, and the setup fee is shown separately and
subtracted from the first twelve months. The calculator will show a loss if the
inputs justify one; it is not built only to sell.

There are two modes. **Only what you miss** sizes the minutes on the overflow,
which is how most clients start. **Every call** sizes them on the whole
switchboard.

---

## About the figures

The starting numbers are labelled by how much they can be trusted:

- **study**: a named study with a stated sample. Invoca's 2026 home services
  benchmark, Peerlogic's study of 4,280 calls across 26 dental practices,
  Homeshare's research on estate agents, Clio's mystery shop of law firms.
- **supplier figure**: a company in this market published it without a method.
  Useful as a prompt, not as evidence.
- **our assumption**: ours, deliberately cautious, and said so on the page.

We looked for independent UK research on missed calls and mostly found vendor
marketing repeating each other, including a widely quoted "£30 billion a year"
and a BT figure of £3.7 billion that disagree by a factor of eight. Neither is
used here. Where we could not trace a study, the page says so.

This matters beyond honesty: under the CAP Code, a claim in marketing has to be
substantiated. A figure the client cannot evidence should not be on their site
as fact, which is why the sourcing is on the page rather than buried.

---

## Testing

```
node test/verify.mjs
```

Loads all nine pages in a real browser and checks the arithmetic against a
second implementation written independently in the test, so the page cannot mark
its own work. It also checks that the plan prices match the agreed sheet, that a
poor case comes out negative, that overage is charged at 60p, and that the
source labels are right. 31 checks, all passing.

Needs Playwright: `npm i -D playwright && npx playwright install chromium`.

---

Online Marketing Help, The Hut, Central Ave, Hullbridge, Hockley SS5 6AU.
020 3489 3934, support@onlinemarketinghelp.co.uk
