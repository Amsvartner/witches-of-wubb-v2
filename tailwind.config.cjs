/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        fondamento: ['Fondamento', 'sans-serif'],
        // WOW-007A typography direction C (human-approved 2026-07-15):
        // Marcellus ceremonial display, IBM Plex Sans UI/data, Source Sans 3
        // for numbers + units. All three are self-hosted OFL faces (see index.css).
        display: ['Marcellus', 'Marcellus SC', 'serif'],
        data: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        number: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: (theme) => ({
        'recipe-bg':
          "radial-gradient(circle at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%), url('/images/script_bg.jpg')",
        // Play-mode page ground — Palette Option A "Obsidian & Gilt"
        // (DESIGN_PROPOSAL_001 §3.1; page palette not finally decided — §8.3).
        'grimoire-page': 'radial-gradient(120% 90% at 50% 8%, #0e0b12 0%, #080609 100%)',
      }),
      colors: {
        'blue-400': 'hsl(180, 100%, 80%)',
        // Play-mode design tokens (DESIGN_PROPOSAL_001 §3.1). Category hues are
        // NOT here — ColorUtil is their single source of truth (PRD F4).
        gold: {
          line: '#c9a24b',
          bright: '#e6c877',
        },
        // Drums hue, desaturated from blue-700 (#1d4ed8) to sit at the same
        // perceived intensity as the other category hues (human, 2026-07-17).
        'drums-blue': '#3559c0',
        // Melody hue, warmed-yellow between Tailwind yellow-500/600 — clearly
        // yellow (matching the physical pillar) but still warm, not ochre
        // (human, 2026-07-17).
        'melody-yellow': '#dfa50a',
        ink: {
          page: '#0e0b12',
          deep: '#080609',
          panel: '#140f1a',
          inset: '#1b1016',
          btn: '#171019',
          rail: '#241f14',
        },
        parchment: '#ece3d0',
      },
      keyframes: {
        fadein: {
          '0%': { opacity: '1' },
          '50%': { opacity: '0.7' },
          '100%': { opacity: '1' },
        },
        scale: {
          '0%': { transform: 'scale3d(0.4, 0.4, 1)' },
          '50%': { transform: 'scale3d(2.2, 2.2, 1)' },
          '100%': { transform: 'scale3d(0.4, 0.4, 1)' },
        },
        // Calm ambient motion only — never faster than ~1Hz, never flashing
        // (DESIGN_PROPOSAL_001 §7.4). Gated behind motion-safe in components.
        'pulse-calm': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        // Equalizer bars: transform-only (compositor-composited — no layout or
        // paint), keeping the animation cheap on the already-loaded GPU.
        eq: {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        },
        // Magic-cauldron ambience (transform/opacity only — compositor-cheap).
        // Blobs rise ~160px from the rim, widening slightly while fading out;
        // base opacity is 0 so a non-running animation leaves them invisible.
        'cauldron-blob': {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '0' },
          '15%': { opacity: '0.75' },
          '100%': { transform: 'translateY(-160px) scale(1.15)', opacity: '0' },
        },
        'cauldron-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        // Centering translate lives in the keyframes: an animated transform
        // REPLACES the utility translate classes, which otherwise shifts the
        // ring by half its size mid-animation.
        'cauldron-ring': {
          '0%': { transform: 'translate(-50%, -50%) scale(1)', opacity: '0.6' },
          '100%': { transform: 'translate(-50%, -50%) scale(1.45)', opacity: '0' },
        },
      },
      animation: {
        fadein: 'fadein 200ms infinite',
        scale: 'scale 2s infinite',
        'pulse-calm': 'pulse-calm 2.4s ease-in-out infinite',
        eq: 'eq 1.2s ease-in-out infinite',
        'cauldron-blob': 'cauldron-blob 4.5s ease-out infinite',
        'cauldron-float': 'cauldron-float 6s ease-in-out infinite',
        'cauldron-ring': 'cauldron-ring 0.9s ease-out forwards',
      },
      transitionDuration: {
        200: '200ms',
        2000: '2000ms',
      },
    },
  },

  plugins: [
    require('@headlessui/tailwindcss')({ prefix: 'ui' }),
    function ({ addBase, config }) {
      addBase({
        'html::-webkit-scrollbar': { display: 'none' },
        html: { scrollbarWidth: 'none', msOverflowStyle: 'none' },
      });
    },
    function ({ addComponents }) {
      const newComponents = {
        '.backdrop-blur': {
          'backdrop-filter': 'blur(13px)', // Adjust blur radius as per your needs
        },
        'input[type="range"].custom-tempo-slider': {
          '@apply appearance-none': {},
          '&:focus': {
            '@apply outline-none': {},
          },
          '&::-webkit-slider-thumb': {
            '@apply appearance-none h-32 w-9 bg-center bg-no-repeat border-none scale-100': {},
            'background-image': "url('/images/arcane_tempo_slider_120.png')",
          },
        },
        'input[type="range"].custom-volume-slider': {
          // Add new CSS class here
          '@apply appearance-none -rotate-90 rounded-lg translate-y-20': {},
          '&:focus': {
            '@apply outline-none': {},
          },
          '&::-webkit-slider-thumb': {
            '@apply appearance-none h-16 w-4 bg-center bg-no-repeat border-none': {},
            'background-image': "url('/images/arcane_volume_slider_120.png')", // Use new image URL here
          },
        },
      };
      addComponents(newComponents);
    },
  ],
};
