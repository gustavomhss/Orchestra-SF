# Handoff — finish-core-20261119

## SHA
Código: 6ea5bf225b8eb7f3e3407c4ae4a227549ab852d4. Base: bd45b3135c2a0cfc0a3cc2f5bdc6ed7373caebb5.
Fonte qualificada: 15388053117883174329454207e60e2a878f5426; snapshot Actions: 1297999f0411681265711176f77e2e8e3fd17daa.

## Data
2026-11-19

## Estado
complete para o núcleo UI33/UI34 de criação, revisão humana e resposta perdida. Qualificação final do conjunto continua pendente.

## Feito
- Helpers dirigem New case e a confirmação nativa; conservam payload, idempotency key, identidade original, CAS1→2, leitura/reload/reabertura.
- UI34 renderiza critérios e fontes originais e edita a intenção com confirmação explícita.
- A resposta perdida após commit conserva o formulário e exige reabertura pelo dado persistido; nenhum POST automático.
- C08 observa somente bindings instalados, identidade corrente, admissão original e duas leituras congruentes do namespace cases para sf_case_draft, decision-edit, controls e BI. A leitura do caso e da evidência continua no produtor original.
- As sete folhas UI/E2E e o observador são os blobs exatos da fonte qualificada. Em host-context, contrato e catálogo foram transplantadas somente as fatias do núcleo.
- Setup conferido: wp03/installation-fixture.ts, installation-setup.ts e runtime/local-configuration.ts são idênticos entre main e a fonte qualificada; public origin3000 e CLI privado4110.

## Pendente com file:line e motivo
- packages/app-shell/e2e/sucafina/decisions-native-recovery.spec.ts:1: C12 em outro WP ainda retorna403; não qualificado por este run.
- packages/app-shell/e2e/sucafina/decisions.spec.ts:1: a suíte completa contém jornadas além das duas qualificadas; segue no gate final após seus WPs.

## Decisões e asserções removidas
Nenhuma asserção de negócio removida ou enfraquecida; controles antigos foram substituídos por controles nativos com verificação integral do produtor. Não houve edição de runtime/application.ts, credenciais artificiais ou permissão por flag. UI35/38 e C12 são checkpoints independentes.

## Como retomar
Integrar este recorte em sf-join-four, continuar os WPs pendentes e executar somente ao final o sf-ci autorizado. Não declarar GO.

## Comandos e resultados
- test-ci [44601715581](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44601715581): **success**, 2 passed, 2.6min. Spec e2e/sucafina/decisions-native-authoring.spec.ts em produção; snapshot1297999f0411681265711176f77e2e8e3fd17daa.
- Foundation já integrada #382: [44607176525](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44607176525), success2cases.
- Protocolo já integrado #383: [44612205026](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44612205026), success2tests/2277assertions.
