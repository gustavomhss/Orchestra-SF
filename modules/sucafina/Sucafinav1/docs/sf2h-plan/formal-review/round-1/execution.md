# R3 — Revisão formal de execução, recursos e CI

**Veredicto: REQUIRES_CHANGES.** Há **2 achados P1 bloqueantes e 1 P2 não bloqueante; nenhum P0**.

- **Commit examinado:** `ec9d36da2385007b64a0aa627582ce7e60629a44`, branch `sf-product-plan`.
- **Baseline de código declarada:** `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`.
- **Escopo:** recursos reais, construção versus consumo, caminho crítico, writers, adendo de agentes/MCP/Atlas, integração, critérios e proveniência de CI.
- **Testes da implementação:** **NOT_RUN**. Nenhum teste local de produto ou run remoto foi executado.
- **Independência:** pareceres históricos e relatórios dos demais revisores não foram consultados. O plano e o remoto não foram alterados.

O prazo de 120 minutos já é condicionado e o escopo permanece integral. Este parecer não reprova a campanha por parecer ambiciosa. Os bloqueios são uma expansão obrigatória ainda ausente da decomposição operacional e instruções conflitantes sobre o início de produtores críticos.

## E-F01 — O adendo ainda não tem decomposição executável no plano canônico

**P1 · bloqueante · confiança alta.**

### Evidência

O adendo [AGENTS-ATLAS-MCP.md](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/AGENTS-ATLAS-MCP.md), em **Encaixe na campanha existente**, acrescenta registro AgentV2, carregamento efetivo de skills e servidor MCP a WP10; cinco perfis e dezoito skills a WP12; e a boundary Atlas a **WP06 + WP14**. Exige ainda perfil real, skill carregada, chamada autorizada pela ponte e resposta do domínio em **T+20**.

A campanha, contratos, ownership, DAG, cronograma, cobertura e mapas de provas continuam na versão anterior dessa decomposição. Não contêm Atlas, BusinessContextService, BusinessEvidenceRef, AgentV2, sucafina-workbench nem skills. WP12.T01 entrega catálogo restrito e adapter de provider, em T+10–25. WP14 mantém quatro tasks de funções e projeções, reserva parcial de 45 minutos de construção e proibição explícita de persistir. WP10.T01 possui persistência de produto, mas não recebe um handoff explícito de DurableMemory/Atlas. As seis provas do adendo não estão mapeadas a critérios canônicos. SCOPE-STATUS.md reconhece que essa reconciliação permanece pendente.

O problema não é WP14 ter de implementar sozinho armazenamento. É faltar a divisão verificável entre sua boundary, o adapter documental de WP06 e o provider persistente de WP10, bem como a alocação da infraestrutura nova e das provas.

### Cenário que refuta a prontidão

Os builders implementam as tasks e checks existentes: análise por provider, catálogo de ferramentas, casos persistentes, ranking de precedentes e dezoito conjuntos de provas. Esses itens específicos podem passar sem os cinco perfis registrados, as dezoito skills carregadas ou o consumo real dos ports Atlas.

No aceite do adendo, aparecem entregas obrigatórias sem task, prefixo, handoff exclusivo e reserva de capacidade. A distribuição conjunta “WP06 + WP14” também deixa a escolha do escritor da nova boundary para uma negociação durante a construção. GNATIVE exige antecipar uma cadeia que não está identificada na alocação atual.

Isso demonstra um plano operacional incompleto para o escopo aceito, sem provar que qualquer duração específica seja impossível.

### Correção verificável

S0/WP00 deve incorporar cada entrega adicional às tasks e aos cinco grupos de axiomas; declarar os caminhos, o escritor e os handoffs; separar boundary, documentação e persistência; incluir registro/empacotamento/carregamento de skills, servidor e descoberta MCP; e mapear as seis provas aos critérios e execuções correspondentes.

O mesmo commit deve atualizar contratos, DAG, ownership, coverage, evidence-plan, proof-map, cronograma e prompts. A revisão de capacidade deve incluir S0, WP12, a reserva parcial de S4 e o resgate de WP14, além do produtor real necessário para T+20. O fechamento exige localizar no plano cada perfil, skill, pack, adapter, consumidor e prova, sem aumentar implicitamente os slots ou retirar escopo.

**Dono sugerido:** S0/WP00, com WP10, WP12, WP06 e S4/WP14.

## E-F02 — Handoffs reintroduzem o bloqueio nativo de Planner e imports

**P1 · bloqueante · confiança alta.**

### Evidência

Em [WP03.md](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP03.md), o handoff determina que as tasks comecem após **WP00.T04**. [WP06.md](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP06.md) contém a mesma condição. As entradas das T01 atribuem seus contratos a T04, e as versões JSON/campaign preservam essas frases.

Contudo, `depends_on`, task-dag e janelas começam após **WP00.T02, em T+10**. T04 agora qualifica host/IA/Relay até T+20; o slot S0-B segue alocado até T+25. A campanha afirma que a qualificação nativa não bloqueia o início dos domínios.

Os handoffs também preservam `sf-planner` e `sf-imports`, divergindo de `sf2-planner` e `sf2-imports` no ownership. WP14.DOD.01 e WP14.T04.DOD.01 ainda citam consumo até T+80, enquanto G4, cabeçalho e janelas usam T+75.

### Cenário que refuta a prontidão

Planner e imports possuem, cada um, cinco janelas consecutivas que somam **62 minutos**, de T+10 a T+72. Se o builder seguir o handoff e esperar T04 até T+20, preservar esse orçamento desloca o final para **T+82**. G4/T+75 já é perdido antes de qualquer falha de implementação ou CI.

Caso GNATIVE fique bloqueado, a frase antiga retém trabalho determinístico que a campanha manda continuar. Um builder que siga o DAG começa em T+10; outro que siga o handoff começa depois de T04. Os dois consultaram o mesmo material obrigatório. A branch antiga também pode deixar o recibo fora do caminho que a integradora procura.

### Correção verificável

Trocar T04 por T02 onde se trata de congelamento contratual, conservando a dependência de T04 apenas para qualificação nativa real. Unificar branches e prazo de WP14 e regenerar todas as representações.

A rechecagem deve mostrar que WP03/WP06 podem começar por contratos em T+10 mesmo com GNATIVE bloqueado, sem instrução residual de espera por T04, e que branch e deadline coincidem nos documentos.

**Dono sugerido:** S0/WP00, com S1, S2 e S4.

## E-F03 — CI-APP descreve uma cobertura maior que sua seleção

**P2 · não bloqueante isoladamente · confiança alta.**

A receita CI-APP em [ci-recipes.json](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/modules/sucafina/Sucafinav1/docs/sf2h-plan/ci-recipes.json) anuncia “Suite completa Bun do pacote app”, mas usa `args: []`.

As fontes primárias no mesmo SHA mostram o recorte efetivo:

| Fonte | Comportamento |
| --- | --- |
| [packages/app-shell/bunfig.toml](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/packages/app-shell/bunfig.toml) | `test.root = "./src"`. |
| [packages/app-shell/package.json](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/packages/app-shell/package.json) | O script `test` combina `test:unit` e `test:browser`. |
| [.github/workflows/test-ci.yml](https://github.com/gustavomhss/Orchestra-SF/blob/ec9d36da2385007b64a0aa627582ce7e60629a44/.github/workflows/test-ci.yml) | Argumentos vazios executam o comando com condições Solid; o comando com condições browser só roda com seleção explícita de `test-browser`. |

Uma regressão coberta apenas por `test-browser` não altera o resultado dessa request. Os três specs Playwright SF também não executam a suíte Bun de browser.

A inventariação obrigatória do epic/AGENTS em T+10 pode assegurar essa cobertura adicional. Por isso este é um problema de precisão da receita e da evidência, e não a afirmação de que o aceite integral necessariamente omitirá a suíte.

**Correção:** descrever CI-APP como suíte de `src` e acrescentar uma request `{ "package": "app", "runner": "bun", "args": ["test-browser"] }`, ou identificar o gate cumulativo que cobre a árvore. Os recibos devem distinguir as seleções e apontar o mesmo candidato.

**Dono sugerido:** S0-C / WP10.T04.

## Aspectos que não geraram achado

A capacidade declarada está condicionada a cinco conversas efetivamente abertas. O plano conta as coordenadoras no pico de vinte agentes e reaproveita os mesmos três slots de S0 para revisão; não conta seis auxiliares centrais simultâneos. A transferência de WP14 prevê escritor único e substituição de revisor com autoria.

O plano diferencia `READY_FOR_INTEGRATION` de aceite, exige produtores reais, começa integração em T0 e conserva uma janela posterior a T+75 para provas e correções. Os quinze minutos de CI são explicitamente hipótese a medir, e o timeout de 45 minutos não é apresentado como duração.

A estratégia candidato C → snapshot S → request → run por SHA é compatível com os recursos inspecionados. O conector suporta leitura de coleções de runs push por GitHub fetch; a receita evita o wrapper que filtra runs de PR. Os validadores aceitam o config de produção e o namespace `e2e/sucafina`, exigem specs existentes e seleção não vazia, e fixam um worker por request. Não identifiquei necessidade de alterar o validator para executar as seleções planejadas.

## Limites e incertezas residuais

O inventário completo de paths examinados está em `execution.json`. Li o plano canônico e suas estruturas de dependências/alocação, as partes relevantes dos WPs e os scripts/configs primários por GitHub MCP no SHA fixado. Não usei pareceres históricos como evidência.

Continuam sem medição nesta revisão a fila e duração de CI, os modelos e serviços já configurados, a abertura real das cinco sessões e o ownership ativo da frente de cloud no futuro T0. A regra de patch sobre SHA combinado existe; sua concretização permanece parte do preflight.

O config Playwright inspecionado sobe o frontend `apps/web`. S0-C/WP10 já recebe a entrega do harness; ele terá de montar o backend SF real, corpus, identidades e persistência no namespace autorizado e demonstrá-los no smoke inicial. A inexistência atual desse harness ou dos specs novos não foi classificada como defeito isolado, pois este commit é de planejamento.

A aprovação futura do plano não aceitará a implementação nem provará duas horas. Para esta rodada, E-F01 e E-F02 impedem `APPROVED_FOR_EXECUTION`; E-F03 melhora a precisão e deve acompanhar a reconciliação das receitas.
