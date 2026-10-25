#!/usr/bin/env node
/**
 * Checks every page in a real browser, and checks the arithmetic against a
 * second implementation written here from the stated rules. If the page and
 * this file disagree, one of them is wrong and the suite says so rather than
 * trusting the page to mark its own work.
 *
 *   node test/verify.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const file = path.join(ROOT, url === "/" ? "index.html" : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("no");
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "text/plain" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const PORT = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const num = (s) => parseFloat(String(s).replace(/[^0-9.-]/g, "")) || 0;
/* Pulls the first money figure out of a sentence. "£795 setup, 3 working days"
   must read as 795, not as 7953. */
const gbp = (s) => {
  const m = String(s).match(/£\s?([\d,]+(?:\.\d+)?)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
};

const PAGES = ["any-business.html", "real-estate.html", "dental.html", "clinics.html",
  "plumbers.html", "hvac.html", "contractors.html", "law-firms.html", "car-dealerships.html"];

console.log("\n0. THE CHOOSER\n");
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "networkidle" });
const tiles = await page.locator(".tile").count();
check("index lists every calculator as its own link", tiles === PAGES.length, `${tiles} tiles`);
check("no dropdown anywhere on it", (await page.locator("select").count()) === 0);
await page.locator(".tile").nth(2).click();
await page.waitForLoadState("networkidle");
check("a tile opens its own page", /\.html/.test(page.url()) && !/index/.test(page.url()), page.url());

console.log("\n1. EVERY PAGE LOADS AND SHOWS A RESULT\n");
for (const p of PAGES) {
  await page.goto(`http://localhost:${PORT}/${p}`, { waitUntil: "networkidle" });
  const head = await page.locator("#headline").innerText();
  const verdict = await page.locator("#verdict-num").innerText();
  const asks = await page.locator(".ask").count();
  const ok = head.length > 10 && /£/.test(verdict) && asks === 3;
  check(p.padEnd(22), ok, `${asks} questions, "${verdict.slice(0, 44)}"`);
}

console.log("\n1b. IT IS SIMPLE BEFORE IT IS DETAILED\n");
await page.goto(`http://localhost:${PORT}/dental.html`, { waitUntil: "networkidle" });
check("only three questions are visible at first",
  (await page.locator(".ask").count()) === 3);
check("the workings start hidden",
  await page.locator("#workings").isHidden());
check("the result is NOT behind the email form",
  /£/.test(await page.locator("#verdict-num").innerText()) &&
  (await page.locator("#verdict-num").isVisible()));
await page.locator("#show-workings").click();
check("the button reveals them", await page.locator("#workings").isVisible());
check("and the detail sliders are in there",
  (await page.locator("#detail-fields .field").count()) === 4);

console.log("\n2. THE ARITHMETIC, CHECKED AGAINST AN INDEPENDENT SUM\n");
await page.goto(`http://localhost:${PORT}/dental.html`, { waitUntil: "networkidle" });

/* Drive the real controls to known values, then compute the answer here. */
async function setAll(v) {
  /* The three headline questions live in #a-*, the rest behind #d-*. */
  for (const [k, val] of Object.entries(v)) {
    const sel = ["calls", "missedPct", "value"].includes(k) ? `#a-${k}` : `#d-${k}`;
    await page.locator(sel).evaluate((el, x) => {
      el.value = x;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, val);
  }
}
if (await page.locator("#workings").isHidden()) await page.locator("#show-workings").click();
const V = { calls: 600, missedPct: 40, newPct: 50, recoverPct: 80, convertPct: 25, value: 1000, minutes: 4 };
await setAll(V);

/* independent model: overflow mode, auto plan */
const PLANS = [
  { name: "Starter", price: 249, minutes: 300, setup: 795 },
  { name: "Growth", price: 449, minutes: 500, setup: 1295 },
  { name: "Scale", price: 849, minutes: 900, setup: 1995 },
];
const OVERAGE = 0.6;
const missed = V.calls * V.missedPct / 100;
const won = missed * (V.newPct / 100) * (V.recoverPct / 100) * (V.convertPct / 100);
const revenue = won * V.value;
const minutes = missed * V.minutes;                       // overflow mode
const plan = PLANS.find((p) => p.minutes >= minutes) || PLANS[2];
const cost = plan.price + Math.max(0, minutes - plan.minutes) * OVERAGE;
const net = revenue - cost;

/* The chain now opens with the total, so the missed figure is the second row. */
check("missed calls", num(await page.locator("#chain li").nth(1).innerText()) === Math.round(missed),
  `page ${await page.locator("#chain li").nth(1).innerText()} vs mine ${Math.round(missed)}`);
check("recovered revenue", Math.abs(num(await page.locator("#lost").innerText()) - revenue) <= 1,
  `page ${await page.locator("#lost").innerText()} vs mine £${Math.round(revenue)}`);
check("plan chosen for the minutes", (await page.locator("#plan-name").innerText()) === plan.name,
  `page ${await page.locator("#plan-name").innerText()} vs mine ${plan.name} (${Math.round(minutes)} min)`);
check("monthly cost incl. overage", Math.abs(num(await page.locator("#price").innerText()) - cost) <= 1,
  `page ${await page.locator("#price").innerText()} vs mine £${Math.round(cost)}`);
const verdictTxt = await page.locator("#verdict-num").innerText();
check("net, read off the headline figure",
  Math.abs(num(verdictTxt) - Math.abs(net)) <= 1,
  `page "${verdictTxt}" vs mine £${Math.round(net)}`);
/* The line under the headline is a sentence now, not a sum, because the sum
   rounded its customer count and then no longer reached the figure above it.
   What has to hold is that the two money figures it quotes still reconcile to
   that headline, within a pound of rounding. */
const sumTxt = await page.locator("#verdict-sum").innerText();
const sumNums = [...sumTxt.matchAll(/£([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, "")));
check("the line under it reconciles to the headline",
  sumNums.length === 2 && Math.abs((sumNums[0] - sumNums[1]) - Math.abs(net)) <= 1,
  sumTxt);
check("and it names how many customers that is",
  /about [\d.,]+ /.test(sumTxt), sumTxt);
check("year one subtracts the setup fee",
  Math.abs(num(await page.locator("#year1").innerText()) - Math.abs(net * 12 - plan.setup)) <= 2,
  `page ${await page.locator("#year1").innerText()} vs mine £${Math.round(net * 12 - plan.setup)}`);

console.log("\n3. IT CAN SHOW A LOSS, RATHER THAN ONLY EVER SELLING\n");
await setAll({ calls: 40, missedPct: 5, newPct: 10, recoverPct: 20, convertPct: 2, value: 60, minutes: 1 });
const netTxt = await page.locator("#verdict-num").innerText();
check("a poor case comes out negative", netTxt.trim().startsWith("-"), netTxt);
check("and is labelled as a cost, not a gain",
  /cost you/i.test(await page.locator(".hero-fig .cap").innerText()),
  await page.locator(".hero-fig .cap").innerText());
check("and is coloured as a loss",
  (await page.locator("#verdict-num").getAttribute("class")).includes("bad"));
check("payback refuses to invent a number",
  /not at these numbers/i.test(await page.locator("#payback").innerText()),
  await page.locator("#payback").innerText());

console.log("\n4. MINUTES AND OVERAGE\n");
await setAll({ calls: 3000, missedPct: 90, newPct: 50, recoverPct: 80, convertPct: 25, value: 1000, minutes: 15 });
check("the biggest plan is chosen when minutes are huge",
  (await page.locator("#plan-name").innerText()) === "Scale");
check("overage is charged and shown",
  /over/i.test(await page.locator("#over").innerText()),
  await page.locator("#over").innerText());
const overTxt = await page.locator("#over").innerText();
check("the overage rate quoted is 60p", /60p/.test(overTxt), overTxt);

/* The mode and plan controls live inside the folded panel, so open it first. */
const openWorkings = async () => {
  if (await page.locator("#workings").isHidden()) await page.locator("#show-workings").click();
};
await openWorkings();
await page.locator('[data-mode="all"]').click();
const allMins = num(await page.locator("#minutes").innerText());
await page.locator('[data-mode="overflow"]').click();
const offMins = num(await page.locator("#minutes").innerText());
check("answering everything needs more minutes than overflow only",
  allMins > offMins, `${allMins} vs ${offMins}`);

console.log("\n5. PRICES MATCH THE AGREED SHEET\n");
const seen = {};
for (const id of ["starter", "growth", "scale"]) {
  await page.locator(`#segments button[data-plan="${id}"]`).click();
  await openWorkings();
  const line = await page.locator("#plan-line").innerText();
  const all = line.match(/£[\d,]+|[\d,]+ minutes/g) || [];
  seen[await page.locator("#plan-name").innerText()] = {
    price: gbp(all[0]), mins: num(all[1]), setup: gbp(all[2]), raw: line,
  };
}
for (const p of PLANS) {
  const s = seen[p.name];
  check(`${p.name}: £${p.price}, ${p.minutes} min, £${p.setup} setup`,
    s && s.price === p.price && s.mins === p.minutes && s.setup === p.setup,
    s ? s.raw : "not shown");
}

console.log("\n6. SOURCES ARE LABELLED HONESTLY\n");
for (const [p, grade] of [["dental.html", "study"], ["plumbers.html", "study"],
                          ["car-dealerships.html", "vendor"], ["any-business.html", "vendor"]]) {
  await page.goto(`http://localhost:${PORT}/${p}`, { waitUntil: "networkidle" });
  /* The source line now lives inside the tooltip behind each question, so it
     is in the DOM but hidden until hover. innerText on a hidden node returns
     "", hence textContent. */
  const src = page.locator(".tip-pop .src").first();
  const cls = await src.getAttribute("class");
  const txt = await src.textContent();
  check(`${p} marks its missed-call figure as "${grade}"`, cls.includes(grade), txt.split("\n")[0]);
}

console.log("\n7. MOBILE AND ERRORS\n");
await page.setViewportSize({ width: 390, height: 820 });
await page.goto(`http://localhost:${PORT}/dental.html`, { waitUntil: "networkidle" });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("no sideways scroll on a phone", overflow <= 0, `overflow ${overflow}px`);
check("no console or page errors", errors.length === 0, errors.slice(0, 2).join(" | ") || "clean");

await page.setViewportSize({ width: 1280, height: 1000 });
await page.goto(`http://localhost:${PORT}/dental.html`, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(HERE, "shot.png"), fullPage: true });

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed   (screenshot: test/shot.png)\n`);
process.exit(fail ? 1 : 0);
