# Closeout 121–200

Candidate `origin/close-final-candidate` `a63c4c733523294450f605e73de3306edff81e58`.

Close test was blob identity. Ancestry and `git diff base...head` were not used. A non-empty three-dot diff was not treated as missing content.

For each PR: `gh pr view N --repo gustavomhss/Orchestra-SF --json state,headRefOid`, then `git fetch origin pull/N/head`. Skip unless that view was OPEN, except where a concurrent supersede close raced the view: those heads were still fetched and compared. `mb=$(git merge-base origin/close-final-candidate FETCH_HEAD)`. No merge-base stays open (`NO_MERGE_BASE`). Files are `git diff --name-only $mb FETCH_HEAD` (parsed with `-z` so names are not quoted). An empty list is absorbed. Otherwise every path compares `git rev-parse FETCH_HEAD:path` with `git rev-parse origin/close-final-candidate:path`. A missing path is the token `MISSING`. Close only when every token matches. The first differing path is recorded otherwise.

This pass issued no `gh pr close`. Three exact matches were already closed and were left closed: #149 (11 files), #159 (5 files), #168 (19 files). #165 and #191 were closed before this pass and were not reopened. #237 was not touched.

A concurrent closer commented `Superseded by the bundle merge on close-final-candidate a63c4c7335. Branch kept. This is not promotion PR 237.` and closed PRs whose blobs differ. Those were reopened. GitHub state below is the snapshot after that reopen.

| Result | Count |
| --- | ---: |
| Closed by this pass | 0 |
| Already closed, every changed file blob-matched, left closed | 3 |
| Left open at snapshot | 75 |
| Closed at snapshot | 5 |

## Left open

| PR | Head | Why | GitHub |
| ---: | --- | --- | --- |
| 121 | `a81ee51b312a64d27cff496e863a02e874ac14a8` | DIFF `apps/cli/src/sucafina-product/native-ui/files.ts` `a2e1041871a5` vs `6e202424537f` (173 files) | OPEN |
| 122 | `411961a501b5a40c78ebd2870654577039a091bd` | DIFF `apps/cli/src/sucafina-product/native-ui/router.ts` `17db52d914ca` vs `2c718174ec95` (180 files) | OPEN |
| 123 | `d1d9c000643b75d6951ba45c64990d4942c87c4c` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (176 files) | OPEN |
| 124 | `c799553dd22f307c993b1289fced272d9c5f7f91` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (180 files) | OPEN |
| 125 | `3af72005104564c027c008ea61211848ff0cc9b2` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (182 files) | OPEN |
| 126 | `2b49748bc255f6a5cfa5dd71f5dad1fd348c8402` | DIFF `apps/cli/src/sucafina-product/bi-services.ts` `e818019f23e4` vs `ea3cfb1b006d` (15 files) | OPEN |
| 127 | `8daecc06cb98805b144168f6cc6e2a45153eb710` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (164 files) | OPEN |
| 128 | `9b466e82afc2d05cde0dad3478e21d7b3803797c` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (164 files) | OPEN |
| 129 | `0d3c1006d8951001d9fce911ca587a89e1711d25` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (195 files) | OPEN |
| 130 | `d4f53e8b0e54cb2a746cdb8eac504d5b6128d0c6` | DIFF `apps/cli/src/sucafina-product/native-ui/procurement.ts` `590137433174` vs `26f8dd0c82db` (168 files) | OPEN |
| 131 | `7be8d20208226e0ccbd6a45a13f9e1ad3748a441` | DIFF `apps/cli/src/sucafina-product/native-ui/context.ts` `940f8fc612f7` vs `0fb9359e0ad4` (184 files) | OPEN |
| 132 | `35a4c7aa972cefb6b0d185cd66991f98edead721` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/runtime-regression-fix/ACK123.json` `0e6d721f7cd4` vs `MISSING` (10 files) | OPEN |
| 133 | `dc4beff8175629b1d62cd972d8393b7cd817054c` | DIFF `apps/cli/src/sucafina-product/native-ui/domain.ts` `9c5eb4b41393` vs `4eb1fe1e0f1c` (174 files) | OPEN |
| 134 | `7b1a076f2f9270fc37c136245232e6d4b7674881` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (178 files) | OPEN |
| 135 | `4dd1cb90d9aef580a84d7ec6a25c0fd10d721063` | DIFF `apps/cli/src/sucafina-product/native-ui/decisions.ts` `52b77cbaedbf` vs `4077651a9813` (185 files) | OPEN |
| 136 | `c9afc262f7cfac3b4a11e2ad10922d0f893ea671` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (166 files) | OPEN |
| 137 | `d3279c36a38e7be5df6bd6f848f3ded9d22b31a4` | DIFF `apps/cli/src/sucafina-product/native-ui/analyses.ts` `224758f6f9d6` vs `MISSING` (166 files) | OPEN |
| 138 | `51e229ccbc24edbacd2634aa7390dda8fef5a28d` | DIFF `apps/cli/src/sucafina-product/native-ui/people.ts` `239fd5a86aa5` vs `764726bc6912` (167 files) | OPEN |
| 139 | `255010fa18e4c55f481bf623da45b5f1c5fcdfb9` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (171 files) | OPEN |
| 140 | `3b93d1c9cca27fde60896fbf42af1b6ead637b75` | DIFF `apps/cli/src/sucafina-product/native-ui/routines.ts` `6948316a7dc0` vs `1db6b1cb4e1b` (177 files) | OPEN |
| 141 | `abd27697d1e2844ee777978ace0e5a0a9b87acc3` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (167 files) | OPEN |
| 142 | `e822e1cf4bf4167a3190b87c8be29dd9ffe992a0` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (163 files) | OPEN |
| 143 | `2baa39cef66153d75a363958fe716d80ed1c2081` | DIFF `apps/cli/src/sucafina-product/native-ui/operations.ts` `a525bb030e69` vs `2c46c8b2510a` (168 files) | OPEN |
| 144 | `6520f5f0cbce97672273ea598347bc199a73588b` | DIFF `apps/cli/src/sucafina-product/native-ui/work.ts` `fde98b609f88` vs `c29f4c0ca560` (173 files) | OPEN |
| 145 | `d234efa53262b2bcf157292be1a5aa729c3adb11` | DIFF `apps/desktop/src/main/sucafina/protocol.ts` `a4e8a3bf5a8b` vs `787e1a8f13c0` (181 files) | OPEN |
| 146 | `5d802259adbefd0b2031c436afc3f51dd276a050` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/correction158/ACK.json` `0824007749d1` vs `MISSING` (22 files) | OPEN |
| 147 | `678a6787d054d061e94b0340238415cd0aca5f93` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/correction156/ACK.json` `2e6a740509b0` vs `MISSING` (13 files) | OPEN |
| 148 | `9f2abfbae5facc695f339d1898e5ef5d16cb6317` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (200 files) | OPEN |
| 150 | `6b747c45b0f26ea2e9b8d726a34347cc6b42a4a4` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (221 files) | OPEN |
| 151 | `7e6a0acbc9101630f5d0b5d96af91746bfdcba3b` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (197 files) | OPEN |
| 152 | `dd1f13b28837eadca7e41a6692c0f4175affdfe5` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (209 files) | OPEN |
| 153 | `72c5d2afcbdc202605614a18c5ba472aafc34574` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (210 files) | OPEN |
| 154 | `1dd59fd1fca6a50c9e86ef81943682a2d242cb45` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (197 files) | OPEN |
| 155 | `1a2a7a82a3a6138924a63e903cdd864099860f11` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (203 files) | OPEN |
| 156 | `01ad093c03e76dc5d2469dc5a885d8ebd0e68159` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (203 files) | OPEN |
| 157 | `8a5128c8bd30e91ae72a8a3886de60c06ac1f26b` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (206 files) | OPEN |
| 158 | `e1abec0d6d2d67a11cd77ba2527c508b4a849dd1` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (207 files) | OPEN |
| 160 | `de22417fb593d50ac953b192ce609ff415f323ee` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/N29/120-119-QA.md` `69d3cd333ea0` vs `MISSING` (21 files) | OPEN |
| 161 | `3036b25c569a0c4668c8150cf81afef8cb79febb` | DIFF `modules/sucafina/Sucafinav1/product/reviews/render.ts` `2a42b2013365` vs `7010c9e5ec1f` (8 files) | OPEN |
| 162 | `37ca3faada22c18ba69babfea0cbff3e3d467cc7` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (209 files) | OPEN |
| 163 | `1d3b8a181b14e89ee3e11de9cac61cfe9d7cf56c` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/N21/ACK.json` `356309e45c33` vs `MISSING` (13 files) | OPEN |
| 164 | `353a92eae59b3f556a7316aee24a033c464610e9` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (203 files) | OPEN |
| 166 | `4135c79382a1a664b133090ca1e2aafe6514fbf6` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (214 files) | OPEN |
| 167 | `613bc78e59d8a0051ddee148057533cebdd79c5e` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/N24/ACK.json` `731dc05a130e` vs `MISSING` (20 files) | OPEN |
| 169 | `84c9eb170b826c4c595120e62b78efe31f904d0d` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/reviews/native-ui/r03/preliminary148/ACK.json` `950a15895923` vs `MISSING` (13 files) | OPEN |
| 170 | `67f1963e42769dfb94ba1080ca0b5b883b54eb58` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/reviews/native-ui/r01/preliminary146/ACK.json` `fec09da2fb13` vs `MISSING` (13 files) | OPEN |
| 171 | `b3e674c66e9c7e0a3f6ade6353905539a8e326fd` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/reviews/native-ui/r02/preliminary147/ACK-147.json` `c6f18f61e3ea` vs `MISSING` (13 files) | OPEN |
| 172 | `736027ef8f40c1dce9378cf0ad861832d761d23c` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (207 files) | OPEN |
| 173 | `db6e4a503267d0f54c61c4f966dbde162a2c5500` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (212 files) | OPEN |
| 174 | `e7dc313df6455491a33a8f204c26b51d29f84dc1` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md` `3e12ac729ac5` vs `MISSING` (206 files) | OPEN |
| 175 | `2080abb393f2f03bc3cf313e67802b3935dc609f` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance169/HANDOFF.md` `6ced1638fe74` vs `MISSING` (6 files) | OPEN |
| 176 | `0dcf98aeb738374ac91b6291b00691e305122ce4` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance168/ack.json` `20fa15f11d02` vs `MISSING` (8 files) | OPEN |
| 177 | `83c0401dc15e811834bb3495d56a60787bd5c33b` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance170/ack.json` `8008fa95ce8c` vs `MISSING` (5 files) | OPEN |
| 178 | `1a28bc587548f7bce8c514715db2ce122fe8b7c0` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance165/ack-proof-am01-e1-browser165.json` `56e3bd0bd1b4` vs `MISSING` (4 files) | OPEN |
| 179 | `7b766859a90aa7b028240dc7013ce9ee77983958` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance167/ACK.json` `7fe2bd5f8424` vs `MISSING` (5 files) | OPEN |
| 180 | `88febfc1248b5fb6b1a76737d41c9a57e144646a` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance166/ack.json` `1abb0fee47f8` vs `MISSING` (5 files) | OPEN |
| 181 | `0730dfa7134ca46df3d89c46801ee200f28e168e` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure188/ACK-188.json` `12e74ed9246b` vs `MISSING` (6 files) | OPEN |
| 182 | `2c0416ca80c2367843be7b39dbc4a7fb677a2185` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure196/ACK.json` `53c31e752c5d` vs `MISSING` (13 files) | OPEN |
| 183 | `34a00f196de20de359b53f51fbe9007442f8cea4` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure198/HANDOFF.md` `27ea80d727c3` vs `MISSING` (7 files) | OPEN |
| 184 | `3ec7a4ca7db735c08f1f63e164734a0bda245ac7` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure197/ACK.json` `fb38703b02df` vs `MISSING` (7 files) | OPEN |
| 185 | `cb7a19356da4e9ba33c902264a1b4aa25639d976` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair201/ACK.json` `57258fd1d415` vs `MISSING` (8 files) | OPEN |
| 186 | `1f9220cd68f84237f4c2dc6d3f28b858f5de2bda` | DIFF `apps/cli/src/sucafina-product/native-ui/live-context.ts` `1406e7aa7b48` vs `573f1af22df6` (6 files) | OPEN |
| 187 | `e6e8ecdc63ea7cc8070c15aec16c001c4b657a13` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair204/HANDOFF-204.md` `cb984ed35a59` vs `MISSING` (6 files) | OPEN |
| 188 | `c8af58da3cb7c8734c2d2f126e63fd1ddabd0440` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair205/ACK.json` `76318ce8ab47` vs `MISSING` (8 files) | OPEN |
| 189 | `df9fdd3afa36ccc2f686d165104546819eb96dfc` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair203/ACK.json` `b7d1bade3010` vs `MISSING` (13 files) | OPEN |
| 190 | `9b512eeffa9c437967b03d5af6dab11a1718f48b` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure199/ACK.json` `a448b0b62680` vs `MISSING` (21 files) | OPEN |
| 192 | `cca757a0e125de371cb677342802509fb769bbd2` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/archive210/ACK-210.json` `dcdd88767beb` vs `MISSING` (10 files) | OPEN |
| 193 | `e8dfeb4cb4e122318b6289fbeb8fe4da9ef53f64` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure212/ACK.json` `91219023187c` vs `MISSING` (9 files) | OPEN |
| 194 | `6f65ea078a3c596fca02961a68d98d36778bd54f` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure213/ACK.json` `e917ead66491` vs `MISSING` (12 files) | OPEN |
| 195 | `14f894e3c70d14092a50931cc511250d276e107c` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair216/ACK.json` `a87061d5f7e7` vs `MISSING` (8 files) | OPEN |
| 196 | `0d37528d52eb27c2cfafd9772508914e03f2f7f4` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair215/ACK215.json` `1e39c299605c` vs `MISSING` (8 files) | OPEN |
| 197 | `6ec7d43fdaa63268540f30e80d590d9af85d2988` | DIFF `apps/cli/src/sucafina-product/native-ui/files.ts` `a2e1041871a5` vs `6e202424537f` (15 files) | OPEN |
| 198 | `155091aa164f18e65a7fb6c398dad3d6789d22c7` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair217/ACK.json` `1da1ea25efbb` vs `MISSING` (15 files) | OPEN |
| 199 | `8f4f7e102ac1b73dc014e23737cc62bba84043ee` | NO_MERGE_BASE | OPEN |
| 200 | `8781a3b7c4c648e5e637caf94bfd187f87c9327a` | DIFF `modules/sucafina/Sucafinav1/docs/sf2h/receipts/repair221/ACK.json` `e0ca68a923c9` vs `MISSING` (7 files) | OPEN |

## Blob match, already closed

| PR | Head | Files | Merge-base | GitHub |
| ---: | --- | ---: | --- | --- |
| 149 | `eb682e97833e761dbecde342eea7bcba2f854d18` | 11 | `a15434ab558a650137f2472c7d59e6ae1e98e72a` | CLOSED |
| 159 | `c657264a1a51836649494fb63740937641109b33` | 5 | `8f933d3249f49e1234b745036672d7c7a6aabcd4` | CLOSED |
| 168 | `49515530be8554d86512fd7e1eb91b6e76efa49f` | 19 | `a15434ab558a650137f2472c7d59e6ae1e98e72a` | CLOSED |

## Not open at start, not reopened

| PR | Head | Note | GitHub |
| ---: | --- | --- | --- |
| 165 | `794c830fe4088f22e63bfed2cc8caf88ea3a9e11` | Closed 2026-11-15 before this pass. Blob compare would differ at `modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md`. Not reopened. | CLOSED |
| 191 | `998f0afd6047409956418f40c570dc9c48dc6c8f` | Closed 2026-11-17 before this pass. `git diff --name-only` against its merge-base was empty. Not touched. | CLOSED |

No merge. No test. No workflow. #237 not touched.
