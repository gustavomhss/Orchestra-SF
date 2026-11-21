import type { SfReviewOperationId } from "../reviews"

// Route metadata for the original review producers. Access remains with each producer.
export const SfReviewRoutes = Object.freeze({
  "reviews.review-agenda-options": {method: "GET", pathTemplate: "{mount}/dashboard", effect: "read", responseMode: "json", fixedQuery: {sf: "review-agenda"}},
  "reviews.review-agenda": {method: "POST", pathTemplate: "{mount}/dashboard", effect: "preview", responseMode: "json", fixedQuery: {sf: "review-agenda"}, maxRequestBytes: 262144},
  "reviews.review-preserve": {method: "POST", pathTemplate: "{mount}/dashboard", effect: "mutation", responseMode: "json", fixedQuery: {sf: "review-preserve"}, maxRequestBytes: 262144},
  "reviews.review-read": {method: "GET", pathTemplate: "{mount}/dashboard", effect: "read", responseMode: "json", fixedQuery: {sf: "review-read"}},
  "dashboard.dashboard-agenda": {method: "POST", pathTemplate: "{mount}/dashboard", effect: "read", responseMode: "json", fixedQuery: {sf: "dashboard-agenda"}},
  "dashboard.dashboard-capture": {method: "POST", pathTemplate: "{mount}/dashboard", effect: "mutation", responseMode: "json", fixedQuery: {sf: "dashboard-capture"}},
  "dashboard.dashboard-history": {method: "GET", pathTemplate: "{mount}/dashboard", effect: "read", responseMode: "json", fixedQuery: {sf: "dashboard-history"}},
  "dashboard.dashboard-review": {method: "GET", pathTemplate: "{mount}/dashboard", effect: "read", responseMode: "json", fixedQuery: {sf: "dashboard-review"}},
  "dashboard.dashboard-review-preserve": {method: "POST", pathTemplate: "{mount}/dashboard", effect: "mutation", responseMode: "json", fixedQuery: {sf: "dashboard-review-preserve"}},
  "projection.review": {method: "GET", pathTemplate: "{mount}/api/ui/projections/review", effect: "read", responseMode: "json"},
  "reviews.export.docx": {method: "GET", pathTemplate: "{mount}/dashboard", effect: "read", responseMode: "json", fixedQuery: {page: "Generate Report", download: "docx"}},
  "reviews.export.pptx": {method: "GET", pathTemplate: "{mount}/dashboard", effect: "read", responseMode: "json", fixedQuery: {page: "Generate Report", download: "pptx"}},
  "reviews.report.prepare": {method: "POST", pathTemplate: "{mount}/dashboard", effect: "prepare", responseMode: "json", fixedQuery: {sf: "review-report"}, maxRequestBytes: 65536},
  "reviews.review-source": {method: "GET", pathTemplate: "{mount}/dashboard", effect: "read", responseMode: "json", fixedQuery: {sf: "review-source"}},
  "reviews.review-thread-context": {method: "POST", pathTemplate: "{mount}/dashboard", effect: "read", responseMode: "json", fixedQuery: {sf: "review-thread-context"}, maxRequestBytes: 65536},
  "reviews.review-update": {method: "GET", pathTemplate: "{mount}/dashboard", effect: "read", responseMode: "json", fixedQuery: {sf: "review-update"}},
} as const satisfies Record<SfReviewOperationId, object>)
