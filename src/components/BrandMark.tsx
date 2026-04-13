import { BRAND_LOGO_URL, BRAND_NAME_AR } from '../constants/brand'

type BrandMarkProps = {
  className?: string
  /** طول وعرض الصورة بالبكسل */
  size?: number
}

export function BrandMark({ className = '', size = 40 }: BrandMarkProps) {
  return (
    <img
      src={BRAND_LOGO_URL}
      alt={`شعار ${BRAND_NAME_AR}`}
      width={size}
      height={size}
      className={`object-contain ${className}`}
      decoding="async"
    />
  )
}
