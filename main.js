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
      Commands = brackets.getModule('command/Commands'),
      CommandManager = brackets.getModule('command/CommandManager'),
      CodeInspection = brackets.getModule('language/CodeInspection'),
      EditorManager = brackets.getModule('editor/EditorManager'),
      ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
      Menus = brackets.getModule('command/Menus'),
      NodeDomain = brackets.getModule('utils/NodeDomain'),
      PreferencesManager = brackets.getModule('preferences/PreferencesManager');

  var closureLinter = new NodeDomain('closureLinter',
      ExtensionUtils.getModulePath(module, 'node/closureLinterDomain'));

  var $DocumentManager = $(DocumentManager);

  var fixjsstyleCommand = CommandManager.register(
      'Fixjsstyle', FIXJSSTYLE_ID, fixjsstyleAsync),
      fixjsstyleOnSaveCommand = CommandManager.register(
      'Fixjsstyle On Save', FIXJSSTYLE_ONSAVE_ID, function() {
        setFixjsstyleOnSave(!this.getChecked());
      });

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
    var deferred = new $.Deferred();
    closureLinter.exec('gjslint', text, filePath)
    .done(function(stdout) {
          deferred.resolve({errors: parseGjslintStdout(stdout)});
        })
    .fail(function(error, message) {
          console.error(EXTENSION_ID + ': error when running gjslint',
                        error, message);
        });
    return deferred.promise();
  }

  /**
   * Makes an asyncrhonous call to fixjsstyle on the potentially unsaved text.
   * @return {$.Promise} Promise to return text with fixed style.
   */
  function fixjsstyleAsync() {
    var deferred = new $.Deferred(),
        editor = EditorManager.getCurrentFullEditor(),
        filePath = EditorManager.getCurrentlyViewedPath();
    if (editor && filePath) {
      var text = editor.document.getText(),
          cursor = editor.getCursorPos(),
          scroll = editor.getScrollPos(),
          language = editor.document.getLanguage().getId();
      if (language === 'javascript' || language === 'html') {
        closureLinter.exec('fixjsstyle', text, filePath)
        .done(function(styledText) {
              // TODO: Think of a constant time way to do this check.
              if (styledText != text) {
                // TODO: Use a diff library to compute changes.
                editor.document.setText(styledText);
                editor.setCursorPos(cursor);
                editor.setScrollPos(scroll.x, scroll.y);
              }
              deferred.resolve();
            })
        .fail(function(error, message) {
              console.error(EXTENSION_ID + ': error when running fjxjsstyle',
                            error, message);
              deferred.reject();
            });
      }
      return deferred.promise();
    }
  }

  /**
   * Runs fixjsstyle and then re-saves the document.
   * @param {!Object} event DocumentSaved event that triggered function.
   * @param {Document} document Brackets document being saved.
   */
  function fixjsstyleOnSave(event, document) {
    fixjsstyleAsync().done(function() {
      $DocumentManager.off('documentSaved', fixjsstyleOnSave);
      CommandManager.execute(Commands.FILE_SAVE, {doc: document});
      $DocumentManager.on('documentSaved', fixjsstyleOnSave);
    });
  }

  /**
   * Turns Fixjsstyle On Save command on or off.
   * @param {Boolean} value True turns command on and vice versa.
   */
  function setFixjsstyleOnSave(value) {
    $DocumentManager[value ? 'on' : 'off']('documentSaved', fixjsstyleOnSave);
    fixjsstyleOnSaveCommand.setChecked(value);
    PreferencesManager.set(FIXJSSTYLE_ONSAVE_ID, value);
    PreferencesManager.save();
  }

  AppInit.appReady(function() {
    var editMenu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
    editMenu.addMenuDivider();
    editMenu.addMenuItem(FIXJSSTYLE_ID, FIXJSSTYLE_SHORTCUT);
    editMenu.addMenuItem(FIXJSSTYLE_ONSAVE_ID);
    setFixjsstyleOnSave(PreferencesManager.get(FIXJSSTYLE_ONSAVE_ID));
    CodeInspection.register('javascript', {
      name: GJSLINT_ID,
      scanFileAsync: gjslintAsync
    });
  });
});
