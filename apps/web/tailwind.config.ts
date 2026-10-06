import type { Config } from 'tailwindcss';

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: c('paper'),
        surface: c('surface'),
        ink: c('ink'),
        muted: c('muted'),
        line: c('line'),
        brand: { DEFAULT: c('brand'), soft: c('brand-soft'), ink: c('brand-ink') },
        holud: { DEFAULT: c('holud'), soft: c('holud-soft') },
        morich: { DEFAULT: c('morich'), soft: c('morich-soft') },
      },
      fontFamily: {
        head: ['var(--font-head)', 'var(--font-body)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '12px', ctl: '8px' },
    },
  },
  plugins: [],
};
export default config;
