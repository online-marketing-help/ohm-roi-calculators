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

const PAGES = ["index.html", "real-estate.html", "dental.html", "clinics.html",
  "plumbers.html", "hvac.html", "contractors.html", "law-firms.html", "car-dealerships.html"];

console.log("\n1. EVERY PAGE LOADS AND SHOWS A RESULT\n");
for (const p of PAGES) {
  await page.goto(`http://localhost:${PORT}/${p}`, { waitUntil: "networkidle" });
  const head = await page.locator("#headline").innerText();
  const net = await page.locator("#net").innerText();
  const plan = await page.locator("#plan-name").innerText();
  const ok = head.length > 10 && /£/.test(net) && /Starter|Growth|Scale/.test(plan);
  check(p.padEnd(22), ok, `${plan}, net ${net}`);
}

console.log("\n2. THE ARITHMETIC, CHECKED AGAINST AN INDEPENDENT SUM\n");
await page.goto(`http://localhost:${PORT}/dental.html`, { waitUntil: "networkidle" });

/* Drive the real controls to known values, then compute the answer here. */
async function setAll(v) {
  for (const [k, val] of Object.entries(v)) {
    await page.locator(`#f-${k}`).evaluate((el, x) => {
      el.value = x;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, val);
  }
}
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

check("missed calls", num(await page.locator("#chain li").first().innerText()) === Math.round(missed),
  `page ${await page.locator("#chain li").first().innerText()} vs mine ${Math.round(missed)}`);
check("recovered revenue", Math.abs(num(await page.locator("#revenue").innerText()) - revenue) <= 1,
  `page ${await page.locator("#revenue").innerText()} vs mine £${Math.round(revenue)}`);
check("plan chosen for the minutes", (await page.locator("#plan-name").innerText()) === plan.name,
  `page ${await page.locator("#plan-name").innerText()} vs mine ${plan.name} (${Math.round(minutes)} min)`);
check("monthly cost incl. overage", Math.abs(num(await page.locator("#cost").innerText()) - cost) <= 1,
  `page ${await page.locator("#cost").innerText()} vs mine £${Math.round(cost)}`);
check("net", Math.abs(num(await page.locator("#net").innerText()) - Math.abs(net)) <= 1,
  `page ${await page.locator("#net").innerText()} vs mine £${Math.round(net)}`);
check("year one subtracts the setup fee",
  Math.abs(num(await page.locator("#year1").innerText()) - Math.abs(net * 12 - plan.setup)) <= 2,
  `page ${await page.locator("#year1").innerText()} vs mine £${Math.round(net * 12 - plan.setup)}`);

console.log("\n3. IT CAN SHOW A LOSS, RATHER THAN ONLY EVER SELLING\n");
await setAll({ calls: 40, missedPct: 5, newPct: 10, recoverPct: 20, convertPct: 2, value: 60, minutes: 1 });
const netTxt = await page.locator("#net").innerText();
check("a poor case comes out negative", netTxt.trim().startsWith("-"), `net ${netTxt}`);
check("and is coloured as a loss",
  (await page.locator("#net").getAttribute("class")).includes("bad"));
check("payback says never rather than a fantasy number",
  /never/i.test(await page.locator("#payback").innerText()),
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

await page.locator('[data-mode="all"]').click();
const allMins = num(await page.locator("#minutes").innerText());
await page.locator('[data-mode="overflow"]').click();
const offMins = num(await page.locator("#minutes").innerText());
check("answering everything needs more minutes than overflow only",
  allMins > offMins, `${allMins} vs ${offMins}`);

console.log("\n5. PRICES MATCH THE AGREED SHEET\n");
const seen = {};
for (const id of ["starter", "growth", "scale"]) {
  await page.locator("#planpick").selectOption(id);
  seen[await page.locator("#plan-name").innerText()] = {
    price: gbp(await page.locator("#plan-price").innerText()),
    mins: num(await page.locator("#plan-mins").innerText()),
    setup: gbp(await page.locator("#plan-setup").innerText()),
  };
}
for (const p of PLANS) {
  const s = seen[p.name];
  check(`${p.name}: £${p.price}, ${p.minutes} min, £${p.setup} setup`,
    s && s.price === p.price && s.mins === p.minutes && s.setup === p.setup,
    s ? `£${s.price}, ${s.mins} min, £${s.setup}` : "not shown");
}

console.log("\n6. SOURCES ARE LABELLED HONESTLY\n");
for (const [p, grade] of [["dental.html", "study"], ["plumbers.html", "study"],
                          ["car-dealerships.html", "vendor"], ["index.html", "vendor"]]) {
  await page.goto(`http://localhost:${PORT}/${p}`, { waitUntil: "networkidle" });
  const cls = await page.locator(".help.src").first().getAttribute("class");
  const txt = await page.locator(".help.src").first().innerText();
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
