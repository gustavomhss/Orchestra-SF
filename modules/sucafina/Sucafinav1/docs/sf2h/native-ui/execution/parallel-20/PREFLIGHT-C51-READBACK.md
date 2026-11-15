# Preflight factual — UX nativa SF, 15 de novembro de 2026

> Snapshot de leitura em GitHub, **não** autorização S0, review FINAL, execução de Python/CI ou GO. Compromissos canônicos permanecem 15 WPs, 74 tasks, 17 contratos e 1.610 critérios. Este documento complementa, não substitui, o GO-NOGO.md dinâmico.

## Identidades e gates conferidos

- PR99 fonte de despacho: `ux-20-dispatch`; normas congeladas em `cbac654784714f68779ae1434d30e6ea8970c4d1`, depois corrigidas documentalmente neste ramo. PR76 `sf-sidebar-plan@de7da0689f1a2aba2ebe190f83d807ca949e2c5a` é antecedente, não branch da norma PR99. PR91 revisão77 antiga não aprova este delta.
- Canônico: `dbf9547211d9b0fade619790de7c19c0869b7c7d`, campaign blob `71b56906f8bb190c4d568f60c7511ce1ff63d5f3`. O controle anterior teve 1.610 pointers conferidos; nesta inspeção o download do arquivo canônico retornou conteúdo vazio pela conexão embora o blob SHA tenha sido identificado. **Não alegar revalidação integral dos pointers nesta rodada.**
- Último candidato material comprovado da stack: **C51** `529142f63683de8e4b1f7d4232f88faf8ffcef6c`, tree `d679b541596dab3b280a87e15e4a0b29ee518262`. `sf2-stack@a6abd2c8d321daf1089f4d440027c46209a89cbe` é terminal documental de missão100; o compare C51→terminal é 3 commits, 9 arquivos somente em docs. Reconsultar refs/diff antes de aplicar ou autorizar qualquer saída.
- **Autoridade 71 e 100 ENCERRADAS.** Missão100 `AUTHORITY-TERMINAL-100.json` diz `new_integrator_appointee:null`, sem nova lease presumida. Exigir nomeação S0 de sucessor real + ACK/lease novos, e observação de owners 45/72/73/74 e demais produtores.
- **P03 original FAIL:** run `43681302722` / job `132712328135`, timeout 180s, original 72 assertions não quitados; mission99/PR95 source deve corrigir causalmente e obter prova do original. R1 parcial de fonte não fecha P03.
- **Native original OFF:** produtor95 ainda sem release terminal admissível; host 96/52 e provas installed são pendências. `GLOBAL_RELEASE=false`. Não promover componente source para C QUALIFIED.

## Revisão estrutural efetivamente feita

- 20 cartas `C00+W01..W19`; todas as **20/20** ordens da primeira onda foram comparadas via GitHub contra suas fichas de `work-orders/*.json`: id, owns, authoring locks, integration deps e parada `BLOCKED_AUTHORIZATION` coincidem. 19 autoras disjuntas, 58 ordens posteriores, total 78.
- 138 claims de paths, sem colisões entre as 20 cartas, conforme checker JS por igualdade e prefixo de diretório. Isso **não verifica** leases de outras sessões fora dessas cartas nem filesystem real.
- Catálogo: 305 IDs de operação = 305 IDs do metadata registry; 70 superfícies, 165 paths de rotas distintos e owner de superfície existente. Confirmado por leitura GitHub, não compilador.
- Correções anteriores: source PR99, C00 preflight read-only sem exigência circular de launch, fail-closed de launch malformado. Correções posteriores: ACK de sucessor atual obrigatório, exclusão das leases71/100 históricas, checagem de paths de cada lease e provas de integridade de SHA.
- O schema `launch-record.template.json` tem `current_integrator_ack/authority/lease=null`: são **lacunas factuais**, não campos que se podem fabricar. Slots, source family blobs/contract digests, branches e actors exigem observação de verdade.

## Tarefas de preflight restantes

1. **Rodar os validadores Python REAIS no checkout autorizado**, em ambiente Python disponível: `python execution/parallel-20/validate_dispatch.py --root execution` e `python execution/validate_plan.py --root execution --strict --canonical <campaign.json>`. Executar também `python -m unittest discover -s execution/parallel-20 -p 'test_*.py' -v` a partir da pasta que contém `execution`. Até evidência resultante: `NOT_RUN`.
2. Re-pin C vivo/tree, blobs de todas as famílias afetadas (instalação/host/transport, dashboard/decisions, auth/desktop, personal views e mensal), comparar preimages por output, identificar outras leases ativas antes de qualquer GO.
3. Publicar parecer independente de reviewer **sem autoria do delta** e aprovação explícita S0 para o escopo das normas/famílias; registrar gate de owner produtor por consumidor. Não usar revisão PR91 do pin antigo como substituta.
4. Designar **um** integrador vivo da stack e vincular C00 à **mesma identidade e lease**, nunca dois escritores, sem duplicar despacho45, preencher launch factual e dar GO por saída com owner/branch/source/contrato congelado; writers W01–W19 só após lease. Um `ARTIFACT_READY` pode ocorrer antes do serviço instalado quando não houver dependência de autoria; `QUALIFIED` não.
5. Antes do release global, completar P03, M31/MI07, source95, testes reais browser+desktop, três FINAL do mesmo C, oito gates/AM e S0 C/G7–D/G8. Nenhum desses foi fechado neste preflight.

**Disposição:** `STRUCTURAL_READBACK_OK / EXECUTION_NO_GO`. Fonte e cartas prontas para operador executar o preflight; **nenhuma sessão autora foi aberta, nenhuma lease concedida, nenhum CI disparado, nenhum teste de produto/compilador feito por esta publicação**.

## Adendo S0-control (2026-11-15)

O HEAD S0-control `8819df6169abd94aaa89d50a21f113e5596d2aae` designou missão105 `S0-C-e15-browser105` como sucessora, porém `PREPARED_NOT_STARTED`. Isso atualiza o `new_integrator_appointee:null` do terminal100, que permanece histórico. Exigir ACK/lease ativos antes de escrita. O mesmo controle designou CI produto exclusivo101 (primeiro ciclo C51 4 SUCCESS/2 FAILURE) e compiler/guards45. Validador e cartas corrigidos; **doze** regressões preparadas, ainda NOT_RUN neste ambiente sem checkout.
