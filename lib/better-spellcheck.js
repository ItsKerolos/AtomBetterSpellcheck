'use babel';

/* eslint-disable no-undef */

import { CompositeDisposable } from 'atom';

import minimatch from 'minimatch';

/** @typedef { import('atom').TextEditor } TextEditor
*/

/** @typedef { import('atom').Decoration } Decoration
*/

/** @typedef { import('atom').DisplayMarker } DisplayMarker
*/

// /** @typedef { Object } ActiveEditor
// * @property { CompositeDisposable } disposable
// */

/**  @type { string[] }
*/
const globPatterns = atom.config.get('better-spellcheck.ignorePaths');

/**  @type { number }
*/
const characterLimit = atom.config.get('better-spellcheck.characterLimit');

/**  @type { string[] }
*/
const enabledGrammars = atom.config.get('better-spellcheck.enabledGrammars');

/** @type { CompositeDisposable }
*/
let subscriptions;

// /** @type { Object.<string, ActiveEditor> }
// */
// const activeEditors = {};

// /** @type { DisplayMarker[] }
// */
// const activeMarkers = [];

// /** @type { Decoration[] }
// */
// const activeLineMarkers = [];

export function activate()
{
  // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
  subscriptions = new CompositeDisposable();
  
  // Register the command (keybind) to a function
  subscriptions.add(atom.commands.add('atom-text-editor:not([mini])',
    {
      'better-spellcheck:suggestions': toggle
    }));

  // delay the start for 1500ms, to give the app time to finish loading other stuff
  setTimeout(init, 1500);
}

export function deactivate()
{
  // console.log('better-spellcheck is deactivated');

  // .ADD Remove all markers and line markers

  subscriptions.dispose();
}

function init()
{
  // register the observe editor callback
  subscriptions.add(atom.textEditors.observe(observeEditor));
}

/** observe all new text editors and register them for spellchecking
* @param { TextEditor } editor
*/
function observeEditor(editor)
{
  // do tests to check if the editor should be spellchecked or not
  if (validateEditor(editor))
    return;
  
  const disposable = new CompositeDisposable();
  let spellcheckTimeout;

  // add the editor's callbacks to global subscriptions,
  // so they get disposed if the extension gets disabled
  subscriptions.add(disposable);

  // when editor's buffer changes
  disposable.add(editor.onDidChange(() =>
  {
    if (spellcheckTimeout)
      clearTimeout(spellcheckTimeout);

    // delay the spellcheck for 500ms to make sure the user ain't still typing
    spellcheckTimeout = setTimeout(() => spellcheck(editor), 500);
  }));

  // on closing an editor dispose of its callbacks
  disposable.add(editor.onDidDestroy(() =>
  {
    subscriptions.remove(disposable);
    
    disposable.dispose();
  }));
}

/** do some configurable tests to check if the editor should be spellchecked
* @param { TextEditor } editor
*/
function validateEditor(editor)
{
  // if the file should be ignored because its grammar is not enabled
  if (!enabledGrammars.includes(editor.getGrammar().name.toLowerCase()))
    return true;

  // if the file should be ignored because it meets a max character limit
  if (characterLimit <= editor.getBuffer().getMaxCharacterIndex())
    return true;
 
  // if the file should be ignored because it meets a glob pattern
  for (let i = 0; i < globPatterns.length; i++)
  {
    const pattern = globPatterns[i];
   
    if (minimatch(editor.getPath(), pattern, { dot: true }))
      return true;
  }
}

/** spellcheck a editor
* @param { TextEditor } editor
*/
function spellcheck(editor)
{
  // Group (1)
  // ([A-Z][a-z]+)
  // match words that start with uppercase letter
  // is[Word]

  // Group (2)
  // ([a-z]+)
  // match all lowercase words
  // [is]Word

  // Group (3)
  // ([A-Z]+(?=[A-Z][a-z]+))
  // match all caps words
  // [ALL]Caps

  // # /([A-Z][a-z]+)|([a-z]+)|([A-Z]+(?=[A-Z][a-z]+))/g

  console.log('spellcheck triggered on ' + editor.getPath());
}

function toggle()
{
  console.log('better-spellcheck is toggled');

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