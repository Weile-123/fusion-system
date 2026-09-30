/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './h5/index.html',
    './h5/pages/**/*.html',
    './h5/*.js'
  ],
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {}
  },
  plugins: []
};
