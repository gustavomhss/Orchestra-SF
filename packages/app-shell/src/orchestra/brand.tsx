import { useLanguage } from "@/context/language"
import { isSucafinaBrand } from "./brand-identity"

export function HugrBrand(props: { class?: string; compact?: boolean }) {
  const language = useLanguage()
  return (
    <div classList={{ "orchestra-brand": true, [props.class ?? ""]: !!props.class }}>
      {isSucafinaBrand() ? (
        <SucafinaLogo compact={props.compact} />
      ) : (
        <>
          <HugrImages name={props.compact ? "hugr-symbol" : "hugr-lockup"} width={props.compact ? 32 : 120} height={props.compact ? 32 : 40} />
          <span data-slot="orchestra-brand-descriptor">{language.t("orchestra.brand.name")}</span>
        </>
      )}
    </div>
  )
}

export function HugrSplash(props: { class?: string }) {
  return (
    <div classList={{ "orchestra-brand": true, "orchestra-brand-splash": true, [props.class ?? ""]: !!props.class }}>
      {isSucafinaBrand() ? <SucafinaLogo splash /> : <HugrImages name="hugr-horizontal-compact" width={121} height={32} />}
    </div>
  )
}

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

// Both pieces are original Sucafina vector paths, without new logo geometry.
function SucafinaLogo(props: { compact?: boolean; splash?: boolean }) {
  return (
    <span class="sucafina-logo" data-size={props.compact ? "compact" : props.splash ? "splash" : "sidebar"} role="img" aria-label="Sucafina">
      <span class="sucafina-logo-symbol" aria-hidden="true">
        <img data-slot="orchestra-brand-logo-dark" src="/brand/sucafina/mark-inverse.svg" alt="" />
        <img data-slot="orchestra-brand-logo-light" src="/brand/sucafina/mark-primary.svg" alt="" />
      </span>
      {!props.compact && (
        <span class="sucafina-logo-wordmark" aria-hidden="true">
          <img data-slot="orchestra-brand-logo-dark" src="/brand/sucafina/wordmark-inverse.svg" alt="" />
          <img data-slot="orchestra-brand-logo-light" src="/brand/sucafina/wordmark-primary.svg" alt="" />
        </span>
      )}
    </span>
  )
}

// Default Orchestra deployment, unchanged.
function HugrImages(props: { name: "hugr-symbol" | "hugr-lockup" | "hugr-horizontal-compact"; width: number; height: number }) {
  return (
    <>
      <img data-slot="orchestra-brand-logo-dark" src={`/orchestra/${props.name}-inverse.svg`} width={props.width} height={props.height} alt="HuGR" />
      <img data-slot="orchestra-brand-logo-light" src={`/orchestra/${props.name}-primary.svg`} width={props.width} height={props.height} alt="HuGR" />
    </>
  )
}
