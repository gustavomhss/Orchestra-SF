# R11 visual evidence

These are the unchanged JPEG previews emitted by the original browser run [45117078885](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45117078885), candidate `cb924bd6cda9bb1fd2ac304618d3a8760b80d94e`. The full-page PNGs remain in Playwright artifact `14792609948`. The [manifest](./evidence/manifest.json) records exact image blobs, dimensions and qualification boundaries. The run passed UI63, UI67 and UI69; UI61 and UI62 retain the limits stated below.

## UI61

The original condition step passed. Materiality timed out later; these images do not qualify materiality or a signal response.

### dark-desktop-recorded-condition

1440 × 1100 pixels; original log preview, 75,829 bytes. Source job `137502251987`.

![UI61 dark-desktop-recorded-condition](./evidence/r11-ui61-dark-desktop-recorded-condition.jpg)

### light-desktop-recorded-condition

1440 × 1100 pixels; original log preview, 79,757 bytes. Source job `137502251987`.

![UI61 light-desktop-recorded-condition](./evidence/r11-ui61-light-desktop-recorded-condition.jpg)

### light-320-recorded-condition

320 × 900 pixels; original log preview, 26,525 bytes. Source job `137502251987`.

![UI61 light-320-recorded-condition](./evidence/r11-ui61-light-320-recorded-condition.jpg)

## UI62

Authorized candidates in Brazilian Portuguese passed. The original recall returned 503; this is not a qualified recall result.

### pt-br-dark-desktop-authorized-candidates

1440 × 1100 pixels; original log preview, 76,393 bytes. Source job `137502251987`.

![UI62 pt-br-dark-desktop-authorized-candidates](./evidence/r11-ui62-pt-br-dark-desktop-authorized-candidates.jpg)

## UI63

The entire journey passed with the exact original incomplete-coverage refusal and a recorded choice without a signal condition. No numerical comparison is claimed.

### dark-desktop-recorded-choice-no-condition

1440 × 1100 pixels; original log preview, 86,163 bytes. Source job `137502251987`.

![UI63 dark-desktop-recorded-choice-no-condition](./evidence/r11-ui63-dark-desktop-recorded-choice-no-condition.jpg)

### light-desktop-incomplete-coverage

1440 × 1100 pixels; original log preview, 64,178 bytes. Source job `137502251987`.

![UI63 light-desktop-incomplete-coverage](./evidence/r11-ui63-light-desktop-incomplete-coverage.jpg)

### light-320-incomplete-coverage

320 × 900 pixels; original log preview, 19,407 bytes. Source job `137502251987`.

![UI63 light-320-incomplete-coverage](./evidence/r11-ui63-light-320-incomplete-coverage.jpg)

### pt-br-dark-desktop-incomplete-coverage

1440 × 1100 pixels; original log preview, 62,107 bytes. Source job `137502251987`.

![UI63 pt-br-dark-desktop-incomplete-coverage](./evidence/r11-ui63-pt-br-dark-desktop-incomplete-coverage.jpg)

## UI67

The entire journey passed, including the original context refresh and Brazilian Portuguese.

### dark-desktop-current-context

1440 × 1100 pixels; original log preview, 63,870 bytes. Source job `137502251987`.

![UI67 dark-desktop-current-context](./evidence/r11-ui67-dark-desktop-current-context.jpg)

### light-desktop-refreshed-context

1440 × 1100 pixels; original log preview, 67,707 bytes. Source job `137502251987`.

![UI67 light-desktop-refreshed-context](./evidence/r11-ui67-light-desktop-refreshed-context.jpg)

### pt-br-dark-desktop-current-context

1440 × 1100 pixels; original log preview, 64,554 bytes. Source job `137502251987`.

![UI67 pt-br-dark-desktop-current-context](./evidence/r11-ui67-pt-br-dark-desktop-current-context.jpg)

## UI69

The entire journey passed, including one reviewed save, exact CAS and persisted readback. These images precede PR715's additional summary spacing.

### dark-desktop-summary-settings

1440 × 1100 pixels; original log preview, 80,806 bytes. Source job `137502251987`.

![UI69 dark-desktop-summary-settings](./evidence/r11-ui69-dark-desktop-summary-settings.jpg)

### light-320-summary-review-actions

320 × 900 pixels; original log preview, 23,181 bytes. Source job `137502251987`.

![UI69 light-320-summary-review-actions](./evidence/r11-ui69-light-320-summary-review-actions.jpg)

### pt-br-dark-desktop-administration

1440 × 1100 pixels; original log preview, 84,293 bytes. Source job `137502251987`.

![UI69 pt-br-dark-desktop-administration](./evidence/r11-ui69-pt-br-dark-desktop-administration.jpg)

## R13: UI69 after PR715 composition

The focused original journey passed on candidate `722b703b060e5cc578fa8d23568b3f9c56d72077`: [run 45121178514](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45121178514). It preserved the 30 body expectations, proved the single save/CAS/readback and refreshed Portuguese view, and produced no page or console errors. These three previews include the additional authorized-content gap; the [R13 manifest](./evidence/r13-ui69-manifest.json) records their source and exact bytes.

### R13 dark-desktop-summary-settings

1440 × 1100 pixels; unchanged original JPEG, 81,819 bytes.

![dark-desktop-summary-settings](./evidence/r13-ui69-dark-desktop-summary-settings.jpg)

### R13 light-320-summary-review-actions

320 × 900 pixels; unchanged original JPEG, 23,181 bytes.

![light-320-summary-review-actions](./evidence/r13-ui69-light-320-summary-review-actions.jpg)

### R13 pt-br-dark-desktop-administration

1440 × 1100 pixels; unchanged original JPEG, 85,345 bytes.

![pt-br-dark-desktop-administration](./evidence/r13-ui69-pt-br-dark-desktop-administration.jpg)

## R15: UI61 native local cancellation

Both isolated journeys passed: [run 45122439989](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45122439989), candidate `d62c4b500695d248240a48944461a0d2262a589f`. Materiality EN and signals BR each observed one native GET and `net::ERR_ABORTED`, retained the condition and cleared selection without a resend. These images qualify local presentation and cancellation only. No completed materiality/signal result or source rollback is claimed. The [R15 manifest](./evidence/r15-ui61-manifest.json) records all twelve PNG capture dimensions and these eight unchanged JPEGs.

### R15 en-dark-desktop-materiality-conditions-before-consultation

1440 × 1100 pixels; unchanged original JPEG, 75,912 bytes.

![en-dark-desktop-materiality-conditions-before-consultation](./evidence/r15-ui61-en-dark-desktop-materiality-conditions-before-consultation.jpg)

### R15 pt-br-dark-desktop-materiality-conditions-before-consultation

1440 × 1100 pixels; unchanged original JPEG, 77,601 bytes.

![pt-br-dark-desktop-materiality-conditions-before-consultation](./evidence/r15-ui61-pt-br-dark-desktop-materiality-conditions-before-consultation.jpg)

### R15 en-dark-desktop-materiality-local-cancel

1440 × 1100 pixels; unchanged original JPEG, 77,925 bytes.

![en-dark-desktop-materiality-local-cancel](./evidence/r15-ui61-en-dark-desktop-materiality-local-cancel.jpg)

### R15 en-light-320-materiality-local-cancel

320 × 900 pixels; unchanged original JPEG, 26,191 bytes.

![en-light-320-materiality-local-cancel](./evidence/r15-ui61-en-light-320-materiality-local-cancel.jpg)

### R15 en-dark-desktop-signals-conditions-before-consultation

1440 × 1100 pixels; unchanged original JPEG, 75,826 bytes.

![en-dark-desktop-signals-conditions-before-consultation](./evidence/r15-ui61-en-dark-desktop-signals-conditions-before-consultation.jpg)

### R15 pt-br-dark-desktop-signals-conditions-before-consultation

1440 × 1100 pixels; unchanged original JPEG, 77,506 bytes.

![pt-br-dark-desktop-signals-conditions-before-consultation](./evidence/r15-ui61-pt-br-dark-desktop-signals-conditions-before-consultation.jpg)

### R15 br-dark-desktop-signals-local-cancel

1440 × 1100 pixels; unchanged original JPEG, 77,829 bytes.

![br-dark-desktop-signals-local-cancel](./evidence/r15-ui61-br-dark-desktop-signals-local-cancel.jpg)

### R15 br-light-320-signals-local-cancel

320 × 900 pixels; unchanged original JPEG, 26,457 bytes.

![br-light-320-signals-local-cancel](./evidence/r15-ui61-br-light-320-signals-local-cancel.jpg)

