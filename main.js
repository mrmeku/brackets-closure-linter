define(function(require, exports, module) {
  'use strict';

  var EXTENSION_ID = 'com.github.mrmeku.closure-linter',
      GJSLINT_ID = EXTENSION_ID + '.gjslint',
      FIXJSSTYLE_ID = EXTENSION_ID + '.fixjsstyle',
      FIXJSSTYLE_ONSAVE_ID = FIXJSSTYLE_ID + '.onSave',
      FIXJSSTYLE_SHORTCUT = [{
        key: 'Ctrl-Shift-J',
        platform: 'win'
      }, {
        key: 'Cmd-Shift-J',
        platform: 'mac'
      }],
      LINT_ERROR_REGEXP = new RegExp('^Line (\\d+), ([E,W])(:[\\d]+: (.*))$');

  var AppInit = brackets.getModule('utils/AppInit'),
      DocumentManager = brackets.getModule('document/DocumentManager'),
      CommandManager = brackets.getModule('command/CommandManager'),
      CodeInspection = brackets.getModule('language/CodeInspection'),
      EditorManager = brackets.getModule('editor/EditorManager'),
      ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
      Menus = brackets.getModule('command/Menus'),
      NodeDomain = brackets.getModule('utils/NodeDomain'),
      PreferencesManager = brackets.getModule('preferences/PreferencesManager');

  // Access to node process with hooks to closure linter.
  var closureLinter = new NodeDomain('closureLinter',
      ExtensionUtils.getModulePath(module, 'node/closureLinterDomain'));

  // Make DocumentManager into a jquery object for event binding.
  var $DocumentManager = $(DocumentManager);

  // Register commands to be made into menu items.
  var fixjsstyleCommand = CommandManager.register(
      'Fixjsstyle', FIXJSSTYLE_ID, fixjsstyleAsync),
      fixjsstyleOnSaveCommand = CommandManager.register(
      'Fixjsstyle On Save', FIXJSSTYLE_ONSAVE_ID, function() {
        setFixjsstyleOnSave(!this.getChecked());
      });

  // Brackets only supports one linting instance at a time so we stop any
  // that are midprogress when the linter is invoked.
  var gjslintDeferred = new $.Deferred();

  /**
   * Creates array of linting error objects from stdout of gjslint.
   * @param {string} output Stdout produced by gjslint.
   * @return {Array.<Object>} Array of brackets lint error objects.
   */
  function parseGjslintStdout(stdout) {
    var lines = stdout.split('\n'),
        lintingErrors = [];
    lines.forEach(function(line) {
      var match = LINT_ERROR_REGEXP.exec(line);
      if (match) {
        lintingErrors.push({
          pos: {line: parseInt(match[1], 10) - 1},
          message: match[2] + match[3],
          type: match[2] === 'E' ?
              CodeInspection.Type.ERROR : CodeInspection.Type.WARNING
        });
      }
    });
    return lintingErrors;
  }

  /**
   * Makes an asynchronous call to gjslint on the potentially unsaved text.
   * @param {string} text Text content of the potentially unsaved file.
   * @param {string} filePath Path to the potentially unsaved file being linted.
   * @return {$.Promise} Promise to return an object mapping to an array of
   *     linting errors.
   */
  function gjslintAsync(text, filePath) {
    gjslintDeferred.resolve();
    gjslintDeferred = new $.Deferred();
    closureLinter.exec('gjslint', text, filePath)
      .done(function(stdout) {
          gjslintDeferred.resolve({errors: parseGjslintStdout(stdout)});
        })
      .fail(function(error, message) {
          gjslintDeferred.reject(error, message);
        });
    return gjslintDeferred.promise();
  }


  /**
   * Makes an asyncrhonous call to fixjsstyle on the potentially unsaved text.
   * @return {$.Promise} Promise to return text with fixed style.
   */
  function fixjsstyleAsync() {
    var editor = EditorManager.getCurrentFullEditor(),
        filePath = EditorManager.getCurrentlyViewedPath();
    if (editor && filePath) {
      var document = editor.document,
          text = document.getText(),
          cursor = editor.getCursorPos(),
          scroll = editor.getScrollPos(),
          language = document.getLanguage().getId();
      // Only fix the style of javascript or html script tags
      if (language === 'javascript' || language === 'html') {
        // Get a reference incase something happends during async command.
        document.addRef();
        return closureLinter.exec('fixjsstyle', text, filePath)
        .done(function(styledText) {
              if (styledText !== text) {
                editor.document.setText(styledText);
              }
            })
        .always(function() {
              editor.setScrollPos(scroll.x, scroll.y);
              editor.setCursorPos(cursor.line, cursor.ch);
              document.releaseRef();
            });
      }
    }
  }


  /**
   * Turns Fixjsstyle On Save command on or off.
   * @param {Boolean} checked True turns command on and vice versa.
   */
  function setFixjsstyleOnSave(checked) {
    $DocumentManager[checked ? 'on' : 'off'](
        'documentSaved', fixjsstyleAsync);
    fixjsstyleOnSaveCommand.setChecked(checked);
    PreferencesManager.set(FIXJSSTYLE_ONSAVE_ID, checked);
    PreferencesManager.save();
  }


  AppInit.appReady(function() {
    // Set up fixjsstyle menu items.
    var editMenu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
    editMenu.addMenuDivider();
    editMenu.addMenuItem(FIXJSSTYLE_ID, FIXJSSTYLE_SHORTCUT);
    editMenu.addMenuItem(FIXJSSTYLE_ONSAVE_ID);
    // Restore previous menu preferences.
    setFixjsstyleOnSave(PreferencesManager.get(FIXJSSTYLE_ONSAVE_ID));
    // Register gjslint to lint javascript and html files.
    CodeInspection.register('javascript', {
      name: GJSLINT_ID,
      scanFileAsync: gjslintAsync
    });
    CodeInspection.register('html', {
      name: GJSLINT_ID,
      scanFileAsync: gjslintAsync
    });
  });
});
