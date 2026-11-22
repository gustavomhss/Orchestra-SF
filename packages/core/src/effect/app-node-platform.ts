import { LLMClient, RequestExecutor } from "@orchestra/llm/route"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpClient } from "effect/unstable/http"
import { makeGlobalNode } from "./app-node"
import { PrivateProvider } from "../provider/private"
import { SessionOwner } from "../session/owner"

export { filesystem, path } from "./app-node-system"
export const httpClient = makeGlobalNode({ service: HttpClient.HttpClient, layer: FetchHttpClient.layer, deps: [] })
export const requestExecutor = makeGlobalNode({
  service: RequestExecutor.Service,
  layer: RequestExecutor.layer,
  deps: [httpClient],
})
// Keep replacements bound to the same precisely typed corporate transport layer.
export const llmClientLayer = PrivateProvider.llmLayer
export const llmClient = makeGlobalNode({ service: LLMClient.Service, layer: llmClientLayer, deps: [requestExecutor, SessionOwner.node] })

export * as LayerNodePlatform from "./app-node-platform"
