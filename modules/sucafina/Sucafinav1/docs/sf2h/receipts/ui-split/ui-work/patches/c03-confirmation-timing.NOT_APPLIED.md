# C03 confirmation timing — NOT_APPLIED

No producer or shared driver change is proposed as already accepted. This file records the remaining composition/performance investigation for Collaboration and Composition.

## Observed, without a relaxed deadline

Run `43621603578`, job `132528304173`, product `639636280859f5f21f44813658d5d9a0c207fff0`, snapshot `aebd6ee7bf597fd6cd742af347e60846f58e5cfc`: exact message selection preparation passed its assertions, but the confirmation/reuse journey did not observe the final attachment response within the existing 5000 ms observation limit.

Run `43622153636`, job `132529996818`, product `a8d5d83f9da9a7042f1bfb5f3f19eb601cc16db3`, snapshot `27d000afc04aa646e27f6804bf430c6dea76835c`: the isolated unchanged journey, with additional diagnostics and stronger identity assertions, failed while waiting for the first uncertain-delivery status at 5000 ms. Cleanup observed that status. The recorded HTTP producer responses for prepare-message and answer-confirm were both 200 and referred to the same exact message selector. This run did not reach replay. See `../run-03.json` for the request/response identities.

The 60000 ms named-test deadline, 5000 ms page observation default, 10000 ms UI request deadline, 30000 ms browser acquisition deadline and 25000 ms finalization deadline were not increased. No browser rerun is authorized merely to seek a lucky green under an equivalent product/selection.

## Owner action

Compose the published Collaboration producer closure, retaining all existing source/authorization fences, and measure the original named test `exact-confirmation.test.ts` on that composed candidate. The retained host blob is `0376f81eb7978807106d259d6f65a9b4e1ed3a2a`; inspected published host `d80d441aa5775a3747303a60161e5a049f84ac16` at `0d9820924b33a8fc7b145f54a675aeef76c98489` includes an optimization of exact answer identity and confirmation scope derivation. Its publisher receipt explicitly states pending hosted validation; this UI work does not import that receipt as a PASS.

Record producer/read/replay phase timing before attributing the failure to a particular function. The current evidence establishes a failed observation bound, not an authorization defect or a final installed-host attachment failure. Keep the exact selector, state, no-duplicate and lifecycle assertions. Do not remove the postconfirmation answer-read to shorten the path: reuse must be revalidated under current authority.

Final case attachment is not mounted in the component fixture; its intended 404 assertion was not reached. This does not establish that the installed host returns 404. The full distinct-recipient production journey remains open.
