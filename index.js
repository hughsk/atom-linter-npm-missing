exports.provideLinter = function () {
  return {
    name: 'npm-missing-packages',
    scope: 'file',
    lintsOnChange: false,
    grammarScopes: ['source.js', 'source.js.jsx'],
    lint: lint
  }

  function lint (editor) {
    const content = editor.getText()
    const file = editor.getPath()

    return new Promise(function (resolve, reject) {
      check(file, content, editor, function (err, results) {
        if (err) return reject(err)
        resolve(results)
      })
    })
  }
}

const parseOpts = {
  ecmaVersion: 6,
  sourceType: 'module',
  allowReserved: true,
  allowReturnOutsideFunction: true,
  allowHashBang: true,
  plugins: { jsx: true }
}

function check (file, content, editor, next) {
  const detect = require('detect-import-require')
  const acorn = require('acorn-jsx')
  const resolve = require('resolve')
  const map = require('map-limit')
  const path = require('path')

  try {
    var ast = acorn.parse(content, parseOpts)
    var detected = detect.find(ast)
  } catch (e) { return next() }

  map(detected.strings, 5, function (target, next) {
    resolve(target, {
      basedir: path.dirname(file)
    }, function (err, resolved) {
      next(null, err && target)
    })
  }, function (err, results) {
    if (err) return next(err)

    const ranges = results.map(function (found, i) {
      if (!found) return

      const name = detected.strings[i]
      const node = detected.nodes[i]

      return {
        name: name,
        start: node.start,
        end: node.end
      }
    }).filter(Boolean).sort(function (a, b) {
      return a.start - b.start
    })

    if (!ranges.length) return next()

    const lines = content.split(/\n/g)
    const lintErrors = []

    var currRange = 0
    var currIndex = 0
    for (var i = 0; i < lines.length && currRange < ranges.length; i++) {
      var currNode = ranges[currRange]
      var prevIndex = currIndex
      var nextLineLength = lines[i].length

      currIndex += nextLineLength + 1
      if (currIndex <= currNode.start) continue

      var column = currNode.start - prevIndex
      var endColumn = column + currNode.end - currNode.start
      var row = i

      currRange++
      lintErrors.push({
        type: 'Error',
        text: 'Could not locate module "' + currNode.name + '"',
        range: [[row, column], [row, endColumn]],
        filePath: file
      })
    }

    return next(null, lintErrors)
  })
}
