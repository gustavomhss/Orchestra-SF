# Session compaction

Compaction summarizes older conversation context while retaining a recent tail. Only a successful summary creates a compaction checkpoint.

If a started attempt fails, returns an empty summary, or is interrupted, Orchestra records a generic failure marker: `Compaction failed` or `Compaction interrupted`. A partial summary is not a successful summary. The failed attempt does not truncate history or replace an earlier successful checkpoint.

Provider failures and empty summaries keep the existing warning and unsuccessful result; model-policy failures and interruptions still propagate to the caller. The marker does not add automatic retries. You can request compaction again manually; automatic compaction continues to follow the existing settings and budget checks. An ineligible attempt that never starts has no failure marker.
