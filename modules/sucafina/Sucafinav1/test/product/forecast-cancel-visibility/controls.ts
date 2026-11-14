import type { Locator } from "@playwright/test"

// Read the real DOM and CSSOM without adding attributes, styles or listeners.
export async function readForecastControls(form: Locator) {
  return form.evaluate((node) => {
    const cancel = node.querySelector<HTMLButtonElement>("[data-analysis-cancel]")
    const retry = [...node.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Refresh analysis status")
    const start = node.querySelector<HTMLButtonElement>("button:not([type]), button[type=submit]")
    const state = (button: HTMLButtonElement | null | undefined) => button ? {
      present: true, hiddenAttribute: button.getAttribute("hidden"), hidden: button.hidden,
      display: getComputedStyle(button).display, visibility: getComputedStyle(button).visibility,
      rectangles: button.getClientRects().length, disabled: button.disabled,
    } : null
    const rules = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules])
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
      .filter((rule) => !!cancel && cancel.matches(rule.selectorText) && !!rule.style.display)
      .map((rule) => ({ selector: rule.selectorText, display: rule.style.display, priority: rule.style.getPropertyPriority("display") }))
    return {
      ready: (node as HTMLFormElement).dataset.sfForecastReady,
      status: node.querySelector("[role=status]")?.textContent,
      cancel: state(cancel), retry: state(retry), start: state(start),
      currency: node.querySelector<HTMLInputElement>('input[name="currency"]')?.value,
      resultBodies: document.querySelectorAll("[data-analysis-body]").length,
      matchedDisplayRules: rules,
    }
  })
}
