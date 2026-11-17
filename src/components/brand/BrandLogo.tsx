import logoUrl from '../../assets/brand/logo.svg';
import { BRAND } from '../../lib/brand';

interface BrandLogoProps {
  /** Width and height in px */
  size?: number;
  className?: string;
}

/** The product logo. `object-contain` keeps a replacement logo whole even when it is not square */
export function BrandLogo({ size = 20, className = '' }: BrandLogoProps) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      alt={BRAND.name}
      draggable={false}
      className={`flex-shrink-0 object-contain ${className}`.trim()}
    />
  );
}
