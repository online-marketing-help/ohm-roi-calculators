/* =========================================================================
   The calculator a business owner can actually use.

   Three questions, in the words they would use themselves:

     How many calls a month?   How many get missed?   What is a customer worth?

   Everything else has a sensible starting value and sits behind "Show the
   workings". The honest chain is still there, still editable, still sourced.
   It is just not the first thing a plumber is asked to understand.

   The sum underneath is unchanged:
     calls -> missed -> genuinely new business -> captured -> converted -> £
   ========================================================================= */

(function () {
  "use strict";

  const slug = window.OHM_INDUSTRY || "universal";
  const ind = INDUSTRIES[slug] || INDUSTRIES.universal;
  const $ = (s) => document.querySelector(s);
  const money = (n) => "£" + Math.round(n).toLocaleString("en-GB");
  const money2 = (n) =>
    "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const one = (w) => w.replace(/s$/, "");

  const state = Object.assign({}, ind.defaults, { mode: "overflow", plan: "auto" });

  /* Where the form goes. The page is static and public, so it cannot hold the
     Convex secret: this webhook is the only way in, and it writes the lead
     against the figures the visitor actually entered. */
  const LEAD_URL =
    "https://n8n.srv1836598.hstgr.cloud/webhook/ohm-roi-lead";

  let last = null;   /* the most recent result, sent with the form */

  /* ------------------------------------------------------------ the model */

  function model(v) {
    const missed = v.calls * (v.missedPct / 100);
    const newBiz = missed * (v.newPct / 100);
    const recovered = newBiz * (v.recoverPct / 100);
    const won = recovered * (v.convertPct / 100);
    const revenue = won * v.value;

    const handled = v.mode === "all" ? v.calls : missed;
    const minutes = handled * v.minutes;

    const auto = PLANS.find((p) => p.minutes >= minutes) || PLANS[PLANS.length - 1];
    const plan = v.plan === "auto" ? auto : PLANS.find((p) => p.id === v.plan);

    const over = Math.max(0, minutes - plan.minutes);
    const overCost = over * OVERAGE;
    const monthlyCost = plan.price + overCost;
    const net = revenue - monthlyCost;

    return {
      missed, newBiz, recovered, won, revenue, minutes, plan, over, overCost,
      monthlyCost, net,
      roi: monthlyCost > 0 ? revenue / monthlyCost : 0,
      payback: net > 0 ? plan.setup / net : Infinity,
      year1: net * 12 - plan.setup,
      breakeven: v.value > 0 ? monthlyCost / v.value : 0,
    };
  }

  /* --------------------------------------------------------- the 3 asks */
  /* Deliberately plain. No percentages in the main view: a count of calls is
     something an owner can picture, "48% miss rate" is not. */

  function buildMain() {
    const wrap = $("#asks");
    wrap.innerHTML = "";

    wrap.appendChild(ask({
      key: "calls",
      q: "How many phone calls do you get in a month?",
      hint: "A rough number is fine. Fifty a week is about 200 a month.",
      min: 20, max: 2000, step: 10,
      show: (v) => Math.round(v).toLocaleString("en-GB") + " calls",
    }));

    wrap.appendChild(ask({
      key: "missedPct",
      q: "How many of those does nobody answer?",
      hint: "Out of hours, engaged, everyone busy. Most owners guess low, so check your phone bill if you can.",
      min: 0, max: 90, step: 1,
      show: (v) => Math.round(state.calls * v / 100).toLocaleString("en-GB") + " calls a month",
      sourced: true,
    }));

    wrap.appendChild(ask({
      key: "value",
      q: ind.askValue,
      hint: ind.valueHint,
      min: (ind.valueRange || {}).min || 50,
      max: (ind.valueRange || {}).max || 10000,
      step: (ind.valueRange || {}).step || 50,
      show: (v) => money(v),
    }));
  }

  function ask(o) {
    const row = document.createElement("div");
    row.className = "ask";
    const id = "a-" + o.key;

    const q = document.createElement("label");
    q.className = "q";
    q.setAttribute("for", id);
    q.textContent = o.q;

    const out = document.createElement("div");
    out.className = "answer";
    out.id = "out-" + o.key;

    const input = document.createElement("input");
    input.type = "range";
    input.id = id;
    input.min = o.min; input.max = o.max; input.step = o.step;
    input.value = state[o.key];
    input.addEventListener("input", () => {
      state[o.key] = parseFloat(input.value);
      render();
    });

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = o.hint;

    row.append(q, out, input, hint);

    if (o.sourced) {
      const s = SOURCES[ind.missedSource];
      const p = document.createElement("p");
      p.className = "hint src " + s.grade;
      if (s.url) {
        p.append("We have started you at the figure reported by ");
        const a = document.createElement("a");
        a.href = s.url; a.target = "_blank"; a.rel = "noopener";
        a.textContent = s.label;
        p.appendChild(a);
        p.append(". Move it to what you know.");
      } else {
        p.append("Starting figure: " + s.label + ". Move it to what you know.");
      }
      row.appendChild(p);
    }

    row.dataset.key = o.key;
    ASK_FORMAT[o.key] = o.show;
    return row;
  }
  const ASK_FORMAT = {};

  /* ------------------------------------------------------- the workings */

  const DETAIL = [
    { k: "newPct", label: "Of the missed calls, how many are new business",
      min: 5, max: 100, step: 1, suffix: "%",
      help: "Your call log is not all customers. Suppliers, people you already work with, wrong numbers and sales calls are all in there." },
    { k: "recoverPct", label: "How many of those the agent handles well enough to capture",
      min: 10, max: 100, step: 1, suffix: "%",
      help: "Some callers will always want a person, and some ask for something the agent is not set up for." },
    { k: "convertPct", label: "How many captured enquiries become paying work",
      min: 1, max: 100, step: 1, suffix: "%",
      help: "Your own closing rate. The agent books them in; you still have to win them." },
    { k: "minutes", label: "Average length of a call", min: 1, max: 15, step: 0.5, suffix: " min",
      help: "Only used to size the plan, not the money." },
  ];

  function buildDetail() {
    const wrap = $("#detail-fields");
    wrap.innerHTML = "";
    DETAIL.forEach((f) => {
      const row = document.createElement("div");
      row.className = "field";
      row.dataset.k = f.k;
      row.dataset.suffix = f.suffix;

      const head = document.createElement("div");
      head.className = "field-head";
      const l = document.createElement("label");
      l.setAttribute("for", "d-" + f.k);
      l.textContent = f.label;
      const o = document.createElement("output");
      head.append(l, o);

      const i = document.createElement("input");
      i.type = "range"; i.id = "d-" + f.k;
      i.min = f.min; i.max = f.max; i.step = f.step; i.value = state[f.k];
      i.addEventListener("input", () => { state[f.k] = parseFloat(i.value); render(); });

      const h = document.createElement("p");
      h.className = "hint";
      h.textContent = f.help;

      row.append(head, i, h);
      wrap.appendChild(row);
    });
  }

  /* --------------------------------------------------------------- render */

  function render() {
    const r = model(state);
    last = r;

    Object.keys(ASK_FORMAT).forEach((k) => {
      const el = document.getElementById("out-" + k);
      if (el) el.textContent = ASK_FORMAT[k](state[k]);
    });

    document.querySelectorAll("#detail-fields .field").forEach((row) => {
      const k = row.dataset.k;
      row.querySelector("output").textContent =
        (k === "minutes" ? state[k].toFixed(1) : Math.round(state[k])) + row.dataset.suffix;
    });

    /* The one sentence that matters. */
    $("#verdict").innerHTML = "";
    if (r.net > 0) {
      $("#verdict").innerHTML =
        "You would be <b>" + money(r.net) + " a month</b> better off.";
      $("#verdict").className = "verdict good";
    } else {
      $("#verdict").innerHTML =
        "At these numbers it would <b>cost you " + money(Math.abs(r.net)) +
        " a month</b>. Worth a conversation rather than a sale.";
      $("#verdict").className = "verdict bad";
    }

    $("#lost").textContent = money(r.revenue);
    $("#lostsub").textContent =
      "about " + Math.round(r.won).toLocaleString("en-GB") + " " +
      (Math.round(r.won) === 1 ? one(ind.unit) : ind.unit) + " a month";

    $("#price").textContent = money(r.monthlyCost);
    $("#pricesub").textContent = r.over > 0
      ? r.plan.name + " plus " + money2(r.overCost) + " of extra minutes"
      : r.plan.name + " plan, " + money(r.plan.setup) + " to set up";

    $("#payback").textContent =
      r.payback === Infinity ? "not at these numbers"
        : r.payback < 1 ? "under a month" : r.payback.toFixed(1) + " months";
    $("#year1").textContent = (r.year1 < 0 ? "-" : "") + money(Math.abs(r.year1));
    $("#year1").className = r.year1 > 0 ? "good" : "bad";
    $("#breakeven").textContent = r.breakeven < 1.05
      ? "1 " + one(ind.unit) + " a month"
      : r.breakeven.toFixed(1) + " " + ind.unit + " a month";

    /* workings */
    $("#chain").innerHTML = "";
    [
      [Math.round(state.calls), "calls a month"],
      [Math.round(r.missed), "nobody answers"],
      [Math.round(r.newBiz), "of those are new business"],
      [Math.round(r.recovered), "the agent captures"],
      [Math.round(r.won), ind.unit + " won, at " + money(state.value) + " each"],
    ].forEach(([n, t]) => {
      const li = document.createElement("li");
      li.innerHTML = "<b>" + n.toLocaleString("en-GB") + "</b> " + t;
      $("#chain").appendChild(li);
    });

    $("#plan-name").textContent = r.plan.name;
    $("#plan-line").textContent =
      money(r.plan.price) + " a month, " + r.plan.minutes.toLocaleString("en-GB") +
      " minutes, " + money(r.plan.setup) + " setup, live in " + r.plan.delivery + ".";
    $("#plan-blurb").textContent = r.plan.blurb;
    const bar = $("#minbar");
    bar.style.width = Math.min(100, (r.minutes / r.plan.minutes) * 100) + "%";
    bar.className = r.over > 0 ? "over" : "";
    $("#minutes").textContent = Math.round(r.minutes).toLocaleString("en-GB");
    $("#over").textContent = r.over > 0
      ? Math.round(r.over).toLocaleString("en-GB") + " over, at " + Math.round(OVERAGE * 100) + "p a minute"
      : Math.round(r.plan.minutes - r.minutes).toLocaleString("en-GB") + " spare";
    $("#mode-note").textContent = state.mode === "all"
      ? "Sized for answering every call that comes in."
      : "Sized for picking up only what your team misses.";
  }

  /* ----------------------------------------------------------------- boot */

  function boot() {
    $("#headline").textContent = ind.headline;
    $("#lede").textContent = ind.lede;

    const toggle = $("#show-workings");
    const panel = $("#workings");
    toggle.addEventListener("click", () => {
      const open = panel.hasAttribute("hidden");
      if (open) panel.removeAttribute("hidden"); else panel.setAttribute("hidden", "");
      toggle.textContent = open ? "Hide the workings" : "Show me how you worked that out";
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.querySelectorAll("[data-mode]").forEach((b) => {
      b.addEventListener("click", () => {
        state.mode = b.dataset.mode;
        document.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("on", x === b));
        render();
      });
    });

    const planSel = $("#planpick");
    [{ id: "auto", name: "Let the calculator choose" }].concat(PLANS).forEach((p) => {
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
      buildMain(); buildDetail(); render();
    });

    wireForm();

    const notes = $("#notes");
    ind.notes.forEach((n) => {
      const li = document.createElement("li");
      li.textContent = n;
      notes.appendChild(li);
    });

    buildMain();
    buildDetail();
    render();
  }

  /* ----------------------------------------------------------- lead form */
  /* The headline answer is never gated. This asks only once the visitor has
     seen what they came for, and it offers something real in return: the
     figures written up, and a same-day reply. */

  function wireForm() {
    const form = $("#lead-form");
    if (!form) return;
    const note = $("#lead-note");
    const btn = $("#lead-submit");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());

      if (!String(d.name || "").trim()) return bad("Please tell us your name.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email || "").trim()))
        return bad("That email address does not look right.");

      btn.disabled = true;
      note.className = "formnote";
      note.textContent = "Sending\u2026";

      fetch(LEAD_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: d.name, email: d.email, phone: d.phone, company: d.company,
          industry: ind.name,
          unit: one(ind.unit),
          calls: state.calls,
          missed: Math.round(state.calls * state.missedPct / 100),
          value: state.value,
          recovered: last ? Math.round(last.revenue) : 0,
          cost: last ? Math.round(last.monthlyCost) : 0,
          net: last ? Math.round(last.net) : 0,
          plan: last ? last.plan.name : "",
          page_url: location.href,
        }),
      })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then(function () {
          form.innerHTML = "";
          note.className = "formnote good";
          note.textContent =
            "Thank you. Your breakdown is on its way and somebody will come back " +
            "to you today. If it is urgent, ring 020 3489 3934.";
          form.appendChild(note);
        })
        .catch(function () {
          btn.disabled = false;
          bad("Sorry, that did not go through. Please ring 020 3489 3934 or " +
              "email support@onlinemarketinghelp.co.uk and we will sort it.");
        });

      function bad(msg) {
        note.className = "formnote bad";
        note.textContent = msg;
        btn.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
