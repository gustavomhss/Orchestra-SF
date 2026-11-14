# Peer revisado do mapa final WP01 / WP02

**Nenhum bloqueador restante de metadados ou da distinção entre estado atual e histórico foi encontrado no FINAL v3.** Esta revisão é de um autor contribuinte e não constitui parecer nativo independente, aceite de S0 ou gate global.

Catálogo revisado: **1.227.202 bytes**, SHA256 `bd9cc6a28f0e1aaf8f1da40147ff70e1cbf2c8075b3f35a295ede65ccd1970ee`. O produto testado permanece `f4ed6dfd82502bcebc091b9be6ce74d4eccf89b7`, tree `71fc6e6bb70f44b50cfb66e33a86ccd149ab32ad`.

## Limite da primeira leitura

O peer v1 confirmou IDs/textos, referências, blobs e o registro de observações, mas deixou passar uma contradição narrativa: `limits` atribuía ao W16 um hook e dois corpos bloqueados que pertenciam ao W15. Também não detectou que os dois testes PASS de destinatários mantinham `candidateAttemptScopeRef` apontando para uma nota antiga de corpo não executado. A varredura ampliada identificou ainda limites históricos sobre W6/W11 e seleção apenas de período que continuavam ligados como estado atual. Referências existentes não garantem que a frase associada represente o momento correto.

Os bytes originais ficam preservados como artefatos **superados**, sem substituir seu conteúdo: [peer v1 JSON](final-metadata-peer-v1-superseded.json) e [peer v1 legível](final-metadata-peer-v1-superseded.md). No bundle, os destinos completos são:

- `modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP01/astra-interface/inputs/final-metadata-peer-v1-superseded.json`
- `modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP01/astra-interface/inputs/final-metadata-peer-v1-superseded.md`

Seus SHA256 continuam `f07155db55b1564483025e2946938b2402f8e80b877de1d2128a9314e732a91d` e `b033501f85c615f7426d4a2d5d281005e79676240734f3cf329818afe827ba14`, respectivamente. O parecer que cobre a versão corrigida é este, publicado em `inputs/final-metadata-peer.md`, com recibo estruturado em [inputs/final-metadata-peer.json](final-metadata-peer.json).

## Retificações conferidas

W16 contém **quatro corpos nomeados PASS: dois consumidores e dois harness, sem hook falho e sem destinatário bloqueado**. Os dois `candidateAttemptScopeRef` antigos saíram da descrição atual. Os mesmos IDs de nota e o único evento do W15 continuam em `historicalAttemptScopes`, com `O-9ee821ae4b66` e run `43593121437`. As 1.272 observações não foram alteradas.

Treze notas antigas foram movidas para vínculos históricos, com texto/ID preservados. Os limites atuais reconhecem rebase, lifecycle de conversas, seleção de caso/fontes/período, diretório e recuperação já implementados e provados em seus SHAs. As descrições atuais de componentes, G02 e D08 também distinguem esses resultados das falhas e revisões anteriores; ações W6d/W7 superadas não são instruções correntes de critérios.

G03 continua delimitado: cinco casos de seleção PASS W14, diretório/logout PASS W16, responsável como ação separada, montagem positiva de signals/destinos pendente e revisão do primeiro409 sem contraprova runtime. O CAS comum `conflict/product-state-changed` ainda vira503 no produtor admitido; apenas `preview` vira o409 conhecido. O patch OWNER-ONLY não foi aplicado nem executado. Uma futura contraprova com dois POSTs reais depende da publicação do owner e deve conservar o retry exato de uma tentativa previamente incerta.

## Integridade e escopo preservados

- **153 IDs/textos canônicos**, 75 WP01 + 78 WP02, 9 tasks e 36 cláusulas gerais permanecem exatos.
- Os **435 títulos**, as **1.272 observações**, as **31 identidades/resultados de runs** e as fontes do produto continuam preservados do W16. Somente os dois registros de destinatários mudam os campos de classificação histórica descritos acima.
- Os nove artefatos do inventário FINAL v3 conferem em bytes, SHA256 e blob. Referências atuais e históricas resolvem; as notas históricas originais permanecem textualmente idênticas.
- Todos os critérios continuam `NOT_DECLARED_DONE`, e static continua FAIL em nove locais estrangeiros. C05, C12 e continuidade de draft mantêm seus limites/falhas específicos.
- O PASS do lifecycle normal não prova cleanup após cancelamento, callers standalone ausentes, causa/cura do I/O, host completo, capacidades nativas ou gates globais.

Nenhum produto/check/CI foi executado. Nenhum código, teste, fixture ou matriz foi editado por esta revisão. O JSON registra as verificações, os hashes e a correção do escopo que escapou ao peer v1.
