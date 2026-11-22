import { lstat } from "node:fs/promises"
import path from "node:path"
import { requireSfRoutinePrivateDirectory } from "../../../../apps/cli/src/sucafina-product/routine-native-private-files.ts"

/** Runtime workspace and host-private state must be physical siblings inside the private installation. */
export async function prepareSfLocalWorkspace(directory: string) {
  if (!await requireSfRoutinePrivateDirectory(directory)) throw new Error("SF_LOCAL_WORKSPACE_INSTALLATION_REQUIRED")
  const installation = await lstat(directory)
  const workspace = path.join(directory, "workspace")
  await requireSfRoutinePrivateDirectory(workspace, true)
  const current = await lstat(directory)
  if (current.dev !== installation.dev || current.ino !== installation.ino ||
    current.uid !== installation.uid || current.mode !== installation.mode)
    throw new Error("SF_LOCAL_WORKSPACE_INSTALLATION_CHANGED")
  return workspace
}
