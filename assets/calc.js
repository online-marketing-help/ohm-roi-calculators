/* =========================================================================
   The maths and the interface.

   The chain is deliberately longer than the usual "missed calls x job value"
   sum, because that sum is wrong. It treats every unanswered call as a lost
   sale, when a real call log is full of suppliers, existing customers and
   wrong numbers, and it assumes an agent converts every one of them.

   Here the chain is:

     calls -> missed -> genuinely new -> recovered by the agent
           -> converted to a customer -> revenue

   Every step is on screen and every step can be edited. A business owner who
   thinks a number is generous can pull it down and watch the answer change,
   which is the only version of this they should trust.
   ========================================================================= */

(function () {
  "use strict";

  const slug = window.OHM_INDUSTRY || "universal";
  const ind = INDUSTRIES[slug] || INDUSTRIES.universal;
  const $ = (s) => document.querySelector(s);

  const money = (n) =>
    "£" + Math.round(n).toLocaleString("en-GB");
  const money2 = (n) =>
    "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ------------------------------------------------------------ the model */

  function model(v) {
    const missed = v.calls * (v.missedPct / 100);
    const newBiz = missed * (v.newPct / 100);
    const recovered = newBiz * (v.recoverPct / 100);
    const won = recovered * (v.convertPct / 100);
    const revenue = won * v.value;

    /* Minutes. "all" means the agent is the front door and answers everything.
       "overflow" means it only picks up what your team does not: after hours,
       engaged, nobody free. The second is far cheaper and is how most start. */
    const handled = v.mode === "all" ? v.calls : missed;
    const minutes = handled * v.minutes;

    /* The cheapest plan that covers those minutes, unless one is pinned. */
    const auto = PLANS.find((p) => p.minutes >= minutes) || PLANS[PLANS.length - 1];
    const plan = v.plan === "auto" ? auto : PLANS.find((p) => p.id === v.plan);

    const over = Math.max(0, minutes - plan.minutes);
    const overCost = over * OVERAGE;
    const monthlyCost = plan.price + overCost;

    const net = revenue - monthlyCost;
    const roi = monthlyCost > 0 ? revenue / monthlyCost : 0;
    const payback = net > 0 ? plan.setup / net : Infinity;
    const year1 = net * 12 - plan.setup;

    return {
      missed, newBiz, recovered, won, revenue, minutes, handled,
      plan, auto, over, overCost, monthlyCost, net, roi, payback, year1,
      breakeven: v.value > 0 ? monthlyCost / v.value : 0,
    };
  }

  /* ------------------------------------------------------------- controls */

  const FIELDS = [
    { k: "calls", label: "Inbound calls a month", min: 20, max: 3000, step: 10, suffix: "" },
    { k: "missedPct", label: "Share nobody answers", min: 0, max: 90, step: 1, suffix: "%", src: "missed" },
    { k: "newPct", label: "Of those, genuinely new business", min: 5, max: 100, step: 1, suffix: "%",
      help: "Not every missed call is a customer. Suppliers, existing clients chasing, wrong numbers and spam all sit in your call log." },
    { k: "recoverPct", label: "The agent captures the enquiry", min: 10, max: 100, step: 1, suffix: "%",
      help: "Some callers will always want a person, and some ask for something the agent is not set up to handle." },
    { k: "convertPct", label: "Captured enquiry becomes a customer", min: 1, max: 100, step: 1, suffix: "%" },
    { k: "minutes", label: "Average call length", min: 1, max: 15, step: 0.5, suffix: " min" },
  ];

  const state = Object.assign({}, ind.defaults, { mode: "overflow", plan: "auto" });

  function buildControls() {
    const wrap = $("#controls");
    wrap.innerHTML = "";

    /* value first: it is the number that moves the answer most */
    /* The value slider gets a range that suits the trade. A single 50 to 25,000
       scale left the most important control pinned to the far left for anyone
       whose job is worth a few hundred pounds, which made it useless. */
    const vr = ind.valueRange || { min: 50, max: 25000, step: 50 };
    wrap.appendChild(field({
      k: "value", label: ind.valueLabel,
      min: vr.min, max: vr.max, step: vr.step,
      prefix: "£", help: ind.valueHint,
    }));

    FIELDS.forEach((f) => wrap.appendChild(field(f)));
  }

  function field(f) {
    const row = document.createElement("div");
    row.className = "field";
    const id = "f-" + f.k;

    const head = document.createElement("div");
    head.className = "field-head";
    const lab = document.createElement("label");
    lab.setAttribute("for", id);
    lab.textContent = f.label;
    const out = document.createElement("output");
    out.id = "out-" + f.k;
    head.append(lab, out);

    const input = document.createElement("input");
    input.type = "range";
    input.id = id;
    input.min = f.min; input.max = f.max; input.step = f.step;
    input.value = state[f.k];
    input.addEventListener("input", () => {
      state[f.k] = parseFloat(input.value);
      render();
    });

    row.append(head, input);

    if (f.help) {
      const p = document.createElement("p");
      p.className = "help";
      p.textContent = f.help;
      row.appendChild(p);
    }
    if (f.src === "missed") {
      const s = SOURCES[ind.missedSource];
      const p = document.createElement("p");
      p.className = "help src " + s.grade;
      const tag = document.createElement("span");
      tag.className = "grade";
      tag.textContent = s.grade === "study" ? "study" : s.grade === "vendor" ? "supplier figure" : "our assumption";
      p.appendChild(tag);
      if (s.url) {
        const a = document.createElement("a");
        a.href = s.url; a.target = "_blank"; a.rel = "noopener";
        a.textContent = s.label;
        p.append(" ", a);
      } else {
        p.append(" " + s.label);
      }
      p.append(". " + s.note);
      row.appendChild(p);
    }

    row.dataset.k = f.k;
    row.dataset.prefix = f.prefix || "";
    row.dataset.suffix = f.suffix || "";
    return row;
  }

  /* --------------------------------------------------------------- render */

  function render() {
    const r = model(state);

    /* control read-outs */
    document.querySelectorAll(".field").forEach((row) => {
      const k = row.dataset.k;
      const out = row.querySelector("output");
      const v = state[k];
      out.textContent =
        row.dataset.prefix + (k === "minutes" ? v.toFixed(1) : Math.round(v).toLocaleString("en-GB")) +
        row.dataset.suffix;
    });

    /* the chain, shown so the result cannot look like magic */
    $("#chain").innerHTML = "";
    [
      [Math.round(r.missed), "calls a month nobody answers"],
      [Math.round(r.newBiz), "of them are new business"],
      [Math.round(r.recovered), "the agent captures"],
      [Math.round(r.won), ind.unit + " won"],
    ].forEach(([n, t], i) => {
      const li = document.createElement("li");
      li.innerHTML = '<b>' + n.toLocaleString("en-GB") + "</b> " + t;
      if (i) li.classList.add("sub");
      $("#chain").appendChild(li);
    });

    /* headline */
    $("#revenue").textContent = money(r.revenue);
    $("#cost").textContent = money(r.monthlyCost);
    $("#net").textContent = (r.net < 0 ? "-" : "") + money(Math.abs(r.net));
    $("#net").className = "big " + (r.net > 0 ? "good" : "bad");
    $("#roi").textContent = r.roi >= 1 ? r.roi.toFixed(1) + "x" : r.roi.toFixed(2) + "x";

    $("#year1").textContent = (r.year1 < 0 ? "-" : "") + money(Math.abs(r.year1));
    $("#year1").className = r.year1 > 0 ? "good" : "bad";
    $("#payback").textContent =
      r.payback === Infinity ? "never at these numbers"
        : r.payback < 1 ? "under a month"
        : r.payback.toFixed(1) + " months";

    /* plan */
    $("#plan-name").textContent = r.plan.name;
    $("#plan-price").textContent = money(r.plan.price) + " a month";
    $("#plan-mins").textContent = r.plan.minutes.toLocaleString("en-GB") + " minutes included";
    $("#plan-setup").textContent = money(r.plan.setup) + " setup, " + r.plan.delivery;
    $("#plan-blurb").textContent = r.plan.blurb;

    const used = Math.round(r.minutes);
    $("#minutes").textContent = used.toLocaleString("en-GB");
    const bar = $("#minbar");
    bar.style.width = Math.min(100, (r.minutes / r.plan.minutes) * 100) + "%";
    bar.className = r.over > 0 ? "over" : "";
    $("#over").textContent = r.over > 0
      ? Math.round(r.over).toLocaleString("en-GB") + " minutes over, " +
        money2(r.overCost) + " a month at " + Math.round(OVERAGE * 100) + "p"
      : Math.round(r.plan.minutes - r.minutes).toLocaleString("en-GB") + " minutes spare";

    /* the honest line: how little has to work for it to wash its face */
    $("#breakeven").textContent = r.breakeven < 0.1
      ? "under a tenth of one " + ind.unit.replace(/s$/, "")
      : r.breakeven.toFixed(1) + " " + (r.breakeven < 1.05 ? ind.unit.replace(/s$/, "") : ind.unit);

    $("#mode-note").textContent = state.mode === "all"
      ? "Answering every call, so the minutes cover your whole switchboard."
      : "Only picking up what your team misses, so the minutes cover the overflow.";
  }

  /* ----------------------------------------------------------------- boot */

  function boot() {
    $("#headline").textContent = ind.headline;
    $("#lede").textContent = ind.lede;
    document.title = ind.name + " ROI calculator | Online Marketing Help";

    /* industry switcher */
    const sel = $("#industry");
    INDUSTRY_ORDER.forEach((k) => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = INDUSTRIES[k].name;
      if (k === slug) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => {
      const to = sel.value;
      location.href = to === "universal" ? "index.html" : to + ".html";
    });

    /* mode + plan pickers */
    document.querySelectorAll("[data-mode]").forEach((b) => {
      b.addEventListener("click", () => {
        state.mode = b.dataset.mode;
        document.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("on", x === b));
        render();
      });
    });
    const planSel = $("#planpick");
    [{ id: "auto", name: "Pick it for me" }].concat(PLANS).forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id; o.textContent = p.name;
      planSel.appendChild(o);
    });
    planSel.addEventListener("change", () => { state.plan = planSel.value; render(); });

    $("#reset").addEventListener("click", () => {
      Object.assign(state, ind.defaults, { mode: "overflow", plan: "auto" });
      planSel.value = "auto";
      document.querySelectorAll("[data-mode]").forEach((x) =>
        x.classList.toggle("on", x.dataset.mode === "overflow"));
      buildControls();
      render();
    });

    /* notes and sources */
    const notes = $("#notes");
    ind.notes.forEach((n) => {
      const li = document.createElement("li");
      li.textContent = n;
      notes.appendChild(li);
    });

    buildControls();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
