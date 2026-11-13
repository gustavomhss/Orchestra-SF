# Fontes, precedência e estado real

## Escopo preservado e adendo integrado

A campanha reconciliada tem 15 WPs, 74 tasks, 17 contratos e 18 pacotes de evidência. Mantém todas as 71 tasks anteriores, 28 capacidades originais, R01–R41, IA01–IA18 e 13 jornadas. Acrescenta RA01–RA06 e três tasks próprias para runtime residente, Atlas e tradução empresarial.

Cinco perfis, dezoito skills, sucafina-workbench com oito packs/39 operações e Atlas SF Business Profile v1 estão agora na fonte canônica, com writers, tempo, contratos, permissões, consumidores e provas. Não são componentes implementados por esta campanha de planejamento.

## Precedência

O pedido do usuário preserva escopo integral, foco no produto e ausência de novos acessos/deploy. As regras reais do repositório continuam válidas. `campaign.json` é a fonte normativa; os arquivos derivados são regenerados juntos e conferidos pelo validador. Os guias explicam o contrato, sem criar exceções tácitas. Divergência material exige correção do plano.

Documentos em `sources`, protótipos, páginas de origem e pareceres antigos preservam intenção e histórico. Não governam o candidato reconciliado e não são evidência de implementação. A proposta antiga de agentes está identificada como original.

## Baseline e avanço de dev

A baseline examinada é `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`. O dev observado em `f08941a346ef0d072dff8e67e49823505ad7a12e` avançou em infraestrutura Azure, scripts de teste Node e workflows associados, sem alterar as fronteiras de runtime examinadas. T0 deve repetir a reconciliação se a execução adotar um código mais novo. Esta correção não funde a frente de cloud.

## Estado de revisão e execução

O checkpoint `ec9d36da2385007b64a0aa627582ce7e60629a44` foi julgado na rodada 1; `5e6510cf5f514d30116d989ef27ee529b02f3184` preservou esses pareceres. A rodada 1 encontrou 8 P1 e 2 P2 brutos, consolidados em seis frentes P1 e dois ajustes P2. As correções agora estão aplicadas, pendentes da decisão independente da rodada 2.

O resultado `PLAN_STRUCTURE_PASS` aplica-se ao hash da campanha em `validation.json`, incluindo a reconciliação residente. Verifica estrutura e consistência declaradas; não certifica algoritmos, APIs de runtime, UX real ou duração. Nenhum teste de implementação, inferência, MCP de negócio, Relay, Atlas empresarial ou CI de produto é declarado executado. Esses estados permanecem NOT_RUN.
