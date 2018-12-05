'use babel';

/* eslint-disable no-undef */

import { CompositeDisposable } from 'atom';

/** @typedef { import('atom').TextEditor } TextEditor
*/

let subscriptions;

export function activate()
{
  // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
  subscriptions = new CompositeDisposable();
  
  // Register command that toggles this view
  subscriptions.add(atom.commands.add('atom-workspace',
    {
      'better-spellcheck:suggestions': () => toggle()
    }));
}

export function deactivate()
{
  console.log('better-spellcheck is deactivated');

  subscriptions.dispose();
}

function toggle()
{
  // console.log('better-spellcheck is toggled');

  const editor = atom.workspace.getActiveTextEditor();
  const editorView = atom.views.getView(editor);
  const editorViewComponent = editorView.getComponent();

  console.log(editor.getGrammar().name);
 
  const markerLayer = editor.addMarkerLayer();

  editor.decorateMarkerLayer(markerLayer, { type: 'highlight', class: 'better-spellcheck-typo' });

  const marker = markerLayer.markBufferRange(editor.getSelectedBufferRange());

  // editor.getGutters()[2].decorateMarker(marker, { type: 'highlight', class: 'better-spellcheck-gutter' });

  requestAnimationFrame(() =>
  {
    // FIX can easily be broken if another extension/theme plays with editor views, or atom updates their layout
    // but for now it works flawlessly
    const editorScrollViewElement = editorView.lastChild.lastChild.firstChild;

    const startPosition = editorViewComponent.pixelPositionForScreenPosition(marker.getStartScreenPosition());

    const a = document.createElement('div');
    a.classList.add('better-spellcheck-markerItem');

    a.style.left = `${startPosition.left}px`;
    a.style.top = `${(startPosition.top + editor.getLineHeightInPixels())}px`;

    editorScrollViewElement.appendChild(a);
  });

  // // get the word under cursor buffer
  // editor.getLastCursor().getCurrentWordBufferRange();

  // if (editor)
  //   editor.insertText('Hello, World!');

  // if (modalPanel.isVisible())
  //   return modalPanel.hide();
  // else
  //   return modalPanel.show();
}