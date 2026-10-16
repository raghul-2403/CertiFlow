import { cx } from './ui.jsx';

// "Scan & Seal" mark: three QR-code corner squares, with the fourth corner
// replaced by a gold certificate seal. Scan the code, get certified.
const SEAL =
  'M31.00 24.10 L32.13 25.31 L33.64 24.63 L34.22 26.18 L35.88 26.12 L35.82 27.78 L37.37 28.36 L36.69 29.87 L37.90 31.00 L36.69 32.13 L37.37 33.64 L35.82 34.22 L35.88 35.88 L34.22 35.82 L33.64 37.37 L32.13 36.69 L31.00 37.90 L29.87 36.69 L28.36 37.37 L27.78 35.82 L26.12 35.88 L26.18 34.22 L24.63 33.64 L25.31 32.13 L24.10 31.00 L25.31 29.87 L24.63 28.36 L26.18 27.78 L26.12 26.12 L27.78 26.18 L28.36 24.63 L29.87 25.31Z';

function Finder({ x, y }) {
  return (
    <g>
      <rect x={x + 0.86} y={y + 0.86} width="10.29" height="10.29" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.71" />
      <rect x={x + 3.43} y={y + 3.43} width="5.14" height="5.14" rx="0.8" fill="currentColor" />
    </g>
  );
}

// A few QR "data" dots between the corner squares
const MODULES = [[18.3, 3.0], [18.3, 8.2], [15.4, 13.3], [20, 13.3], [3.0, 18.3], [8.2, 18.3], [13.3, 18.3], [18.3, 18.3], [13.3, 15.4]];
const MOD = 1.97;

export function LogoMark({ className, title }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <Finder x={3} y={3} />
      <Finder x={25} y={3} />
      <Finder x={3} y={25} />
      {MODULES.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={MOD} height={MOD} rx="0.4" fill="currentColor" />
      ))}
      <path d={SEAL} fill="#B8892B" />
      <path d="M28.3 31.1l1.9 1.9 3.6-3.8" fill="none" stroke="#0E1B36" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Full logo: mark + wordmark. `light` = for dark backgrounds.
export default function Logo({ light, size = 'md', className }) {
  const big = size === 'lg';
  return (
    <span className={cx('inline-flex items-center gap-2.5', light ? 'text-white' : 'text-ink', className)}>
      <LogoMark className={big ? 'size-10' : 'size-8'} />
      <span className={cx('heading leading-none', big ? 'text-[2.1rem]' : 'text-[1.7rem]')}>CertiFlow</span>
    </span>
  );
}
