# Cold review adversarial — Reconstrutor SF, pacote de 50 sessões

**Veredito: FIX-FIRST / NÃO DISPARAR IMPLEMENTAÇÃO SOB V5.** Revisão documental independente do commit `28180ff626edf73d3ae855f9c2d2a4048887ca3c` na branch `recon-50-packets`. Nenhum teste de produto, agent launch, merge ou deploy feito neste parecer. O pacote é PLANNED, não código executado.

## Decisão de escopo corrigida

O V5 está em desacordo com a intenção expressa pelo solicitante. O primeiro **release integrado** deve abranger as capacidades abaixo. Execução incremental continua válida; exclusão de escopo da primeira entrega, não. Nenhum item é promovido automaticamente a tecnologia vencedora sem medição.

| Tema | Obrigação na primeira entrega | Prova mínima |
|---|---|---|
| OCR | Caminho real para PDF digitalizado/imagem sem camada textual, com ancoragem e cobertura | Documento digitalizado real → afirmação → região/página verificável; erro explícito quando falhar |
| Conectores | Aquisição autorizada via conectores reais dos sistemas selecionados no contrato (Drive/SharePoint como alvos iniciais) | Ingestão, nova versão, permissão removida e revalidação com principal real; sem credencial no browser |
| Embeddings | Recuperação semântica com escopo, versão, revogação e proveniência | Consulta semântica traz evidência correta; cross-tenant/usuário negado; fonte revogada desaparece |
| Banco de grafos | Camada de grafo de entidades/relações/proveniência consultável e prova da escolha de armazenamento de grafo | Consultas de relações e impacto corretas após aditivo/remoção; benchmark relacional vs motor de grafos; não criar segunda fonte da verdade |
| Fórmulas | Avaliação segura de subconjunto declarado de fórmulas e tratamento das não suportadas | Cálculo conhecido reproduzível; fórmulas externas/macros não executam; cache divergente não é aceito |
| Autoaceite semântico | Capacidade de decisão por classe, desligada até prova estatística adequada | Política versionada, abstenção, reversão e relatório por classe; nenhuma classe sem qualificação autoaceita |
| Jev | Avaliação de decisões delimitadas com integração proposta/testada | Conjunto comum, falsos positivos, abstenção, custo, latência; candidato não ganha poder de mudar permissões |
| Docling | Parser candidato testado em fontes reais, inclusive layout/OCR quando adequado | Comparação de cobertura, citação, custo e latência no mesmo corpus |
| LangExtract | Extração com grounding comparada ao baseline | Atribuição/intervalos; alucinação de âncora recusada |
| Reducto | Challenger de parsing/citações com dados autorizados | Resultado, coordenadas quando presentes, custo/latência e limites de dados externos |
| DocETL | Resolução de entidades testada com vínculos difíceis | Homônimos, subsidiárias e agrupamento transitivo falso reprovados |
| Splink | Linkage probabilístico testado no mesmo conjunto | Precisão de vínculos, candidatos recuperados, contaminação dos grupos, thresholds e abstenção |

Ferramentas concorrentes **precisam ser comparadas**, mas não necessariamente todas permanecer ativas em produção. Resultado inferior é uma decisão fundamentada de não adoção, não exclusão antecipada do trabalho. O plano deve fixar alvos reais, preços/credenciais autorizados e corpus de comparação antes de comprometer integrações externas. Bloqueio de autorização/provider deve ficar explícito: nunca simular PASS.

## Achados com correções mínimas

### CR-01 — P0 — Escopo de primeira entrega foi reduzido sem autorização
**Evidência:** `plan-50.docx`, seção "Decisões técnicas fechadas", exclui OCR/grafo/embeddings; `execution-50.json` contém `technology.not_mvp` com OCR, conectores, DocETL/Splink, Docling/Reducto/LangExtract. Busca nas 50 entradas `sessions[]`: nenhuma missão com OCR, conectores, embeddings, Jev, Docling, LangExtract, Reducto, DocETL, Splink ou benchmark comparativo explícitos.

**Correção:** publicar V6 revisando objetivos, contratos, 50 atribuições, dependências, gates e corpus. Proibir repetição de "não MVP" para essas áreas. Não substituir a correção por simples anotação no README.

**Prova:** cada capacidade acima tem owner, escrita, entrada real, teste negativo, benchmark/gate e consumidor na mesma composição instalada.

### CR-02 — P0 — 50 sessões em paralelo não significam 50 implementações simultâneas
**Evidência:** `execution-50.json` define `all_waves_launch_in_parallel: true`, mas `launch_mode` e ledger fixam **50/50 `PREP_ONLY`**. As tarefas de L/D/U/I aguardam G0 e releases anteriores. Máxima preparação é possível, não implementação imediata total.

**Correção:** separar `PREP_READY` de `CODE_READY`, disponibilizar pesquisas reais, corpus, testes e experimentos independentes desde D0; ativar autores de código somente em dependências satisfeitas. Medir `active_code_writers`, `blocked_hours` e latência até o primeiro vertical, sem prometer 50 writers.

**Prova:** relatório de prontidão identifica precisamente quais sessões escrevem código imediatamente e quais produzem apenas prova/preparação.

### CR-03 — P0 — Gate de integração é incompleto no DAG
**Evidência:** `I01` depende de L06/L08/D01/D03/U02/U03/C10 mas **não** de I02 (host auth/mount), I03 (sub-API) nem I04 (admissão/scanner). `I10` tampouco depende de I02. `C10` produz pedidos de integração, não prova de API nativa instalada.

**Correção:** introduzir recibos de capacidade externos verificáveis (N0/N1/N7/N10, source access, provider e auth); tornar os artefatos mínimos desses recibos dependências do primeiro vertical. Se I01 só provar adapter isolado, reclassificar como `REAL_COMPONENT`, nunca `INSTALLED`. I10 exige o receipt de autenticação e mount, no mesmo candidato.

**Prova:** cookie/mount reais, fonte real, provider autorizado, reload/evidence e isolamento host/instalação/principal, com hashes de candidatos.

### CR-04 — P0 — Checks são rótulos, não comandos executáveis
**Evidência:** `sessions/*.md` usam `C02-focused`, `L01-focused` etc. No JSON o campo `checks` também são rótulos; não há comando, seletor ou caminho de suite para vários autores, e seus `write_allowlist` frequentemente não incluem testes. O AGENTS exige GitHub Actions, provas verificáveis e typecheck, não declara que `C02-focused` seja uma lane pronta.

**Correção:** atribuir a cada missão um arquivo de teste próprio permitido, comando `bun run test:ci <workspace> <arquivo>`, provador de seleção não vazia, typecheck específico e gate de guard. Adicionar integração com o owner de tooling onde necessário.

**Prova:** primeira CI roda o alvo exato de cada tipo (contrato, parser, domínio, SolidJS browser, E2E) com número de testes positivo.

### CR-05 — P1 — Isolamento de arquivos deixou sem owner a composição e o typecheck
**Evidência:** 50 `write_allowlist` não apresentam owner para `modules/sucafina/reconstruction/index.ts`, `tsconfig.json` e registro de módulos/adapters compartilhados. O subtree de UI tem `compose/**`, mas navegação/registry/API gerada pertencem a owners externos sem compromisso fechado.

**Correção:** ownership explícito do barrel/tsconfig e pontos de montagem; entregar patches mínimos em paths externos via handoff e ACK, não edição concorrente. Congelar exports, compilação e DTOs antes de fan-out.

**Prova:** import real de todos os módulos, typecheck do código e testes novos, import test no host, sem editar branches alheias.

### CR-06 — P1 — Auditoria independente antes do candidato instalado
**Evidência:** `I09` depende C08/L09/D10/U09, não de I08 ou I01. Pode fechar auditoria sobre componentes enquanto a integração instalada está quebrada; I10 então consome esse resultado como se fosse suficiente.

**Correção:** dividir auditoria em oráculos precoces e adversarial final **após candidate SHA fixo/I08**, com provas negativas da composição. Revisões de segurança de terceiros no mesmo gate.

**Prova:** relatório de I09 referencia exatamente o candidate SHA de I10 e cenários instalados realmente executados.

### CR-07 — P1 — Critérios de aceite são insuficientes para execução sem decisões dos autores
**Evidência:** muitas missões têm um único acceptance textual e um único step; faltam payload/fixture exato, forma de falha, versões e inputs, orçamento, teste negativo e cross-API handoff. `G4` não define denominador, amostra, tolerância nem estratos. Regras anteriores de avaliação estatística/autoaceite não estão operacionalizadas.

**Correção:** para cada tarefa incluir `inputs`, `implement`, `outputs`, `negative_cases`, `exact_test`, `release_receipt`, `consumers`; classificar unknowns como bloqueio. No autoaceite definir unidade amostral, erro, cobertura, intervalo, versão e kill-switch.

**Prova:** executor gera implementação e teste sem pedir decisão de arquitetura/produto; falha semantizada sem maquiagem.

### CR-08 — P1 — Terceiros e privacidade sem plano de admissão e custo
**Evidência:** o V5 admite apenas provider hospedado existente e evita OCR/connectors/challengers, logo não mapeia envio de fontes a Reducto, Jev etc, credenciais, quotas, retenção, isolamento e autorização específica.

**Correção:** validar previamente quais serviços recebem dados (com dados reais somente quando autorizados), usar corpus sintético na comparação inicial, orçamento e timeout por operador, sem armazenar secrets em app/branch. Incluir testes de revogação, retries, cancelamento e saída quando fornecedor falha.

**Prova:** matriz de provider, tratamento de dados, custo e integração auditáveis por fonte/escopo.

### CR-09 — P2 — Baseline de `sf2-stack` já avançou
**Evidência:** 50 missões foram escritas em cima de `bc5eb1e0...`; no momento deste parecer `sf2-stack` está em `1074cf338...` (quatro commits à frente). O plano já exige C01 revalidar, mas nenhuma missão dispõe do preimage atualizado.

**Correção:** C01 publica pin atual + owner inventory antes de autorizar autores. Nunca adotar HEAD móvel silenciosamente nem copiar branches.

**Prova:** todos os receipts referem SHA e preimage consistentes; diff de paths próprios e contratos revisto.

## Ações na ordem causal

1. **Não despachar implementação baseada em V5**; preparação read-only não é aceite nem implementação.
2. Corrigir o contrato de escopo de V6 com as 12 linhas acima, sem excluir tecnologias antes da comparação.
3. Repartir as 50 missões mantendo 5 grupos de 10 e *fan-out real*: reservar trabalho independente no D0 (benchmarks, corpora, adapters, casos negativos, CI). Nenhuma dupla escreve o mesmo prefixo.
4. Fechar G0 com heads/ownership, DTOs, schemas de extração, provider allowlist, destinos nativos e comandos Actions verificáveis.
5. Executar primeiro vertical real imediatamente quando os menores adapters/ports estiverem prontos, **sem retirar do release** OCR, conectores, embeddings, grafo, fórmulas ou avaliação de ferramentas.
6. A primeira entrega integrada só é liberada com matriz de cobertura completa (ou bloqueio explícito sem declarar entrega completa), cenários de autorização/revogação e auditoria instalada independente.

**Importante:** requisitos de desempenho e qualidade preservados; qualquer autoaceite automático precisa passar sua própria qualificação, senão fica inativo e o release não pode alegar que autoaceite foi validado. Ferramentas concorrentes são avaliadas; instalar todas sem uso não aumenta qualidade nem velocidade.

**Resultado do review:** **4 P0 / 4 P1 / 1 P2**. O DAG atual é acíclico, todos os 50 IDs e dependências existem e os prefixos próprios não se sobrepõem lexicalmente; isso **não prova** que a integração, CI ou o escopo estejam corretos.
