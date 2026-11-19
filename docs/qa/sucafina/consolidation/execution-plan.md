# Plano canônico de execução — consolidação Orchestra-SF

## 0. Metadados e escopo

**Tipo:** plano operacional; não é recibo de execução, aprovação de deploy ou GO.  
**Base de elaboração:** `close-final-candidate@9c2a43e2ed63254a94ae698cac52c476a3fb2653`.  
**Fila observada:** 242 PRs abertos na consulta de 2026-11-17.  
**Estratégia:** inventário completo + quatro bundles novos + promoção pelo PR `#237`.

Este plano substitui a estratégia anterior de seis waves e rebases individuais. A auditoria dos primeiros 100 PRs continua válida como evidência histórica, mas não representa o universo completo nem autoriza disposições para a fila móvel.

---

## 1. Missão

Reduzir centenas de PRs históricos para um conjunto pequeno, rastreável e qualificável sem perder trabalho e sem transportar ancestry obsoleta.

O resultado terminal deve ser:

1. cada PR aberto no início da campanha possui uma disposição explícita;
2. todo conteúdo útil ainda ausente foi portado para B0, B1, B2 ou B3;
3. todo conteúdo já presente possui prova de absorção;
4. toda duplicata possui dono canônico;
5. todo blocker possui dono e decisão requerida;
6. a base fica verde antes de receber novas integrações;
7. o merge ref do `#237` é qualificado no SHA final;
8. os PRs históricos ficam fechados ou explicitamente bloqueados, sem residual órfão.

---

## 2. Termos normativos

### 2.1 SHA e refs

- `BASE_BRANCH`: `close-final-candidate`.
- `BASE_EXPECTED`: SHA da base fixado no início de uma operação.
- `SOURCE_PR`: PR histórico sob análise.
- `SOURCE_HEAD`: SHA exato do head do `SOURCE_PR`.
- `SOURCE_BASE`: base declarada pelo PR histórico.
- `SOURCE_MB`: `merge-base(BASE_EXPECTED, SOURCE_HEAD)`.
- `SOURCE_CANDIDATE_SUPERSET`: diff `SOURCE_MB..SOURCE_HEAD`; é apenas um superset de mudanças candidatas, nunca “delta autoral” por presunção.
- `BUNDLE_HEAD`: SHA do bundle após o último checkpoint.
- `MERGE_REF`: ref sintético do GitHub para a composição head+base do PR.
- `PROMOTION_MERGE_REF`: merge ref do `#237` contra `go-live-close`.

### 2.2 Disposições do ledger

Cada unidade de conteúdo recebe exatamente uma disposição:

| Disposição | Significado |
|---|---|
| `UNREVIEWED` | snapshot criado, ainda não julgado |
| `ABSORBED_ANCESTOR` | `SOURCE_HEAD` é ancestral da base |
| `ABSORBED_BLOB` | blob ou deleção final já é idêntico à base |
| `ABSORBED_PATCH` | patch equivalente já está presente por squash/composição |
| `DUPLICATE_HEAD` | outro PR tem o mesmo head e é o dono canônico |
| `SUPERSEDED` | intenção substituída por implementação posterior comprovada |
| `REPLAY` | residual útil deve ser portado para um bundle |
| `DOCS_ONLY` | documentação prospectiva, sem comportamento de produto |
| `DROP_WITH_EVIDENCE` | conteúdo rejeitado com justificativa técnica explícita |
| `BLOCKED_OWNER_DECISION` | decisão de produto, release, dados, VM ou arquitetura |
| `BLOCKED_MISSING_BRANCH` | branch/head não acessível |
| `BLOCKED_SEMANTIC_CONFLICT` | duas intenções incompatíveis sem regra canônica |
| `PROMOTION_ONLY` | conteúdo pertence exclusivamente à promoção final |

Não existem `MAYBE`, `PROBABLY`, `SHARED_RED_OK` ou “superseded por título parecido”.

### 2.3 Estados operacionais

- `SNAPSHOTTED`
- `CLASSIFIED`
- `PORTED`
- `CI_PENDING`
- `CI_GREEN`
- `MERGED`
- `CLOSE_READY`
- `CLOSED`
- `BLOCKED`

Disposição e estado são independentes. Exemplo: um item pode ter disposição `REPLAY` e estado `CI_PENDING`.

---

## 3. Invariantes globais

### 3.1 Código, testes e segurança

1. GitHub Actions é o único oráculo de teste desta campanha.
2. Não executar `bun test`, build ou typecheck local.
3. Não aceitar skip, `xfail`, cast, `any`, ignore, timeout inflado ou assert relaxado.
4. Não alterar comportamento fail-closed para produzir verde.
5. Não ampliar cookie, origin, CORS, grant ou permissões sem decisão explícita.
6. Não introduzir token no renderer.
7. Não fabricar receipt, PASS, execução, UAT ou prova instalada.
8. Não reescrever:
   - `modules/sucafina/Sucafinav1/docs/sf2h/receipts/**`;
   - `docs/qa/sucafina/uat-cio/research/**`;
   - hashes, assinaturas e resultados históricos.
9. Correção histórica gera novo registro; nunca mutação retroativa.
10. O shell Orchestra e seus temas são preservados; Sucafina é brand layer.

### 3.2 Git e ownership

1. Branch histórica é read-only.
2. Um único writer possui a branch de cada bundle.
3. Miners entregam classificação, patches ou commits isolados; não fazem push concorrente no bundle.
4. Todo bundle nasce do HEAD atual da base após lease.
5. Todo merge é serial.
6. CI e reviews expiram se a base mudar.
7. Nenhum source PR é fechado sem residual zero comprovado.
8. Branches históricas não são apagadas antes da promoção final.
9. `#237` não recebe feature.
10. Nenhum merge direto em `close-final-candidate` fora dos bundles durante a campanha.

### 3.3 Infra e release

1. Estes documentos não autorizam VM, deploy ou semeadura de dados.
2. `go-live-close` só recebe a promoção final.
3. Artefato, tree, receipts e UAT precisam apontar para o mesmo candidato.
4. Smoke SSO real e rollback são gates independentes de CI de código.
5. Windows e macOS não são reintroduzidos no CI SF se a política canônica é Linux-only.

---

## 4. Controle da base

`close-final-candidate` não está protegido por garantia suficiente para assumir imutabilidade. A campanha deve usar uma das opções abaixo.

### 4.1 Opção preferida: proteção temporária

Configurar temporariamente:

- merge somente por PR;
- checks obrigatórios;
- sem force-push;
- sem deleção;
- somente integrador da campanha com permissão de merge;
- reviews mínimas para mudança de comportamento.

### 4.2 Opção mínima: lease rígido

Antes de qualquer operação:

```bash
export REPO=gustavomhss/Orchestra-SF
export BASE_BRANCH=close-final-candidate
export BASE_EXPECTED="$(gh api repos/$REPO/git/ref/heads/$BASE_BRANCH --jq .object.sha)"
test -n "$BASE_EXPECTED"
```

Antes de push, aceite de CI, review final e merge:

```bash
current="$(gh api repos/$REPO/git/ref/heads/$BASE_BRANCH --jq .object.sha)"
test "$current" = "$BASE_EXPECTED" || {
  echo "BASE_DRIFT expected=$BASE_EXPECTED actual=$current" >&2
  exit 1
}
```

Se houver drift:

1. não rebasear automaticamente;
2. parar o bundle;
3. renovar inventário dos paths tocados;
4. atualizar o ledger;
5. reconstruir o bundle sobre o novo head;
6. rerodar CI e reviews.

---

## 5. Topologia final

```text
Fase A: inventário total e ledger
             │
             ├──────────────┐
             │              │
             ▼              ▼
          B0 verde     mineração read-only B1/B2/B3
             │
             ▼
          merge B0
             │
             ▼
             B1
             │
             ▼
          merge B1
             │
             ▼
             B2
             │
             ▼
          merge B2
             │
             ▼
             B3
             │
             ▼
          merge B3
             │
             ▼
        #237 merge ref
             │
             ▼
         GO/NO-GO
```

B1 não começa enquanto a Fase A possuir `UNREVIEWED` ou `UNKNOWN`. B0 pode avançar em paralelo porque trabalha somente sobre falhas atuais comprovadas da base.

---

## 6. Fase A — inventário completo

### 6.1 Objetivo

Criar um snapshot determinístico de todos os PRs abertos e classificar cada path relevante sem executar rebase ou merge nas branches históricas.

### 6.2 Entradas

- HEAD atual de `close-final-candidate`;
- lista completa de PRs abertos, sem limite de 100;
- metadados de head/base/estado;
- changed files paginados até o fim;
- histórico das auditorias existentes.

### 6.3 Saídas obrigatórias

1. `consolidation-ledger.jsonl` real, validado pelo schema.
2. resumo por bundle:
   - quantidade de PRs;
   - quantidade de paths;
   - `REPLAY`;
   - absorvidos;
   - duplicados;
   - bloqueados.
3. mapa de ownership por path.
4. lista de decisões do dono.
5. lista de source heads imutáveis.
6. lista de branches ausentes.
7. lista de relações duplicadas e canônicas.
8. zero registros `UNREVIEWED` antes de B1.

### 6.4 Algoritmo por PR

Para cada PR:

1. capturar:
   - número;
   - título;
   - draft;
   - estado;
   - base;
   - branch;
   - head SHA;
   - autor;
   - mergeability observada;
   - checks observados;
   - changed files completos;
2. confirmar que a ref da branch e o head do PR coincidem;
3. testar ancestralidade;
4. testar diff vazio;
5. comparar blobs por path;
6. comparar deleções;
7. comparar patch-id quando o blob divergir;
8. detectar head idêntico em outro PR;
9. detectar ancestry empilhada;
10. construir `SOURCE_CANDIDATE_SUPERSET`;
11. classificar por arquivo;
12. usar hunk somente em arquivo misto;
13. atribuir bundle e owner;
14. registrar evidência;
15. marcar decisão ou blocker.

### 6.5 Ordem de prova de absorção

Aplicar nesta ordem:

1. `SOURCE_HEAD` ancestral da base;
2. diff final vazio;
3. blob final idêntico;
4. path removido também ausente na base;
5. patch-id equivalente;
6. hunk canônico presente;
7. implementação posterior semanticamente equivalente, com evidência;
8. somente então `SUPERSEDED`.

Título, descrição ou nome de branch nunca são prova.

### 6.6 Granularidade

A unidade padrão é **path**. Usar hunk somente quando:

- parte do arquivo já está absorvida;
- outra parte ainda é útil;
- não é seguro portar o arquivo inteiro;
- o hunk possui contexto e hash identificável.

### 6.7 Gate de saída

A Fase A termina quando:

- todos os PRs do snapshot estão no ledger;
- todos os changed files foram paginados;
- zero registros `UNREVIEWED`;
- zero `SOURCE_HEAD` sem pin;
- duplicatas possuem dono canônico;
- blockers possuem owner;
- paths protegidos estão identificados;
- cada `REPLAY` aponta para B0/B1/B2/B3/FINAL.

---

## 7. B0 — baseline verde

### 7.1 Branch

`consolidate/00-baseline-green`

### 7.2 Missão

Corrigir apenas defeitos atuais da base e tornar o CI um oráculo confiável. B0 não absorve feature histórica.

### 7.3 Defeitos conhecidos a reconfirmar

Recolher os logs do head atual. Assinaturas já observadas em heads anteriores incluem:

- `scenario-links.ts`: valor possivelmente indefinido;
- fixtures de `DocumentEvidenceHost` sem `rejectDocument`;
- fixture T8 com literal de instalação estreito;
- Decisions esperando redirect legado `/sucafina/dashboard`;
- Reports esperando `${mount}/dashboard`;
- `spawn-imports` vermelho;
- guard contra `origin/dev` vermelho, enquanto guard contra a base do PR estava verde;
- `CI-SF` potencialmente revelando defeitos posteriores quando deixa de cancelar/bailar.

Essas assinaturas são pistas, não autorização para copiar fix antigo.

### 7.4 Paths permitidos

B0 pode tocar somente:

- arquivos diretamente responsáveis pelos typechecks atuais;
- fixtures compartilhados de enrollment/instalação;
- testes correspondentes;
- scripts de guard/spawn se a causa estiver comprovada;
- workflow/manifesto somente quando a falha estiver no oráculo, não no produto;
- documentação do ledger e da campanha.

### 7.5 Paths proibidos

B0 não deve:

- implementar feature de domínio;
- remover console;
- alterar branding;
- absorver backlog por conveniência;
- mudar schema de negócio;
- introduzir deploy;
- alterar receipts históricos;
- converter erro real em waiver.

### 7.6 Sequência de commits

1. `fix(sf): reconcile current document evidence types`
2. `test(sf): align current document host fixtures`
3. `test(sf): retarget enrollment fixtures to Orchestra shell`
4. `fix(ci): restore spawn/import guard contract` — somente se causa comprovada
5. `fix(ci): reconcile canonical guard base` — somente após decisão explícita
6. `fix(sf): close remaining CI-SF baseline defects`
7. `docs(sf): record B0 evidence and source dispositions`

Cada commit deve ter source PRs e evidências no ledger.

### 7.7 Gate de entrada

- base pinada;
- logs do head atual coletados;
- falhas agrupadas por assinatura;
- branch criada do SHA exato;
- writer único designado;
- paths permitidos publicados.

### 7.8 Gate de saída

- geração limpa;
- todos os typechecks verdes;
- Decisions chega à jornada real e passa;
- Reports chega à jornada real e passa;
- CI-SF termina e passa;
- guards e spawn passam sem relaxamento;
- matriz completa verde no merge ref;
- rerun das lanes anteriormente vermelhas no mesmo head;
- nenhum vermelho chamado de “shared”;
- cold review de segurança e escopo;
- lease da base ainda válido.

---

## 8. B1 — plataforma, runtime, host e segurança

### 8.1 Branch

`consolidate/10-platform-runtime`

Criada somente após o merge de B0.

### 8.2 Ownership

B1 é dono de:

- `apps/cli/src/sucafina-product/**`;
- `apps/desktop/**`;
- `packages/core/**`;
- `packages/server/**`;
- runtime de instalação, host, origin, auth e transport;
- contextos de autoridade e comunicação;
- Files/Memory transport;
- Task/Relay/Schedule;
- SessionPrompt;
- native bridge;
- provenance de plataforma.

B1 não é dono da lógica financeira, Procurement, Planner, Reports ou UI global do shell.

### 8.3 Invariantes

- sem token no renderer;
- sem CORS amplo;
- cookie não é ampliado por conveniência;
- `401`, `403` e `503` continuam distintos;
- stale installation falha fechada;
- issuer/origin/installation permanecem vinculados;
- nenhum grant ou principal é fabricado;
- bridge adicionada possui producer, consumer e prova;
- logout e revogação invalidam o contexto correto;
- persistência não reabre host de outra instalação.

### 8.4 Checkpoints

1. installation/origin fences;
2. auth/Entra/session lifecycle;
3. owner-runtime/host-context;
4. desktop broker/native bridge;
5. Files/Memory/transport;
6. Task/Relay/Schedule/SessionPrompt;
7. negative proofs e integração.

### 8.5 Gate de entrada

- B0 mergeado e verde;
- inventário completo;
- todos os registros B1 classificados;
- nenhum path B1 simultaneamente owned por B2/B3;
- decisões de auth abertas explicitadas.

### 8.6 Gate de saída

- targeted lanes verdes após cada checkpoint;
- full CI verde no head final;
- testes negativos de origin/auth/stale context verdes;
- nenhuma bridge inerte;
- nenhuma alteração não atribuída no diff;
- reviewers de segurança e runtime aprovam o mesmo SHA;
- lease válido.

---

## 9. B2 — produto e domínios de negócio

### 9.1 Branch

`consolidate/20-business-product`

Criada somente após o merge de B1.

### 9.2 Ownership

B2 é dono de:

- `modules/sucafina/Sucafinav1/product/**`;
- lógica e testes de domínio;
- componentes específicos dos capítulos;
- Documents;
- import/export;
- Office;
- Procurement;
- Planner;
- Finance;
- Portfolio;
- Decisions;
- Reports;
- People;
- Today;
- drafts;
- evidence;
- Atlas de negócio;
- CAP04/CAP05/CAP18/CAP19/CAP22.

B2 implementa o capítulo. B3 conecta o capítulo ao shell global.

### 9.3 Ordem de checkpoints

1. Documents / import / export / Office;
2. Procurement;
3. Planner / Finance / Portfolio;
4. Decisions / Reports;
5. People / Today / drafts;
6. Atlas / evidence / receipts novos;
7. jornadas integradas.

### 9.4 Invariantes

- proveniência não é reconstruída artificialmente;
- draft retido continua retido;
- Apply exige proposta e aprovação válidas;
- CAS não vira last-write-wins;
- unidade, moeda e data permanecem explícitas;
- cenário hipotético não vira observação;
- revalidação não é removida para evitar race;
- imports mantêm limites de bytes, partes, concorrência e tempo;
- exports mantêm autorização e refs;
- receipts novos não alegam execução não realizada;
- nenhum histórico imutável é reescrito.

### 9.5 Quando dividir B2

B2 só vira B2A/B2B quando houver:

1. decisão humana bloqueando um domínio enquanto o restante está pronto;
2. migração de schema com rollout independente;
3. contrato semanticamente incompatível;
4. falha impossível de isolar por checkpoint;
5. rollback que exija fronteira própria.

Tamanho de diff sozinho não é justificativa.

### 9.6 Gate de saída

- todos os checkpoints possuem targeted CI;
- full CI verde;
- jornadas integradas verdes;
- recibos novos vinculados ao head;
- nenhum path global do shell entrou por acidente;
- review de dados/financeiro e review funcional no mesmo SHA;
- lease válido.

---

## 10. B3 — shell nativo, UX e aposentadoria do legado

### 10.1 Branch

`consolidate/30-native-shell`

Criada somente após o merge de B2.

### 10.2 Ownership

B3 é dono de:

- shell global Orchestra;
- sidebar;
- entrypoint;
- roteamento global;
- brand layer Sucafina;
- temas;
- integração dos capítulos;
- links e navegação;
- i18n global;
- retarget dos E2Es para capítulos nativos;
- retirada das páginas HTML legadas;
- limpeza de assets comprovadamente mortos.

### 10.3 Ordem obrigatória

1. wiring nativo;
2. rotas e navegação;
3. brand layer e temas;
4. jornada nativa equivalente;
5. retarget do teste;
6. desativação da face HTML;
7. limpeza de código inalcançável;
8. full-product journey.

Nunca retirar o legado antes de equivalência e retarget.

### 10.4 Invariantes

- interface continua Orchestra;
- temas Orchestra permanecem;
- marca Sucafina permanece em todos os temas;
- APIs JSON e projeções nativas continuam;
- páginas HTML não voltam como face do produto;
- manutenção e backups não são removidos por engano;
- prova visual usa host instalado, não mock;
- factory e pacote Linux continuam verdes.

### 10.5 Gate de saída

- todas as jornadas obrigatórias usam shell nativo;
- nenhuma lane depende das antigas páginas HTML;
- APIs preservadas;
- factory/package verdes;
- installed capture monta os capítulos;
- full CI verde;
- review visual e review de equivalência no mesmo SHA;
- lease válido.

---

## 11. Promoção final — PR #237

### 11.1 Natureza

O `#237` possui head `close-final-candidate` e base `go-live-close`. Ele acompanha automaticamente a base. Não existe “commit para atualizar o SHA do #237”.

### 11.2 Proibido

- adicionar feature;
- corrigir bug escondido;
- alterar produto;
- reescrever receipt;
- gerar PASS sintético;
- aprovar deploy automaticamente.

### 11.3 Sequência

1. confirmar B0–B3 mergeados;
2. confirmar ledger sem residual órfão;
3. pin:
   - head de `close-final-candidate`;
   - head de `go-live-close`;
   - merge ref do `#237`;
4. executar CI no merge ref;
5. construir o artefato do mesmo tree;
6. validar pacote e hashes;
7. executar provas instaladas;
8. executar smoke SSO real;
9. validar rollback;
10. executar UAT autorizada;
11. cold review tripla;
12. registrar GO/NO-GO do dono;
13. promover sem código surpresa.

### 11.4 Gate de saída

- merge ref verde;
- artefato e tree coincidem;
- receipts apontam para o mesmo candidato;
- nenhuma história BLOCKED foi convertida em PASS;
- nenhuma branch fonte possui residual sem disposição;
- owner sign-off explícito.

---

## 12. Matriz de CI

### 12.1 Targeted CI

Após cada checkpoint, rodar as lanes diretamente afetadas. Exemplos:

| Escopo | Lanes mínimas |
|---|---|
| tipos/contratos | `sf/static-and-contracts`, suite manifestada correspondente |
| CLI/runtime | `sf/test-CI-CLI`, `sf/test-CI-SF` |
| app source | `sf/test-CI-APP-SRC` |
| browser/componentes | `sf/test-CI-APP-BROWSER` |
| Decisions | `sf/test-CI-UI-DECISIONS` |
| Reports | `sf/test-CI-UI-REPORTS` |
| Operations/Uploads | `sf/test-CI-UI-OPERATIONS` |
| Procurement queue | `sf/procurement-queue-integration` |
| Atlas/negócio | `sf/test-CI-ATLAS-BUSINESS` |
| Omni | `sf/linux-native-omni` |
| entrada/manifesto | `sf/preflight` |

O workflow canônico é a fonte final. A lista acima não licencia ignorar job novo.

### 12.2 Full CI

Obrigatório:

- no head final de cada bundle;
- no merge ref de cada bundle;
- no merge ref final do `#237`.

### 12.3 Rerun

B0:

- full CI verde;
- rerun de todas as lanes que estavam vermelhas, canceladas ou suspeitas de infra.

B1–B3:

- full CI verde;
- rerun somente de lane instável, flaky ou anteriormente vermelha.

### 12.4 Falha de infraestrutura

Uma falha pode ser classificada como infra somente com:

- mesmo head;
- mesma lane;
- ausência de mudança de produto;
- assinatura de rede/registry/runner;
- rerun limpo;
- registro no ledger/PR.

Rerun não apaga a primeira falha.

---

## 13. Reviews

Cada bundle exige duas reviews independentes no mesmo SHA:

### Review A — semântica e segurança

- auth;
- origem;
- dados;
- provenance;
- guards;
- decisão de produto;
- comportamento fail-closed.

### Review B — integração e escopo

- duplicação;
- paths fora de ownership;
- ancestry acidental;
- código morto;
- fixtures;
- CI;
- risco de regressão.

B2 exige ainda review financeira/dados. B3 exige review visual/equivalência. A promoção exige revisão tripla.

---

## 14. Fechamento dos PRs históricos

Após cada merge:

1. atualizar base;
2. renovar prova de absorção;
3. verificar residual zero;
4. atualizar ledger;
5. fechar somente `close_ready=true`;
6. comentar bundle, commits e evidência;
7. preservar branch.

Modelo:

```text
Fechado como absorvido/superseded pela consolidação.

Bundle: <B0|B1|B2|B3>
Base verificada: <sha>
Commit(s): <sha...>
Paths/hunks: <lista>
Disposição: <disposition>
Residual contra a base: zero
Branch preservada até a promoção final.
```

PR parcialmente portado permanece aberto até o último residual ser disposto.

---

## 15. Condições de parada

Parar imediatamente diante de:

- drift da base;
- branch/head sem lease;
- conflito semântico de auth, provenance, financeiro ou retention;
- migração sem rollback;
- hunk sem origem demonstrável;
- receipt alterado para fingir execução;
- novo vermelho não atribuível;
- tentativa de remover guard para obter verde;
- path fora do ownership do bundle;
- source PR não inventariado;
- CI executado contra SHA diferente;
- merge ref diferente do revisado.

Conflito textual, import, rename e fixture desatualizada não são stop global; resolvem-se no checkpoint apropriado.

---

## 16. Definition of Done

```text
[ ] snapshot completo da fila criado
[ ] zero UNREVIEWED/UNKNOWN
[ ] B0 mergeado e verde
[ ] B1 mergeado e verde
[ ] B2 mergeado e verde
[ ] B3 mergeado e verde
[ ] zero residual órfão
[ ] source PRs fechados ou bloqueados com owner
[ ] #237 verde no merge ref atual
[ ] tree, artifact e receipts coincidentes
[ ] UAT sem PASS fabricado
[ ] rollback comprovado
[ ] GO/NO-GO explícito
```
