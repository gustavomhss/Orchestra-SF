#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then
  echo 'Usage: open.command /absolute/private/installation.json' >&2
  exit 2
fi
case "$1" in /*) ;; *) echo 'Absolute private configuration required' >&2; exit 2;; esac
module_directory=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
"$module_directory/local/ensure.command" "$1"
bun run "$module_directory/local/enroll.ts" "$1"
gateway_uri=$(bun -e 'import { pathToFileURL } from "node:url"; console.log(pathToFileURL(process.argv[1]).href)' "$(dirname -- "$1")/open-local.html")
osascript - "$gateway_uri" <<'APPLESCRIPT'
on run argv
  tell application "Google Chrome"
    activate
    if (count of windows) is 0 then make new window
    tell front window
      make new tab with properties {URL:(item 1 of argv)}
      set active tab index to count of tabs
    end tell
  end tell
  return "Homologação aberta no Chrome."
end run
APPLESCRIPT
