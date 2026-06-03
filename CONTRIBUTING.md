# Contributing to skillport

Thanks for helping make agent skills portable! Contributions of all sizes are
welcome — new rules, bug fixes, docs, and real-world skills that expose gaps.

## Development setup

```bash
npm install      # project-local; never use -g
npm run check    # typecheck (no emit)
npm test         # build tests + run the node:test suite
npm run demo     # run skillport on its own fixtures
```

Node >= 20. There are no runtime dependencies — keep it that way. Dev
dependencies are limited to TypeScript and `@types/node`.

## Adding a rule

Rules live in [`src/rules.ts`](./src/rules.ts) and are declared with the
`defineRule` factory. A good rule:

1. **Is grounded in documentation.** Every rule carries a `sourceUrl` pointing at
   the authoritative Claude Code / Codex / Agent Skills page that establishes the
   incompatibility. No source, no rule.
2. **Names the affected agents precisely.** Only flag the agents that actually
   break or degrade — not "all" by reflex.
3. **Picks an honest severity.** `error` = the skill will not work there;
   `warning` = behavior may differ. Don't inflate.
4. **Gives an actionable `fix`.** Tell the author what to change.
5. **Ships with tests.** Add a positive and a negative case to
   [`src/rules.test.ts`](./src/rules.test.ts), and make sure the "a clean,
   portable skill triggers no rules" test still passes.

## Testing

All tests use the built-in `node:test` runner. Keep rule tests pure (construct
`ParsedSkill` objects directly); reserve filesystem fixtures for the parser and
CLI integration tests.

```bash
npm test
```

## Pull requests

- Keep changes focused and the diff readable.
- Update `CHANGELOG.md` under `[Unreleased]`.
- Make sure `npm run check` and `npm test` are green; CI runs both.

## Scope

skillport v0.1 is intentionally **static**. Behavioral cross-agent testing
(actually running a skill on `claude -p` / `codex exec` and comparing outcomes)
is planned separately — discuss in an issue before building it here.
