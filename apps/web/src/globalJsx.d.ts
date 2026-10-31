// Flow: hast-util-to-jsx-runtime (the chat markdown renderer) types its components through the
// global `JSX` namespace, which React 19's types no longer declare; without it every tag is
// unknown. Point the global namespace at React's.
import type { JSX as ReactJsx } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements extends ReactJsx.IntrinsicElements {}
  }
}
