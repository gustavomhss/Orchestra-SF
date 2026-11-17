# Procedimento de execução — humano e QA

## 0. Limites de segurança

Executar somente em instância isolada autorizada. **Não usar produção, dados reais, segredos, token OIDC, client secret nem IDs reais de tenant nos relatórios ou no Git.** A matriz tem rótulos de atores; o executor precisa configurar o vínculo autenticado no ambiente seguro. Nunca alterar grupos Entra, permissões reais ou policy de produção para produzir uma negativa. Se tiver um grupo supremo real, a autorização do owner é pré-condição. Todos os status começam `NOT_RUN`.

## 1. Preparação auditável

1. Anotar **commit exato**, tree hash, nome do branch somente como contexto, image/build/package digest e CI run IDs. Se o commit mudar, invalidar evidência anterior para a nova versão.
2. Congelar uma instalação QA isolada e snapshot backup; verificar owner tuple, origem HTTPS, roleMap, accessRevision e grants por ator. Capturar somente IDs de ensaio sanitizados em relatório público.
3. Semear **pelos produtores admitidos**, nunca `INSERT` no SQLite ou atalho de API fictícia. O fixture `SF-LAB-2026.json` não é script de seed; primeiro conferir a interface real de criação/importação e os codecs. Caso produtor não exista, `BLOCKED_CAPABILITY`.
4. Para o roteiro de import, partir de uma versão Planner válida contendo Renewal=72000 e Fixed=518000 (números do oráculo), exportada pela aplicação, **não apenas arquivo montado**. Gerar preview e confirmar visualmente token/version antes de aplicar.
5. Provisionar atores reais de **teste** e permissões por fluxo. Não inferir `role` de cargo e não inventar objectId. Os nomes Daniel, Caio, Pedro, Gabriel, Sofie e Zico são etiquetas do caso, não grants.
6. Verificar via endpoint/control real se `/sucafina/admin/access` do PR #270 e demo Flamengo do PR #268 estão no candidato. Caso não, manter teste `BLOCKED_CAPABILITY/CONDITIONAL`, sem tirar a linha do inventário ou simular implementação.

## 2. Ordem sugerida — respeitando dependências

| Lote | Stories | Preparação/saída |
| --- | --- | --- |
| A · Foundation | SF-E2E-016/017/018/022/036/043 e UI67 | Identidade, owner, Entra, contexto e permissões; negativa deve funcionar antes das mutações |
| B · Baseline | CAP03/17/18/22/23, CAP24/25/26, CAP09/10 | Semear orçamento, 25 projetos, fornecedores, FX, PR32k e histórico coerentes |
| C · Transações | SF-E2E-002/003/005/013/023/028/037/042 | Forecast, sourcing, import, CAS, Idempotency, stale/retry e evidência no produtor |
| D · Conhecimento | UI33–UI63, SF-E2E-004/006/007/014/024 | Decisões, documentos, BI, pauta, reports, busca, revogação e evidências |
| E · Agents e administração | UI64–UI70, SF-E2E-019–026/030–032/035 | Agentes, scheduler, painel admin condicional, demo e governança |
| F · Matriz completa | P01/N01 de cada superfície; 165 rotas | Navegação, role-permission, ref válida/inválida, 320/768/1440, 200% e teclado |
| G · DR/Release | SF-E2E-034/039/040/044/045 | Persistência, performance, restore, identidade real e assinatura do gate |

**Observação:** os IDs no lote são atalhos de planejamento; leia sempre o índice `STORIES-END-TO-END.md` e priorize dependências reais descobertas no SHA. Uma story pode ser independente se seu dado já estiver semeado.

## 3. Como executar uma story

1. Copiar `EVIDENCE-RECORD.json` como `evidence/<case-id>-<attempt>.json` num repositório de evidências com controle de acesso; **não commitar payloads reais no repositório público**.
2. Registrar executor, data UTC, SHA C, tenant lógico QA, papel, scopes, `sourceRef`, rev observado, fixture revision, browser e ambiente.
3. Capturar estado `BEFORE`: fonte original relida, versão, contagem, grants e snapshot de audit. Salvar hash SHA-256 do conteúdo sanitizado.
4. Executar passos na ordem, anotar uma linha por ação com horário, principal, request method/path (sem query secreta), status, resultado visual e identificador opaco sanitizado.
5. Para mutation, **não** assumir sucesso pelo clique ou `200` da UI: confirmar `producer apply`/domínio, recibo da tentativa e releitura independente do efeito. Para negativa, capturar status e prova de **ausência de commit**.
6. Exercitar contraprova em sessão independente; não reciclar dados/sessão que poderiam tornar a negativa ambígua.
7. Classificar resultado: `PASSED_WITH_EVIDENCE`, `FAILED_PRODUCT`, `BLOCKED_ENVIRONMENT`, `BLOCKED_CAPABILITY`, `NOT_APPLICABLE_APPROVED`. `PASSED` sem os campos obrigatórios é inválido.
8. QA lead faz cold review de ao menos todos P0; casos report/Procurement/Entra/revogação requerem validação cruzada com dados do produtor, não apenas screenshots.

## 4. Falha → decisão

- **401:** sessão ausente/expirada; não é substituível por local operator na nuvem.
- **403:** pode ser a negativa correta (Zico), ou defeito se o papel foi comprovadamente autorizado; comparar host/sessão/grants/source e intenção.
- **409:** conflito CAS/owner/policy revisados; UI deve preservar escolha e draft, sem mutação.
- **422:** input semanticamente inválido/stale; não suprimir ao ajustar `expect`.
- **503:** producer, Graph, documento, provider ou host indisponível; evidência de bloco, não sucesso.
- **202/started:** só job admitido; exigir completion + arquivo/output/receipt verificáveis.
- **Não há resposta após commit:** consultar attempt/receipt original, sem reexecutar escrita cegamente.

## 5. Evidências não negociáveis

Screenshot before/after e vídeo da jornada quando UX for objeto; redacted HTTP request/response (sem cookies/tokens); source before/after em JSON sanitizado; audit e receipt IDs; hash de arquivo para DOCX/PPTX/XLSX; resultado CI ancorado ao SHA; prova explícita de 403/409/422/503 onde pertinente; origem/competência/FX; principal/owner + policy revision. Uma imagem isolada da tela não basta. Consentimentos e tokens reais nunca entram no pacote versionado.

## 6. Encerramento

Executar `python scripts/validate_qa_pack.py` para conferir integridade estrutural do material (não produto). Consolidar tabela de resultados por ID, SHA, risco e status; atualizar `GO-NOGO-GATE.md` em relatório de execução privado com aprovação do owner. Se houver P0 sem evidence ou falha de 12 jobs, **NO-GO**. Uma nova feature mesclada após a aprovação exige atualização do inventário, rebase e regressão de todos os fluxos relacionados.
