# Contributing to Formspec

Thanks for your interest in contributing to Formspec.

## License terms for contributions

Formspec is an open-core project with two licenses:

- **Apache-2.0** for runtime packages (engine, renderers, types, Rust crates, Python package, specs, schemas)
- **BSL 1.1** for authoring packages (studio, core, chat, MCP, assist, linter, changeset)

By submitting a pull request, you agree to license your contribution under the same license that applies to the file(s) you are modifying. See [LICENSING.md](LICENSING.md) for which packages use which license.

You also acknowledge that the maintainers may offer the project (including your contributions) under commercial license terms to third parties. If you are not comfortable with this, please do not submit a contribution.

## Getting started

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes following the conventions in [CLAUDE.md](CLAUDE.md)
4. Run the relevant test suites before submitting
5. Open a pull request with a clear description of what you changed and why

## Development workflow

We follow red-green-refactor. Every bugfix or feature starts with a failing test. See the "Development Workflow" section in [CLAUDE.md](CLAUDE.md) for details.

## Commit convention

Use semantic prefixes: `feat:`, `fix:`, `build:`, `docs:`, `test:`, `refactor:`.

## Reporting issues

Open an issue on GitHub. Include steps to reproduce, expected behavior, and actual behavior. For spec questions, reference the relevant section from `specs/`.
