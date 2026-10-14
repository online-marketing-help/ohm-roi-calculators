#!/usr/bin/env python3
"""
Writes the nine calculator pages from one template.

    python3 build.py

index.html is the universal one, and each industry gets its own file so the
developer can link straight to the page that matches the service page it sits
beside. They share assets/, so a change to the maths lands on all nine at once
and there is only ever one copy to fix.
"""
import pathlib
import re

HERE = pathlib.Path(__file__).parent

# Read the industry list straight out of the data the pages themselves use, so
# the two can never drift apart.
data = (HERE / "assets" / "data.js").read_text()
order = re.search(r"const INDUSTRY_ORDER = \[(.*?)\];", data, re.S).group(1)
SLUGS = re.findall(r'"([a-z-]+)"', order)
NAMES = dict(re.findall(r'slug: "([a-z-]+)",\s*\n\s*name: "([^"]+)"', data))

TEMPLATE = """<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="Work out what the calls you miss are costing, and what an AI voice agent from Online Marketing Help would return against its real price.">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="wrap">

  <header class="top">
    <div>
      <h1 id="headline"></h1>
      <p class="lede" id="lede"></p>
    </div>
    <label class="pick">
      Your trade
      <select id="industry" aria-label="Choose your trade"></select>
    </label>
  </header>

  <div class="grid">

    <section class="card">
      <h2>Your numbers</h2>

      <div class="modes" role="group" aria-label="What the agent answers">
        <button type="button" data-mode="overflow" class="on">Only what you miss</button>
        <button type="button" data-mode="all">Every call</button>
      </div>
      <p class="help" id="mode-note"></p>

      <div id="controls"></div>

      <label class="pick" style="margin-top:4px">
        Plan
        <select id="planpick" aria-label="Choose a plan"></select>
      </label>

      <p style="margin-top:18px">
        <button type="button" class="btn" id="reset">Put the starting figures back</button>
      </p>
    </section>

    <section class="card">
      <h2>What that comes to</h2>

      <ul id="chain"></ul>

      <div class="figures">
        <div class="fig"><span>Recovered a month</span><b id="revenue"></b></div>
        <div class="fig"><span>What it costs</span><b id="cost"></b></div>
      </div>

      <div class="fig" style="margin-bottom:16px">
        <span>Left over, every month</span><b class="big" id="net"></b>
      </div>

      <div class="line"><span>Return on the monthly fee</span><b id="roi"></b></div>
      <div class="line"><span>Setup paid back in</span><b id="payback"></b></div>
      <div class="line"><span>First twelve months, after setup</span><b id="year1"></b></div>
      <hr class="rule">
      <div class="line"><span>It washes its face at</span><b id="breakeven"></b></div>

      <div class="planbox">
        <h3 id="plan-name"></h3>
        <div class="price" id="plan-price"></div>
        <div class="meta"><span id="plan-mins"></span> &middot; <span id="plan-setup"></span></div>
        <p class="blurb" id="plan-blurb"></p>
        <div class="meter"><i id="minbar"></i></div>
        <div class="mins"><span><b id="minutes"></b> minutes used</span><span id="over"></span></div>
      </div>
    </section>
  </div>

  <div class="card notes" style="margin-top:18px">
    <h2>Where these figures come from</h2>
    <ul id="notes"></ul>
    <p class="help">
      Treat every starting figure as a placeholder. The ones we could trace to a
      named study are marked as such; the rest are either a supplier's own number
      or our own cautious guess, and both are labelled honestly. Your call
      records beat all of them, and this is built to be overwritten with them.
    </p>
    <a class="cta" href="https://onlinemarketinghelp.co.uk/omh-free-consultation">Book a free 30 minute consultation</a>
  </div>

  <footer>
    <strong>Online Marketing Help</strong> &middot; The Hut, Central Ave, Hullbridge,
    Hockley SS5 6AU &middot; 020 3489 3934 &middot;
    <a href="mailto:support@onlinemarketinghelp.co.uk">support@onlinemarketinghelp.co.uk</a>
    <br>
    Prices shown are the current AI voice agent plans and are exclusive of VAT.
    This tool is an estimate built from figures you supply; it is not a quotation
    and not a guarantee of results.
  </footer>

</div>

<script>window.OHM_INDUSTRY = "{slug}";</script>
<script src="assets/data.js"></script>
<script src="assets/calc.js"></script>
</body>
</html>
"""

written = []
for slug in SLUGS:
    name = NAMES.get(slug, slug)
    title = ("ROI calculator | Online Marketing Help" if slug == "universal"
             else f"{name} ROI calculator | Online Marketing Help")
    out = HERE / ("index.html" if slug == "universal" else f"{slug}.html")
    out.write_text(TEMPLATE.format(title=title, slug=slug))
    written.append(out.name)

print(f"  {len(written)} pages written:")
for w in written:
    print("    " + w)
