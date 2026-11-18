# Close proof 100–180

Candidate `origin/close-final-candidate` `a63c4c733523294450f605e73de3306edff81e58`.

Proof, and no other close rule. Each PR head was fetched as `refs/pull/N/head` (the commit `FETCH_HEAD` would name). `mb=$(git merge-base origin/close-final-candidate FETCH_HEAD)`. Files are `git diff --name-only $mb FETCH_HEAD` (`core.quotepath=false` so the path passed to `git rev-parse` is the literal path). Close only when that list is empty, or every file has the same blob token on the PR head and on `origin/close-final-candidate` (`git rev-parse`, token `MISSING` if absent). A differing token is unique work and stays open. No three-dot diff. No close because a bundle commit mentions the number. #237 was not touched. No branch was deleted. No tests, no CI, no merge, no push to `sf-red-clusters`.

At the decision snapshot every existing PR in 100–180 was OPEN and its `headRefOid` matched the fetched pull head. #149, #159 and #168 were then closed with `gh pr close N --repo gustavomhss/Orchestra-SF` and no comment. No reopen was required.

| Result | Count |
| --- | ---: |
| Closed by this pass | 3 |
| Reopened by this pass | 0 |
| Left open | 77 |
| Absent | 1 |

## Closed

Every changed file's blob token matched the candidate.

| PR | Head | Merge-base | Files | GitHub |
| ---: | --- | --- | ---: | --- |
| 149 | `eb682e97833e761dbecde342eea7bcba2f854d18` | `a15434ab558a650137f2472c7d59e6ae1e98e72a` | 11 | CLOSED |
| 159 | `c657264a1a51836649494fb63740937641109b33` | `8f933d3249f49e1234b745036672d7c7a6aabcd4` | 5 | CLOSED |
| 168 | `49515530be8554d86512fd7e1eb91b6e76efa49f` | `a15434ab558a650137f2472c7d59e6ae1e98e72a` | 19 | CLOSED |

## Left open

First differing path is the proof that the PR was not closed. `differ` is the count of changed files whose blob token is not the candidate token.

| PR | Head | Merge-base | Files | Differ | First differ | GitHub |
| ---: | --- | --- | ---: | ---: | --- | --- |
| 100 | `3f3198e7636242421ef71a788502b10179893e5c` | `eecbdacb21734695094332deb6142aa35d5c9c3c` | 7 | 7 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/reviews/R1/browser-91/attempt-001/ACK91.json `6a8a6d44dbdd6ac53379dc6bb5ece0251e6ad4fc` vs `MISSING` | OPEN |
| 101 | `28bbd0a215631253311aa76f28ea96c0e7c63640` | `5585e57f90d7b8d45e0577a8f0f4aa7884d3b58d` | 8 | 5 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/report-title-fix/ACK-98.json `1b33189428b407e76562948efcad82aa876092ae` vs `MISSING` | OPEN |
| 102 | `0a2f8ccd0eca92f5b32994d288b471149fb00668` | `5585e57f90d7b8d45e0577a8f0f4aa7884d3b58d` | 10 | 8 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/denied-read-fix/ACK-97.json `434c4532eb5bcb23bff99969efcd07f5e1568562` vs `MISSING` | OPEN |
| 103 | `3ef1bbf2188275f5bc6ebaeed162a069ad3ae351` | `5585e57f90d7b8d45e0577a8f0f4aa7884d3b58d` | 14 | 11 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/creation-reload-fix/ACK96.json `5ab4db0a55022968ddbb845e93806d653cc476b8` vs `MISSING` | OPEN |
| 104 | `1ba45ae10641aab50e8ddd8377dd8e2714b74aa4` | `5585e57f90d7b8d45e0577a8f0f4aa7884d3b58d` | 16 | 12 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/correction161/ACK161.json `cb814c33ddc1cdf24352462be2a9e77bc487ffae` vs `MISSING` | OPEN |
| 105 | `55a622ff56e029e2375a1f337d094403f3757e77` | `529142f63683de8e4b1f7d4232f88faf8ffcef6c` | 15 | 13 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/correction142/ACK-142.json `1089272fb63ca0c0464cf7ba4d79591d02c6a0c0` vs `MISSING` | OPEN |
| 106 | `783becc0c5df4c2f1667a51d287710131a92b655` | `529142f63683de8e4b1f7d4232f88faf8ffcef6c` | 76 | 76 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance150/ACK150.json `c71332432e9566d24d6f7a57011fb6c499a00e6a` vs `MISSING` | OPEN |
| 107 | `b935f51ca9333c77d2b13ced8e7ad743df79468d` | `180212940105e7b9ad15171b067c1c1b7841df5f` | 46 | 46 | .github/workflows/sf-compiler-c53.yml `fd463eb8af4b72fef2cd831cf7e6377656be3532` vs `MISSING` | OPEN |
| 108 | `ae6fdd332ae8484f71caa5d9315883305729ce8d` | `180212940105e7b9ad15171b067c1c1b7841df5f` | 4 | 4 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/reviews/R1/browser-112/attempt-001/ACK-112.json `d1048a2527ad06cebd2d742b5f4159f980b1d8df` vs `MISSING` | OPEN |
| 109 | `bd65179c3ce1da921974c686439d3877f735f852` | `180212940105e7b9ad15171b067c1c1b7841df5f` | 12 | 11 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/creation-recovery-link/ACK111.json `21c569036fb79f19e3f761b22df28e633a1a4593` vs `MISSING` | OPEN |
| 110 | `c449aff9c819e0cbbc88386b2f0f079f4c58d56c` | `180212940105e7b9ad15171b067c1c1b7841df5f` | 12 | 11 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-child-admission/ACK110.json `59fd8b6be4199f8a7c825561208a93ff8980d22c` vs `MISSING` | OPEN |
| 112 | `3dc622981faa3c40ae9f6fcf81f6d53464618d00` | `180212940105e7b9ad15171b067c1c1b7841df5f` | 8 | 5 | apps/cli/src/sucafina-product/bi-services.ts `597b5c3b536c2416d9d7d39c7d4329ce5c4183ff` vs `ea3cfb1b006d335266197a889cc9ce7f842f0434` | OPEN |
| 113 | `b4493686ceb456c0bd0b5a1acc51cfe92c37f3c4` | `180212940105e7b9ad15171b067c1c1b7841df5f` | 22 | 4 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/matcher-type-repair/ACK117.json `b932a17179c4a4680ff3d8577896e54902ad5c14` vs `MISSING` | OPEN |
| 114 | `bcd2afbdb745dc8cd60f6e5b84e0c90163b86878` | `180212940105e7b9ad15171b067c1c1b7841df5f` | 43 | 11 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/fixture-type-repair/ACK118.json `64e722fd3afbc5a8ad167b7465f7a2b2be109171` vs `MISSING` | OPEN |
| 115 | `a92f50cf6df2c3a5d367e26f86b272eec34d380b` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 168 | 159 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 116 | `0bcf034da608b5a89576f5e43fcd66349b397baa` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 181 | 173 | apps/cli/src/sucafina-product/native-ui/planner.ts `fee901b48a7c9bd612abb547b0465f5e04ce355e` vs `0a952e2af1b49dd7c53bb56f1425a763c526bcf6` | OPEN |
| 117 | `914b56e076ca80ea9ecbc97253486ea90ee2dedf` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 9 | 6 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/creation-proof-repair/ACK121.json `c6007d9de5aa71e8aff84527b768acb5cd0d6cbe` vs `MISSING` | OPEN |
| 118 | `9bbbeb65e539eb9ce501fe9391fe3a43970b5cba` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 181 | 167 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 119 | `287176a823a4f75371528b03ff72060874fe0b5d` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 169 | 160 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 120 | `96c01020db59d9b4f8d44300638418d67ee11fea` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 187 | 173 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 121 | `a81ee51b312a64d27cff496e863a02e874ac14a8` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 173 | 167 | apps/cli/src/sucafina-product/native-ui/files.ts `a2e1041871a553498b92f159ef9b28c874a3cfb6` vs `6e202424537f69d2ed4df5f8dd0c2a3a5fa629c9` | OPEN |
| 122 | `411961a501b5a40c78ebd2870654577039a091bd` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 180 | 174 | apps/cli/src/sucafina-product/native-ui/router.ts `17db52d914ca49934953e1161461b03856eb29c5` vs `2c718174ec9554689e1879425e525f0c9fd555ba` | OPEN |
| 123 | `d1d9c000643b75d6951ba45c64990d4942c87c4c` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 176 | 165 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 124 | `c799553dd22f307c993b1289fced272d9c5f7f91` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 180 | 170 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 125 | `3af72005104564c027c008ea61211848ff0cc9b2` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 182 | 170 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 126 | `2b49748bc255f6a5cfa5dd71f5dad1fd348c8402` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 15 | 15 | apps/cli/src/sucafina-product/bi-services.ts `e818019f23e449468577175d5c78e53dbf0fb9b2` vs `ea3cfb1b006d335266197a889cc9ce7f842f0434` | OPEN |
| 127 | `8daecc06cb98805b144168f6cc6e2a45153eb710` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 164 | 154 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 128 | `9b466e82afc2d05cde0dad3478e21d7b3803797c` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 164 | 158 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 129 | `0d3c1006d8951001d9fce911ca587a89e1711d25` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 195 | 183 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 130 | `d4f53e8b0e54cb2a746cdb8eac504d5b6128d0c6` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 168 | 162 | apps/cli/src/sucafina-product/native-ui/procurement.ts `59013743317453a390e8092b2c8a49713eaf17cc` vs `26f8dd0c82db3c159baa7890aced788b8ba8e0fd` | OPEN |
| 131 | `7be8d20208226e0ccbd6a45a13f9e1ad3748a441` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 184 | 176 | apps/cli/src/sucafina-product/native-ui/context.ts `940f8fc612f7dee3a3c412075a8e16d3d6e21410` vs `0fb9359e0ad4b5090bc5fa1417bbe354b951fc4e` | OPEN |
| 132 | `35a4c7aa972cefb6b0d185cd66991f98edead721` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 10 | 9 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/runtime-regression-fix/ACK123.json `0e6d721f7cd45d99ec6b766497e2ddde2f324a80` vs `MISSING` | OPEN |
| 133 | `dc4beff8175629b1d62cd972d8393b7cd817054c` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 174 | 162 | apps/cli/src/sucafina-product/native-ui/domain.ts `9c5eb4b4139315d20b5ae40a06d58f955984596a` vs `4eb1fe1e0f1cb1727db0013e9a17e78768a8dfd8` | OPEN |
| 134 | `7b1a076f2f9270fc37c136245232e6d4b7674881` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 178 | 169 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 135 | `4dd1cb90d9aef580a84d7ec6a25c0fd10d721063` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 185 | 178 | apps/cli/src/sucafina-product/native-ui/decisions.ts `52b77cbaedbf36880edcbd6fd73ddb61e5472b79` vs `4077651a9813df69de0a37e1e0a106ddb122f5ce` | OPEN |
| 136 | `c9afc262f7cfac3b4a11e2ad10922d0f893ea671` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 166 | 160 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 137 | `d3279c36a38e7be5df6bd6f848f3ded9d22b31a4` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 166 | 159 | apps/cli/src/sucafina-product/native-ui/analyses.ts `224758f6f9d611268bea1d1f9b8d76678d99807c` vs `MISSING` | OPEN |
| 138 | `51e229ccbc24edbacd2634aa7390dda8fef5a28d` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 167 | 160 | apps/cli/src/sucafina-product/native-ui/people.ts `239fd5a86aa541dd6990c9d870148d5753d72dbb` vs `764726bc6912f060e1d1fe34a7745a0659e804c5` | OPEN |
| 139 | `255010fa18e4c55f481bf623da45b5f1c5fcdfb9` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 171 | 163 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 140 | `3b93d1c9cca27fde60896fbf42af1b6ead637b75` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 177 | 170 | apps/cli/src/sucafina-product/native-ui/routines.ts `6948316a7dc0b07296180fed7f5b32f613bcc106` vs `1db6b1cb4e1b85a5978616d0893bf00a256d658c` | OPEN |
| 141 | `abd27697d1e2844ee777978ace0e5a0a9b87acc3` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 167 | 160 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 142 | `e822e1cf4bf4167a3190b87c8be29dd9ffe992a0` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 163 | 154 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 143 | `2baa39cef66153d75a363958fe716d80ed1c2081` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 168 | 160 | apps/cli/src/sucafina-product/native-ui/operations.ts `a525bb030e692a506bcd6194a1d1033a12c676a7` vs `2c46c8b2510ab632dbff48519f278e4f94966301` | OPEN |
| 144 | `6520f5f0cbce97672273ea598347bc199a73588b` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 173 | 166 | apps/cli/src/sucafina-product/native-ui/work.ts `fde98b609f88d5bdb3ca472bddc4b373092da2a6` vs `c29f4c0ca56046fcbccdc9e9336db352180030c4` | OPEN |
| 145 | `d234efa53262b2bcf157292be1a5aa729c3adb11` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 181 | 165 | apps/desktop/src/main/sucafina/protocol.ts `a4e8a3bf5a8b55f14ca6457bb767f83fe6d3070a` vs `787e1a8f13c0d017f2ebe026ecf2aa51d6e931ae` | OPEN |
| 146 | `5d802259adbefd0b2031c436afc3f51dd276a050` | `a15434ab558a650137f2472c7d59e6ae1e98e72a` | 22 | 12 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/correction158/ACK.json `0824007749d18093bd6dbdc620bb6e2c2f93ac00` vs `MISSING` | OPEN |
| 147 | `678a6787d054d061e94b0340238415cd0aca5f93` | `a15434ab558a650137f2472c7d59e6ae1e98e72a` | 13 | 8 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/correction156/ACK.json `2e6a740509b0215b14cff437430c899af73ea353` vs `MISSING` | OPEN |
| 148 | `9f2abfbae5facc695f339d1898e5ef5d16cb6317` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 200 | 191 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 150 | `6b747c45b0f26ea2e9b8d726a34347cc6b42a4a4` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 221 | 209 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 151 | `7e6a0acbc9101630f5d0b5d96af91746bfdcba3b` | `8a73afab60036c11fed15f6365a2b2930ee289d9` | 197 | 187 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 152 | `dd1f13b28837eadca7e41a6692c0f4175affdfe5` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 209 | 193 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 153 | `72c5d2afcbdc202605614a18c5ba472aafc34574` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 210 | 197 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 154 | `1dd59fd1fca6a50c9e86ef81943682a2d242cb45` | `8a73afab60036c11fed15f6365a2b2930ee289d9` | 197 | 187 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 155 | `1a2a7a82a3a6138924a63e903cdd864099860f11` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 203 | 187 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 156 | `01ad093c03e76dc5d2469dc5a885d8ebd0e68159` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 203 | 192 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 157 | `8a5128c8bd30e91ae72a8a3886de60c06ac1f26b` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 206 | 195 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 158 | `e1abec0d6d2d67a11cd77ba2527c508b4a849dd1` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 207 | 193 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 160 | `de22417fb593d50ac953b192ce609ff415f323ee` | `a15434ab558a650137f2472c7d59e6ae1e98e72a` | 21 | 13 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/N29/120-119-QA.md `69d3cd333ea02750cfdf21bf7252760b512a484a` vs `MISSING` | OPEN |
| 161 | `3036b25c569a0c4668c8150cf81afef8cb79febb` | `422f1ed7b549021d7c62c834c9d9041279112af4` | 8 | 1 | modules/sucafina/Sucafinav1/product/reviews/render.ts `2a42b20133651bcff54f0a4f1ed2eb3590c06cc9` vs `7010c9e5ec1f5300388408573b5ace1273662070` | OPEN |
| 162 | `37ca3faada22c18ba69babfea0cbff3e3d467cc7` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 209 | 196 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 163 | `1d3b8a181b14e89ee3e11de9cac61cfe9d7cf56c` | `a15434ab558a650137f2472c7d59e6ae1e98e72a` | 13 | 4 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/N21/ACK.json `356309e45c33d66a368fa678741ec0c79919dc19` vs `MISSING` | OPEN |
| 164 | `353a92eae59b3f556a7316aee24a033c464610e9` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 203 | 190 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 165 | `794c830fe4088f22e63bfed2cc8caf88ea3a9e11` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 212 | 190 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 166 | `4135c79382a1a664b133090ca1e2aafe6514fbf6` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 214 | 196 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 167 | `613bc78e59d8a0051ddee148057533cebdd79c5e` | `a15434ab558a650137f2472c7d59e6ae1e98e72a` | 20 | 4 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/N24/ACK.json `731dc05a130e80ee47b4cd7afcf3f203d987a87c` vs `MISSING` | OPEN |
| 169 | `84c9eb170b826c4c595120e62b78efe31f904d0d` | `d8f14f81855858120f914af4f3934406bfdb74f1` | 13 | 13 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/reviews/native-ui/r03/preliminary148/ACK.json `950a158959239e51560f36cd3841baf66e3d77b1` vs `MISSING` | OPEN |
| 170 | `67f1963e42769dfb94ba1080ca0b5b883b54eb58` | `d8f14f81855858120f914af4f3934406bfdb74f1` | 13 | 13 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/reviews/native-ui/r01/preliminary146/ACK.json `fec09da2fb131a59bd8feb8558741f056ada8429` vs `MISSING` | OPEN |
| 171 | `b3e674c66e9c7e0a3f6ade6353905539a8e326fd` | `d8f14f81855858120f914af4f3934406bfdb74f1` | 13 | 13 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/reviews/native-ui/r02/preliminary147/ACK-147.json `c6f18f61e3eaa313a4592cf730a21119c7493e38` vs `MISSING` | OPEN |
| 172 | `736027ef8f40c1dce9378cf0ad861832d761d23c` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 207 | 193 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 173 | `db6e4a503267d0f54c61c4f966dbde162a2c5500` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 212 | 196 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 174 | `e7dc313df6455491a33a8f204c26b51d29f84dc1` | `af479f68c22ef1d1e9ac100a81a820f8b0273338` | 206 | 194 | modules/sucafina/Sucafinav1/docs/sf2h/native-ui/ACCEPTANCE.md `3e12ac729ac5f814e5f681ad4a20fa09535dcc5c` vs `MISSING` | OPEN |
| 175 | `2080abb393f2f03bc3cf313e67802b3935dc609f` | `690a34cdd81c12d7311f3717c19679b950276161` | 6 | 5 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance169/HANDOFF.md `6ced1638fe7453030f65ceda89c53f94edc96bf6` vs `MISSING` | OPEN |
| 176 | `0dcf98aeb738374ac91b6291b00691e305122ce4` | `690a34cdd81c12d7311f3717c19679b950276161` | 8 | 6 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance168/ack.json `20fa15f11d0247f09d1929255c23c59ab5c88f9f` vs `MISSING` | OPEN |
| 177 | `83c0401dc15e811834bb3495d56a60787bd5c33b` | `690a34cdd81c12d7311f3717c19679b950276161` | 5 | 2 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance170/ack.json `8008fa95ce8cefbf39057905ee940e697c740f54` vs `MISSING` | OPEN |
| 178 | `1a28bc587548f7bce8c514715db2ce122fe8b7c0` | `690a34cdd81c12d7311f3717c19679b950276161` | 4 | 4 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance165/ack-proof-am01-e1-browser165.json `56e3bd0bd1b4b189e5421f3c32075428a93132db` vs `MISSING` | OPEN |
| 179 | `7b766859a90aa7b028240dc7013ce9ee77983958` | `690a34cdd81c12d7311f3717c19679b950276161` | 5 | 4 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance167/ACK.json `7fe2bd5f8424e8ba32698fd69ddb9d85cf99b304` vs `MISSING` | OPEN |
| 180 | `88febfc1248b5fb6b1a76737d41c9a57e144646a` | `690a34cdd81c12d7311f3717c19679b950276161` | 5 | 3 | modules/sucafina/Sucafinav1/docs/sf2h/receipts/advance166/ack.json `1abb0fee47f870531d6c458652a09d7b3a1afe28` vs `MISSING` | OPEN |

## Absent

#111 does not exist. It was not opened, closed, or reopened.

#237 was not touched.
