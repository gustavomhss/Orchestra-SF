import { createSignal } from "solid-js"
import { useLanguage } from "@/context/language"
import { isSucafinaBrand } from "./brand-identity"

// Existing public component name is retained for callers; the installed brand decides its appearance.
export function HugrBrand(props: { class?: string; compact?: boolean }) {
  const language = useLanguage()
  return (
    <div classList={{ "orchestra-brand": true, [props.class ?? ""]: !!props.class }}>
      {isSucafinaBrand() ? (
        <SucafinaLogo compact={props.compact} />
      ) : (
        <>
          <HugrImages
            name={props.compact ? "hugr-symbol" : "hugr-lockup"}
            width={props.compact ? 32 : 120}
            height={props.compact ? 32 : 40}
          />
          <span data-slot="orchestra-brand-descriptor">{language.t("orchestra.brand.name")}</span>
        </>
      )}
    </div>
  )
}

export function HugrSplash(props: { class?: string }) {
  return (
    <div classList={{ "orchestra-brand": true, "orchestra-brand-splash": true, [props.class ?? ""]: !!props.class }}>
      {isSucafinaBrand() ? <SucafinaLogo /> : <HugrImages name="hugr-horizontal-compact" width={121} height={32} />}
    </div>
  )
}

// Empty-state product mark. Never display an Orchestra logo in a Sucafina deployment.
export function HugrMark(props: { class?: string }) {
  return (
    <span classList={{ "orchestra-mark": true, [props.class ?? ""]: !!props.class }} aria-hidden="true">
      {isSucafinaBrand() ? (
        <SucafinaLogo compact />
      ) : (
        <>
          <img data-slot="orchestra-brand-logo-dark" src="/orchestra/hugr-symbol-inverse.svg" alt="" />
          <img data-slot="orchestra-brand-logo-light" src="/orchestra/hugr-symbol-primary.svg" alt="" />
        </>
      )}
    </span>
  )
}

// Asset slots are deliberate: approved Sucafina artwork must be supplied verbatim.
// A text fallback avoids silently substituting an invented emblem or the HuGR mark.
function SucafinaLogo(props: { compact?: boolean }) {
  const [darkReady, setDarkReady] = createSignal(false)
  const [lightReady, setLightReady] = createSignal(false)
  return (
    <span
      class="sucafina-logo"
      data-size={props.compact ? "mark" : "lockup"}
      data-dark-ready={darkReady()}
      data-light-ready={lightReady()}
      role="img"
      aria-label="Sucafina"
    >
      <img
        data-slot="orchestra-brand-logo-dark"
        src={props.compact ? "/brand/sucafina/mark-inverse.svg" : "/brand/sucafina/lockup-inverse.svg"}
        alt=""
        onLoad={() => setDarkReady(true)}
        onError={() => setDarkReady(false)}
      />
      <img
        data-slot="orchestra-brand-logo-light"
        src={props.compact ? "/brand/sucafina/mark-primary.svg" : "/brand/sucafina/lockup-primary.svg"}
        alt=""
        onLoad={() => setLightReady(true)}
        onError={() => setLightReady(false)}
      />
      <span data-slot="sucafina-fallback-dark" aria-hidden="true">{props.compact ? "S" : "SUCAFINA"}</span>
      <span data-slot="sucafina-fallback-light" aria-hidden="true">{props.compact ? "S" : "SUCAFINA"}</span>
    </span>
  )
}

// The sidebar lockup drops the wordmark's H, because the symbol already reads as one; the splash keeps the full wordmark.
function HugrImages(props: {
  name: "hugr-symbol" | "hugr-lockup" | "hugr-horizontal-compact"
  width: number
  height: number
}) {
  return (
    <>
      <img
        data-slot="orchestra-brand-logo-dark"
        src={`/orchestra/${props.name}-inverse.svg`}
        width={props.width}
        height={props.height}
        alt="HuGR"
      />
      <img
        data-slot="orchestra-brand-logo-light"
        src={`/orchestra/${props.name}-primary.svg`}
        width={props.width}
        height={props.height}
        alt="HuGR"
      />
    </>
  )
}
