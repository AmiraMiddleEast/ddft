/**
 * Phase 4 Plan 03 — Thin wrapper around @react-pdf/renderer's `renderToBuffer`.
 *
 * Use `renderToBuffer` (not `renderToStream`) inside Server Actions per
 * RESEARCH Pitfall 1: (a) we need the byteLength for the laufliste row,
 * (b) the full PDF fits comfortably in memory for an internal tool,
 * (c) we write once to disk, not stream to client.
 *
 * This file is TSX so the `<LauflisteDocument>` JSX is valid.
 */

import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { LauflisteDocument } from "./Document";
import type { LauflisteInput } from "../types";

export async function renderLaufliste(input: LauflisteInput): Promise<Buffer> {
  // LauflisteDocument returns a @react-pdf/renderer <Document>, so the created
  // element is a ReactElement<DocumentProps> in the runtime shape expected by
  // renderToBuffer. The Document wrapper is typed as ReactElement<unknown>
  // because of how @react-pdf re-exports component props; the cast below
  // pins the correct element type.
  const element = React.createElement(
    LauflisteDocument,
    { input },
  ) as unknown as React.ReactElement<DocumentProps>;
  return renderToBuffer(element);
}
