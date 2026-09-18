/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // Wichtig: kein "preflight reset" gegen dein bestehendes style.css laufen
  // lassen, falls du das Systembrett später in dieselbe Seite wie deinen
  // normalen Header/Footer einbetten willst. Für eine eigenständige Seite
  // (empfohlener Start) kann corePlugins.preflight auf true bleiben.
  theme: {
    extend: {},
  },
  plugins: [],
};
