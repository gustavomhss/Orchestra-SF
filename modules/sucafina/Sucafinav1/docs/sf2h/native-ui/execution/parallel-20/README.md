# UX nativa Sucafina — execução agressiva com 20 sessões potenciais

**Atualização de fato posterior ao S0-control:** ACK105 foi publicado em `sf2-stack@d083b422b6a587f47873abde4d866e35017ff8b8`; lease `S0-C-e15-browser105` ativa para a integração de produto. O candidato material observado posteriormente chegou a **C53** `180212940105e7b9ad15171b067c1c1b7841df5f`, tree `c423dd1e0828242534fd45d4183104ecc1d20edd`. Isso substitui o status antigo `PREPARED_NOT_STARTED` somente como **estado histórico observado**, mas **não autoriza C00/UX20** a compartilhar a lease sem designação exata nem inicia 19 writers; para executar, reconsultar HEAD/ACK/leases. Produto CI101 exclusivo, compiler/guards45. `GLOBAL_RELEASE=false`.


**Estado exato: contrato e despacho RECONCILIADOS; GO de escrita ainda dependente de S0 e integradora sucessora vigente (71/100 encerradas), releases dos owners, material C/HEAD e parecer independente do delta.** Este arquivo não dá autorização, não cria lanes, não executa CI, não libera produto. `GLOBAL_RELEASE=false`. Não chamar de `RUNNING`, `QUALIFIED` ou `CLOSED` sem evidência instalada.

## Fonte única de verdade

- **Norma operacional corrigida:** branch `ux-20-dispatch`, PR99, base de contrato fixada no SHA `cbac654784714f68779ae1434d30e6ea8970c4d1` em `dispatch.json.source.commit`; até esse SHA, `CONTRACTS.md`, `host-signatures.ts`, `component-signatures.ts`, `SURFACE-SPECS.md`, `contract-catalog.json`, `surface-manifest.json`, `component-locks.json`, `ACCEPTANCE.md`, protocolo e ordens individuais foram reconciliados. Versões posteriores deste diretório apenas orientam distribuição e verificação, salvo nova mudança normativa declarada.
- **Plano anterior:** PR76 `sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a` e review77 PR91 `native-plan-review@16712630025cad3de647f2ea49ecbcdb2cc854fa`. Sua triagem FIX-FIRST é origem dos achados, não contrato concorrente; as propostas 77A–77E **não** são uma segunda fila.
- **Canônico preservado:** `dbf9547211d9b0fade619790de7c19c0869b7c7d`: 15 WPs, 74 tasks, 17 contratos e 1.610 critérios. O manifesto único mantém **78 ordens**: I00, D01, F01–F04, S01–S05, A01–A15, U01–U47, Q01–Q02 e R01–R03.
- **Snapshot verificado 2026-11-15:** C51 `529142f63683de8e4b1f7d4232f88faf8ffcef6c`, tree `d679b541596dab3b280a87e15e4a0b29ee518262`; `sf2-stack@a6abd2c8d321daf1089f4d440027c46209a89cbe` é terminal documental da missão100, lease ENCERRADA; P03 original FAIL, produto sem freeze. Próxima autoridade depende de nomeação S0, não de inferência da71/100.
- **S0 controle posterior:** `8819df6169abd94aaa89d50a21f113e5596d2aae` preparou integradora105, ainda `PREPARED_NOT_STARTED`; 101 tem CI de produto exclusivo, 45 compiler/guards; nenhuma licença de escrita inferida da designação.
- **Material real da stack:** `sf2-stack` e ACKs S0 e integradora sucessora vigente (71/100 encerradas)/45/72/73/74 mudam independentemente. Cada GO depende de *observação atual* de SHA/tree e blobs por família, jamais de um SHA histórico da documentação.

## Conteúdo pronto para o operador

| Arquivo | Uso único |
| --- | --- |
| [dispatch.json](dispatch.json) | 20 cartas, allowlists reais dos outputs, locks, deps, testes e prompts completos; nenhuma permissão implícita |
| [PROMPTS.md](PROMPTS.md) | 20 mensagens individuais geradas diretamente dessas cartas, prontas para abrir sessões **após preflight** |
| [GO-NOGO.md](GO-NOGO.md) | Ordem operacional do coordenador, lista de bloqueios, dedupe CI, estados, piloto, FINAL e métricas |
| [LIVE-STRUCTURAL-AUDIT-20261115.json](LIVE-STRUCTURAL-AUDIT-20261115.json) | Evidência estrutural desta rodada: 78 ordens, 23 checks, delta I00 e limites NOT_RUN, sem GO |
| [ADVERSARIAL-AUDIT.md](ADVERSARIAL-AUDIT.md) | R77-F01..F08 e contraexemplos adicionais, decisão, evidência, risco residual e provas exigidas |
| [launch-record.template.json](launch-record.template.json) | Schema para registrar somente fatos observados: C/tree, autoridade, sources, owner ACK, lease, slots e runner |
| [validate_dispatch.py](validate_dispatch.py) | Verificador documental fail-closed das 20 cartas versus 78 ordens/70 superfícies/305 operações; nunca concede GO |
| [../manifest.json](../manifest.json) e [../EXECUTION-PROTOCOL.md](../EXECUTION-PROTOCOL.md) | Fila única, ciclo de vida e deduplicação já existentes. Não criar segundo scheduler, segundo dispatcher ou outro integrador |

## Primeira onda — teto de 20 sessões, 19 autores disjuntos

C00 é único coordenador/I00 e só pode escrever na stack se sua identidade e lease forem as mesmas do integrador material atualmente nomeado por S0; caso contrário C00 é SOMENTE leitura e encaminha patches inertes ao owner único. W01–W19 são capacidade **potencial** de autoria, somente depois de ACK, lease e contratos FROZEN por output. Sequência de cartas (nomes exatos no JSON):

- **Fundação/host:** W01 D01 (broker desktop), W02 F01 (owner/URL/contexto), W03 F02 (transporte/portas), W04 F03 (frame/estados), W05 F04 (harness), W06 S01 (lista/detalhe), W07 S02 (MonthlyGrid), W08 S03 (draft/review/receipt), W09 S04 (evidências), W10 S05 (colaboração).
- **Domain e piloto:** W11 A03 (Procurement), W12 U10.queue, W13 U13.pr-approval, W19 U11.title-save. **P0** = título `pr.title` de PR draft/rejected, CAS `versions['requests:'+id]` e fence de owner na transação original; sem receipt C12, sem aprovação. **P1** = PR submetida sob holder/versão reais e aprovação U13 com M31/MI07 retidos. Ambos web+desktop, papéis/owner negativo e perda de resposta sem retry.
- **Outros adapters disjuntos:** W14 A01, W15 A02, W16 A04, W17 A05, W18 A06. **A07** permanece entre as 58 ordens da fila remanescente; as capacidades completas U10.overview, U11.complete, U13.complete e os 3 FINAL continuam mandatórios, não substituídos pelos increments.

As 138 reivindicações de escrita dessas cartas foram conferidas **documentalmente** sem conflito entre sessões. Este resultado não detecta leases concorrentes atuais de outros projetos; C00 **precisa** conferir ownership vivo. As fontes permitem autoria em paralelo contra interfaces congeladas, mas integração requer implementações reais, e qualificação serviços/identidades/provas no mesmo C. Não confundir `ARTIFACT_READY` com `QUALIFIED`.

## Fechamentos normativos R77-F01–F08

| Achado | Onde foi fechado como decisão | Prova operacional não substituível |
| --- | --- | --- |
| F01 — URL e owner | `CONTRACTS §2.3`, F01/I00, transição única sidebar/menu/deep link/teclado/histórico/ConnectionGate | A explicitamente selecionado, B persistido, late-response e troca sem Chat |
| F02 — descoberta/ctx | `CONTRACTS §2.1–2.2`, host signatures e `ctx.installations/context` catálogo | `select=ids` independente de directoryB, contexto hostId, tuple real |
| F03 — Microsoft e bootstrap | `CONTRACTS §4.2`, intent opaca single-use via `dashboard?sf=native-return` mantendo `safeReturn` original | ACK72, Entra real, callback, expiração/replay/restart, partição desktop |
| F04 — semântica/autoridade | `CONTRACTS §3.2`, `X-SF-Native-Owner` na transação; P0 title vs P1 approval | patch I00 após ACK73/74, CAS e 0 commits no owner errado, M31/MI07 |
| F05 — draft | `COMPONENT-CONTRACTS §7` e S03/F01 | dirty, 503, revogação/logout, navegação/response loss |
| F06 — views/landing | `CONTRACTS §5.6`, A12/U43 (UI32), F01/U01 | produtor pessoal v2 ainda precisa ser implementado e provado; legado v1 inalterado |
| F07 — paste | `COMPONENT-CONTRACTS §4`, `component-signatures`, A02/S02/U07 | `monthly-edit/monthly-host`, TSV, 0..11→1..12, CAS por linha/partial/mobile |
| F08 — FINAL | `ACCEPTANCE §6`, R01 produto/UX/native, R02 finanças/ACL, R03 IA/MCP/Atlas/Relay/Schedule/WP14 | três revisores **novos** e independentes do mesmo C final |

**Status correto dos oito:** decisões agora constam das fontes normativas. Isso não equivale a aprovação independente desta nova revisão nem a PASS de código, testes, CI, renderização, Microsoft, scanner, skills ou release.

## Execução sem retrabalho — condições não negociáveis

C00 valida documento/digest/branch e reconcilia owners reais uma vez; entrega a cada writer sua ficha específica e preimages. Em cada saída, writer só escreve a allowlist, publica `ARTIFACT_READY` com receipt/handoff e solta a capacidade, sem aguardar serviços ou duplicar controllers. I00 integra por output com CAS e recebe fragmentos dos shared registries, sem reimplementar o que pertence ao produtor. O owner101 de CI produto (45 somente compiler/guards) escolhe testes causais e só deduplica request/runner/fixture/config/C idênticos; nenhuma suite repetida sem causa, nenhum green transplantado entre C.

As revisões finais R01/R02/R03 seguem no candidato completo corrigido, com original `GLOBAL_RELEASE=false` até autorização S0 e gates C/G7–D/G8. Não substituir banco, autenticador, parser, scanner ou contrato por stub para ficar verde. A velocidade não suspende rigor; fator 10× é **meta não medida**.

**Comandos documentais para operador autorizado**, após preparar working tree com dependências: `python execution/parallel-20/validate_dispatch.py --root execution`, depois `python execution/validate_plan.py --root execution --strict --canonical <caminho-da-campaign.json>` usando os argumentos reais da CLI desse validador. Verificar `--help` antes de invocar e manter gates de produto no CI 45. **Nenhum desses comandos foi executado nesta publicação.**
