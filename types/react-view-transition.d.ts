import "react";

// `ViewTransition` ships in the React canary the App Router builds against, so
// the runtime export exists. @types/react declares it only under the opt-in
// `react/canary` types, which the default `react` module does not expose, so it
// is declared here rather than reaching for `any` at every call site.
declare module "react" {
  interface ViewTransitionProps {
    children?: React.ReactNode;
    /** Shared name matched across routes to morph an element between them. */
    name?: string;
    default?: string;
    enter?: string;
    exit?: string;
    update?: string;
    share?: string;
    onEnter?: (element: Element, types: string[]) => void;
    onExit?: (element: Element, types: string[]) => void;
    onShare?: (element: Element, types: string[]) => void;
    onUpdate?: (element: Element, types: string[]) => void;
  }

  export const ViewTransition: React.ComponentType<ViewTransitionProps>;
}
