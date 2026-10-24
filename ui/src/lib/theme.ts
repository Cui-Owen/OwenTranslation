// Follows the system appearance, like the side panel and in-page UI.
export function followSystemTheme() {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => document.documentElement.classList.toggle("dark", media.matches);
  apply();
  media.addEventListener("change", apply);
}
