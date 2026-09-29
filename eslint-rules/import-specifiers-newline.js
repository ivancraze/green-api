export default {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    messages: {
      separate: 'Place each imported name on its own line when importing more than three names.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode

    return {
      ImportDeclaration(node) {
        const specifiers = node.specifiers.filter((specifier) => specifier.type === 'ImportSpecifier')
        if (specifiers.length <= 3) return

        for (let index = 1; index < specifiers.length; index++) {
          const previous = specifiers[index - 1]
          const current = specifiers[index]
          if (previous.loc.end.line !== current.loc.start.line) continue

          context.report({
            node: current,
            messageId: 'separate',
            fix(fixer) {
              const comma = sourceCode.getTokenBefore(current)
              if (comma.value !== ',' || sourceCode.text.slice(comma.range[1], current.range[0]).trim()) return null
              return fixer.replaceTextRange([comma.range[1], current.range[0]], '\n')
            },
          })
        }
      },
    }
  },
}
