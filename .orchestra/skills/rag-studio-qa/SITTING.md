# Sitting, 2026-11-11

Isolated server `127.0.0.1:4097`. Not the owner's Orchestra. The screen and the HTTP API were checked against each other. The story runner exited 0. This file records the look. The runner must not mark these passed.

- J01 pass. The four lights sit on one row and can be read without hover. The one that is on is distinct.
- J02 pass. Show the cut paints the cut on the source text.
- J03 pass. Read again, cut again, redo numbers, and remove pieces are separate. Each has its own Run. There is no reindex button.
- J04 pass. When retrieval is unnecessary, the screen says so. With K at 0, it does not.
- J05 pass. Admitted files show read, failed, or not yet read. A path outside the folder is refused and is not listed. When the open folder is the git project, project source is refused as Atlas and is not listed.
- J06 pass. Sent, search missed, and dropped before the model show the span on the source text. A missing sentence and an unread file show no span.
- J07 pass. Sent says the span was in the block. It says that does not mean the model used it.
- J08 pass. After one boundary change and a separate recut, every saved question is listed. The harbor sentence changed. The pier sentence did not.
- J09 pass. Read, failed, and not yet read are visible. After remove, the file is gone from the list and from the API.
- J10 pass. With the files read, exactly one light is on, matching the diagnosis. With the only relevant file not yet read, no light is on and that status is visible.

Limits, not failures of these items:

- A file inside a nested git repo is admitted when the open folder is not that repo. The refusal is the open location's project tree.
- A failed file has no text, so a question cannot name it as the only relevant file. The files screen still shows failed.
- The preview query hack in `chapter-route.tsx` is not part of this change.
