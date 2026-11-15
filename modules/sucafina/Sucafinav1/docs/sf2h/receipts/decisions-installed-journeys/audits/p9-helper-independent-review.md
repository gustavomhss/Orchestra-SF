# P9 — revisão independente do helper de captura

**Parecer: sem bloqueio estático remanescente identificado para a escolha nominal única, após correção da comparação dos snapshots e adoção do domínio v3.** Não é resultado de compilação, execução ou aceitação da jornada.

## Material observado

- Helper: `/workspace/scratch/fec39c0682b3/m52-work/p9-host-source/post/choice-source-history.ts.txt`; blob `2ba11396ce2700fb270dbd269df218fa55e26c2d`; SHA256 `fd0f1eca895a5de4f71f7a9e8c21795f3876026ce0c527bd7a8f5fb30d004005`.
- BCS com fallback: blob `04f0cc9dce675e2b044b6ed999deac7526804068`; SHA256 `9853a0d7e55ac9c928d4409f66fd938527f03841793e3121dcbd03272bd5d8e8`.
- Domínio v3: SHA256 `82bd2af9a6756f39c040acbef3a7529173f245ec74317a00557520f23d2c1a0c`; state `2b8aa07e730bdc73891b14faced899e6f54ee487`, ledger `8e097896028878d2072239858534ed99c2463207`, mutations `ca21c3690f71d28c04c4bbd5045aa8389c42d384`.
- Preimages remotos relidos no W11 `fb9ed54674e7792008e8d1bd7425adc7effe8c09`: LocalStore `a36440a750d5671a34c3ab41b2af48093af9f7ee`, SourcePersistence `0e812842ad0d534998c182100a8466548d70e915`, CurrentChoice46 `db487cd1b6263835302e9bcf80499d18531aa592`, decisões `f22b00f0a97ab138d1d8b86855f432c6ef709c36`, Planner port `13800a1ac7dbe1b9bc95ca0a10480708760b4936`.

## Defeito encontrado e correção conferida

A primeira versão de `stable()` comparava `latest.planner/dashboard/procurement` por `===`. O LocalStore real, linhas231–242, retorna cópias independentes em toda chamada de `currentSnapshots()`. SourcePersistence linha78 encaminha o método sem alterar esse contrato. Isso recusaria deterministicamente a captura elegível antes da primeira projeção. A versão observada do helper, linhas63–76, fixa a identidade do método e recaptura o digest completo das três superfícies, como o padrão já usado por CurrentChoice46 linhas259–272. O blocker foi corrigido; nenhum path de CurrentChoice foi modificado.

## Compatibilidade de tipos, dados e transação

- `ChoiceSelection.snapshot: Readonly<Snapshot>` é compatível com o callback opcional de mutations. `domainSurface: "planner"` já seleciona `transactionAll` no state-provider linhas174–177. A seleção recebe um clone do snapshot Planner fornecido à mesma transação; a igualdade inicial por conteúdo com `currentSnapshots().planner` é adequada. O staged produto permanece separado até o callback terminar, portanto seus casos/outbox ainda não comprometidos não geram diferença artificial no snapshot Dashboard observado.
- `choice`, `event` e `case` correspondem à mesma próxima versão. O produtor real em mutations linhas210–212 cria `event.caseRef.version = oldVersion + 1`; saveCase linha257 atribui exatamente essa versão ao caso. O callback v2/v3 clona a seleção inteira, preserva os membros, fixa seu digest, recusa `ok` sem array e revalida estado, transporte, lease e autoridade depois do await.
- `event.outputDigest === digestSfValue(choice)`, evidências e identidades de escritor/horário são comparados. O reader confere `capture.eventDigest === digestSfValue(event)` sobre o único evento persistido, cobrindo também rationale, lifecycleState, factualGaps e consideredActions. O helper exportado de integridade usa o mesmo campo internamente derivado no enqueue.
- `SfLedgerRecordCapture` é um registro e uma `DomainProjection` reais. O projector instalado tem terceiro argumento opcional, portanto satisfaz o tipo privado de dois argumentos. Seu retorno não-ok pode ser devolvido como o ramo não-ok do PortResult de captura sem conversão de valor. A validação mantém os campos de instalação/projeto/principal/política/acesso, moeda USD, período original e fonte exata de cada valor; não confunde o array de SourceRef do contexto com os BusinessEvidenceRef dos valores.
- A ausência/array vazio preserva o caminho legado; UI não elegível, operações, hipóteses ou evidências mistas não recebem captura nova. Replay sai antes do callback. Nada cria receipt ou muda pending para settled.

## Leitura e autoridade

O reader usa o state port real em outbox/cases, exige autoridade atual de principal/policy/access, participação e callback de autorização do caso, ancora chave/eventRef/case incarnation/versão/choice/event digests e verifica todos os corpos antes/depois. Os argumentos e resultados são clonados. Request, headers, método/URL, lease, binding, host e métodos são fixados e revalidados. Leituras que falham ou se alteram devolvem undefined; não concedem acesso.

O callback de autorização instalado em business-services é participação + `host.revalidate` (linha166), sem resolver as mesmas evidências recursivamente. O fallback BCS observa primeiro o produtor Atlas, depois a captura do outbox se ausente. Ele alimenta exclusivamente a prova do original; `recordHistory` continua responsável pela ACL atual, linhagem física, campos/período exatos, dupla projeção atual e diferenças. Não há equivalência de captura a publicação Atlas ou a fonte operacional fresca.

## Limites e qualificação necessária

O reader é conservador quando existem várias capturas para o mesmo refDigest: exige igualdade integral de todas e autoriza todos os casos encontrados. O projector real inclui `observedAt` em SourceRefs (Planner port linhas145,190,229); duas escolhas novas do mesmo ref em horários diferentes podem produzir corpos distintos e resultar em indisponibilidade. Isso não afeta a única escolha nominal nem seu replay sem recaptura, mas impede afirmar suporte geral a múltiplas capturas equivalentes. Nenhuma normalização, seleção arbitrária ou relaxamento foi proposto nesta revisão.

Esta revisão não mede o custo das recapturas/digests dentro de C08. Os testes cirúrgicos no Actions e as cinco jornadas UI originais continuam sendo a prova exigida. Nenhum teste, compilador, produto ou dispatch foi executado por este revisor; nenhuma fonte remota foi alterada.
