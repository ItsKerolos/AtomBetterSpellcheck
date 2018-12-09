'use babel';

/* eslint-disable no-undef */

import { CompositeDisposable } from 'atom';

import { readFile } from 'fs';
import { join } from 'path';

import nodeHun from 'nodehun';

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

* Group (4) (ALL_CAPS)
* ([A-Z]+)
* match all caps words
* [ALL]_[CAPS]
*/
const wordRegex = /([A-Z][a-z]+)|([a-z]+)|([A-Z]+(?=[A-Z][a-z]+))|([A-Z]+)/g;

/** @typedef { Object } ActiveEditor
* @property { DisplayMarkerLayer } markerLayer
* @property { Gutter } gutter
* @property { Object<string, string[]> } misspelled
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
      'better-spellcheck:corrections': showCorrections
    }));

  // delay the initialization for 1500ms
  // gives atom time to finish loading
  setTimeout(init, 500);
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
      throw new Error('Couldn\'t load the en_US affix, better-spellcheck won\'t activate');

    // load the en_US & cSpell dictionary file
    readFile(join(__dirname, '../dictionaries/cspell.dic'), (err, dic) =>
    {
      if (err)
        throw new Error('Couldn\'t load the en_US dictionary, better-spellcheck won\'t activate');

      // load the user's personal dictionary
      /** @type { string[] }
      */
      const personal = atom.config.get('better-spellcheck.personal');

      // addDictionary isn't working for some reason,
      // so this is a workaround for merging two dictionaries
      if (personal && personal.length > 0)
      {
        let string = dic.toString();
        let length = string.substring('0', string.indexOf('\n'));

        string = string.substring(length.length);

        length = parseInt(length) + personal.length;

        string = length + string + personal.join('\n');

        dic = Buffer.from(string);
      }

      nodeHun.createNewNodehun(aff, dic, (err, dictionary) =>
      {
        spell = dictionary;

        subscriptions.add(atom.textEditors.observe(observeEditor));
      });
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

  const gutter = editor.addGutter({ type: 'decorated' });
  const markerLayer = editor.addMarkerLayer();

  editor.decorateMarkerLayer(markerLayer, { type: 'highlight', class: 'better-spellcheck-typo' });

  activeEditors[editor.getPath()] = {
    gutter: gutter,
    markerLayer: markerLayer
  };

  // when editor's buffer changes
  disposable.add(editor.onDidChange(() =>
  {
    if (spellcheckTimeout)
      clearTimeout(spellcheckTimeout);

    // delay the spellcheck for 1500ms to make sure the user ain't still typing
    spellcheckTimeout = setTimeout(() => spellcheck(editor), 1500);
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
  return new Promise((resolve) =>
  {
    const activeEditor = activeEditors[editor.getPath()];

    // if the editor isn't being observed, then why spellcheck it
    if (!activeEditor)
      return;

    // clear the previous marker
    activeEditor.markerLayer.clear();

    // reset the misspelled cache
    activeEditor.misspelled = {};

    // scan the entire editor for word using our word regex
    editor.scan(wordRegex, (result) =>
    {
      const word = result.matchText;

      spell.spellSuggestions(word, (err, correct, corrections) =>
      {
        if (!correct)
        {
          // mark the word
          const marker = activeEditor.markerLayer.markBufferRange(result.range);

          // mark the line
          activeEditor.gutter.decorateMarker(marker, { type: 'highlight', class: 'icon icon-light-bulb better-spellcheck-gutter' });

          // cache it with its corrections
          if (!activeEditor.misspelled[word])
            activeEditor.misspelled[word] = corrections;
        }
      });

      // resolve the promise
      resolve();
    });
  });
}

function showCorrections()
{
  return new Promise((resolve) =>
  {
    // the current active/selected editor
    const editor = atom.workspace.getActiveTextEditor();
    
    const activeEditor = activeEditors[editor.getPath()];

    // if the editor isn't being observed, then why spellcheck it
    if (!activeEditor)
      return;

    // get last cursor then using the word regex,
    // get the range of the word that is under the cursor
    const wordRange = editor.getLastCursor().getCurrentWordBufferRange({
      wordRegex: wordRegex
    });

    // if the word range is null or,
    // if the range starts and ends in the same point
    // then we can't get the word
    if (!wordRange || wordRange.start === wordRange.end)
      return;

    // using the word range get the word's string
    const word = editor.getTextInBufferRange(wordRange);

    // if the word isn't misspelled, then we don't need to do anything
    if (!activeEditor.misspelled[word])
      return;

    // get the marker
    const marker = activeEditor.markerLayer.findMarkers({ containedInBufferRange: wordRange })[0];

    requestAnimationFrame(() =>
    {
      const editor = atom.workspace.getActiveTextEditor();
      const editorView = atom.views.getView(editor);
      const editorViewComponent = editorView.getComponent();

      // can easily be broken if another extension/theme plays with editor views, or atom updates their layout
      const editorScrollViewElement = editorView.lastChild.lastChild.firstChild;

      const startPosition = editorViewComponent.pixelPositionForScreenPosition(marker.getStartScreenPosition());

      const constrainer = document.createElement('div');
      constrainer.classList.add('better-spellcheck-correctionsConstrainer');

      // set the correct position of the constrainer relative to the editor
      constrainer.style.left = `${startPosition.left}px`;
      constrainer.style.top = `${(startPosition.top + editor.getLineHeightInPixels())}px`;

      /** adds a new button to the constrainer
      * @param { string } title
      * @param { () => void } callback
      */
      function addButton(title, callback)
      {
        const button = document.createElement('div');
        button.classList.add('better-spellcheck-correction');

        button.onmousedown = (event) =>
        {
          if (event)
            event.stopImmediatePropagation();

          callback();

          removeConstrainer();
          marker.destroy();
        };

        button.textContent = title;
        
        constrainer.appendChild(button);
      }

      /**  @param { KeyboardEvent } event
      */
      function keydown(event)
      {
        event.stopImmediatePropagation();

        if (event.keyCode === 13)
        {
          constrainer.children.item(constrainer.selectedIndex || 0).onmousedown.apply();

          removeConstrainer();
        }
        else if (event.keyCode === 40)
          navigation(1);
        else if (event.keyCode === 38)
          navigation(-1);
      }

      /** @param { number } direction
      */
      function navigation(direction)
      {
        const index = constrainer.selectedIndex || 0;

        if (constrainer.children.item(index).classList.contains('better-spellcheck-correction-selected'))
          constrainer.children.item(index).classList.remove('better-spellcheck-correction-selected');

        constrainer.selectedIndex = Math.max(Math.min(index + direction, constrainer.children.length - 1), 0);

        constrainer.children.item(constrainer.selectedIndex).classList.add('better-spellcheck-correction-selected');

        constrainer.children.item(constrainer.selectedIndex).scrollIntoView({
          behavior: 'instant',
          inline: 'end',
          block: 'nearest'
        });
      }

      function removeConstrainer()
      {
        constrainer.remove();

        document.body.removeEventListener('mousedown', removeConstrainer);
        document.body.removeEventListener('keydown', keydown);
      }

      document.body.addEventListener('mousedown', removeConstrainer);
      document.body.addEventListener('keydown', keydown);

      // add a button for each correction
      for (let i = 0; i < activeEditor.misspelled[word].length; i++)
      {
        const correction = activeEditor.misspelled[word][i];

        // replace the misspelled word with the correction
        addButton(correction, () => editor.setTextInBufferRange(wordRange, correction));
        addButton(correction, () => editor.setTextInBufferRange(wordRange, correction));
        addButton(correction, () => editor.setTextInBufferRange(wordRange, correction));
      }

      // add a button to allow the user to ignore the misspelled word
      addButton(`Add: "${word}" to dictionary`, () =>
      {
        const current = atom.config.get('better-spellcheck.personal');

        current.push(word);

        atom.config.set('better-spellcheck.personal', current);

        // re-trigger a spellcheck
        spellcheck(editor);
      });

      navigation(0);

      editorScrollViewElement.appendChild(constrainer);

      // resolve the promise
      resolve();
    });
  });
}