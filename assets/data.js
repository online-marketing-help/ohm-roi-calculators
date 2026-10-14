/* =========================================================================
   Everything the calculator is allowed to assume lives here.

   Two rules this file follows.

   1. OMH's prices are facts. They come from the price breakdown agreed with
      the MD and must not be edited here to make a number look better.

   2. Industry figures are NOT facts, they are starting points. Every default
      carries the source it came from and how much weight that source deserves.
      Most "missed call" statistics in this market are vendor marketing with no
      traceable study behind them, so the honest thing is to say so, show the
      owner the number, and let them replace it with their own.
   ========================================================================= */

/* ------------------------------------------------------------------ plans */
/* Agreed 2026 pricing. Minutes are per month; overage is the same on every
   plan. Setup is one off. */
const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 249,
    minutes: 300,
    setup: 795,
    delivery: "3 working days",
    blurb: "One agent, one number. Answers the calls you are missing now.",
  },
  {
    id: "growth",
    name: "Growth",
    price: 449,
    minutes: 500,
    setup: 1295,
    delivery: "5 to 7 working days",
    popular: true,
    blurb: "More minutes, deeper qualifying and your diary connected.",
  },
  {
    id: "scale",
    name: "Scale",
    price: 849,
    minutes: 900,
    setup: 1995,
    delivery: "12 to 15 working days",
    blurb: "Up to 3 locations or brands. Further sites are £495 setup, £49 a month each.",
  },
];

const OVERAGE = 0.60;      // £ per minute once the allowance is used
const EXTRA_SITE_SETUP = 495;
const EXTRA_SITE_MONTH = 49;
const SITES_INCLUDED = 3;  // in Scale

/* --------------------------------------------------------------- sourcing */
/* grade: "study"  a named study with a stated sample
          "vendor" a supplier's own published figure, no method given
          "ours"   OMH's own working assumption, stated as such            */
const SOURCES = {
  invoca: {
    label: "Invoca, Home Services Lead Conversion Benchmarks 2026 (July 2026)",
    url: "https://invoca.com/reports/the-invoca-home-services-lead-conversion-benchmarks-report-2026",
    grade: "study",
    note: "Averages across Invoca's customer base: a person answers 52% of inbound calls, 65% of calls over 15 seconds, 73% of calls over 30 seconds. Sample size not disclosed.",
  },
  peerlogic: {
    label: "Peerlogic, study of 4,280 calls across 26 dental practices",
    url: "https://www.peerlogic.com/",
    grade: "study",
    note: "38% of inbound calls went unanswered; 25% new patient conversion recorded in the same study.",
  },
  homeshare: {
    label: "Homeshare research, UK estate and letting agents",
    url: "https://homeshare.co.uk/newsfeed/estate-agents-miss-94-of-early-evening-calls-research-claims",
    grade: "study",
    note: "94.1% of calls between 6pm and 9pm on weekdays went unanswered.",
  },
  clio: {
    label: "Clio Legal Trends Report, mystery shop of law firms",
    url: "https://www.clio.com/uk/guides/client-intake-legal-trends/",
    grade: "study",
    note: "40% of firms answered the phone to a prospective client; 52% either answered or called back.",
  },
  moneypenny: {
    label: "Moneypenny, UK legal call research",
    url: "https://www.moneypenny.com/uk/",
    grade: "vendor",
    note: "35% of calls to small and mid-sized UK firms go unanswered in business hours; roughly 1 in 10 calls is a new enquiry.",
  },
  dragon2000: {
    label: "Dragon2000, UK dealership call research",
    url: "https://www.dragon2000.co.uk/",
    grade: "vendor",
    note: "28% of inbound calls go unanswered at car dealerships; peak misses 11am and 3pm, Monday to Wednesday.",
  },
  ukSme: {
    label: "Widely repeated UK SME figure, original study not traceable",
    url: "",
    grade: "vendor",
    note: "27% of inbound calls to the average UK SME reported unanswered, rising to 47% for the smallest firms. Repeated across many supplier blogs; we could not find the underlying research, so treat it as a prompt to measure your own.",
  },
  ours: {
    label: "OMH working assumption",
    url: "",
    grade: "ours",
    note: "Not measured. A deliberately cautious placeholder so the result is not flattering by accident. Change it to what you know.",
  },
};

/* ------------------------------------------------------------- industries */
/* missedPct      share of inbound calls nobody answers
   newPct         share of those missed calls that are genuinely new business.
                  This is the number vendor calculators quietly set to 100%.
                  Supplier calls, existing customers chasing, wrong numbers and
                  spam are all in a real call log.
   recoverPct     share of those the agent actually converts into a captured
                  enquiry. Not 100%: some callers want a person, some ask for
                  something out of scope.
   convertPct     captured enquiry to paying customer
   value          average value of one customer, in pounds
   minutes        average length of a handled call                           */
const INDUSTRIES = {
  universal: {
    slug: "universal",
    name: "Any business",
    headline: "What are the calls you miss actually worth?",
    lede:
      "This works for any business that sells over the phone. If your trade is listed below, " +
      "use that version instead: the starting figures are closer to your world.",
    valueLabel: "Average value of one new customer",
    valueHint: "What one new customer is worth to you, over the whole relationship, not just the first job.",
    unit: "customers",
    defaults: { calls: 400, missedPct: 27, newPct: 45, recoverPct: 70, convertPct: 30, value: 900, minutes: 3.5 },
    valueRange: { min: 100, max: 10000, step: 50 },
    missedSource: "ukSme",
    valueSource: "ours",
    notes: [
      "Most published missed call statistics come from companies selling the fix. Where we could not trace a study, we say so.",
      "Every figure here is editable. The only numbers we will not move are our own prices.",
    ],
  },

  "real-estate": {
    slug: "real-estate",
    name: "Estate and letting agents",
    headline: "What are the valuations you never hear about worth?",
    lede:
      "Vendors ring in the evening, after they have talked it over at home. That is exactly " +
      "when the office is shut.",
    valueLabel: "Average commission per instruction",
    valueHint: "Your average fee on one instruction that completes.",
    unit: "instructions",
    defaults: { calls: 350, missedPct: 30, newPct: 40, recoverPct: 70, convertPct: 25, value: 3500, minutes: 4 },
    valueRange: { min: 1000, max: 12000, step: 100 },
    missedSource: "homeshare",
    valueSource: "ours",
    notes: [
      "Homeshare's research found 94.1% of calls between 6pm and 9pm went unanswered. The default above is a whole week average, not that evening window, which is why it is far lower.",
      "A valuation booked is not an instruction won. The conversion step below is where that is handled.",
    ],
  },

  dental: {
    slug: "dental",
    name: "Dental practices",
    headline: "What is a new patient who could not get through worth?",
    lede:
      "Reception is with a patient, the phone rings out, and the caller tries the practice " +
      "down the road. Nobody ever logs it.",
    valueLabel: "Average value of a new patient",
    valueHint: "Over the relationship, not the first appointment. Private and implant work sits far higher than NHS.",
    unit: "new patients",
    defaults: { calls: 600, missedPct: 38, newPct: 35, recoverPct: 75, convertPct: 25, value: 800, minutes: 3.5 },
    valueRange: { min: 150, max: 6000, step: 50 },
    missedSource: "peerlogic",
    valueSource: "ours",
    notes: [
      "The 38% default and the 25% conversion both come from the same study of 4,280 calls across 26 practices, so they are at least consistent with each other.",
      "Claims of £10,000 lifetime value circulate widely in this market with no study behind them. We have not used them.",
    ],
  },

  clinics: {
    slug: "clinics",
    name: "Private clinics and healthcare",
    headline: "What are the patient enquiries you miss worth?",
    lede:
      "Lunch cover, peak morning, and the hour after close. The phone does not stop because " +
      "the desk is busy.",
    valueLabel: "Average value of a new patient",
    valueHint: "Over the course of treatment, not a single consultation.",
    unit: "new patients",
    defaults: { calls: 500, missedPct: 30, newPct: 40, recoverPct: 75, convertPct: 30, value: 1200, minutes: 4 },
    valueRange: { min: 150, max: 8000, step: 50 },
    missedSource: "ukSme",
    valueSource: "ours",
    notes: [
      "If you take clinical questions on the phone, note that the agent books and triages to your rules; it does not give clinical advice.",
    ],
  },

  plumbers: {
    slug: "plumbers",
    name: "Plumbers and emergency trades",
    headline: "What is the job worth that went to whoever answered first?",
    lede:
      "An emergency caller does not leave a voicemail. They ring the next firm on the list, " +
      "and the first one to pick up gets the job.",
    valueLabel: "Average value of one job",
    valueHint: "Your average invoice. Emergency call-outs and installs pull this in opposite directions.",
    unit: "jobs",
    defaults: { calls: 300, missedPct: 48, newPct: 55, recoverPct: 70, convertPct: 45, value: 350, minutes: 3 },
    valueRange: { min: 80, max: 2500, step: 10 },
    missedSource: "invoca",
    valueSource: "ours",
    notes: [
      "Invoca's 2026 home services benchmark found a person answers 52% of inbound calls, which is where the 48% default comes from. For calls lasting over 30 seconds the answer rate rises to 73%.",
      "The same report found 45% of leads converted during the call, which is the conversion default here.",
    ],
  },

  hvac: {
    slug: "hvac",
    name: "Heating and HVAC",
    headline: "What is a breakdown call you could not take worth?",
    lede:
      "Cold snap, phones light up, two engineers are already out. The calls you cannot reach " +
      "are the ones paying the most.",
    valueLabel: "Average value of one job",
    valueHint: "Repairs, services and installs averaged out. A boiler install changes this a lot.",
    unit: "jobs",
    defaults: { calls: 320, missedPct: 48, newPct: 55, recoverPct: 70, convertPct: 45, value: 600, minutes: 3 },
    valueRange: { min: 100, max: 5000, step: 25 },
    missedSource: "invoca",
    valueSource: "ours",
    notes: [
      "Demand is seasonal. Run this on a busy winter month as well as an average one; the plan you need is set by the peak, not the mean.",
    ],
  },

  contractors: {
    slug: "contractors",
    name: "Contractors and home improvement",
    headline: "What is an enquiry that rang out worth?",
    lede: "You are on site, not at a desk. The phone is still where the work comes from.",
    valueLabel: "Average value of one project",
    valueHint: "Your average contract value, not the enquiry.",
    unit: "projects",
    defaults: { calls: 220, missedPct: 48, newPct: 50, recoverPct: 70, convertPct: 30, value: 4000, minutes: 4 },
    valueRange: { min: 500, max: 30000, step: 250 },
    missedSource: "invoca",
    valueSource: "ours",
    notes: [
      "High value and low volume. A single recovered project can cover a year of the service, so be honest about the conversion rate rather than the ceiling.",
    ],
  },

  "law-firms": {
    slug: "law-firms",
    name: "Law firms",
    headline: "What is the client who could not reach you worth?",
    lede:
      "Someone with a legal problem rings three firms. The one that picks up and takes the " +
      "details usually keeps them.",
    valueLabel: "Average fee per matter",
    valueHint: "Your average billed matter. Conveyancing, family and PI sit a long way apart.",
    unit: "matters",
    defaults: { calls: 400, missedPct: 35, newPct: 25, recoverPct: 70, convertPct: 35, value: 2500, minutes: 5 },
    valueRange: { min: 300, max: 15000, step: 100 },
    missedSource: "moneypenny",
    valueSource: "ours",
    notes: [
      "The new-business share is set low on purpose: Moneypenny puts it at roughly 1 in 10 calls, and most of your traffic is existing matters. We have used 25% as a middle position, not the headline.",
      "Clio's mystery shop found 40% of firms answered the phone to a prospective client at all.",
      "The agent takes details and books. It does not give legal advice or quote fees unless you tell it the fee.",
    ],
  },

  "car-dealerships": {
    slug: "car-dealerships",
    name: "Car dealerships",
    headline: "What is the buyer who gave up on hold worth?",
    lede:
      "Sales, service and parts all land on the same switchboard. The buyer who cannot get " +
      "through is at another forecourt by the afternoon.",
    valueLabel: "Average gross profit per unit",
    valueHint: "Gross profit on one sale, not the sticker price. Add finance and warranty if you want the full picture.",
    unit: "sales",
    defaults: { calls: 800, missedPct: 28, newPct: 35, recoverPct: 70, convertPct: 20, value: 1600, minutes: 3 },
    valueRange: { min: 200, max: 6000, step: 50 },
    missedSource: "dragon2000",
    valueSource: "ours",
    notes: [
      "Use gross profit, not the price of the car, or the result will be nonsense.",
      "Service bookings are usually the easier win. Run those separately with the service figures.",
    ],
  },
};

const INDUSTRY_ORDER = [
  "universal", "real-estate", "dental", "clinics",
  "plumbers", "hvac", "contractors", "law-firms", "car-dealerships",
];
