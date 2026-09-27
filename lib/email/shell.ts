import "server-only";

/**
 * The one inline style every EventPass email opens with.
 *
 * An email client will not load a webfont or read a CSS custom property, so
 * this is the third place after the manifest and the theme-colour meta where
 * the design system has to be restated as literals. Both are derived: the ink
 * is the sRGB conversion of `--foreground`, and the family asks for Geist Sans
 * first so a client that happens to have it renders in the product's own voice
 * before falling back to the reader's system sans.
 *
 * It replaces `Arial` on `#171717` — a pure neutral, which the palette does not
 * contain anywhere and which reads visibly colder than every EventPass surface.
 */
const EMAIL_INK = "#22222b";

export const EMAIL_BODY_STYLE = [
  "font-family:Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  `color:${EMAIL_INK}`,
  "line-height:1.6",
  "max-width:640px",
].join(";");

/** Ticket Codes and other strings a person reads aloud or types back. */
export const EMAIL_CODE_STYLE =
  "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:20px;letter-spacing:0.08em";
