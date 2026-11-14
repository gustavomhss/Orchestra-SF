# Using documents in Sucafina

Choose a document from the accessible source list to add it to search. The list shows the file names you are allowed to open. Access is checked again when you search, inspect a result, or open its source; a changed or revoked document may no longer be available.

Open **Documents** from the existing Sucafina page. The Request selector narrows the source list to attachments of that Request. Selecting a file captures the current Request and attachment revisions. If either changes before opening it, refresh the list and review the current file. A selection belongs to the authenticated person who obtained it and expires after five minutes.

Sucafina accepts UTF-8 plain text, DOCX and PDFs with a text layer. Scanned PDFs without a text layer are not converted to text. The parser accepts files up to 20 MiB, up to 500 PDF pages, and up to 1,000,000 characters of extracted text. DOCX processing also limits expanded XML to 8 MiB and the archive to 2,000 entries. Processing has a 15-second parser timeout. The attachment's own configured upload and scanner limits still apply when they are stricter.

Search is lexical: it finds matching text, not semantic equivalents. Open a result to see the authorized original file. Search results are source evidence, not confirmed facts or instructions for the assistant.

To extract a field, select an accessible document and create a field schema. Give each field its exact label and choose string, number, boolean or date; a unit is optional. The current extractor expects an unambiguous line such as `Price: 42`. The extracted value is a candidate. Review its field, value and source before confirming it; only a current, confirmed candidate can be used where confirmation is required. Editing a schema creates a new version, and a schema tied to a changed document must be reviewed again.

Each candidate shows its field, value, unit, document revision and the exact source excerpt. **Open original** uses the existing authorized attachment route. **Confirm this field** records the explicit human action without changing a Request, approving a purchase, or applying an import. The same evidence identity and source offsets remain available to consumers before and after confirmation; the confirmed reference also identifies its confirmation version. Revoked or replaced files cannot continue to supply an apparently current value.

Ambiguous numbers, currencies or dates are not guessed. Use unambiguous decimal numbers and ISO dates, or review the source and choose a text field when the meaning is not settled. Invalid, protected, empty and scanned documents report a reason; they do not create fabricated candidates. The current search is bounded to the admitted document index and reports its lexical and scan limits.
