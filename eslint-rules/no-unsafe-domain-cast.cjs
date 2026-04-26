'use strict'

const ts = require('typescript')

/**
 * no-unsafe-domain-cast
 *
 * Disallow `X as unknown as <T>` where `<T>` is a type defined in our codebase
 * (i.e. its declaration's source file does NOT live under `node_modules/`).
 *
 * The double-cast through `unknown` bypasses TypeScript's structural compatibility
 * check. This is the bug pattern that hid the `course.id` vs `course._id` typo
 * (commit 2bbf3b7, 2026-04-26) — the cast made the partial stub typecheck-clean
 * locally while CI's fresh build correctly rejected it.
 *
 * For our own domain types, the safe alternative is `unsafeCast<T>(partial, reason)`
 * (defined in `@elearn-studio/shared-types`), which types the input as `Partial<T>`
 * — TS rejects field-name typos there.
 *
 * For external library types (Component, Editor, Window, Event, Response, ...),
 * the cast is often a coping mechanism for complex types we cannot construct
 * directly. Those are NOT flagged by this rule (provenance check against
 * `node_modules/` allows them).
 *
 * Escape hatch when the helper does NOT fit (e.g. testing intentionally malformed
 * input, or narrowing an opaque `unknown`):
 *
 *     // eslint-disable-next-line no-unsafe-domain-cast -- <one-line reason>
 *     const x = ({ ... } as unknown as DomainType)
 *
 * See decisions/2026-04-26-as-unknown-as-test-stub-cast.md for the full ADR.
 *
 * Phase 1 (this rule's initial scope per `.eslintrc.cjs`): test files only.
 * Phase 2 will extend coverage to production code.
 *
 * Implementation notes:
 *   - Rule is type-aware (requires `parserOptions.project` in eslintrc).
 *   - If parserServices is missing (rule loaded against a non-TS-aware config),
 *     the rule silently no-ops rather than producing false negatives quietly:
 *     callers who want enforcement must enable type-aware linting.
 *   - We resolve the symbol of the target type's name and inspect its first
 *     declaration's source file. `node_modules/` substring → external → allow.
 *     Anything else → ours → flag.
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow `as unknown as <T>` for types defined in our codebase. ' +
        'Use `unsafeCast<T>(partial, reason)` from @elearn-studio/shared-types ' +
        'or construct the real shape.',
      recommended: false,
    },
    schema: [],
    messages: {
      unsafeDomainCast:
        'Avoid `as unknown as {{typeName}}` — `{{typeName}}` is defined in our codebase. ' +
        'Use `unsafeCast<{{typeName}}>(partial, reason)` from @elearn-studio/shared-types, ' +
        'construct the real shape, or add an eslint-disable comment with a one-line reason ' +
        'if neither path fits (see decisions/2026-04-26-as-unknown-as-test-stub-cast.md).',
    },
  },

  create(context) {
    const services = context.parserServices
    if (!services || !services.program || !services.esTreeNodeToTSNodeMap) {
      // Type-aware linting not enabled. Rule is a no-op rather than producing
      // misleading "no problems" reports — the absence of warnings here does
      // not mean the codebase is clean of the pattern.
      return {}
    }
    const checker = services.program.getTypeChecker()

    /**
     * Extract a printable name from a TS type name node.
     * Handles Identifier (`Foo`) and TSQualifiedName (`ns.Foo`).
     */
    function printTypeName(typeNameNode) {
      if (!typeNameNode) return null
      if (typeNameNode.type === 'Identifier') return typeNameNode.name
      if (typeNameNode.type === 'TSQualifiedName') {
        const left = printTypeName(typeNameNode.left)
        const right = printTypeName(typeNameNode.right)
        return left && right ? `${left}.${right}` : null
      }
      return null
    }

    /**
     * Check whether a type annotation references a type defined in our codebase.
     * Returns the printable type name if it is OUR type, null otherwise.
     *
     * Drills into TSArrayType so `as unknown as Foo[]` is treated like `as unknown as Foo`.
     */
    function ourTypeName(typeAnnotation) {
      if (!typeAnnotation) return null

      let target = typeAnnotation
      if (target.type === 'TSArrayType') {
        target = target.elementType
      }
      if (target.type !== 'TSTypeReference') return null

      const idNode = target.typeName
      const tsNode = services.esTreeNodeToTSNodeMap.get(idNode)
      if (!tsNode) return null

      let symbol = checker.getSymbolAtLocation(tsNode)
      if (!symbol) return null

      // Imported types resolve to an Alias symbol whose first declaration is
      // the local ImportSpecifier (in OUR file). Follow the alias chain to the
      // actual definition before checking provenance — otherwise every
      // imported external type would be misclassified as "ours".
      while (symbol && symbol.flags & ts.SymbolFlags.Alias) {
        const next = checker.getAliasedSymbol(symbol)
        if (!next || next === symbol) break
        symbol = next
      }
      if (!symbol) return null

      const decls = symbol.getDeclarations()
      if (!decls || decls.length === 0) return null

      // If ANY declaration is external, treat as external (covers ambient
      // augmentations of library types); flag only when ALL declarations live
      // in our codebase.
      const allOurs = decls.every((d) => {
        const f = d.getSourceFile().fileName
        return f && !f.includes('node_modules')
      })
      if (!allOurs) return null

      return printTypeName(idNode)
    }

    return {
      // `expr as unknown as T` is parsed as TSAsExpression nesting:
      //   outer.typeAnnotation = T
      //   outer.expression     = TSAsExpression { typeAnnotation: TSUnknownKeyword }
      'TSAsExpression[expression.type="TSAsExpression"][expression.typeAnnotation.type="TSUnknownKeyword"]'(
        node,
      ) {
        const typeName = ourTypeName(node.typeAnnotation)
        if (!typeName) return
        context.report({
          node,
          messageId: 'unsafeDomainCast',
          data: { typeName },
        })
      },
    }
  },
}
