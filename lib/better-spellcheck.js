'use babel';

/* eslint-disable no-undef */

import { CompositeDisposable } from 'atom';

import { readFile } from 'fs';
import { join } from 'path';

import nspell from 'nspell';

import minimatch from 'minimatch';

/** @typedef { import('atom').TextEditor } TextEditor
*/

/** @typedef { import('atom').Gutter } Gutter
*/

/** @typedef { import('atom').DisplayMarkerLayer } DisplayMarkerLayer
*/

/** @typedef { import('atom').Marker } Marker
*/

/** @typedef { import('atom').Decoration } Decoration
*/

/** @typedef { import('nspell') } NSpell
*/

/** a regex that can find a word in a haystack
*
* Group (1) (camelCase)
* ([A-Z][a-z]+)
* match words that start with uppercase letter
* is[Word]
*
* Group (2)
* ([a-z]+)
* match all lowercase words
* [is]Word
*
* Group (3) (AllCaps)
* ([A-Z]+(?=[A-Z][a-z]+))
* match all caps words
* [ALL]Caps
*/
const wordRegex = /([A-Z][a-z]+)|([a-z]+)|([A-Z]+(?=[A-Z][a-z]+))/g;

/** @typedef { Object } ActiveEditor
* @property { DisplayMarkerLayer } markerLayer
* @property { Gutter } gutter
* @property { Object<string, string[]> } misspelled
*/

/** @type { NSpell }
*/
let spell;

/** @type { string[] }
*/
let enabledGrammars;

/** @type { string[] }
*/
let globPatterns;

/** @type { number }
*/
let characterLimit;

/** @type { CompositeDisposable }
*/
let subscriptions;

/** @type { Object<string, ActiveEditor> }
*/
const activeEditors = {};

export function activate()
{
  // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
  subscriptions = new CompositeDisposable();

  // Register the command (keybind) to a function
  subscriptions.add(atom.commands.add('atom-text-editor:not([mini])',
    {
      'better-spellcheck:corrections': toggle
    }));

  // delay the initialization for 1500ms
  // gives atom time to finish loading
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
  // load configuration
  enabledGrammars = atom.config.get('better-spellcheck.enabledGrammars');
  globPatterns = atom.config.get('better-spellcheck.ignorePaths');
  characterLimit = atom.config.get('better-spellcheck.characterLimit');

  // load the en_US affix file
  readFile(join(__dirname, '../dictionaries/index.aff'), (err, aff) =>
  {
    if (err)
      throw new Error('Couldn\'t load the en_US dictionary, better-spellcheck won\'t activate');

    // load the en_US & cSpell dictionary file
    readFile(join(__dirname, '../dictionaries/cspell.dic'), (err, dic) =>
    {
      if (err)
        throw new Error('Couldn\'t load the en_US dictionary, better-spellcheck won\'t activate');

      spell = nspell(aff, dic);

      // load the user's personal dictionary
      /** @type { string[] }
      */
      const personal = atom.config.get('better-spellcheck.personal');

      if (personal)
        spell.personal(personal.join('\n'));

      subscriptions.add(atom.textEditors.observe(observeEditor));
    });
  });
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

  const gutters = editor.getGutters();

  const markerLayer = editor.addMarkerLayer();

  editor.decorateMarkerLayer(markerLayer, { type: 'highlight', class: 'better-spellcheck-typo' });

  activeEditors[editor.getPath()] = {
    // code that can be broken between different installs of atom
    gutter: (gutters.length > 1) ? gutters[1] : undefined,
    markerLayer: markerLayer
  };

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
    activeEditors[editor.getPath()].markerLayer.destroy();

    activeEditors[editor.getPath()] = undefined;

    subscriptions.remove(disposable);

    disposable.dispose();
  }));

  // trigger first time spellcheck
  spellcheck(editor);
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
  return new Promise((resolve, reject) =>
  {
    const activeEditor = activeEditors[editor.getPath()];

    // if the editor isn't being observed, then why spellcheck it
    if (!activeEditor)
    {
      reject();

      return;
    }

    // reset the misspelled cache
    activeEditor.misspelled = {};

    // scan the entire editor for word using our word regex
    editor.scan(wordRegex, (result) =>
    {
      const word = result.matchText;

      // if the word is misspelled
      if (!spell.correct(word))
      {
        // mark the word
        const marker = activeEditor.markerLayer.markBufferRange(result.range);
  
        // mark the line
        activeEditor.gutter.decorateMarker(marker, { type: 'highlight', class: 'icon icon-nuclicon-warning better-spellcheck-gutter' });

        // cache it with its corrections
        if (!activeEditor.misspelled[word])
          activeEditor.misspelled[word] = spell.suggest(word);
      }
    });

    // resolve the promise
    resolve();
  });
}

function toggle()
{
  // ADD check if  the editor is being spellchecked in the activeEditors object

  // console.log(editor.getWordUnderCursor({
  //   wordRegex: wordRegex
  // }));
    
  // ADD find the maker in the that word range
  // activeEditor.markerLayer.findMarkers({ containedInBufferRange });

  // ADD if the word is in misspelled then show its corrections

  // requestAnimationFrame(() =>
  // {

  //   const editor = atom.workspace.getActiveTextEditor();
  //   const editorView = atom.views.getView(editor);
  //   const editorViewComponent = editorView.getComponent();

  //   // .FIX can easily be broken if another extension/theme plays with editor views, or atom updates their layout
  //   // but for now it works flawlessly
  //   const editorScrollViewElement = editorView.lastChild.lastChild.firstChild;

  //   const startPosition = editorViewComponent.pixelPositionForScreenPosition(marker.getStartScreenPosition());

  //   const a = document.createElement('div');
  //   a.classList.add('better-spellcheck-correctionsConstrainer');

  //   a.style.left = `${startPosition.left}px`;
  //   a.style.top = `${(startPosition.top + editor.getLineHeightInPixels())}px`;

  //   const b = document.createElement('div');
  //   b.classList.add('better-spellcheck-correction');

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