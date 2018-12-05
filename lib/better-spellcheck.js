'use babel';

/* eslint-disable no-undef */

import { CompositeDisposable } from 'atom';

import { readdirSync } from 'fs';
import { join } from 'path';

import glob from 'globby';

/** @typedef { import('atom').TextEditor } TextEditor
*/

/** @typedef { import('atom').Decoration } Decoration
*/

/** @typedef { import('atom').DisplayMarker } DisplayMarker
*/

/** @type { CompositeDisposable }
*/
let subscriptions;

/** @type { DisplayMarker[] }
*/
let activeMarkers = [];

/** @type { Decoration[] }
*/
let activeLineMarkers = [];

export function activate()
{
  // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
  subscriptions = new CompositeDisposable();
  
  // Register command that toggles this view
  // subscriptions.add(atom.commands.add('atom-workspace',
  //   {
  //     'better-spellcheck:suggestions': () => toggle()
  //   }));

  // delay the spellcheck for 1500ms
  setTimeout(() =>
  {
    init();
  }, 1500);
}

export function deactivate()
{
  // console.log('better-spellcheck is deactivated');

  // TODO Remove all markers and line markers

  subscriptions.dispose();
}

/**
*/
function init()
{

}

/** scan all files in all opened projects
*/
function scanProjects()
{
  const directories = atom.project.getDirectories();

  for (let i = 0; i < directories.length; i++)
  {
    checkDirectory(
      directories[i].getPath(),
      [ '**/node_modules/**', '**/.git/**', '**/package-lock.json' ]
    ).then((files) =>
    {
      console.log(files);
    });
  }
}

/** walk through a directory and get all files,
* @param { string } directory
* @param { string[] } glob
*/
function checkDirectory(directory)
{
  return new Promise((resolve) =>
  {
    glob('**/**', {
      cwd: directory,
      absolute: true,
      dot: true,
      // .ADD read the config for the ignore paths there
      ignore: glob,
    }).then((files) => resolve(files));
  });
}

/**
*/
function toggle()
{
  // // console.log('better-spellcheck is toggled');

  // const editor = atom.workspace.getActiveTextEditor();
  // const editorView = atom.views.getView(editor);
  // const editorViewComponent = editorView.getComponent();

  // // atom.grammars.selectGrammar

  // // get the language
  // // console.log(editor.getGrammar().name);
 
  // const markerLayer = editor.addMarkerLayer();

  // editor.decorateMarkerLayer(markerLayer, { type: 'highlight', class: 'better-spellcheck-typo' });

  // const range = editor.getSelectedBufferRange();
  // const rangeString = editor.getTextInBufferRange(range);

  // const marker = markerLayer.markBufferRange(editor.getSelectedBufferRange());

  // const gutters = editor.getGutters();

  // /** @type { Decoration }
  // */
  // let lineMarker;

  // if (gutters.length > 2)
  //   lineMarker = gutters[2].decorateMarker(marker, { type: 'highlight', class: 'better-spellcheck-gutter' });

  // requestAnimationFrame(() =>
  // {
  //   // .FIX can easily be broken if another extension/theme plays with editor views, or atom updates their layout
  //   // but for now it works flawlessly
  //   const editorScrollViewElement = editorView.lastChild.lastChild.firstChild;

  //   const startPosition = editorViewComponent.pixelPositionForScreenPosition(marker.getStartScreenPosition());

  //   const a = document.createElement('div');
  //   a.classList.add('better-spellcheck-suggestionsConstrainer');

  //   a.style.left = `${startPosition.left}px`;
  //   a.style.top = `${(startPosition.top + editor.getLineHeightInPixels())}px`;

  //   const b = document.createElement('div');
  //   b.classList.add('better-spellcheck-suggestion');

  //   document.body.onclick = () =>
  //   {
  //     console.log('clicked body');

  //     a.remove();
  //   };

  //   b.onmousedown = (event) =>
  //   {
  //     console.log('clicked b');

  //     event.preventDefault();
  //     event.stopImmediatePropagation();

  //     lineMarker.destroy();
  //     marker.destroy();
  //   };

  //   b.textContent = `Add: "${rangeString}" to dictionary`;

  //   a.appendChild(b);

  //   editorScrollViewElement.appendChild(a);
  // });

  // // get the word under cursor buffer
  // editor.getLastCursor().getCurrentWordBufferRange();

  // if (editor)
  //   editor.insertText('Hello, World!');
}