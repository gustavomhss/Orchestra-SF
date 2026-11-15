# P9 — revisão estática final sobre C41

**PASS estático; qualificação de runtime pendente. GLOBAL_RELEASE permanece HOLD.**

A revisão fechou dois defeitos antes de qualquer execução deste candidato: a comparação por identidade de snapshots separados retornados pelo LocalStore e a janela assíncrona após a última leitura protegida do reader/BCS. O helper791de0 e o BCS1400fa usam digest completo das observações e mantêm a última autorização de cases/outbox no mesmo C08; depois dessa fronteira há somente verificações síncronas.

O domínio v3 ancora a captura real ao ChoiceRecord, evento completo, outputDigest e outbox atômico já existentes. Replay não chama o produtor nem completa capturas antigas. A ausência do callback e as formas explicitamente não suportadas preservam o comportamento anterior; falhas de uma captura suportada continuam sendo recusas. Nenhuma aprovação formal, política, grant, C12 ou CurrentChoice foi alterado.

O wiring usa o produtor real de Planner apenas no preparo padrão. O reader não recorre à resolução de evidência de cases/BCS. O caminho Atlas69 é preservado e continua prioritário. Toda a implementação createSfRecordHistory permanece byte idêntica a C37, incluindo ACL atual, continuidade física, releituras da captura protegida e diferenças canônicas.

A unidade proposta mantém47 casos e acrescenta3 adversariais na saída final. O writer nasce fora do contexto C08 e não é aguardado até concluir enquanto o lock está retido. Há observação imediata de rejeição e drenagem/limpeza no finally. A revisão foi textual; nenhum teste, build ou tsc foi executado.

C41 é1074cf338619a70ddef1ad1f62e32618fc355fed, tree3f98ab38aa223eefba708e566a42450d8f1c2a93. Dos155 paths do commit, somente business-services cruza os31 overlays. O postc7f8b5 preserva integralmente o novo binding67 e o delta52 anterior. C40 havia exigido atualizar somente o preimage do fixture Microsoft e seu mapa isolado, preservando Auth72, o mapa histórico55 e a composição atual do LocalStore.

A autoridade observada permanece ACK71_ACCEPTED_BOUNDED_SUCCESSION para integração e ACK52_ACTIVE_BOUNDED_SUCCESSION para52. Os commits auditados não encerram nem transferem essas leases. O SHA6b8b409 exibido como base da PR era antigo e não foi usado como HEAD.

Os pins, hashes completos, provas de equivalência textual e limites constam do JSON adjacente. O próximo gate é Actions no candidato exato, seguido das cinco jornadas originais com os budgets, identidades e assertions preservados.
