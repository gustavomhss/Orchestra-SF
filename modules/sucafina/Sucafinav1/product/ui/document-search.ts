/** Resolve each result again before presenting a source link. */
export const documentSearchScript = `
document.querySelectorAll('[data-document-result]').forEach(async (entry) => {
  const title = entry.querySelector('[data-document-title]')
  try {
    const url = new URL(location.href); url.search = ''; url.searchParams.set('sf', 'document-open'); url.searchParams.set('ref', entry.dataset.ref)
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' }); const result = await response.json()
    if (!response.ok || result.status !== 'ok' || typeof result.value?.title !== 'string') throw new Error('unavailable')
    title.textContent = result.value.title
    if (typeof result.value.href !== 'string') return
    const target = new URL(result.value.href, location.href)
    const mount = location.pathname.replace(/\\/(dashboard|planner|procurement)$/, '')
    if (target.origin !== location.origin || !target.pathname.startsWith(mount + '/')) throw new Error('invalid-target')
    const link = document.createElement('a'); link.href = target.href; link.textContent = 'Open source'; entry.append(link)
  } catch { title.textContent = 'Document unavailable or access changed.'; entry.querySelector('[data-document-text]')?.remove() }
})
`
