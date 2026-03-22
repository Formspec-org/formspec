/** @filedesc Tailwind integration CSS — rating star states + range thumb polish (host should compile Tailwind from adapter sources). */

export const integrationCSS = `
/* Force dark native form controls to match the dark card backgrounds. */
formspec-render input,
formspec-render textarea,
formspec-render select {
  color-scheme: dark;
}
/* Explicit dark background for multi-line inputs (UA stylesheets can override Tailwind). */
formspec-render textarea {
  background-color: rgba(24, 24, 27, 0.8);
  color: rgb(244, 244, 245);
}

/* Elevate layout cards when this adapter is active (Card plugin uses formspec-card). */
formspec-render .formspec-card {
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(24, 24, 27, 0.7);
  box-shadow: 0 4px 28px -10px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  padding: 1.25rem 1.35rem;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
formspec-render .formspec-card-title {
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: rgb(244 244 245);
  margin: 0 0 0.2rem;
}
formspec-render .formspec-card-subtitle {
  font-size: 0.8125rem;
  line-height: 1.45;
  color: rgb(161 161 170);
  margin: 0 0 1rem;
}
.formspec-rating-stars {
  gap: 0.35rem;
}
.formspec-rating-star {
  transition: color 0.15s ease, transform 0.15s ease, filter 0.15s ease;
  line-height: 1;
}
.formspec-rating-star--selected {
  color: #2dd4bf;
  transform: scale(1.12);
  filter: drop-shadow(0 2px 10px rgba(45, 212, 191, 0.45));
}
.formspec-rating-star--half {
  color: #5eead4;
  opacity: 0.92;
}
input[type="range"].formspec-tw-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 1.125rem;
  width: 1.125rem;
  border-radius: 9999px;
  background: #2dd4bf;
  border: 2px solid rgba(24, 24, 27, 0.9);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  margin-top: -5px;
}
input[type="range"].formspec-tw-range::-webkit-slider-runnable-track {
  height: 0.375rem;
  border-radius: 9999px;
  background: linear-gradient(90deg, #0d9488, #3f3f46);
}
input[type="range"].formspec-tw-range::-moz-range-thumb {
  height: 1.125rem;
  width: 1.125rem;
  border-radius: 9999px;
  background: #2dd4bf;
  border: 2px solid rgba(24, 24, 27, 0.9);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
input[type="range"].formspec-tw-range::-moz-range-track {
  height: 0.375rem;
  border-radius: 9999px;
  background: #3f3f46;
}
`.trim();
