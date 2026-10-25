#!/usr/bin/env python3
"""
Writes the index and the nine calculator pages from one template.

    python3 build.py

index.html is a chooser: nine cards, one per trade, no dropdown. Each trade gets
its own page so it can be linked straight from the matching service page.
They share assets/, so the maths and the pricing exist in one place.
"""
import pathlib
import re

HERE = pathlib.Path(__file__).parent

# The industry list is read out of the data the pages themselves use, so the
# two can never drift apart.
data = (HERE / "assets" / "data.js").read_text()
order = re.search(r"const INDUSTRY_ORDER = \[(.*?)\];", data, re.S).group(1)
SLUGS = re.findall(r'"([a-z-]+)"', order)
NAMES = dict(re.findall(r'slug: "([a-z-]+)",\s*\n\s*name: "([^"]+)"', data))
LEDES = dict(re.findall(r'slug: "([a-z-]+)",(?:.|\n)*?lede:\s*\n?\s*"([^"]+)"', data))

FILE = {s: ("any-business.html" if s == "universal" else f"{s}.html") for s in SLUGS}

FOOTER = """  <footer>
    <strong>Online Marketing Help</strong> &middot; The Hut, Central Ave, Hullbridge,
    Hockley SS5 6AU &middot; 020 3489 3934 &middot;
    <a href="mailto:support@onlinemarketinghelp.co.uk">support@onlinemarketinghelp.co.uk</a>
    <br>
    Prices are the current AI voice agent plans and exclude VAT. This is an
    estimate built from the figures you enter. It is not a quotation and not a
    promise of results.
  </footer>"""

PAGE = """<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="wrap">

  <p class="back"><a href="index.html">All calculators</a></p>

  <header class="hero">
    <span class="badge">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
           stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h2m3 0h3M8 16h2m3 0h3"/>
      </svg>
      ROI calculator
    </span>
    <h1 id="headline"></h1>
    <p class="lede" id="lede"></p>
  </header>

  <div class="panel">
    <div class="panel-in">

      <div class="col-controls">
        <div id="asks"></div>

        <div class="planpick">
          <span class="pp-label">Choose a plan</span>
          <div class="segments" id="segments" role="group" aria-label="Choose a plan"></div>
          <p class="pp-note" id="plan-note"></p>
        </div>
      </div>

      <div class="col-results">
        <div class="hero-fig">
          <span class="cap">Better off, every month</span>
          <b id="verdict-num"></b>
          <em id="verdict-sum"></em>
        </div>

        <div class="two">
          <div class="stat">
            <span class="cap">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                   stroke-width="1.9" stroke-linecap="round"><path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Work you are missing
            </span>
            <b id="lost"></b>
            <em id="lostsub"></em>
          </div>
          <div class="stat">
            <span class="cap">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                   stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              Calls answered a year
            </span>
            <b id="answered"></b>
            <em id="answeredsub"></em>
          </div>
        </div>

        <div class="highlight">
          <div>
            <span class="cap" id="minimum-cap"></span>
            <b id="minimum-roi"></b>
          </div>
          <div class="right">
            <span class="cap">Monthly cost</span>
            <b id="price"></b>
            <em id="pricesub"></em>
          </div>
        </div>

        <div class="lines">
          <div class="line"><span>Setup fee paid back in</span><b id="payback"></b></div>
          <div class="line"><span>First year, after the setup fee</span><b id="year1"></b></div>
        </div>
      </div>

    </div>
  </div>

  <section class="card capture" id="capture">
    <h2>Want these figures checked against your own numbers?</h2>
    <p class="hint" style="font-size:15px;margin-bottom:4px">
      This is an estimate built from what you typed. We will go through it with
      you properly, with what the agent would say on your calls, and tell you
      plainly if it is not worth it for you.
    </p>
    <p class="or">
      <a class="cta" href="https://onlinemarketinghelp.co.uk/omh-free-consultation">Book a free 30 minute consultation</a>
    </p>
  </section>

  <p class="middle">
    <button type="button" id="show-workings" class="btn" aria-expanded="false" aria-controls="workings">
      Show me how you worked that out
    </button>
  </p>

  <div id="workings" hidden>
    <div class="grid">
      <section class="card">
        <h2>The sum, step by step</h2>
        <ul id="chain"></ul>
        <p class="hint">
          Most calculators multiply missed calls by job value and stop there. That
          assumes every unanswered call was a customer and that we would win all
          of them. Neither is true, so the steps in between are here and you can
          move every one.
        </p>
        <div id="detail-fields" style="margin-top:18px"></div>
      </section>

      <section class="card">
        <h2>The plan that fits</h2>

        <div class="modes" role="group" aria-label="What the agent answers">
          <button type="button" data-mode="overflow" class="on">Only what you miss</button>
          <button type="button" data-mode="all">Every call</button>
        </div>
        <p class="hint" id="mode-note"></p>

        <div class="planbox">
          <h3 id="plan-name"></h3>
          <div class="price" id="plan-line"></div>
          <p class="blurb" id="plan-blurb"></p>
          <div class="meter"><i id="minbar"></i></div>
          <div class="mins"><span><b id="minutes"></b> minutes used</span><span id="over"></span></div>
        </div>

        <h2 style="margin-top:26px">Where the starting figures come from</h2>
        <ul id="notes"></ul>
        <p class="hint">
          Figures we could trace to a named study are marked as such. The rest are
          either a supplier's own number or our own cautious guess, and both say
          so. Your own call records beat all of them.
        </p>

        <p style="margin-top:18px">
          <button type="button" class="btn" id="reset">Put the starting figures back</button>
        </p>
      </section>
    </div>
  </div>

{footer}

</div>

<script>window.OHM_INDUSTRY = "{slug}";</script>
<script src="assets/data.js"></script>
<script src="assets/calc.js"></script>
</body>
</html>
"""

INDEX = """<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>What are your missed calls costing you? | Online Marketing Help</title>
<meta name="description" content="Work out what the calls you miss are worth, and what an AI voice agent would return against its real price. Nine calculators, one for each trade.">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="wrap">

  <header class="top">
    <h1>What are the calls you miss actually costing you?</h1>
    <p class="lede">
      Three questions and you have the number. Pick the one that matches your
      trade, or use the general one.
    </p>
  </header>

  <div class="cards">
{cards}
  </div>

  <section class="card" style="margin-top:22px">
    <h2>How these work</h2>
    <p class="hint" style="font-size:15px">
      Most calculators in this market multiply your missed calls by the value of
      a job and call the answer lost revenue. That is wrong twice over: it
      assumes every unanswered call was a customer, and that an agent would have
      won all of them. These ask you three things, make a cautious assumption
      about the rest, and show you every step if you want to see it. They will
      tell you when the numbers do not justify it.
    </p>
  </section>

{footer}

</div>
</body>
</html>
"""

CARD = """    <a class="tile" href="{file}">
      <b>{name}</b>
      <span>{lede}</span>
    </a>"""

cards = "\n".join(
    CARD.format(file=FILE[s], name=NAMES.get(s, s),
                lede=LEDES.get(s, "").split(". ")[0].rstrip(".") + ".")
    for s in SLUGS
)

written = []
for slug in SLUGS:
    name = NAMES.get(slug, slug)
    title = (f"{name}: what are your missed calls costing? | Online Marketing Help")
    desc = (f"Work out what the calls you miss are worth to {name.lower()}, "
            "and what an AI voice agent would return against its real price.")
    out = HERE / FILE[slug]
    out.write_text(PAGE.format(title=title, desc=desc, slug=slug, footer=FOOTER))
    written.append(out.name)

(HERE / "index.html").write_text(INDEX.format(cards=cards, footer=FOOTER))
written.insert(0, "index.html")

print(f"  {len(written)} pages written:")
for w in written:
    print("    " + w)
