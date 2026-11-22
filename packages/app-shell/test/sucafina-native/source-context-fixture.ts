import { sfContextDestinationsFromPages } from "../../../../apps/cli/src/sucafina-product/native-ui/live-context"

// The genuine F01 page projection publishes domain CAP destinations, never UI surface IDs.
const destinations = sfContextDestinationsFromPages([{ surface: "dashboard", page: "Executive Dashboard" }])
if (!destinations || !destinations.some((item) => item.capabilityId === "CAP01")) throw new Error("source destination control failed")
export const sourceDestinations = destinations
