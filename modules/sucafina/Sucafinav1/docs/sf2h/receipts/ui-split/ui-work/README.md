# ui-work — seleção, replies e respostas

**Entrega: incremento publicado e revisável, com aceite parcial.** PR [#47](https://github.com/gustavomhss/Orchestra-SF/pull/47), `ui-work` → `interface-resume`. G03 e C03 não são declarados fechados. Os 75 critérios de WP01, 78 de WP02 e gates globais permanecem preservados.

## Comportamento entregue

- `case-work-selection.ts`: preflight sem cache e deadline conservado até consumir o corpo da resposta. Caso, fontes e período permanecem na tentativa; retry usa o mesmo corpo e a mesma chave.
- `work-collaboration.ts`: preparação da confirmação usa sempre a identidade completa da mensagem selecionada: pergunta, mensagem, encarnação e versão. Um seletor salvo de mensagem anterior não prevalece sobre essa seleção, mesmo com autor e texto iguais.
- O ACK direto exige o append exato ao snapshot transacional C08, preservando as identidades/versões anteriores e validando a nova mensagem. A projeção corrente de destinatário continua inconclusiva, porque não contém recibo inequívoco da mutação; o consumidor conserva a tentativa congelada.

O delta de produção é de dois arquivos, com 15 linhas acrescentadas e 12 removidas. Nenhum produtor, host, driver, fixture compartilhado, workflow, guard ou política financeira foi alterado.

## Observações e limites

| Prova | Resultado | Observação |
| --- | --- | --- |
| Reply direto: resposta perdida, textos idênticos, retry e reload | **PASS no componente**, run 02 | Três replies reais com texto igual, quatro mensagens totais, duas tentativas de mesmo corpo/chave e versão de armazenamento 4 sem nova mutação no replay/reload. |
| Destinatário distinto: ACK inconclusivo, retry, reload e nova admissão | **PASS no componente**, run 02 | Autor `person`, destinatário `reader-b`; homônimo recusado. Quatro mensagens persistidas, duas tentativas idênticas e nenhum ACK inventado a partir de `RecipientThread.current`. |
| Seleção do primeiro ciclo: perda de resposta, retry e reload | **PASS no componente**, run 02 | Uma seleção persistida, versão 1; caso, fonte e período 01–31/03/2026 preservados; nenhum autosave no reload. |
| Conflito G03 real e review | **FAIL**, run 02 | Produtor retido devolve HTTP 503 `selection-unavailable`; o teste continua exigindo 409 `selection-not-committed`. A concorrência passa pela API real. |
| Confirmação exata, perda de resposta e reuso completo | **FAIL**, runs 02/03 | A preparação pela identidade selecionada foi observada. O run isolado registrou prepare-message e answer-confirm 200, mas excedeu o limite de observação de 5000 ms. Retry/reuso/attachment não receberam PASS. |
| Typecheck do package | **FAIL**, run 03 sobre W2 | Nove diagnósticos externos: cinco em host-context e quatro em callers WP07 de ReviewHost; zero nos arquivos próprios nesse SHA. |
| Guards após corrigir recibos | **PASS**, run 04 sobre W3 | 78 regras, 924 paths contra origin/dev, zero gate findings, 52 avisos, zero erros. Omni positivo: pass, dois spawns. |

O fixture compartilhado usa HTTP de Colaboração, produtores, admissão UI, emissores de fonte, C06/C08 e SQLite reais. A autenticação de atores e a lease de destinatário são fronteiras explícitas do fixture publicado por Colaboração. A seleção e o reply direto reutilizam sessões de operador criptografadas. O caso é criado e lido pelo port real; seu vínculo inicial com a pergunta é corpus semeado. O attachment final ao caso não está montado neste componente, e sua assertion 404 não foi alcançada. Isso não é prova de falha 404 no host instalado.

## SHAs e runs

| Run | W: produto/testes | S: envelope CI | Resultado |
| --- | --- | --- | --- |
| [43621153005](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43621153005) | `639636280859f5f21f44813658d5d9a0c207fff0` | `7c16727818bd49fbd6c9f1a53f1dd3800573255b` | 0 pass / 6 fail. Request sem `./` virou filtro Bun e inverteu lifecycle/startup; jornadas browser NOT_RUN. Typecheck/guards efetivamente executados ficam registrados. |
| [43621603578](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43621603578) | `639636280859f5f21f44813658d5d9a0c207fff0` | `aebd6ee7bf597fd6cd742af347e60846f58e5cfc` | 5 pass / 2 fail. Três jornadas aprovadas mais startup/finalização; G03 e confirmação falharam. Omni pass. |
| [43622153636](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43622153636) | `a8d5d83f9da9a7042f1bfb5f3f19eb601cc16db3` | `27d000afc04aa646e27f6804bf430c6dea76835c` | 2 pass / 2 fail. Confirmação isolada e checks estáticos falharam; lifecycle e Omni pass. |
| [43622829031](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43622829031) | `e817f5d9d8a85d8d19d70f7e356120cac30a0265` | `0e244bfb4d4b59ffed4424025ea4125adcb846e2` | 1 pass / 0 fail. Somente guards, após retirar os dumps de log rejeitados. Omni pass. |

W1 tree: `57c12761912d22276edb3ae1f7515a306c6580ce`. W2 tree: `4f3984ee1552a50e74433417ba3815b9af3efaf0`. W3 tree: `92739139bed9987f1f6fc583d2185213f4c15698`.

Em todos os pares W/S, a comparação GitHub contém somente `.ci-run.json`: os blobs de produto, testes, configuração e fixtures são idênticos dentro de cada par. Os dois blobs de produto são iguais em W1/W2/W3. A separação do teste falho de confirmação conservou literalmente os dois testes de reply já aprovados. O último commit de handoff acrescenta apenas documentação/evidência a W3; não muda o produto nem os testes.

[validation.json](validation.json) registra os blobs e equivalências. [inputs.json](inputs.json) fixa os inputs. [criteria.json](criteria.json) associa as observações aos critérios; [criterion-universe.json](criterion-universe.json) preserva o universo 75 + 78. Nenhum teste de produto foi executado localmente; a validação local se limitou à sintaxe e ao request canônico de CI.

## Dependências e próxima ação

1. **G03 — Collaboration + Composition:** integrar o fix publicado `case-selection.ts` blob `cd9a67887f41986243809672572c972440c832ec`, mantendo sua prova de produtor. A base desta fatia ainda usa `ec80e2916c8a06cbb471cf02e30bb1cb5ebd9cc0`. O [patch exato](patches/g03-published-intake.NOT_APPLIED.patch) está **NOT_APPLIED**. Depois, executar a mesma prova de conflito/review sobre o candidato composto.
2. **C03-REPLY-ACK — Collaboration:** publicar identidade durável da mutação de destinatário. O [patch proposto](patches/c03-recipient-receipt.NOT_APPLIED.patch) guarda o recibo no resultado C08 e conserva reautorização. É **NOT_APPLIED / NOT_COMPILED / NOT_EXECUTED**. A UI não consome contrato ainda não publicado. Outcomes Boolean legados não podem virar identidade inferida por texto ou posição.
3. **C03 confirmação — Collaboration + Composition:** investigar os tempos da cadeia real e consumir a closure publicada preservando fences. O [handoff de timing](patches/c03-confirmation-timing.NOT_APPLIED.md) identifica os dois runs e os blobs retido/publicado. O host publicado `d80d441aa5775a3747303a60161e5a049f84ac16` em `0d9820924b33a8fc7b145f54a675aeef76c98489` tem otimização pertinente; sua mera publicação não equivale à prova desta UI. Não elevar deadlines nem retirar answer-read para obter verde.
4. **C03-HOST — compose-resume/WP10:** demonstrar a jornada completa com sessão real de destinatário distinto, reuso revalidado e attachment real ao caso. A prova de componente atual não fecha esse aceite.
5. **SHARED-STATIC — Composition/WP07:** resolver os nove diagnósticos externos registrados em [run-03.json](run-03.json). A falha de typecheck não foi convertida em PASS.

Todos os patches permanecem dentro do prefixo de recibos; os paths alheios são readonly. A base `2ee71fc90055814912654ae198f7a1dcf9583943`, branches anteriores, falhas e evidências históricas foram preservadas. Os dumps `.log` rejeitados pelo guard foram retirados do head, com hashes e links de preservação em [receipt-cleanup.json](receipt-cleanup.json); os recibos estruturados continuam versionados.

**GLOBAL_RELEASE: não declarado.** PR permanece draft para revisão e composição, sem merge ou encerramento.
