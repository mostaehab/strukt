/**
 * Positional entity labels -- `N1`, `E2`.
 *
 * Stored ids are UUIDs, which are not what a student reads back off the canvas
 * and are certainly not what a rejection message or a status line should
 * quote. The panel, the canvas status line and every message that names an
 * entity read the label from here, so one Node can never be `N2` in the panel
 * and a UUID on the canvas.
 *
 * Numbering follows creation order. Renumbering after a delete is a known
 * instability, deferred with the rest of the label-consistency work because it
 * affects Nodes and Elements alike and needs a stable-ordinal decision.
 */

function positionalLabel(
  entities: { id: string }[],
  id: string | null,
  prefix: string,
): string {
  if (id === null) return "";
  const index = entities.findIndex((entity) => entity.id === id);
  // Empty rather than a bogus "N0": nothing is labelled if nothing matched.
  return index === -1 ? "" : `${prefix}${index + 1}`;
}

export function nodeLabel(nodes: { id: string }[], nodeId: string | null) {
  return positionalLabel(nodes, nodeId, "N");
}

export function elementLabel(
  elements: { id: string }[],
  elementId: string | null,
) {
  return positionalLabel(elements, elementId, "E");
}
