define(function(require, exports, module) {
  'use strict';

  // Constants.
  var GJSLINT_ID = 'mrmeku.closurelinter.gjslint',
      FIXJSSTYLE_ID = 'mrmeku.closurelinter.fixjsstyle',
      FIXJSSTYLE_TIMESTAMP_ID = FIXJSSTYLE_ID + '.timestamp',
      FIXJSSTYLE_SHORTCUT = [{
        key: 'Ctrl-Shift-J',
        platform: 'win'
      }, {
        key: 'Cmd-Shift-J',
        platform: 'mac'
      }],
      LINT_ERROR_REGEXP = new RegExp('^Line (\\d+), ([E,W])(:[\\d]+: (.*))$');

  // Brackets module imports.
  var AppInit = brackets.getModule('utils/AppInit'),
      CommandManager = brackets.getModule('command/CommandManager'),
      CodeInspection = brackets.getModule('language/CodeInspection'),
      EditorManager = brackets.getModule('editor/EditorManager'),
      ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
      Menus = brackets.getModule('command/Menus'),
      NodeDomain = brackets.getModule('utils/NodeDomain');

  // Node domain with which to execute the closure linter.
  var closureLinter = new NodeDomain('closureLinter',
      ExtensionUtils.getModulePath(module, 'node/closureLinterDomain'));

  /**
   * Creates array of linting error objects from stdout of gjslint.
   * @param {string} output Stdout of gjslint.
   * @return {Array.<Object>} Array of brackets lint error objects.
   */
  function parseGjslintOutput(output) {
    var lines = output.split('\n'),
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
   * @return {!$.Promise} Promise to return an object mapping to an array of
   *     linting errors.
   */
  function gjslintAsync(text, filePath) {
    var deferred = new $.Deferred();
    closureLinter.exec('gjslint', text, filePath)
    .done(function(output) {
          deferred.resolve({errors: parseGjslintOutput(output)});
        })
    .fail(function(error, message) {
          console.error('Closure linter: error when running gjslint',
                        error, message);
        });
    return deferred;
  }

  /**
   * Makes an asyncrhonous call to fixjsstyle on the potentially unsaved text.
   * @return {!$.Promise} Promise to return text with fixed style.
   */
  function fixjsstyleAsync() {
    var deferred = new $.Deferred(),
        editor = EditorManager.getCurrentFullEditor(),
        filePath = EditorManager.getCurrentlyViewedPath();
    if (editor && filePath) {
      var text = editor.document.getText(),
          cursor = editor.getCursorPos(),
          scroll = editor.getScrollPos(),
          fileType = editor.document.getLanguage().getId();
      if (fileType === 'javascript' || fileType === 'html') {
        closureLinter.exec('fixjsstyle', text, filePath)
        .done(function(styledText) {
              console.log('hi');
              editor.document.setText(styledText);
              editor.setCursorPos(cursor);
              editor.setScrollPos(scroll.x, scroll.y);
              deferred.resolve();
            })
        .fail(function(error, message) {
              console.error('Closure linter: error when running fjxjsstyle',
                            error, message);
            });
      }
    }
  }

  function fixjsstyleOnSave(event, document) {
    if ((event.timeStamp - localStorage.getItem(COMMAND_TIMESTAMP)) > 1000) {
      fixjsstyleAsync().done(function() {
        localStorage.setItem(COMMAND_TIMESTAMP, event.timeStamp);
        CommandManager.execute(Commands.FILE_SAVE, {
          doc: document
        });
      });
    }
  }

  AppInit.appReady(function() {
    CommandManager.register('Run fixjsstyle', FIXJSSTYLE_ID, fixjsstyleAsync);
    var editMenu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
    editMenu.addMenuDivider();
    editMenu.addMenuItem(FIXJSSTYLE_ID, FIXJSSTYLE_SHORTCUT);
    // TODO: Add fixjsstyle onsave menu item.
    CodeInspection.register('javascript', {
      name: GJSLINT_ID,
      scanFileAsync: gjslintAsync
    });
  });
});
