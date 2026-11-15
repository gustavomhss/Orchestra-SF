# Continuação da UX nativa SF — 20 sessões sem dois planos concorrentes

**Estado: PREP_ONLY / FIX-FIRST.** Este pacote é uma preparação documental de delegação; não é autorização para escrever produto, abrir 20 leases, executar CI, fazer merge, publicar release ou trocar custódia. A PR #76 permanece draft. A lista de 78 ordens em `../manifest.json` é a única fila executável quando liberada; não há um novo scheduler nem uma segunda campanha.

## Identidades preservadas

- Plano nativo: `sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a`, PR #76, frozen for this continuation. Esta branch separada não altera os 115 arquivos do pacote.
- Revisão independente: `native-plan-review@16712630025cad3de647f2ea49ecbcdb2cc854fa`, PR #91, verdict `FIX-FIRST`; triagem limitada do novo head está em `review77/LATE-DRIFT.md` dessa branch. O parecer não aprova as 305 operações nem o novo PDF.
- Canônico: `dbf9547211d9b0fade619790de7c19c0869b7c7d`, 15 WPs, 74 tasks, 17 contratos e 1.610 critérios intactos.
- Material `sf2-stack` e ACKs de S0/71/72/73/74/45 **não estão pinados por esta publicação**. I00 deve ler as autoridades atuais. Nunca usar o SHA histórico `faa30fdd` como material live sem reconciliação.

## O que as 20 sessões significam

Uma sessão `C00` é coordenadora/I00, e 19 sessões `W01`–`W19` são **potenciais autoras de um output por vez**. `dispatch.json` contém 20 cartas individuais prontas para distribuição após as condições; não cria sessões, branches, leases nem aprova escrita. A contagem é capacidade desejada, não capacidade observada; I00 só admite tantos autores quanto sejam realmente disponíveis e sem conflito de arquivo/lease.

Fatiamento da primeira leva: D01 desktop; F01–F04 fundação; S01–S05 componentes; A03 Procurement; U10.queue e U13.pr-approval piloto; A01, A02, A04–A07 adaptação por domínio. As 58 ordens ainda não atribuídas e os outputs remanescentes U10.overview/U13.complete permanecem obrigatórios na fila do manifesto original. Q01/Q02 e R01–R03 nunca são omitidos nem antecipados como aprovação FINAL.

Os contratos podem permitir autoria antes dos produtores concretos, **somente se a família de contrato exata estiver fechada, seu hash estiver no launch-record e o output não depender de uma decisão contraditória**. `ARTIFACT_READY` libera autor após handoff, mas não se converte em `INTEGRATED` ou `QUALIFIED` sem evidência da stack correta.

## FIX-FIRST: oito deltas da revisão77 a reconciliar no plano normativo

Estas são decisões de direção para fechar os conflitos, **não alegações de que os arquivos normativos já foram editados, compilados ou validados**. I00 deve publicar o diff exato no catálogo, assinaturas, superfícies e ordens afetadas, rodar validação documental e obter a autoridade necessária antes de promover `FROZEN`.

| ID | Direção única de correção | Gate mínimo para liberar o output afetado |
| --- | --- | --- |
| R77-F01 | Transição de owner/URL/seleção visual **atômica depois da autenticação**, em todos os ingressos (sidebar, menu, teclado, histórico, deep link); URL explícita A não usa contexto persistido B como fallback; resposta tardia de A não publica em B | F01/I00 e regressão de navegação com A/B, back/forward/reload e troca de projeto |
| R77-F02 | Discovery de instalação deve aceitar IDs/location autorizados **sem exigir directory antigo já selecionado**; endpoint metadata global no HttpApi atual e negócio no mount; tuple instalação/projeto/host conferido pelo servidor; mesma Request preparada; Basic Orchestra não dá grant SF | Contrato único de ctx, bootstrap, porta e SDK/provider; owner I00/F01/F02 |
| R77-F03 | Bootstrap só nas condições reais de identidade/configuração e sem transformar roleMap vazio em ausente. Retorno Microsoft com intent opaco, efêmero, one-use, destino nativo limitado e revalidação de binding; **não ampliar safeReturn para URLs arbitrárias**. Qualquer alternativa que mude retorno/OAuth exige ACK explícito 72 | Contract+preimage+ACK72; testes de ticket expirado/reutilizado, logout, contexto e usuário sem grupo |
| R77-F04 | Preservar POST/payload/Origin/idempotência dos produtores de views/análises; saída HTML nunca vira JSON por scraping. Fazer **P0 title-save real** (edição `pr.title` com CAS `versions['requests:'+id]`, sem receipt C12 inventado) como smoke transacional e **P1 aprovação real** original como gate adicional de negócio, mantendo M31/MI07. `X-SF-Native-Owner` deve ser comparado com principal/tuple privados **na mesma transação após auth e antes do execute**, não só no frontend | F02/A03/U10/U11/U13 + precondition instalada e owner mismatch 0 commits; nenhum replay após perda de resposta |
| R77-F05 | DraftState acima do remount, LeaveGuard antes de navegação voluntária, estados clean/dirty/saving/outcome-unknown; ficar/descartar/revisar; 503 conserva só com owner autorizado, revogação/logout purga. Descartar UI não cancela mutação já enviada | F01/S03 + testes, sem marcar runtime PASS pela documentação existente |
| R77-F06 | View salva e preferência de landing como variante **versionada, aditiva, persistida pelo servidor** com target nativo fechado, owner, ACL, CAS, filtros e migração bidirecional das 28 capacidades. Hoje é fallback somente sem preferência válida. Não remapear `SfPersonalView` ao modelo legado incompatível | Catálogo, DTO, produtor e U41/A12 reconciliados; UI32 continua HOLD próprio |
| R77-F07 | MonthlyGrid precisa de seleção retangular/TSV, preview de erros/locks, texto original, CAS por linha, parcial/conflito e reenvio só de correções; reusar `monthly-edit/monthly-host`, preservar input multi-linha mobile e números do produtor | S02/A02/U07–U09 + assinatura pública e regressão; não reduzir a edição célula-a-célula |
| R77-F08 | Três FINAL independentes no mesmo C: R01 produto/UX/native/a11y e arquitetura pertinente; R02 semântica financeira, permissionamento, persistência e evidência; R03 IA/skills/MCP/Atlas/Relay/Schedule/documentos/WP14 e integrações. Cobertura transversal arquitetural distribuída conforme risco. Revisor não julga sua autoria | Corrigir ACCEPTANCE + R01/R02/R03 e matriz dos canônicos; revisor que programou é substituído |

A revisão77 recomenda cinco pacotes 77A–77E, **não** uma segunda fila em concorrência com I00/F/A/S/U/Q/R. São insumos de correção do contrato único; nenhuma dupla de escritores recebe os mesmos paths. As mudanças de segurança/transporte dos produtores 72/73/74 e a autoridade S0/71/45 continuam externas. Nenhum gate canônico é relaxado.

## Protocolo de despacho da C00

1. Inspecionar `sf2-stack` atual, branch da PR76, revisão77, canônico, AGENTS, ACKs e releases; registrar o que mudou **por família de fonte**, não reler indiscriminadamente toda a campanha. Confirmar o único dono de integração e o dispatcher canônico.
2. Publicar `launch-record` com SHA/tree material, hashes de catálogo/componentes/rotas/copy, estados resolvidos dos oito findings, actor/branch/lease/allowlist por output, writer atual de cada path, runners e seleção de CI, autoridade e blocker. **Sem esse registro não existe GO.**
3. Fazer os reparos normativos que realmente faltam na fonte única, com patches ownership-aware; reexecutar `validate_plan.py` documental e revisão independente do delta. Não declarar os achados fechados porque este README os enumerou.
4. Quando S0/71 autorizar, colocar cada carta individual em `READY_FOR_AUTHORING` **somente se** suas próprias famílias estiverem FROZEN e sua lease não colidir; registrar e publicar ACK real da sessão. Ao receber `ARTIFACT_READY`, consumir exatamente o output no C, validar pelas seleções causais e liberar slot.
5. Reutilizar a lane liberada com o próximo output da fila de 78 ordens: dependência de autoria satisfeita, maior número de consumidores desbloqueados, prioridade e ID; não bloquear por piloto/serviço externo quando autoria disjunta é possível.
6. Integrar incrementalmente com CAS e provas no mesmo C; três FINAL só ao fim, por autores independentes; manter `GLOBAL_RELEASE=false` até a autoridade canônica e os gates reais.

## Limites de prova desta continuação

Leitura direta de PR76 e PR91 e dos contratos/ordens relevantes. Não houve product edit, teste do produto, CI, build, scanner, Microsoft live, criação de 20 sessões, lançamento de 20 branches nem validação do ganho de 10×. A publicação desta branch é **documental e proposta**; a execução começa só depois de cumprir os gates acima.


## Atualização normativa de reconciliação (mesma fila)

A PR99 agora possui correções diretamente nas fontes: `CONTRACTS.md`, `host-signatures.ts`, `contract-catalog.json`, `SURFACE-SPECS.md`, `surface-manifest.json`, `component-signatures.ts`, `component-locks.json`, `ACCEPTANCE.md` e work-orders afetadas. A fonte definitiva é **a versão atual destes arquivos da branch PR99**, não as propostas de correção acima. Esta branch contém apenas documentação e assinaturas de desenho; os schemas exibidos não compilam como código do produto, e sua leitura não declara o produtor implementado.

O piloto é **P0 title-save `U11.title-save`** (edição `pr.title` de draft com CAS e fence real, sem receipt C12) e **P1 `U13.pr-approval`** (aprovação real de PR submetida sob holder atual e M31/MI07), com `U10.queue` e duas seleções Q01/Q02. Nunca equivaler P0 a aprovação. UI32 pertence a **U43**, não U41; a preferência de entrada é integrada por F01/U01 quando o produtor de views v2 estiver admitido.

A primeira leva inclui o output `U11.title-save`; o adapter A07 continua na fila de 78 ordens, sem ser retirado do escopo. O envelope de 20 sessões passa a ser uma capacidade máxima desejada, não 20 branches/leases pré-criados. O integrador faz source/readback por SHA vigente, ACK de ownership e release explícito de todos os paths existentes antes de permitir qualquer edição de produto.
