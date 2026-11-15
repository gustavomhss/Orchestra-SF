# Missão158 · N14 / PR146 · terminal source handoff

**Epoch:** `ux-native-n14-e2-browser158`. **Ator autenticado GitHub:** `gustavomhss`. **Modelo efetivo desta sessão:** `GPT-6`. **Astra runtime/session ID:** não expostos; não foi inferida sua criação nem a morte do writer anterior. **HEAD material:** `f308a54c6976edeaba2ed9ecc2a1ff34c8a7fd0c`, **tree:** `28c7191c9136f24669401727c5c1fbc08fb55abe`. **ACK:** `7ff7da570b492a303bb6afd2055647834b0c26ac`.

## PRE-R01-146-004: confirmação causal e trabalho efetivamente aplicado

O pré-blob de CAP06 `df71763074fccb7dd6f26efba762dffc32c42c65` continha `disabled: true` e `onInvoke: () => undefined`, portanto nenhum usuário conseguia seguir “Abrir estrutura”. CAP07 já existe na folha `people/structure/index.tsx@b67ed1ce...`, e a rota congelada `CAP07/entry` consta do manifesto. A fonte e a leitura de A10 foram reconciliadas contra `application.ts@a0deff8a...` e `dashboard-people.ts@de499e6d...`.

O delta REAL em `SOURCE-DELTA.patch` preserva o bloqueio de clique inseguro e corrige a razão de negativa: se CAP06 estiver pronta e a projeção de contexto atual disser que `CAP07/dashboard` não pode ser lida (ou recurso marcado `denied`), o CTA explica `sf.common.noAccess`, sem deduzir permissão a partir de outro papel. Os cenários novos em `u03.spec.ts` exigem, em uma instalação isolada REAL fornecida por150, (a) acesso positivo com CTA habilitada, navegação CAP06→CAP07, read real HTTP200 e stamp idêntico, owner triple/ano/mês, teclado Enter, foco no documento destino, browser back e foco de retorno, reflow 320px; e (b) principal CAP06-only real, CTA desabilitada com mensagem de acesso negado, sem transição por teclado. Nenhum mock/intercept, skip ou sucesso sintético.

## Bloqueio técnico exato — 132 precisa agir

O código AINDA NÃO habilita a CTA para autorizados. O contrato atual `SfSurfaceProps` contém apenas `surfaceId,route` e `SfContextHandle` contém `state,generation,ready,reload,invalidate`; nenhum fornece builder ou callback para `SfHref`. `navigation-state/index.ts@dc264d8c...` oferece uma state machine `requestNativeTransition(href,cause)`, mas NÃO é um builder nem fornece um hook de páginas. O registro de 132 `route-registry.ts@c70c68f...` exporta manifesto/parser e NÃO concede owner-aware href. `SfHref` é opaco; concatenar `/orchestra/sf-people/structure` + query no leaf seria violaçao de NAV-01 e risco de owner misturado.

`OWNER132-UNAPPLIED.patch` é **PATCH INERTE E NÃO APLICADO** (inclui hunk compartilhado, fora do allowlist). Propõe a assinatura exata `SfPeopleStructureNavPort.buildStructureHref({source:SfResolvedRoute<"CAP06">, ownerKey:SfOwnerKey, query:{year?,month?}, returnTo:SfHref}):SfHref|undefined` e `transitionStructure({href,ownerKey,returnTo,returnFocusActionId:"open-team-structure"}):Promise<SfNativeTransitionResult>`. O consumer proposto: exige `CAP07` read e resource `domain.page.CAP07` ready/operational, chama **builder F01** para CAP07/entry com mesmo owner/context, e depois a **transição autorizada** com revalidação atual, sem URL arbitrária; expõe loading/error real, devolução de foco por histórico e não usa route derivada de strings. A propriedade de bridge é opcional para manter negativa até implementação de 132. **O contrato proposto NÃO existe hoje e não deve ser anunciado como implementado.**

132 deve avaliar o patch contra os contratos congelados, instalar uma implementação real host + F01 public route builder antes de aplicar o hunk da folha, revalidar grant/owner no `requestNativeTransition`, preservar período e `returnTo` sem texto livre, e comprovar reversão de foco. Nenhuma modificação compartilhada foi feita pelo158; qualquer ajuste de assinatura pertence a132. A falta dessa API não pode ser contornada com `navigate("/...")`, `new URL` no componente ou cast de `SfHref`.

## SHAs e rastreabilidade

- CAP06: `df71763074fccb7dd6f26efba762dffc32c42c65 → 71d5028ed37864ad98cb767687e354a32730cfbd`.
- U03 E2E: `e9938385e1422480012c501af5c5ad783ad8dc39 → 7f9481c612026115cfff4513e0771eb301ea852a`.
- CAP07 leaf: `b67ed1ced5497218b1c2c0d0011cafafed46eb72` (intocado).
- Public F01 context type: `592eef8206c665a1fc908934e258b286fe85609e` (intocado).
- Material source: `f308a54c6976edeaba2ed9ecc2a1ff34c8a7fd0c`, tree `28c7191c9136f24669401727c5c1fbc08fb55abe`.
- Finding `PRE-R01-146-004`, `U03-AC02`, `U03-AC03`, NAV-01/READ-01/COPY-01 e Q02. `U03-AC01` preservado, sem reinterpretação de resultados.

## Validação e encaminhamento terminal

**NOT_RUN:** Playwright local/hosted, browser web/desktop, typecheck, build, codegen, guards, parser/validator; nenhum runner, dispatcher, workflow, reset/force ou merge executado por158. A mudança de razão de negativa e os testes são produto-fonte, **não** prova instalada, não fechamento de PRE-R01-146-004 e **não** GLOBAL_RELEASE. O owner da revisão deve reavaliar no integrado.

**Próxima ação exata:** 132/PR65 receber `SOURCE-DELTA.patch`, `OWNER132-UNAPPLIED.patch` e `MANIFEST.json`, validar/installar builder/port F01 owner-bound, aplicar o hunk da folha e registrar consumer pre/post e ACK real; 149/PR107 executar só compilação/guards dos inputs integrados; 150/PR106 executar seletivamente `u03.spec.ts` com principals autorizada e CAP06-only reais, em web/desktop instalado e foco/back/reflow. Resultado P2 permanece aberto até recheck independente. Goal nativa pausada. A autoridade anterior segue revogada para futuras escritas; conclusão administrativa não implica encerramento técnico de outra sessão.
