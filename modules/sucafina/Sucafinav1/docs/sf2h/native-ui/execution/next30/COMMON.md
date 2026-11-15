# NEXT30 — campanha de 30 NOVOS implementadores UX nativa SF

**Estado: PREPARED_NOT_STARTED. Não concede GO, ACK, lease, integração, CI ou release.**

## Objetivo e contagem

Somar **30 sessões autoras novas** às **19 existentes W01–W19**, sem reutilizar/substituir nenhuma das 19. A 20ª posição da primeira campanha é a integração I00 já exercida exclusivamente pelo ator **114** (S0-C-e17-browser114; reconfirmar lease viva no início). Qualificação: **119** compiler/guards/codegen, **120** produto/tests via GitHub Actions. Não criar segundo integrador nem runner. As 30 novas são **9 lanes de adapters N01–N09 + 21 lanes de telas/fluxos N10–N30**.

Fonte única: 78 ordens `execution/manifest.json`, sendo 19 ordens completas + I00 já distribuídas na campanha W; este pacote cobre as **53 ordens completas ainda não distribuídas para autoria** (A07–A15, U01–U09, U12 e U14–U47) e **três saídas complementares** (`U10.overview`, `U11.complete`, `U13.complete`), excluindo a autoria existente W12/U10.queue, W19/U11.title-save, W13/U13.pr-approval. **Q01/Q02 e R01/R02/R03 continuam mandatórios**, tratados separadamente por qualificação e revisão independente (não são vagas de implementação). O corpus original de 15 WPs, 74 tasks, 17 contratos, 70 superfícies, 305 operações e 1.610 critérios **não sofre corte**.

## Regras de autoria (iguais para cada um dos N01–N30)

1. Leia `AGENTS.md` aplicável, este `COMMON.md`, seu `packets/Nxx.json`, cada `execution/work-orders/<ID>.json` integral, `execution/EXECUTION-PROTOCOL.md`, `execution/manifest.json` e **required_reads da própria ficha**. Seus paths e outputs são os únicos autorizáveis. Consulte `execution/campaign-overlay/COMMON.md` e os contratos, assinaturas, locks e `SOURCE-PINS-C58.json` do snapshot para entender erratas. Normativo `cbac654784714f68779ae1434d30e6ea8970c4d1`, corpus canônico `dbf9547211d9b0fade619790de7c19c0869b7c7d`. C58 é histórico, **não o HEAD atual**.
2. Antes de toda escrita em **branch de implementação SEPARADA**, 114/S0 verifica um ator real, branch, base commit/tree, owner + lease + ACK vivos, allowlist e release do dono do arquivo, contratos FROZEN e blobs das fontes repinados, além de admissões por output. Registro `PREPARED` ou branch hint NÃO são autorização. Esta branch `sf-ux-next30-dispatch-20261115` é **somente documental**; não editar produto nela.
3. Reutilize **código, mocks como referência de UX, componentes Solid, dados/produtores reais, host, contratos, tokens, tema e i18n do Orchestra**. Não reimplemente funcionalidades que já existem nem crie outro standalone, iframe, segundo shell, backend, regra financeira, auth, ACL, stub produtor, aprovação ou recibo fictício. UI mockada ≠ integração funcional; marque lacunas reais, não invente sucesso.
4. Cada pacote autoriza apenas os `write_paths` efetivos e o prefixo de recibos do próprio Nxx; `protected_paths` sempre prevalecem inclusive sobre globs pais. `114` é **único escritor** de shared registry, imports/composition, rotas centrais, i18n global, generated e código de produtor com owner alheio. Shared change = **patch completo inerte**, pre/post SHA e owner para 114. Nem um Nxx deve editar `W01–W19` nem o trabalho de reparo existente.
5. Separe três gates: **autoria** pode avançar com contratos congelados; **integração** requer os produtores reais enumerados; **qualificação** requer identidades, serviços, versão e probes do mesmo candidato. Dependência ausente bloqueia SOMENTE a saída afetada, não o trabalho paralelo independente. `ARTIFACT_READY` ≠ `INTEGRATED` ≠ `QUALIFIED` ≠ `CLOSED`.
6. Testes **exclusivamente por GitHub Actions**, solicitados a **120** via test:ci/request e seleção cirúrgica deduplicada por tree/config/fixtures. Typecheck/guards e geração SDK só via **119** coordenado com 114. Não rodar testes, validadores, parser, tsc, unittest ou typecheck localmente. Não alterar `generated` manualmente. Failure -> corrigir causa; sem relaxar gates.
7. Sem merge, rebase cego, force, deploy, Azure, credenciais, release, novo controller, mensagens externas, mudança de engine financeira, regras de aprovação, escopo de auth ou política de acesso. Use GitHub remoto MCP e CAS/expected HEAD para mutação.
8. Todos os fluxos com negativa autorizativa, owner/contexto atômico, CAS/holder/versão, privacidade por campo e export, revogação, timeout/stale, reabertura/refresh e response-loss sem replay automático quando mutação tiver resultado incerto. P0 U11.title-save NÃO é aprovação/C12; P1 U13.pr-approval requer holder e aprovação real, sem fingir sucesso.
9. Handoff por OUTPUT: commits e PR para `sf2-stack` **somente após autorização**, patch integrável, pre/postimages, diff e interface, evidência GH Actions (ou NOT_RUN), contratos/critério cobertos ou pendentes, dependências, recibo Nxx e ACK para 114. Uma PR aberta não é release; 114 integra atomizando o que for aceito.

## Trabalho complementar Procurement (fronteiras imutáveis)

- **W12** é o único autor de `U10.queue` em `procurement/queues/**`; N21 só escreve `U10.overview` em `procurement/overview/**`; i18n/test compartilhados são patches inertes para 114.
- **W19** é o único autor de `U11.title-save` em `procurement/requests/title/**` e também de `sf-u11.ts` / `u11.spec.ts` nesta primeira wave. N22 conclui SOMENTE o restante de `U11.complete` **fora** desses paths e entrega integração/test/i18n compartilhados a 114; não sobrescrever P0.
- **W13** é o único autor de `U13.pr-approval` em `procurement/approvals/pr/**`. N23 conclui o restante de `U13.complete` excluindo `approvals/pr/**`; 114 integra resultados no componente/rota compartilhados.

## Qualificação e aceitação global

`Q01`: navegação, isolamento, compatibilidade e P0/P1 positivos/negativos com 120/114. `Q02`: visual, responsividade, acessibilidade, localização e P0/P1 com 120/114. `R01`: produto UX/arq/a11y; `R02`: finanças/autoridade/privacidade; `R03`: IA/8 MCP packs/39 ops/Atlas/Relay/Schedule/docs/WP14. **Três revisores independentes sem autoria** sobre mesmo C candidato final, nunca N01–N30 revisando seu próprio escopo. `GLOBAL_RELEASE=false` até S0 declarar os critérios originais e nativos integralmente satisfeitos.

## Ordem de execução inteligente

Autorize imediatamente, por output, qualquer trabalho com **locks/contratos congelados e ownership legítimo**; 9 adapters podem ser escritos simultaneamente às telas mesmo que parte do binding ainda aguarde integração. Prioridade operacional: liberar F01/F02/F03, A07–A15 e compartilhados W; compor telas por famílias em 114; qualificar apenas seleções com producers reais; invalidar só consumidores do delta causal. Não ocupar 30 sessões com polling nem dividir microtrabalho artificialmente.

Os pacotes contêm descrições **preparadas**, não fatos de launch. Se o produto já cumprir algum output no C atual, demonstrar a equivalência e entregar `NO_CHANGE_ALREADY_SATISFIED` com evidência; **não reconstruir** apenas para justificar ocupação.
