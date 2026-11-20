# Sucafina analytics

Open **Analytics** in the Sucafina chapter for the installation you are using. Choose an analysis view and its start and end dates, then select **Choose context**. The available selections and Planner versions come from the current installation.

Choose the selection you want to inspect and select **View data**. For a financial view, **Compare Planner versions** lets you choose the base version, candidate version and three-letter comparison currency explicitly. Both version references must appear in the authorized options for that period. The application does not choose a first or latest version for you.

## Refreshing and changing a selection

**Refresh data** checks current access and reads the available options again before refreshing a previously requested analysis. The analysis also checks access and refreshes on window focus and every 30 seconds. An active data request does not block the separate access check.

Changing a filter or selection removes the previous result. You can clear the selection even while an options refresh is pending; the pending response cannot restore it. Choose the new context and selection before requesting data again.

## Opening a source and returning

Use **Open original source** on a displayed measure to resolve its exact original value and evidence digest. Authorized source links open the corresponding native Sucafina page for the same server, project and installation. The destination is authorized and read again by that page.

When a measure depends on several original sources, each source has its own button, identified by its original record and reference. Choose the source you want to inspect; the application resolves that exact value and evidence digest without choosing a comparison side for you.

Returning to Analytics within the same owner preserves only the human filters, version choices, currency and measure/source focus. Analytics checks current access and reads both the options and data again before showing the result and restoring focus. A previous projection or source link is never replayed as a current result.

## Access changes and sign-out

If the access check reports that access or the session has changed, the current view is removed and pending reads are cancelled. A late successful response cannot restore private data.

**Sign out** starts the real identity logout request and immediately removes the private view, before that request completes. Repeated activation while sign-out is pending does not send another logout. After sign-out, use the normal installation sign-in flow before opening analytics again.
