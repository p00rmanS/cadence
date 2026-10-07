/**
 * Settings for PostCSS, which processes the CSS during a build: Tailwind turns our class names into
 * real CSS, and Autoprefixer adds the extra browser-specific spellings older browsers need.
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
