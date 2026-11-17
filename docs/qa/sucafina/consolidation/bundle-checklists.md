# Checklists executáveis por bundle

Copiar a seção correspondente para o body do PR e marcar cada item com evidência.

## A. Fase A — inventário

### Entrada

- [ ] `BASE_EXPECTED` registrado
- [ ] contagem completa de PRs abertos registrada
- [ ] paginação confirmada
- [ ] branches e heads pinados
- [ ] auditorias históricas lidas como evidência, não como verdade viva
- [ ] writers proibidos nas branches históricas

### Execução

- [ ] todos os PRs possuem metadata snapshot
- [ ] todos os changed files foram paginados
- [ ] ancestralidade testada
- [ ] blobs/deleções comparados
- [ ] patch-id usado quando necessário
- [ ] duplicatas de head detectadas
- [ ] branches empilhadas identificadas
- [ ] classificação por path concluída
- [ ] hunks usados somente em arquivos mistos
- [ ] bundle e owner atribuídos
- [ ] paths protegidos marcados
- [ ] decisões do dono enumeradas
- [ ] ledger validado

### Saída

- [ ] zero `UNREVIEWED`
- [ ] zero `UNKNOWN`
- [ ] zero source head sem pin
- [ ] cada `REPLAY` aponta para bundle
- [ ] duplicatas possuem PR canônico
- [ ] blockers possuem owner
- [ ] resumo de contagens publicado

---

## B0 — baseline verde

### Entrada

- [ ] base pinada
- [ ] CI atual coletado
- [ ] falhas agrupadas por assinatura
- [ ] branch criada do SHA exato
- [ ] writer único
- [ ] paths permitidos publicados
- [ ] nenhum feature scope incluído

### Typecheck e contratos

- [ ] `scenario-links` ou erro equivalente reproduzido no CI
- [ ] narrowing corrigido sem cast
- [ ] fixtures `DocumentEvidenceHost` atualizados
- [ ] `rejectDocument` ou contrato atual testado
- [ ] fixture T8 tipada sem literal artificial
- [ ] E2E typecheck verde

### Enrollment

- [ ] contrato atual de redirect reconfirmado no produto
- [ ] Decisions fixture atualizado
- [ ] Reports fixture atualizado
- [ ] cookie policy preservada
- [ ] Decisions chega à jornada real
- [ ] Reports chega à jornada real
- [ ] asserts de domínio preservados

### Guards e CI-SF

- [ ] `spawn-imports` causa exata documentada
- [ ] guard contra base do PR avaliado
- [ ] guard contra `dev` avaliado
- [ ] base canônica do guard decidida
- [ ] nenhuma comparação removida por conveniência
- [ ] CI-SF completou
- [ ] falhas posteriores do CI-SF corrigidas

### Saída

- [ ] full CI verde
- [ ] rerun das lanes previamente vermelhas
- [ ] geração limpa
- [ ] nenhuma lane cancelada
- [ ] nenhum “shared red”
- [ ] review A no SHA final
- [ ] review B no SHA final
- [ ] lease válido
- [ ] merge serial
- [ ] source PRs B0 reclassificados

---

## B1 — plataforma/runtime

### Entrada

- [ ] B0 mergeado
- [ ] base verde
- [ ] inventário completo
- [ ] records B1 classificados
- [ ] ownership sem colisão
- [ ] decisões auth/origin listadas
- [ ] branch criada do novo HEAD

### Checkpoint 1 — installation/origin

- [ ] seleção stale rejeitada
- [ ] origin witness real
- [ ] same-origin fail-closed
- [ ] nenhuma origem implícita inventada
- [ ] targeted CI verde

### Checkpoint 2 — auth/Entra/session

- [ ] 401/403/503 distintos
- [ ] logout/revogação comprovados
- [ ] cookie path preservado
- [ ] issuer/installation vinculados
- [ ] targeted CI verde

### Checkpoint 3 — host/runtime

- [ ] owner-runtime final
- [ ] host-context final
- [ ] producer e consumer ligados
- [ ] nenhuma bridge inerte
- [ ] targeted CI verde

### Checkpoint 4 — desktop/native bridge

- [ ] broker real
- [ ] renderer sem token
- [ ] origem instalada comprovada
- [ ] targeted CI verde

### Checkpoint 5 — Files/Memory/transport

- [ ] contratos tipados
- [ ] autoridade preservada
- [ ] limites e erros preservados
- [ ] targeted CI verde

### Checkpoint 6 — Task/Relay/Schedule/SessionPrompt

- [ ] wiring real
- [ ] callbacks reais
- [ ] nenhuma simulação
- [ ] targeted CI verde

### Saída

- [ ] full CI verde
- [ ] negative proofs verdes
- [ ] review segurança
- [ ] review runtime
- [ ] diff sem paths B2/B3 indevidos
- [ ] lease válido
- [ ] merge serial
- [ ] source PRs B1 reclassificados

---

## B2 — produto/domínios

### Entrada

- [ ] B1 mergeado
- [ ] base verde
- [ ] records B2 classificados
- [ ] ownership publicado
- [ ] migrações e rollback avaliados
- [ ] branch criada do novo HEAD

### Checkpoint 1 — Documents/import/export/Office

- [ ] auth antes do body
- [ ] limites de bytes/partes/tempo
- [ ] parser bounded
- [ ] evidence refs preservadas
- [ ] exports autorizados
- [ ] DOCX/XLSX qualificados
- [ ] targeted CI verde

### Checkpoint 2 — Procurement

- [ ] queue correta
- [ ] proposal/approval obrigatórios
- [ ] Apply idempotente
- [ ] races cobertas
- [ ] privacy preservada
- [ ] targeted CI verde

### Checkpoint 3 — Planner/Finance/Portfolio

- [ ] unidade/moeda/data explícitas
- [ ] OPEX/CAPEX sem perda
- [ ] FX provenance
- [ ] 12 meses
- [ ] custos e validações
- [ ] targeted CI verde

### Checkpoint 4 — Decisions/Reports

- [ ] duas alternativas
- [ ] escolha humana persistida
- [ ] source change revalidado
- [ ] reports preservam fontes
- [ ] review/reopen correto
- [ ] targeted CI verde

### Checkpoint 5 — People/Today/drafts

- [ ] draft retido
- [ ] revalidação
- [ ] CAS
- [ ] anexos
- [ ] resumo Today
- [ ] targeted CI verde

### Checkpoint 6 — Atlas/evidence

- [ ] ordinalidade
- [ ] histórico
- [ ] provenance
- [ ] nenhum receipt histórico reescrito
- [ ] targeted CI verde

### Saída

- [ ] jornadas integradas verdes
- [ ] full CI verde
- [ ] review funcional
- [ ] review financeiro/dados
- [ ] diff sem shell global indevido
- [ ] lease válido
- [ ] split não foi feito apenas por tamanho
- [ ] merge serial
- [ ] source PRs B2 reclassificados

---

## B3 — shell nativo

### Entrada

- [ ] B2 mergeado
- [ ] base verde
- [ ] equivalência mapeada
- [ ] records B3 classificados
- [ ] brand invariants publicados
- [ ] branch criada do novo HEAD

### Wiring e navegação

- [ ] capítulos registrados
- [ ] sidebar Orchestra
- [ ] entrypoint único
- [ ] routes nativas
- [ ] crosslinks
- [ ] i18n
- [ ] targeted CI verde

### Brand/temas

- [ ] Sucafina em todos os temas
- [ ] temas Orchestra preservados
- [ ] logos/assets autorizados
- [ ] favicon/naming corretos
- [ ] nenhum “segundo produto”
- [ ] targeted CI verde

### Retarget

- [ ] jornada nativa equivalente existe
- [ ] auth real
- [ ] evidence real
- [ ] teste retargetado
- [ ] teste antigo não foi apenas deletado
- [ ] negative coverage preservada
- [ ] targeted CI verde

### Retirada do legado

- [ ] APIs JSON preservadas
- [ ] POSTs preservados
- [ ] maintenance/backups preservados
- [ ] HTML não é mais face
- [ ] assets só removidos se inalcançáveis
- [ ] factory verde
- [ ] package Linux verde

### Saída

- [ ] full-product journey verde
- [ ] full CI verde
- [ ] review visual
- [ ] review equivalência
- [ ] lease válido
- [ ] merge serial
- [ ] source PRs B3 reclassificados

---

## Final — #237

### Pin

- [ ] head de `close-final-candidate`
- [ ] head de `go-live-close`
- [ ] merge ref do #237
- [ ] tree SHA
- [ ] artifact digest

### Código

- [ ] nenhum feature commit
- [ ] nenhum bug fix escondido
- [ ] nenhum receipt reescrito
- [ ] nenhum PASS sintético

### Qualificação

- [ ] CI completo no merge ref
- [ ] package check
- [ ] extração
- [ ] host instalado
- [ ] smoke SSO real
- [ ] rollback
- [ ] AM01–AM06
- [ ] UAT
- [ ] cold review tripla
- [ ] ledger terminal
- [ ] zero residual órfão
- [ ] GO/NO-GO explícito
