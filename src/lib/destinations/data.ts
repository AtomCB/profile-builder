import type { DestinationInfo, VisaRule } from "./types";

/*
 * Hardcoded destination data. Costs are rough per-person daily estimates in USD,
 * including lodging. Visa rules are illustrative short-stay tourist rules and can
 * change; the agent always tells users to confirm with official government sources.
 */

const SCHENGEN_NOTE =
  "Schengen area: 90 days in any 180-day period for visa-exempt travelers. The EU's ETIAS travel authorization is planned for visa-exempt visitors; check whether it is in effect before travel.";

const schengenVisa = (): Record<"US" | "GB" | "CA" | "AU" | "IN" | "DE", VisaRule> => ({
  US: { type: "visa-free", maxStayDays: 90, note: SCHENGEN_NOTE },
  GB: { type: "visa-free", maxStayDays: 90, note: SCHENGEN_NOTE },
  CA: { type: "visa-free", maxStayDays: 90, note: SCHENGEN_NOTE },
  AU: { type: "visa-free", maxStayDays: 90, note: SCHENGEN_NOTE },
  IN: { type: "visa-required", note: "Schengen short-stay visa required; apply in advance." },
  DE: { type: "visa-free", note: "EU citizen: free movement, no visa or stay limit." },
});

const DEFAULT_VISA_NOTE =
  "No visa data for this passport. Check the destination government's official immigration website.";

export const DESTINATIONS: readonly DestinationInfo[] = [
  {
    id: "kyoto",
    name: "Kyoto",
    country: "JP",
    countryName: "Japan",
    aliases: ["kyoto-shi"],
    bestMonths: [3, 4, 5, 10, 11],
    climateSummary:
      "Four distinct seasons. Mild, pleasant spring (cherry blossoms late Mar–early Apr) and autumn (foliage in Nov); hot, humid summers; cold, dry winters.",
    knownFor: ["temples", "gardens", "history", "culture", "food", "architecture", "hiking", "photography"],
    goodFor: ["solo", "partner", "friends", "family-adults", "family-with-kids", "group-tour"],
    averageDailyCostUSD: { budget: 80, midRange: 200, luxury: 550 },
    visa: {
      byPassport: {
        US: { type: "visa-free", maxStayDays: 90 },
        GB: { type: "visa-free", maxStayDays: 90 },
        CA: { type: "visa-free", maxStayDays: 90 },
        AU: { type: "visa-free", maxStayDays: 90 },
        IN: { type: "e-visa", maxStayDays: 90, note: "Japan eVISA available; apply before travel." },
        DE: { type: "visa-free", maxStayDays: 90 },
      },
      defaultNote: DEFAULT_VISA_NOTE,
    },
    cuisine: ["kaiseki", "tofu and yuba", "shojin ryori (temple vegetarian)", "matcha sweets", "ramen"],
    dietaryNotes:
      "Vegetarian temple cuisine exists, but fish stock (dashi) is in many dishes, so ask explicitly. Vegan and halal options are limited outside the center.",
    accessibilityNotes:
      "Stations and newer sights are generally accessible. Many temples have gravel paths, steps and steep approaches.",
    watchOutFor: [
      "very crowded in cherry blossom and autumn foliage seasons",
      "hot, humid summers",
      "stairs and hills at temples",
    ],
  },
  {
    id: "lisbon",
    name: "Lisbon",
    country: "PT",
    countryName: "Portugal",
    aliases: ["lisboa"],
    bestMonths: [4, 5, 6, 9, 10],
    climateSummary:
      "Mediterranean: warm, sunny springs and autumns; hot, dry summers; mild, rainy winters.",
    knownFor: ["history", "architecture", "food", "nightlife", "museums", "markets", "beaches", "photography"],
    goodFor: ["solo", "partner", "friends", "family-adults"],
    averageDailyCostUSD: { budget: 70, midRange: 170, luxury: 450 },
    visa: { byPassport: schengenVisa(), defaultNote: DEFAULT_VISA_NOTE },
    cuisine: ["bacalhau (salt cod)", "grilled sardines", "pastéis de nata", "seafood rice", "vinho verde"],
    dietaryNotes:
      "Seafood- and pork-heavy, but vegetarian and vegan options are common in central neighborhoods.",
    accessibilityNotes:
      "Very hilly, with steep, slippery cobblestone streets. Historic trams are mostly not wheelchair accessible; the metro mostly is.",
    watchOutFor: ["steep hills and slippery cobblestones", "summer crowds and heat", "pickpockets on busy trams"],
  },
  {
    id: "marrakech",
    name: "Marrakech",
    country: "MA",
    countryName: "Morocco",
    aliases: ["marrakesh"],
    bestMonths: [3, 4, 5, 10, 11],
    climateSummary:
      "Semi-arid: warm, pleasant spring and autumn; very hot summers (often 40°C+); mild days and cold nights in winter.",
    knownFor: ["markets", "shopping", "architecture", "culture", "food", "gardens", "history", "wellness"],
    goodFor: ["solo", "partner", "friends", "family-adults", "group-tour"],
    averageDailyCostUSD: { budget: 45, midRange: 120, luxury: 400 },
    visa: {
      byPassport: {
        US: { type: "visa-free", maxStayDays: 90 },
        GB: { type: "visa-free", maxStayDays: 90 },
        CA: { type: "visa-free", maxStayDays: 90 },
        AU: { type: "visa-free", maxStayDays: 90 },
        IN: { type: "e-visa", maxStayDays: 30, note: "Morocco e-visa available; apply before travel." },
        DE: { type: "visa-free", maxStayDays: 90 },
      },
      defaultNote: DEFAULT_VISA_NOTE,
    },
    cuisine: ["tagine", "couscous", "harira soup", "mint tea", "street-stall grills"],
    dietaryNotes:
      "Halal by default. Vegetarian tagines and couscous are easy to find. Alcohol is only served in licensed venues.",
    accessibilityNotes:
      "Medina alleys are narrow, uneven and busy with scooters; accessibility is limited. Newer hotels and riads vary.",
    watchOutFor: [
      "extreme summer heat",
      "persistent touts and haggling in the medina",
      "reduced hours during Ramadan",
    ],
  },
  {
    id: "reykjavik",
    name: "Reykjavík",
    country: "IS",
    countryName: "Iceland",
    aliases: ["reykjavik"],
    bestMonths: [6, 7, 8, 9],
    climateSummary:
      "Cool and changeable year-round. Summer has near 24-hour daylight; winter is dark and cold, with northern lights roughly Sep–Mar.",
    knownFor: ["nature", "hiking", "scenic drives", "wellness", "wildlife", "adventure", "photography"],
    goodFor: ["solo", "partner", "friends", "family-adults", "family-with-kids", "group-tour"],
    averageDailyCostUSD: { budget: 140, midRange: 300, luxury: 700 },
    visa: { byPassport: schengenVisa(), defaultNote: DEFAULT_VISA_NOTE },
    cuisine: ["lamb soup", "fresh fish", "skyr", "hot dogs (pylsur)"],
    dietaryNotes:
      "Fish and lamb focused. Vegetarian and vegan options are good in the city but sparse in the countryside.",
    accessibilityNotes:
      "The city center is fairly accessible. Many nature sites involve uneven terrain, gravel paths and long walks.",
    watchOutFor: ["very high prices", "fast-changing weather", "very short winter days", "long drives between sights"],
  },
  {
    id: "cape-town",
    name: "Cape Town",
    country: "ZA",
    countryName: "South Africa",
    aliases: ["capetown", "kaapstad"],
    bestMonths: [11, 12, 1, 2, 3],
    climateSummary:
      "Southern-hemisphere Mediterranean: warm, dry, windy summers (Nov–Mar); cool, rainy winters (Jun–Aug).",
    knownFor: ["nature", "hiking", "beaches", "wine", "wildlife", "food", "adventure", "scenic drives"],
    goodFor: ["solo", "partner", "friends", "family-adults", "family-with-kids", "group-tour"],
    averageDailyCostUSD: { budget: 55, midRange: 140, luxury: 400 },
    visa: {
      byPassport: {
        US: { type: "visa-free", maxStayDays: 90 },
        GB: { type: "visa-free", maxStayDays: 90 },
        CA: { type: "visa-free", maxStayDays: 90 },
        AU: { type: "visa-free", maxStayDays: 90 },
        IN: { type: "e-visa", note: "South Africa e-visa available; apply before travel." },
        DE: { type: "visa-free", maxStayDays: 90 },
      },
      defaultNote: DEFAULT_VISA_NOTE,
    },
    cuisine: ["braai (barbecue)", "Cape Malay curries", "bobotie", "fresh seafood", "Cape Winelands wines"],
    dietaryNotes:
      "Meat-forward, but there is a strong vegetarian and vegan scene. Halal food is widely available.",
    accessibilityNotes:
      "Major attractions such as the V&A Waterfront and the Table Mountain cableway are accessible. Hiking trails and some beaches are not.",
    watchOutFor: [
      "strong summer winds",
      "safety: avoid isolated areas, especially after dark",
      "long-haul flights from most regions",
    ],
  },
];
