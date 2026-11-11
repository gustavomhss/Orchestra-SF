import type { ServerConnection } from "@/context/server"

// The default server is what the app opens on launch, so it moves with the entry it pointed at.
export async function moveDefaultWithReplacedEntry(input: {
  previous: ServerConnection.Key
  next: ServerConnection.Key
  remove: (key: ServerConnection.Key) => void
  getDefault?: () => Promise<ServerConnection.Key | null>
  setDefault?: (key: ServerConnection.Key | null) => Promise<void> | void
  report: (error: unknown) => void
}) {
  input.remove(input.previous)
  // A failed read does not say this entry was the default, so the write is not attempted.
  const current = await Promise.resolve(input.getDefault?.()).catch(() => null)
  if (current !== input.previous || !input.setDefault) return
  try {
    await input.setDefault(input.next)
  } catch (error) {
    console.error(error)
    input.report(error)
  }
}
