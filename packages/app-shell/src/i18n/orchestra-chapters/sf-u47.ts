/**
 * N14 / U47 leaf dictionary. Frozen CAP08 strings are bilingual; original
 * Talent Review renderer field/option labels intentionally retain English when
 * the source supplies no pinned pt-BR translation.
 */
export const SF_U47_COPY = {
  "sf.cap08.title": "Talent Review",
  "sf.cap08.primary": "Edit review",
  "sf.u47.name": "Name",
  "sf.u47.title": "Title",
  "sf.u47.type": "Type",
  "sf.u47.leader": "Leader",
  "sf.u47.location": "Location",
  "sf.u47.start": "Start date",
  "sf.u47.end": "End date",
  "sf.u47.status": "Status",
  "sf.u47.classification": "Classification",
  "sf.u47.outlook": "Outlook",
  "sf.u47.notes": "Notes",
  "sf.u47.notReviewed": "Not reviewed",
  "sf.u47.employee": "Employee",
  "sf.u47.contractor": "Contractor",
  "sf.u47.active": "Active",
  "sf.u47.onLeave": "On Leave",
  "sf.u47.terminated": "Terminated",
  "sf.u47.talent": "Talent",
  "sf.u47.solidContributor": "Solid Contributor",
  "sf.u47.lagger": "Lagger",
  "sf.u47.promote": "Promote",
  "sf.u47.stay": "Stay",
  "sf.u47.replace": "Replace",
  "sf.u47.termination": "Termination",
  "sf.u47.statusFilter": "Status filter (blank = Active)",
  "sf.u47.importTitle": "Import members workbook",
  "sf.u47.replaceMembers": "Replace members",
  "sf.u47.confirmReplacement": "Confirm replacement",
  "sf.u47.import": "Import",
  "sf.u47.export": "Export All Members",
  "sf.u47.delete": "Delete",
  "sf.u47.save": "Save member",
  "sf.u47.addMember": "Add member",
  "sf.u47.importNamedRows": "Import needs named member rows.",
  "sf.u47.replaceConfirmation": "Replace requires confirmation.",
  "sf.u47.versions": "Each matched member version is required.",
  "sf.u47.importRoute": "Import",
  "sf.u47.exportRoute": "Export",
  "sf.u47.installation": "Installation",
} as const

export const SF_U47_COPY_BR: Readonly<Record<keyof typeof SF_U47_COPY, string>> = {
  ...SF_U47_COPY,
  "sf.cap08.title": "Avaliação de talentos",
  "sf.cap08.primary": "Editar avaliação",
}
