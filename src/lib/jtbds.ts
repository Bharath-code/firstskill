import type { Niche } from "./types";

export interface JtbdTemplate {
  id: string;
  niche: Niche;
  label: string;
  prompt: string;
  successCriteria: string[];
}

export const NICHES: { id: Niche; label: string; blurb: string }[] = [
  {
    id: "forms",
    label: "Form APIs",
    blurb: "Create a form, collect a response, export submissions.",
  },
  {
    id: "payments",
    label: "Creator payments",
    blurb: "Create a product, take a payment, confirm the charge.",
  },
  {
    id: "scheduling",
    label: "Scheduling",
    blurb: "Create an event, book a slot, send a confirmation.",
  },
];

export const JTBD_TEMPLATES: JtbdTemplate[] = [
  {
    id: "forms-create-submit",
    niche: "forms",
    label: "Create form + capture one response",
    prompt:
      "Using only the product docs and API, create a new form with one email field and one short-text field, then submit a sample response. Report the submission id.",
    successCriteria: [
      "Form created via API",
      "Response submitted",
      "Submission id returned",
    ],
  },
  {
    id: "forms-export",
    niche: "forms",
    label: "List submissions + export CSV",
    prompt:
      "Authenticate, list submissions for an existing form, and export them as CSV (or equivalent structured export).",
    successCriteria: [
      "Auth succeeded",
      "Submissions listed",
      "Export retrieved",
    ],
  },
  {
    id: "payments-charge",
    niche: "payments",
    label: "Create product + take $10 charge",
    prompt:
      "Create a $10 one-time product (or checkout session) and complete a test-mode charge. Return the payment/session id.",
    successCriteria: [
      "Product or price created",
      "Checkout or charge initiated",
      "Payment id returned",
    ],
  },
  {
    id: "payments-refund",
    niche: "payments",
    label: "Refund a test payment",
    prompt:
      "Given a recent test payment id from docs/examples, issue a full refund and confirm status.",
    successCriteria: [
      "Payment located",
      "Refund created",
      "Refund status confirmed",
    ],
  },
  {
    id: "scheduling-book",
    niche: "scheduling",
    label: "Book next available slot",
    prompt:
      "Find the next available slot for a demo calendar and book it for a fictional attendee. Return the event id.",
    successCriteria: [
      "Availability fetched",
      "Slot booked",
      "Event id returned",
    ],
  },
  {
    id: "scheduling-cancel",
    niche: "scheduling",
    label: "Cancel and reschedule",
    prompt:
      "Cancel an existing booking from the docs examples and reschedule it one day later.",
    successCriteria: [
      "Booking found",
      "Cancelled",
      "Rescheduled with new id",
    ],
  },
];

export function getJtbd(id: string): JtbdTemplate | undefined {
  return JTBD_TEMPLATES.find((j) => j.id === id);
}

export function jtbdForNiche(niche: Niche): JtbdTemplate[] {
  return JTBD_TEMPLATES.filter((j) => j.niche === niche);
}
