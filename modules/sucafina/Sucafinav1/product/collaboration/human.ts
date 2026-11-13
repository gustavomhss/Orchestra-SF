import type { createSfHumanAuthority } from "../integration/human-authority.ts"

/** Root-private authority; the retained Request and action digest never come from payload fields. */
export type CollaborationHumanAuthority = Pick<ReturnType<typeof createSfHumanAuthority>, "authorize">
