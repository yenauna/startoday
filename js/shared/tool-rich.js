// A safe, selection-preserving span formatter for the local typing board.
export function formatToolRange(editor, source, styles) {
  const doc = editor.ownerDocument,
    selection = doc.defaultView.getSelection();
  if (!source || !editor.contains(source.startContainer) || !editor.contains(source.endContainer)) return null;
  const range = source.cloneRange(),
    fragment = range.extractContents(),
    span = doc.createElement('span');
  const permitted = ['fontSize', 'color', 'backgroundColor', 'fontWeight'];
  for (const key of permitted) if (styles[key]) {
    span.style[key] = styles[key];
    fragment.querySelectorAll('*').forEach(el => el.style.removeProperty(key.replace(/[A-Z]/g, s => '-' + s.toLowerCase())));
  }
  if (styles.fontWeight) fragment.querySelectorAll('b,strong').forEach(el => el.replaceWith(...el.childNodes));
  if (fragment.childNodes.length) span.append(fragment);else span.textContent = '\u200b';
  range.insertNode(span);
  range.selectNodeContents(span);
  selection.removeAllRanges();
  selection.addRange(range);
  editor.focus();
  return range.cloneRange();
}
