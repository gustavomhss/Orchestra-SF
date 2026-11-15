# Missão65 — recuperação C12

**Estado: HANDOFF_TERMINAL_LEASE_ENDED. Unidade de fonte liberada completa para consumo autorizado; aceite global permanece aberto.**

O candidato corrige a associação de um recibo real a uma intenção alterada depois da aplicação. A seleção hospedada final passou com **27 testes, zero falhas, 824 expectativas e 11 arquivos em 24,47s**. O primeiro save/register foi qualificado com o corpo original retido; a consulta mínima exigida pelo reload histórico da UI tem um patch externo completo, ainda inerte.

## Identidades e autoridade

| Item | Identidade |
| --- | --- |
| Branch / PR draft de fonte | `c12-recovery-proof` / [PR74](https://github.com/gustavomhss/Orchestra-SF/pull/74) |
| Base atribuída | `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85` |
| ACK anterior a qualquer escrita de produto | `59fc1645b4a1b9e4b56dddac9db1686b2cf8b377` |
| W final de produto e testes | `99919e946fa065cbcd458446fc71ab3f50f73267` |
| Árvore W | `95e8f51bcfe3f613177e676a1053c2ab87dd8d6d` |
| S final, filho direto de W | `041e9d7dd055043a1a3de5c8261e399f8da2de73` |
| Única diferença W→S | `.ci-run.json`, blob `8880e6342708120b061a2836ddc4a605baab1443` |
| Actions final | [run43668690783](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43668690783), job132673683798 |
| Consumidor solicitado | 60 / [PR65](https://github.com/gustavomhss/Orchestra-SF/pull/65) |
| Target observado | `faa30fddb7e7b61696b66fd069f51cf18c51125f`, árvore `b3b4f89ddd6a3ca5d570681f91098214b5ce935d` |

O commit que contém este documento acrescenta evidência. Seu SHA/árvore exatos e o readback CAS são publicados no comentário terminal da PR65 e na PR74; não são apresentados como um novo W executado.

A autoridade de60 em `after-c27-60/AUTHORITY.json`, blob `83e9c35441aa09e8d81e35bfb8e1a711322e8bf9`, já está **HANDOFF_TERMINAL_LEASE_ENDED**. Esta entrega é um input disponível para60 quando houver retomada explicitamente autorizada, ou para um sucessor autorizado. Não nomeia sucessor, não reabre lease e não escreve na stack. O ACK de recebimento/consumo permanece solicitado.

## Correção e preservação de contratos

- `apply.ts` guarda a intenção completa dentro da reserva de aplicação existente antes de cruzar a fronteira do domínio. A recuperação compara pedido original, escolha única, material completo do PreparedChange e instalação/projeto/principal/política/revisão.
- `prepared-apply.ts` verifica essa intenção, quando presente, antes e dentro da transação do domínio. Seleções duplicadas e provas de recibo com escopo, alvo ou conteúdo incorretos são recusadas; a leitura termina com conferência da prova durável e da lease.
- `receipt-review-binding.ts` contém os verificadores compartilhados. O valor da prova continua sendo o recibo bruto; chave, binding v1 e escopo canônico permanecem iguais.
- O produtor direto mantém uma única transação atômica de domínio+recibo. A falha definitiva de receiptVersion continua deixando o snapshot inteiro intacto e permite a tentativa válida seguinte, conforme o gate WP03 existente.

Não há uma transação global de domínio e caso. O efeito e seu recibo são gravados primeiro; a reconciliação do caso é separada e preserva uma edição humana não relacionada. Uma reserva sem recibo continua indeterminada e não permite redispatch.

Recibos/reservas antigos sem a intenção completa não recebem uma intenção reconstruída a partir do caso atual: a reconciliação genérica retorna `original-intent-unverifiable`. A leitura autorizada do recibo bruto continua disponível quando sua prova é válida. Migração histórica, se necessária, exige evidência histórica confiável e escopo próprio.

## Evidência reproduzível

| Seleção | W / resultado observado | Interpretação |
| --- | --- | --- |
| R1 | `5da7aa96` — 23 PASS / 1 FAIL; 676 expectativas; 10 arquivos; 21,75s | A falha ocorreu na emissão de fonte Hot Topic: período anual incorreto no teste, antes de registro. Corrigido para o dia do relógio da fixture, sem mudar grants, produtor ou expectativa200. |
| B0 | `9b32505d` — 0 PASS / 1 FAIL; 1 filtrado; 6 expectativas; 2,50s | Contraprova sobre os três arquivos originais de produto: payload mudou de42 para777 mantendo digest/chave declarados, e a recuperação devolveu `ok`. Mesmo teste e helper de R2, byte a byte. |
| R2 | `99919e94` — 27 PASS / 0 FAIL; 824 expectativas; 11 arquivos; 24,47s | Oito casos novos e19 regressões existentes. Fonte qualificada no limite declarado. |

[Requests, resultados e trechos de logs](validation/) conservam W/S, árvores, configuração, run, job e contagens por tentativa. Os SHA de todos os gates preservados constam no [fechamento de dependências](dependency-closure.json). Não houve execução local de produto, teste, typecheck ou build.

Os oito casos novos comprovam: primeiro case-save; primeiro registro Hot Topic com duas intenções independentes de conteúdo igual; perda após commit de domínio; perda após reconciliação; mutações de material/escolha/chave/incarnation/política/revisão; reserva sem recibo; admissão privada e recibo bruto original; recusa de prova real com escopo incorreto. As autoridades e os serviços são recriados sobre o mesmo SQLite sem reseeding de escolha, preparação, recibo ou reconciliação. A instrumentação conta uma execução real de domínio e zero redispatches de recuperação.

Os gates existentes passam sem alteração de asserções: WP03 rollback/Planner, WP04 Finance alias, WP11 reconciliação/indeterminação/Dashboard, WP13 escopo e WP11 execução entre Planner e Procurement. O último inclui sucesso parcial, dois recibos ordenados, conflito e revogação. A alteração Procurement permitida conserva estAmount100; nenhuma aprovação financeira foi fabricada.

Os antigos22 PASS de32 pertencem ao run43646007759/job132603819490, W`ba731ff646d8ed7a1c7fb15bf82f4e8c5a2ef81a`, S`114b1c3ff83a038b515f4afcf5db0fc795d59b6d`. Não foram somados aos27 atuais. A fixture histórica permanece no blob `33650407123163ea881eca9d4940fde364b27c54`. O requisito financeiro M31 permanece separado da prova C12.

## Primeiro register: dependência externa concreta

O HTTP/produtor atual recupera exatamente a primeira transação quando recebe o corpo original e a chave. O reload histórico da UI conserva apenas `caseRef/key` antes de conhecer `draftRef`; `list` não correlaciona a chave e `readCurrent` exige o draftRef ausente. Esse caminho mínimo **continua bloqueado**.

[external/first-save](external/first-save/README.md) entrega três preimages, três postimages, manifesto e diff integral de13.073bytes, SHA256 `a28525a119237a7f10ef9c183b51aa0203e038c8374d292663db8b4eaa94d36d`. A proposta implementa lookup somente leitura no store, composição Dashboard e rota HTTP privada, usando a chave admitida e o resultado C08 exato. Estado **NOT_APPLIED / NOT_RUN / NOT_TYPECHECKED**; nenhum teste importa arquivos arquivados.

60 ou o integrador autorizado deve encaminhar a unidade ao responsável pelos paths compartilhados. O gate do owner deve provar commandIdentity estável para a chave original com o corpo mínimo, recusa de ausência/ambiguidade/revogação e ausência de escrita;52 deve consumir a porta e provar o reload. Nenhuma UI52 nem produtor61 foi editado.

## Entrega para consumo

1. Consumir os três arquivos ativos juntos e os seis arquivos novos de testes. O [manifesto de pre/postimages](patches/owned/manifest.json) e o [patch completo de produto/testes](patches/owned/c12-recovery-complete.patch) identificam cada byte. O [patch integral até W2](patches/owned/branch-W2-complete.patch) inclui também o ACK e reconstrói os dez paths alterados desde a base, conferidos com o diff remoto; [text-integrity.json](patches/owned/text-integrity.json) registra apenas essa integridade de texto, sem execução de produto.
2. Reconferir a autoridade vigente, os preimages e a composição real da stack antes de integrar. O PASS de W não qualifica automaticamente C28 ou uma composição futura.
3. Encaminhar [REQUEST-45](checks/REQUEST-45.json) para `bun typecheck` no pacote e `bun run check:guards --base origin/dev` no lane autorizado de45. Ambos continuam REQUESTED_NOT_RUN; nenhuma ref/workflow de45 foi assumida.
4. Conservar os bloqueios da consulta mínima/UI, reinício real de processo, consumo nativo, AM04 integral e C/G7–D/G8. Os runs desta missão fizeram zero spawns Omni e não reivindicam essa prova.

[criteria.json](criteria.json), [first-save-criteria.json](first-save-criteria.json) e a [revisão independente](review/independent-executor-audit.json) distinguem prova parcial e aceite completo. Nenhum dos15WPs/74tasks/17contracts/1610critérios foi substituído por este slice.

**Liberação explícita:** a unidade completa de fonte, testes, evidências e proposta externa está disponível para recebimento/revisão/integração por quem tiver autoridade vigente. Não se exige um PASS global inexistente para receber o material. A missão65 encerra sua lease com a publicação deste handoff; `GLOBAL_RELEASE=false`.
