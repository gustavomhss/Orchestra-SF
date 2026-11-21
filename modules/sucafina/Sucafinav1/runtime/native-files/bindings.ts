import type { SfFilesOperationId } from "@orchestra/schema/sucafina/files"

/**
 * A06 SERVER-ONLY adapters to the four *existing* producers.
 *
 * No alternative HTTP router, persistence, business-domain service, private
 * actor, scanner, permission or snapshot is created here. I00/F02 own route
 * construction, request admission, the closed operation registry and binding
 * installation; these delegates use the very same request and source handlers.
 */
export type SfFilesSurface = "dashboard" | "planner" | "procurement"
export type SfFilesExistingProducer =
  (request: Request, surface: SfFilesSurface) => Promise<Response | undefined>
export type SfFilesHostSources = Readonly<{
  imports?: SfFilesExistingProducer
  documents?: SfFilesExistingProducer
  documentScenarios?: SfFilesExistingProducer
  application?: SfFilesExistingProducer
  reviews?: SfFilesExistingProducer
}>

const failUnavailable = () => Response.json(
  { status: "unavailable", reason: "source-handler-unavailable" },
  {
    status: 503,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  },
)

async function through(
  producer: SfFilesExistingProducer | undefined,
  request: Request,
  surface: SfFilesSurface,
): Promise<Response> {
  // Absence of scanner/admission/producer NEVER implies clean or succeeded.
  if (!producer || request.signal.aborted) return failUnavailable()
  const result = await producer(request, surface)
  return result ?? failUnavailable()
}

/**
 * Closed per-operation adapters, no execute(operationId:string) dispatcher.
 * The caller supplies the current authorized producer handler; it must not
 * parse HTML or create a second server-side auth/snapshot path.
 *
 * In particular, the application delegate must be the original application
 * surface handler (assets and file exports); the existing import/document
 * branches keep their own ui/human admission and source revalidation.
 */
export function createSfFilesHostBindings(input: SfFilesHostSources) {
  return Object.freeze({
    "files.import-targets": (request: Request, surface: SfFilesSurface) => through(input.imports, request, surface),
    "files.import-reference": (request: Request, surface: SfFilesSurface) => through(input.imports, request, surface),
    "files.import-detail": (request: Request, surface: SfFilesSurface) => through(input.imports, request, surface),
    "files.import-admit": (request: Request, surface: SfFilesSurface) => through(input.imports, request, surface),
    "files.import-preview": (request: Request, surface: SfFilesSurface) => through(input.imports, request, surface),
    "files.import-apply": (request: Request, surface: SfFilesSurface) => through(input.imports, request, surface),
    "files.document-requests": (request: Request, surface: SfFilesSurface) => through(input.documents, request, surface),
    "files.document-search": (request: Request, surface: SfFilesSurface) => through(input.documents, request, surface),
    "files.document-open": (request: Request, surface: SfFilesSurface) => through(input.documents, request, surface),
    "files.document-schemas": (request: Request, surface: SfFilesSurface) => through(input.documents, request, surface),
    "files.document-schema": (request: Request, surface: SfFilesSurface) => through(input.documents, request, surface),
    "files.document-sources": (request: Request, surface: SfFilesSurface) => through(input.documents, request, surface),
    "files.document-admit": (request: Request, surface: SfFilesSurface) => through(input.documents, request, surface),
    "files.document-extract": (request: Request, surface: SfFilesSurface) => through(input.documents, request, surface),
    "files.document-confirm": (request: Request, surface: SfFilesSurface) => through(input.documents, request, surface),
    "files.document-candidates": (request: Request, surface: SfFilesSurface) => through(input.documents, request, surface),
    "files.document-scenario-targets": (request: Request, surface: SfFilesSurface) => through(input.documentScenarios, request, surface),
    "files.document-scenario-preview": (request: Request, surface: SfFilesSurface) => through(input.documentScenarios, request, surface),
    "files.asset.link": (request: Request, surface: SfFilesSurface) => through(input.application, request, surface),
    "files.asset.download": (request: Request, surface: SfFilesSurface) => through(input.application, request, surface),
    "files.asset.upload": (request: Request, surface: SfFilesSurface) => through(input.application, request, surface),
    "files.export.xlsx": (request: Request, surface: SfFilesSurface) => through(input.application, request, surface),
    "files.export.po": (request: Request, surface: SfFilesSurface) => through(input.application, request, surface),
    "files.export.suppliers": (request: Request, surface: SfFilesSurface) => through(input.application, request, surface),
    "files.export.register": (request: Request, surface: SfFilesSurface) => through(input.application, request, surface),
    "files.export.json": (request: Request, surface: SfFilesSurface) => through(input.application, request, surface),
    "files.export.members": (request: Request, surface: SfFilesSurface) => through(input.application, request, surface),
    "files.export.review": (request: Request, surface: SfFilesSurface) => through(input.reviews, request, surface),
  } satisfies Record<SfFilesOperationId, SfFilesExistingProducer>)
}
