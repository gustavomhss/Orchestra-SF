# Closeout 121–200

Checked every open PR numbered 121 through 200 against `origin/close-final-candidate` `a63c4c733523294450f605e73de3306edff81e58`.

A PR was eligible to close only if its head was an ancestor of that commit, or `git diff origin/close-final-candidate...<head>` was empty. Neither was true for any open PR in range. None were closed. None were merged. #237 was not touched. #165 and #191 were not open and were not touched.

| Result | Count |
| --- | ---: |
| Closed | 0 |
| Left open | 78 |

Proof commands, run in `/tmp/w-base` after `git fetch origin` and `git fetch origin refs/pull/<n>/head`:

```
git merge-base --is-ancestor <head> origin/close-final-candidate
git diff --quiet origin/close-final-candidate...<head>
```

`merge-base --is-ancestor` exited 1 for every head (not an ancestor; not an error). `git diff --quiet` exited 1 for 77 heads (non-empty) and 128 for #199 (no merge base). Listed head SHAs matched the fetched `refs/pull/<n>/head` tips.

## Left open

| PR | Head | Why |
| ---: | --- | --- |
| 121 | `a81ee51b312a64d27cff496e863a02e874ac14a8` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (173 files changed, 90892 insertions(+)) |
| 122 | `411961a501b5a40c78ebd2870654577039a091bd` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (180 files changed, 93190 insertions(+)) |
| 123 | `d1d9c000643b75d6951ba45c64990d4942c87c4c` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (176 files changed, 90998 insertions(+)) |
| 124 | `c799553dd22f307c993b1289fced272d9c5f7f91` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (180 files changed, 92945 insertions(+)) |
| 125 | `3af72005104564c027c008ea61211848ff0cc9b2` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (182 files changed, 91070 insertions(+)) |
| 126 | `2b49748bc255f6a5cfa5dd71f5dad1fd348c8402` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (15 files changed, 536 insertions(+), 6 deletions(-)) |
| 127 | `8daecc06cb98805b144168f6cc6e2a45153eb710` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (164 files changed, 89341 insertions(+)) |
| 128 | `9b466e82afc2d05cde0dad3478e21d7b3803797c` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (164 files changed, 89400 insertions(+)) |
| 129 | `0d3c1006d8951001d9fce911ca587a89e1711d25` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (195 files changed, 96711 insertions(+)) |
| 130 | `d4f53e8b0e54cb2a746cdb8eac504d5b6128d0c6` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (168 files changed, 90587 insertions(+)) |
| 131 | `7be8d20208226e0ccbd6a45a13f9e1ad3748a441` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (184 files changed, 91852 insertions(+)) |
| 132 | `35a4c7aa972cefb6b0d185cd66991f98edead721` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (10 files changed, 1087 insertions(+)) |
| 133 | `dc4beff8175629b1d62cd972d8393b7cd817054c` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (174 files changed, 91717 insertions(+)) |
| 134 | `7b1a076f2f9270fc37c136245232e6d4b7674881` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (178 files changed, 90485 insertions(+)) |
| 135 | `4dd1cb90d9aef580a84d7ec6a25c0fd10d721063` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (185 files changed, 93119 insertions(+)) |
| 136 | `c9afc262f7cfac3b4a11e2ad10922d0f893ea671` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (166 files changed, 89696 insertions(+)) |
| 137 | `d3279c36a38e7be5df6bd6f848f3ded9d22b31a4` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (166 files changed, 89446 insertions(+)) |
| 138 | `51e229ccbc24edbacd2634aa7390dda8fef5a28d` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (167 files changed, 89986 insertions(+)) |
| 139 | `255010fa18e4c55f481bf623da45b5f1c5fcdfb9` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (171 files changed, 91200 insertions(+)) |
| 140 | `3b93d1c9cca27fde60896fbf42af1b6ead637b75` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (177 files changed, 90323 insertions(+)) |
| 141 | `abd27697d1e2844ee777978ace0e5a0a9b87acc3` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (167 files changed, 89823 insertions(+)) |
| 142 | `e822e1cf4bf4167a3190b87c8be29dd9ffe992a0` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (163 files changed, 89674 insertions(+)) |
| 143 | `2baa39cef66153d75a363958fe716d80ed1c2081` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (168 files changed, 90195 insertions(+)) |
| 144 | `6520f5f0cbce97672273ea598347bc199a73588b` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (173 files changed, 91388 insertions(+)) |
| 145 | `d234efa53262b2bcf157292be1a5aa729c3adb11` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (181 files changed, 90849 insertions(+)) |
| 146 | `5d802259adbefd0b2031c436afc3f51dd276a050` | not an ancestor of a63c4c733523; three-dot diff from merge-base a15434ab558a is non-empty (22 files changed, 3180 insertions(+)) |
| 147 | `678a6787d054d061e94b0340238415cd0aca5f93` | not an ancestor of a63c4c733523; three-dot diff from merge-base a15434ab558a is non-empty (13 files changed, 1854 insertions(+)) |
| 148 | `9f2abfbae5facc695f339d1898e5ef5d16cb6317` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (200 files changed, 101821 insertions(+)) |
| 149 | `eb682e97833e761dbecde342eea7bcba2f854d18` | not an ancestor of a63c4c733523; three-dot diff from merge-base a15434ab558a is non-empty (11 files changed, 1949 insertions(+)) |
| 150 | `6b747c45b0f26ea2e9b8d726a34347cc6b42a4a4` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (221 files changed, 106284 insertions(+)) |
| 151 | `7e6a0acbc9101630f5d0b5d96af91746bfdcba3b` | not an ancestor of a63c4c733523; three-dot diff from merge-base 8a73afab6003 is non-empty (197 files changed, 100406 insertions(+)) |
| 152 | `dd1f13b28837eadca7e41a6692c0f4175affdfe5` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (209 files changed, 102268 insertions(+)) |
| 153 | `72c5d2afcbdc202605614a18c5ba472aafc34574` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (210 files changed, 103036 insertions(+)) |
| 154 | `1dd59fd1fca6a50c9e86ef81943682a2d242cb45` | not an ancestor of a63c4c733523; three-dot diff from merge-base 8a73afab6003 is non-empty (197 files changed, 100516 insertions(+)) |
| 155 | `1a2a7a82a3a6138924a63e903cdd864099860f11` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (203 files changed, 101611 insertions(+)) |
| 156 | `01ad093c03e76dc5d2469dc5a885d8ebd0e68159` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (203 files changed, 101994 insertions(+)) |
| 157 | `8a5128c8bd30e91ae72a8a3886de60c06ac1f26b` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (206 files changed, 102694 insertions(+)) |
| 158 | `e1abec0d6d2d67a11cd77ba2527c508b4a849dd1` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (207 files changed, 102078 insertions(+)) |
| 159 | `c657264a1a51836649494fb63740937641109b33` | not an ancestor of a63c4c733523; three-dot diff from merge-base 8f933d3249f4 is non-empty (5 files changed, 611 insertions(+)) |
| 160 | `de22417fb593d50ac953b192ce609ff415f323ee` | not an ancestor of a63c4c733523; three-dot diff from merge-base a15434ab558a is non-empty (21 files changed, 2331 insertions(+)) |
| 161 | `3036b25c569a0c4668c8150cf81afef8cb79febb` | not an ancestor of a63c4c733523; three-dot diff from merge-base 422f1ed7b549 is non-empty (8 files changed, 441 insertions(+), 1 deletion(-)) |
| 162 | `37ca3faada22c18ba69babfea0cbff3e3d467cc7` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (209 files changed, 102730 insertions(+)) |
| 163 | `1d3b8a181b14e89ee3e11de9cac61cfe9d7cf56c` | not an ancestor of a63c4c733523; three-dot diff from merge-base a15434ab558a is non-empty (13 files changed, 1763 insertions(+)) |
| 164 | `353a92eae59b3f556a7316aee24a033c464610e9` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (203 files changed, 102216 insertions(+)) |
| 166 | `4135c79382a1a664b133090ca1e2aafe6514fbf6` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (214 files changed, 102653 insertions(+)) |
| 167 | `613bc78e59d8a0051ddee148057533cebdd79c5e` | not an ancestor of a63c4c733523; three-dot diff from merge-base a15434ab558a is non-empty (20 files changed, 2822 insertions(+)) |
| 168 | `49515530be8554d86512fd7e1eb91b6e76efa49f` | not an ancestor of a63c4c733523; three-dot diff from merge-base a15434ab558a is non-empty (19 files changed, 3229 insertions(+)) |
| 169 | `84c9eb170b826c4c595120e62b78efe31f904d0d` | not an ancestor of a63c4c733523; three-dot diff from merge-base d8f14f818558 is non-empty (13 files changed, 3415 insertions(+)) |
| 170 | `67f1963e42769dfb94ba1080ca0b5b883b54eb58` | not an ancestor of a63c4c733523; three-dot diff from merge-base d8f14f818558 is non-empty (13 files changed, 8596 insertions(+)) |
| 171 | `b3e674c66e9c7e0a3f6ade6353905539a8e326fd` | not an ancestor of a63c4c733523; three-dot diff from merge-base d8f14f818558 is non-empty (13 files changed, 1890 insertions(+)) |
| 172 | `736027ef8f40c1dce9378cf0ad861832d761d23c` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (207 files changed, 102461 insertions(+)) |
| 173 | `db6e4a503267d0f54c61c4f966dbde162a2c5500` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (212 files changed, 103986 insertions(+)) |
| 174 | `e7dc313df6455491a33a8f204c26b51d29f84dc1` | not an ancestor of a63c4c733523; three-dot diff from merge-base af479f68c22e is non-empty (206 files changed, 103558 insertions(+)) |
| 175 | `2080abb393f2f03bc3cf313e67802b3935dc609f` | not an ancestor of a63c4c733523; three-dot diff from merge-base 690a34cdd81c is non-empty (6 files changed, 1189 insertions(+)) |
| 176 | `0dcf98aeb738374ac91b6291b00691e305122ce4` | not an ancestor of a63c4c733523; three-dot diff from merge-base 690a34cdd81c is non-empty (8 files changed, 849 insertions(+)) |
| 177 | `83c0401dc15e811834bb3495d56a60787bd5c33b` | not an ancestor of a63c4c733523; three-dot diff from merge-base 690a34cdd81c is non-empty (5 files changed, 698 insertions(+)) |
| 178 | `1a28bc587548f7bce8c514715db2ce122fe8b7c0` | not an ancestor of a63c4c733523; three-dot diff from merge-base 690a34cdd81c is non-empty (4 files changed, 1812 insertions(+)) |
| 179 | `7b766859a90aa7b028240dc7013ce9ee77983958` | not an ancestor of a63c4c733523; three-dot diff from merge-base 690a34cdd81c is non-empty (5 files changed, 1122 insertions(+)) |
| 180 | `88febfc1248b5fb6b1a76737d41c9a57e144646a` | not an ancestor of a63c4c733523; three-dot diff from merge-base 690a34cdd81c is non-empty (5 files changed, 4773 insertions(+)) |
| 181 | `0730dfa7134ca46df3d89c46801ee200f28e168e` | not an ancestor of a63c4c733523; three-dot diff from merge-base 913b6b8f143e is non-empty (6 files changed, 3010 insertions(+)) |
| 182 | `2c0416ca80c2367843be7b39dbc4a7fb677a2185` | not an ancestor of a63c4c733523; three-dot diff from merge-base 6607c60d2a2b is non-empty (13 files changed, 4301 insertions(+), 1 deletion(-)) |
| 183 | `34a00f196de20de359b53f51fbe9007442f8cea4` | not an ancestor of a63c4c733523; three-dot diff from merge-base 6607c60d2a2b is non-empty (7 files changed, 443 insertions(+)) |
| 184 | `3ec7a4ca7db735c08f1f63e164734a0bda245ac7` | not an ancestor of a63c4c733523; three-dot diff from merge-base 6607c60d2a2b is non-empty (7 files changed, 712 insertions(+)) |
| 185 | `cb7a19356da4e9ba33c902264a1b4aa25639d976` | not an ancestor of a63c4c733523; three-dot diff from merge-base 4426445c0582 is non-empty (8 files changed, 361 insertions(+), 9 deletions(-)) |
| 186 | `1f9220cd68f84237f4c2dc6d3f28b858f5de2bda` | not an ancestor of a63c4c733523; three-dot diff from merge-base 4426445c0582 is non-empty (6 files changed, 391 insertions(+), 8 deletions(-)) |
| 187 | `e6e8ecdc63ea7cc8070c15aec16c001c4b657a13` | not an ancestor of a63c4c733523; three-dot diff from merge-base 4426445c0582 is non-empty (6 files changed, 165 insertions(+), 8 deletions(-)) |
| 188 | `c8af58da3cb7c8734c2d2f126e63fd1ddabd0440` | not an ancestor of a63c4c733523; three-dot diff from merge-base 4426445c0582 is non-empty (8 files changed, 430 insertions(+), 3 deletions(-)) |
| 189 | `df9fdd3afa36ccc2f686d165104546819eb96dfc` | not an ancestor of a63c4c733523; three-dot diff from merge-base 4426445c0582 is non-empty (13 files changed, 701 insertions(+), 16 deletions(-)) |
| 190 | `9b512eeffa9c437967b03d5af6dab11a1718f48b` | not an ancestor of a63c4c733523; three-dot diff from merge-base 6607c60d2a2b is non-empty (21 files changed, 2361 insertions(+), 140 deletions(-)) |
| 192 | `cca757a0e125de371cb677342802509fb769bbd2` | not an ancestor of a63c4c733523; three-dot diff from merge-base 6130f6820146 is non-empty (10 files changed, 6654 insertions(+)) |
| 193 | `e8dfeb4cb4e122318b6289fbeb8fe4da9ef53f64` | not an ancestor of a63c4c733523; three-dot diff from merge-base 7abf6c425e9b is non-empty (9 files changed, 661 insertions(+), 8 deletions(-)) |
| 194 | `6f65ea078a3c596fca02961a68d98d36778bd54f` | not an ancestor of a63c4c733523; three-dot diff from merge-base 7abf6c425e9b is non-empty (12 files changed, 807 insertions(+), 10 deletions(-)) |
| 195 | `14f894e3c70d14092a50931cc511250d276e107c` | not an ancestor of a63c4c733523; three-dot diff from merge-base 7abf6c425e9b is non-empty (8 files changed, 652 insertions(+), 6 deletions(-)) |
| 196 | `0d37528d52eb27c2cfafd9772508914e03f2f7f4` | not an ancestor of a63c4c733523; three-dot diff from merge-base 7abf6c425e9b is non-empty (8 files changed, 704 insertions(+), 1 deletion(-)) |
| 197 | `6ec7d43fdaa63268540f30e80d590d9af85d2988` | not an ancestor of a63c4c733523; three-dot diff from merge-base 7abf6c425e9b is non-empty (15 files changed, 2578 insertions(+), 10 deletions(-)) |
| 198 | `155091aa164f18e65a7fb6c398dad3d6789d22c7` | not an ancestor of a63c4c733523; three-dot diff from merge-base 7abf6c425e9b is non-empty (15 files changed, 1395 insertions(+), 4 deletions(-)) |
| 199 | `8f4f7e102ac1b73dc014e23737cc62bba84043ee` | not an ancestor of a63c4c733523; no merge base with origin/close-final-candidate, so the three-dot diff cannot be proven empty |
| 200 | `8781a3b7c4c648e5e637caf94bfd187f87c9327a` | not an ancestor of a63c4c733523; three-dot diff from merge-base e6488a4d7694 is non-empty (7 files changed, 863 insertions(+), 5 deletions(-)) |

Unique hunks were not closed. Re-check only if `origin/close-final-candidate` moves or a PR head moves.
