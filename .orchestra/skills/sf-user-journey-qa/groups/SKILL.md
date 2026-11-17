---
name: sf-user-journey-qa-groups
description: "Grupos internos de stories do Orchestra-SF: smoke, domínios ou acesso. Executar somente o grupo solicitado."
internal: true
when: "O QA quer um grupo de stories, smoke ou regressão por domínio"
not-when: "O QA pediu uma story individual; use CAP/UI/E2E, não um grupo"
---
# Campanhas seletivas de QA / manutenção SF

**Não é uma função para usuários da Sucafina.** Cada filho é uma campanha de manutenção que aponta para skills individuais. Um grupo só é executado quando o QA o solicitar explicitamente.

Seleção: para verificação curta e não destrutiva, abrir `smoke`; para mudanças localizadas, abrir o domínio impactado; `full` contém somente os gates SF-E2E-034/040 e exige ordem explícita do owner. Para uma única story, usar a folha CAP/UI/E2E correspondente. **Não rodar todos os grupos por padrão.**

Ao executar vários grupos, deduplicar stories já executadas **apenas** se SHA, fixture, instalação, versão de dados e perfis forem idênticos; caso contrário, executar novamente. `PASSED_WITH_EVIDENCE` exige UI real e observadores independentes. Nunca converter testes estáticos em PASS.

Os conteúdos, papéis e oráculos ficam nas 185 folhas; as listas de grupo não os duplicam. Fonte de verdade dos grupos: `docs/qa/sucafina/uat-cio/story-groups.json`.
