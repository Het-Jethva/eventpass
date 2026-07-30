import "react";

// `ViewTransition` ships in React's experimental build, which Next substitutes
// for `react` when experimental.viewTransition is enabled. The runtime export
// therefore exists, but @types/react 19.2 does not declare it, so it is
// declared here rather than reaching for `any` at every call site.
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
