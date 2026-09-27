// Installed by the inline script in the root layout, which has to run before
// React hydrates so the first paint is already in the right theme. The switcher
// calls back into it rather than re-deriving the active theme, so there is one
// resolution of the stored preference in the product instead of two.
declare global {
  interface Window {
    __eventpassTheme?: () => void;
  }
}

export {};
