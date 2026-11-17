# Revisão fria V2 — Orchestra-SF UAT 360° para CIO / Sucafina

**Data do estudo:** 2026-11-16 · **Autoria:** cold review independente da produção de casos anterior · **Estado:** GAPS_IDENTIFIED_NOT_SOTA.
**Escopo:** artefatos de teste, não reexecução da aplicação. **Não afirmar GO-LIVE ou 100% de testes.**

## Veredito

O V1 é um catálogo amplo e relativamente cuidadoso, mas **não é ainda um sistema de aceitação de classe mundial**. O denominador de cobertura tem três níveis que não podem ser misturados:

1. **Cobertura estrutural:** 70 superfícies, 165 rotas, 305 IDs do catálogo + 1 extra em registro — localizados/correlacionados.
2. **Cobertura semântica:** ações, estados, transições, regras, versões, falhas e permissões por operação — **não demonstrada por simples mapeamento de IDs a stories**.
3. **Cobertura executada:** resultados do mesmo SHA, real instalação, atores verdadeiros, dados materializados, recibos e evidências — **zero execuções documentadas no pack**.

O alcance não deve ser medido por **185+825**. Muitas das 825 verificações partilham a mesma expectativa parametrizada; as 140 histórias por superfície partilham boilerplate. O teste de uma tela não cobre todas as mutações que ela expõe. `NOT_RUN` não é sucesso.

## Descobertas verificáveis no próprio V1

| ID | Grau | Achado e evidência | Risco | Fechamento exigido |
|---|---|---|---|---|
| V2-01 | P0 | As 70 stories principais repetem **exatamente o primeiro e último passo**, e 70 contraprovas seguem quatro passos de mesma estrutura. | Executor improvisa comandos/expected, qualidade não é reproduzível. | Passos individualizados com entrada, sourceRef, estado, status contratual e testemunho de cada ação. |
| V2-02 | P0 | Mapeamento **306 IDs de operações → superfície e story principal**, sem prova de cada transição/codec/producer em SHA C. | Cobertura nominal 306/306 gera confiança indevida. | Ledger por operação com `read/prepare/commit/deny/retry/receipt`, método/version binding, status e evidência. |
| V2-03 | P0 | `SF-LAB-2026.json` não é seed executável nem fixture materializada no produto; 25 projetos e 10 suppliers são JSON. | UAT em VM pode ficar toda BLOCKED ou usar dados diferentes. | Provisioner por **portas originais autorizadas** + read-before-create + reconcile + cleanup + lease por executor. |
| V2-04 | P0 | Ausência de matriz explícita de transições de estados Procurement/Decision/Import/Agent/Report. | Aprovações ilegais, atalhos, resposta perdida, cancellation races escapam. | State model com eventos, guards, before/after, oráculo independente, teste por aresta válida e inválida. |
| V2-05 | P1 | **825 casos** são 5 padrões repetidos por rota; **83 rotas estáticas** e **82 com parâmetro dinâmico**. | Teste `invalid ref` em rota estática vira só query arbitrária e mascara gaps. | Particionar por tipo de rota, parâmetro e semântica (read/create/edit/download) com expectativas distintas por status. |
| V2-06 | P1 | As **45 E2E stories** tinham `Como` seguido de lista de papéis; corrigido para protagonista único e colaboradores neste V2. | Não é uma história centrada no usuário, ownership do aceite fica ambíguo. | Designar dono por story, contribuidores e decisão de sign-off por domínio. |
| V2-07 | P1 | `QA-TRACEABILITY.json` marcava todas **45 histórias como BASELINE**, mas há **11 com dependência de release**. Corrigido para 34 baseline + 11 condicionais. | Falso FAIL/GO em feature não promovida ou obrigatória não testada. | Manifest de release com `required/conditional/not-applicable-approved` por SHA e decisão do owner. |
| V2-08 | P1 | Título da story `SF-E2E-006` invertia os valores da fonte (6 dias) e extração errada (60). Corrigido. | QA poderia preparar oráculo inverso e aceitar bug. | Linter de invariantes de fixtures e expectativas; snapshot de fatos independentes. |
| V2-09 | P0 | Não há prova de `tenant + real user + snapshot role/grant + VM + CI` para casos de identidade, nem variante de mudança de grant sob concorrência demonstrada. | Vazamento horizontal, autoelevação e falsa comprovação de segurança. | Perfis signed-OIDC reais, matriz RBAC/ABAC e contraprova revalidada no backend. |
| V2-10 | P1 | Os scores P0 são **39 de 45 histórias E2E**, sem critérios explícitos de impacto/residual risk. | Prioridade pouco discriminante; execução crítica não cabe na janela. | FMEA leve por impacto × frequência × detectabilidade, owner e tempo de execução; selecionar tranche de bloqueio real. |
| V2-11 | P1 | Entidades sintéticas básicas (`Projeto IT Global XX`) pouco próximas de cotidiano multi-país do comércio internacional de café. | Experiência do CIO e situações de dados globais subrepresentadas. | Instalar cenários **hipotéticos** para interfaces logísticas/embarques, FX temporal, fuso, origem/destino e anomalias de qualidade, sem alegar existência de CTRM/SAP/Fabric integrado. |
| V2-12 | P0 | Fonte do catálogo vem de SHA histórico; releases e PRs paralelos seguem mudando sem um diff semântico de cobertura. | Gate mede versão errada. | Diff de `manifest+route+registry+producer+policies` do C; todo novo comando/guard exige nova prova. |
| V2-13 | P1 | O validador v1 dizia ser somente-leitura, mas reescrevia `QA-TRACEABILITY.json` e contava todas as 45 E2E como BASELINE. **Corrigido no V2 para validar sem mutar o relatório, e exigir hashes completos.** | Auditoria altera a própria evidência e oculta feature gates. | Validar sem efeitos colaterais; qualquer divergência aborta. |

## Critérios para qualificar como SOTA sem marketing

Uma bateria de aceitação de referência exige, simultaneamente:

- **(A) Readiness de dados:** fixture sintética carregada no produtor, IDs reais capturados e `seed receipt` versionado por SHA do ambiente. Sem seed = BLOCKED, não PASS.
- **(B) Model-based testing:** modelos formais de estados para Procurement, Import, Decisions, Review/Export, Routine/AI e Supreme Grants. Cobrir arestas críticas, guard verdadeiro/falso, transições inválidas, revogação e replays.
- **(C) Teste independente do implementation oracle:** resultados calculados fora da função sob teste; reconciliar valores, versões, bytes, deltas e invariantes. Cada mutação tem BEFORE/AFTER.
- **(D) Fault injection real:** particionar perda de request antes do commit, perda de resposta após commit, timeout, restart, 429/503, optimistic concurrency, malformado, dupla submissão, evento fora de ordem.
- **(E) Actor-by-policy:** grupos, grants, recurso, tenant, instalação, política revogada, ator homônimo e senha/sessão não exposta. Testar backend e navegador, nunca somente esconder links.
- **(F) Semântica de confiança IA:** `run.started` != `run.completed`, output verificado != escolha humana != mutação de negócio; fontes citadas, source digest, verifier, cancel race e failures.
- **(G) Usabilidade medida:** jornadas em desktop/tablet/mobile e zoom, teclado, leitores de tela, content reflow, percepção de erros; comparação da marca Sucafina mantendo geometria/temas Orchestra.
- **(H) Evidence chain:** cada etapa com `runId`, user objectId (sanitizado), sourceSha/commit, env, time, request/correlation id, expected vs observed, receipt ou no-commit, artifact digest e auditor independente.
- **(I) Decisão de release auditável:** estado do candidato C, `Required` vs `Conditional`, blockers sem exceção informal, sign-off CIO/Finance/Security/QA/Release, plano rollback e prova dos 12 jobs no mesmo SHA.

## Camadas do programa recomendado

| Camada | Unidade de cobertura | Critério para PASS | Custo/recomendação |
|---|---|---|---|
| L0 contrato | campo/codec/método/status/op ID | unit/contract test para op exata; sem parse HTML nem skip | automatizar tudo |
| L1 transição | state×event×guard×role×version | mutação correta, no-commit ou receipt original | automação de API e falhas |
| L2 jornada humana | ator real×objetivo×UI×visão×projeção | observação sem depender do código para dizer o expected | executar com QA e stakeholders |
| L3 ataque/resiliência | policy swap, browser history, concorrência, backend 429/503, disaster | efeito nunca escapa grants; recuperação mensurável | especialistas + chaos controlado |
| L4 CIO witness | briefing, forecast, procurement, risco, snapshot e relatório | decisão informada, sem ação silenciosa, concilia com produtor | sponsor assina por cenário |
| L5 promoção | SHA C + CI + pacote + tenant + VM + política + rollback | evidência homogênea e irrevogável de release | gate conjuntivo |

## Padrões externos de referência (não declaração de certificação)

- **ISO/IEC/IEEE 29119-3:2021:** documentação de teste — https://www.iso.org/standard/79429.html . O pacote v1 é incompleto como evidência executada.
- **ISTQB CTFL v4.0.1:** partição de equivalência, limites, tabela de decisão e transição de estados — https://www.istqb.org/ . Aplicar técnicas, não apenas citá-las.
- **OWASP ASVS 5.0.0:** requisitos verificáveis de segurança web — https://asvs.owasp.org/ . O nível escolhido e exceções precisam ser definidos pelo responsável de segurança.
- **WCAG 2.2:** critérios testáveis de acessibilidade — https://www.w3.org/TR/WCAG22/ . Não afirmar conformidade apenas por ter screenshot responsivo.

## Os 8 dossiês adicionados neste V2

`STEP-LEVEL-DOSSIERS.md` e `.json` são **exemplos operacionais aprofundados**, 8 casos com ação → expected → witness por etapa, incluindo Finance, Procurement, Import, Review, Graph admin (condicional), IA, UX e DR. Eles não transformam as outras 185 histórias em nível 2 por osmose. **Estado de todos os 8: NOT_RUN.**

## Decisão de prontidão

**NO-GO para chamar o programa de SOTA ou homologado.** GO **somente para continuar o design UAT**. O trabalho prioritário é: (1) seed real e entitlements, (2) proof ledger por operação, (3) models/transition coverage, (4) reescrever stories genéricas em passos observáveis, (5) executar com evidência em candidato C. Os ajustes documentais deste V2 **não são equivalentes** à execução nem a completar esses itens.
