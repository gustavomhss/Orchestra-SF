---
name: sf-user-journey-qa-e2e-e2e037-045-041
description: "QA manutenção SF: executar story SF-E2E-041 (Instalação vazia não inventa dashboard completo) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-041 ou o caso específico Instalação vazia não inventa dashboard completo"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-041"
---
# SF-E2E-041 — Instalação vazia não inventa dashboard completo

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Outros atores:** LEADER · **Superfícies:** UI29, CAP01, CAP24, UI45 · **Jornadas:** J01, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Instalação nova sem import/seed de produto, mas login e capítulos disponíveis.

**Resultado de negócio:** Como CIO, com apoio de LEADER, diante da situação descrita, preciso abrir todas as superfícies relevantes sem dados provisionados, para distinguir vazio verdadeiro de erro de serviço.

## Pré-condições específicas

- Instalação nova sem import/seed de produto, mas login e capítulos disponíveis.

## Passos a executar na interface

1. Criar instalação QA vazia autorizada
2. Fazer login real e abrir Hoje, Dashboard, Procurement e BI
3. Inspecionar mensagens sem dados e sem permissões
4. Tentar buscar termo não existente
5. Tentar abrir link com referência antiga de outra instalação
6. Verificar menu e criação de primeira versão
7. Adicionar um dado real por produtor autorizado
8. Reabrir dashboard e verificar transição empty→data

## Oráculos observáveis (não reescrever para passar)

- Sem registros retorna vazio honesto, nunca 500 ou dados de outro tenant
- Ausência de dados difere de 0 válido
- CAP24 vazio não inventa aging/contagem
- Após a primeira gravação, dados aparecem sem reconstrução manual
- Nenhuma referência obsoleta concede acesso

## Contraprovas

- Permissão negada não pode ser mostrada como “sem dados” enganoso
- Na ausência de provider/codec, capability unavailable explícito

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
