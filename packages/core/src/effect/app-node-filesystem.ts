import { NodeFileSystem, NodePath } from "@effect/platform-node"
import { FileSystem, Path } from "effect"
import { makeGlobalNode } from "./app-node"

// Process and filesystem callers need these platform nodes without provider or session state.
export const filesystem = makeGlobalNode({ service: FileSystem.FileSystem, layer: NodeFileSystem.layer, deps: [] })
export const path = makeGlobalNode({ service: Path.Path, layer: NodePath.layer, deps: [] })
