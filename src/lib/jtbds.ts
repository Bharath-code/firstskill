import type { Niche } from "./types";

export interface JtbdTemplate {
  id: string;
  niche: Niche;
  label: string;
  prompt: string;
  successCriteria: string[];
}

/** Named the way a customer would say it out loud, not the way we file it. */
export const NICHES: { id: Niche; label: string; blurb: string }[] = [
  {
    id: "retrieval",
    label: "Search & fetch",
    blurb: "Find something out on the web and bring back text an assistant can use.",
  },
  {
    id: "memory-state",
    label: "Store & recall",
    blurb: "Save something now, then find it again later.",
  },
];

export const JTBD_TEMPLATES: JtbdTemplate[] = [
  {
    id: "retrieval-search-fetch",
    niche: "retrieval",
    label: "Search, then read the top results",
    prompt:
      "Using only the product docs and API, run a search for a topic of your choice, then fetch the full contents of the top three results and report the source URLs.",
    successCriteria: [
      "Search request accepted",
      "Contents fetched for the top results",
      "Source URLs returned",
    ],
  },
  {
    id: "retrieval-crawl-page",
    niche: "retrieval",
    label: "Read one page of a site as clean text",
    prompt:
      "Using only the product docs and API, fetch a single public page and return it as clean text or markdown, with the navigation and boilerplate stripped.",
    successCriteria: [
      "Crawl or scrape request accepted",
      "Page content returned",
      "Content is usable text, not raw HTML",
    ],
  },
  {
    id: "memory-store-recall",
    niche: "memory-state",
    label: "Save three items, then find one again",
    prompt:
      "Using only the product docs and API, store three items with some attached detail, then run one query that finds the right item back and report its id.",
    successCriteria: [
      "Items stored",
      "Query executed",
      "Correct item returned by id",
    ],
  },
  {
    id: "memory-sandbox-run",
    niche: "memory-state",
    label: "Run a snippet and read the output",
    prompt:
      "Using only the product docs and API, start a session or sandbox, run a short snippet of code in it, read the printed output back, and shut it down cleanly.",
    successCriteria: [
      "Session started",
      "Snippet executed",
      "Output read back and session closed",
    ],
  },
];

export function getJtbd(id: string): JtbdTemplate | undefined {
  return JTBD_TEMPLATES.find((j) => j.id === id);
}

export function jtbdForNiche(niche: Niche): JtbdTemplate[] {
  return JTBD_TEMPLATES.filter((j) => j.niche === niche);
}
