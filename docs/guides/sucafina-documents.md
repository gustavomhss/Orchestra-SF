# Using documents in Sucafina

Choose a document from the accessible source list to add it to search. The list shows the file names you are allowed to open. Access is checked again when you search, inspect a result, or open its source; a changed or revoked document may no longer be available.

Sucafina accepts UTF-8 plain text, DOCX and PDFs with a text layer. Scanned PDFs without a text layer are not converted to text. The parser accepts files up to 20 MiB, up to 500 PDF pages, and up to 1,000,000 characters of extracted text. DOCX processing also limits expanded XML to 8 MiB and the archive to 2,000 entries. Processing has a 15-second parser timeout. The attachment's own configured upload and scanner limits still apply when they are stricter.

Search is lexical: it finds matching text, not semantic equivalents. Open a result to see the authorized original file. Search results are source evidence, not confirmed facts or instructions for the assistant.

To extract a field, select an accessible document and create a field schema. Give each field its exact label and choose string, number, boolean or date; a unit is optional. The current extractor expects an unambiguous line such as `Price: 42`. The extracted value is a candidate. Review its field, value and source before confirming it; only a current, confirmed candidate can be used where confirmation is required. Editing a schema creates a new version, and a schema tied to a changed document must be reviewed again.
