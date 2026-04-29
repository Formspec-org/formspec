# Makefile for Formspec — documentation, tests, and full compile (Rust + JS/WASM + PyO3).

PANDOC = pandoc
TEMPLATE = docs/template.html
DOCS_DIR = docs
SPECS_DIR = specs

all: build

spec-artifacts:
	npm run docs:generate

docs-check:
	npm run docs:check

test-unit: build-js
	npm run test:unit

test-e2e:
	npm run test:e2e

test-studio-e2e:
	npm run test:studio:e2e

test-python: build-python
	python3 -m pytest tests/

test-scripts:
	npm run test:scripts

build-wasm:
	npm run build:wasm --workspace=@formspec-org/engine

# Full compile: Rust workspace + npm workspaces (WASM via formspec-engine) +
# formspec_rust into active Python + wos-spec and trellis submodules.
build: build-rust build-js build-python build-wos-spec build-trellis

build-rust:
	cargo build --workspace

build-js:
	npm run build

# Submodule delegation — auto-initializes submodules when missing.
# The file-target rule below clones/populates the submodule on demand via
# `git submodule update --init --recursive`, so `make build` / `make test`
# work on a fresh checkout without a separate bootstrap step.

wos-spec/Makefile trellis/Makefile:
	@echo "Initializing $(@D) submodule..."
	git submodule update --init --recursive $(@D)

# Explicit bootstrap target for callers who want to init everything up front.
submodules:
	git submodule update --init --recursive

build-wos-spec: wos-spec/Makefile
	$(MAKE) -C wos-spec build

build-trellis: trellis/Makefile
	$(MAKE) -C trellis build

test-wos-spec: wos-spec/Makefile
	$(MAKE) -C wos-spec test

test-trellis: trellis/Makefile
	$(MAKE) -C trellis test

clean-wos-spec: wos-spec/Makefile
	$(MAKE) -C wos-spec clean

clean-trellis: trellis/Makefile
	$(MAKE) -C trellis clean

# Builds the Rust extension and places the .so into the source tree for editable installs.
# Uses maturin develop so the in-tree _native.so stays current (pip install writes to
# site-packages, which is shadowed by the editable src/formspec/ on sys.path).
build-python:
	maturin develop --release --manifest-path crates/formspec-py/Cargo.toml

# Force-rebuild the Python extension from scratch. Use this when tests pick up
# stale bindings — typical symptom: a function signature was changed in Rust
# but Python still sees the old shape.
# maturin develop with python-source="src" places the .so directly in src/formspec/.
rebuild-python:
	rm -f src/formspec/_native*.so
	maturin develop --release --manifest-path crates/formspec-py/Cargo.toml

test-rust:
	cargo nextest run --workspace

# After pulling, if `git status` shows trellis/ or wos-spec/ submodule drift, run
# `git submodule update --init --recursive` (or `make submodules`) so local
# `make test` matches CI SHAs. Missing submodules are auto-initialized on first use.
test: test-unit test-python test-rust test-scripts test-e2e test-studio-e2e test-wos-spec test-trellis

test-engine-isolation: build-js
	npm run --workspace=@formspec-org/engine test:init-entry-runtime-only
	npm run --workspace=@formspec-org/engine test:render-entry-runtime-only
	npm run --workspace=@formspec-org/engine test:fel-runtime-entry-only
	npm run --workspace=@formspec-org/engine test:wasm-runtime-isolation
	npm run --workspace=@formspec-org/engine test:wasm-tools-import-count

check: docs-check test test-engine-isolation
	npm run check:deps
	npm run check:studio-source-sizes

api-docs:
	PYTHONPATH=src python3 -c "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('pdoc') else 1)" || python3 -m pip install -e '.[docs]'
	PYTHONPATH=src python3 -m pdoc formspec --output-directory $(DOCS_DIR)/api/formspec
	npx typedoc --entryPoints packages/formspec-types/src/index.ts --tsconfig packages/formspec-types/tsconfig.json --out $(DOCS_DIR)/api/formspec-types
	npx typedoc --entryPoints packages/formspec-engine/src/index.ts --tsconfig packages/formspec-engine/tsconfig.json --out $(DOCS_DIR)/api/formspec-engine
	npx typedoc --entryPoints packages/formspec-layout/src/index.ts --tsconfig packages/formspec-layout/tsconfig.json --out $(DOCS_DIR)/api/formspec-layout
	npx typedoc --entryPoints packages/formspec-webcomponent/src/index.ts --tsconfig packages/formspec-webcomponent/tsconfig.json --out $(DOCS_DIR)/api/formspec-webcomponent
	npx typedoc --entryPoints packages/formspec-adapters/src/index.ts --tsconfig packages/formspec-adapters/tsconfig.json --out $(DOCS_DIR)/api/formspec-adapters
	npx typedoc --entryPoints packages/formspec-assist/src/index.ts --tsconfig packages/formspec-assist/tsconfig.json --out $(DOCS_DIR)/api/formspec-assist
	npx typedoc --entryPoints packages/formspec-react/src/index.ts --tsconfig packages/formspec-react/tsconfig.json --out $(DOCS_DIR)/api/formspec-react
	npx typedoc --entryPoints packages/formspec-core/src/index.ts --tsconfig packages/formspec-core/tsconfig.json --out $(DOCS_DIR)/api/formspec-core
	npx typedoc --entryPoints packages/formspec-studio-core/src/index.ts --tsconfig packages/formspec-studio-core/tsconfig.json --out $(DOCS_DIR)/api/formspec-studio-core
	npx typedoc --entryPoints packages/formspec-chat/src/index.ts --tsconfig packages/formspec-chat/tsconfig.json --out $(DOCS_DIR)/api/formspec-chat
	npx typedoc --entryPoints packages/formspec-mcp/src/index.ts --tsconfig packages/formspec-mcp/tsconfig.json --out $(DOCS_DIR)/api/formspec-mcp
	npm run --workspace=@formspec-org/studio-core build
	cargo doc --workspace --no-deps
	rm -rf $(DOCS_DIR)/api/rust && cp -r target/doc $(DOCS_DIR)/api/rust
	PYTHONPATH=src python3 scripts/generate-api-markdown.py src/formspec/API.llm.md
	node scripts/generate-ts-api-markdown.mjs

html-docs: \
      $(DOCS_DIR)/spec.html \
      $(DOCS_DIR)/mapping.html \
      $(DOCS_DIR)/fel-grammar.html \
      $(DOCS_DIR)/changelog.html \
      $(DOCS_DIR)/extension-registry.html \
      $(DOCS_DIR)/theme-spec.html \
      $(DOCS_DIR)/component-spec.html \
      $(DOCS_DIR)/references-spec.html \
      $(DOCS_DIR)/ontology-spec.html \
      $(DOCS_DIR)/locale-spec.html \
      $(DOCS_DIR)/grant-application.html

docs: html-docs api-docs

$(DOCS_DIR)/spec.html: $(SPECS_DIR)/core/spec.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="Formspec Core Specification" -o $@ $<

$(DOCS_DIR)/mapping.html: $(SPECS_DIR)/mapping/mapping-spec.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="Formspec Mapping Specification" -o $@ $<

$(DOCS_DIR)/fel-grammar.html: $(SPECS_DIR)/fel/fel-grammar.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="FEL Grammar Specification" -o $@ $<

$(DOCS_DIR)/changelog.html: $(SPECS_DIR)/registry/changelog-spec.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="Formspec Changelog Specification" -o $@ $<

$(DOCS_DIR)/extension-registry.html: $(SPECS_DIR)/registry/extension-registry.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="Formspec Extension Registry" -o $@ $<

$(DOCS_DIR)/theme-spec.html: $(SPECS_DIR)/theme/theme-spec.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="Formspec Theme Specification" -o $@ $<

$(DOCS_DIR)/component-spec.html: $(SPECS_DIR)/component/component-spec.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="Formspec Component Specification" -o $@ $<

$(DOCS_DIR)/references-spec.html: $(SPECS_DIR)/core/references-spec.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="Formspec References Specification" -o $@ $<

$(DOCS_DIR)/ontology-spec.html: $(SPECS_DIR)/ontology/ontology-spec.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="Formspec Ontology Specification" -o $@ $<

$(DOCS_DIR)/locale-spec.html: $(SPECS_DIR)/locale/locale-spec.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="Formspec Locale Specification" -o $@ $<

$(DOCS_DIR)/grant-application.html: docs/grant-application-guide.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="Grant Application — Formspec Walkthrough" -o $@ $<

setup:
	python3 -m venv .venv
	.venv/bin/pip install -e '.[test]'
	.venv/bin/pip install pre-commit
	.venv/bin/pre-commit install

serve:
	busybox httpd -f -p 8000 -h docs

clean: clean-wos-spec clean-trellis
	rm -f $(DOCS_DIR)/spec.html \
	      $(DOCS_DIR)/mapping.html \
	      $(DOCS_DIR)/fel-grammar.html \
	      $(DOCS_DIR)/changelog.html \
	      $(DOCS_DIR)/extension-registry.html \
	      $(DOCS_DIR)/theme-spec.html \
	      $(DOCS_DIR)/component-spec.html \
	      $(DOCS_DIR)/references-spec.html \
	      $(DOCS_DIR)/ontology-spec.html \
	      $(DOCS_DIR)/locale-spec.html \
	      $(DOCS_DIR)/grant-application.html
	rm -rf $(DOCS_DIR)/api
	rm -f src/formspec/API.llm.md \
	      packages/formspec-engine/API.llm.md \
	      packages/formspec-layout/API.llm.md \
	      packages/formspec-webcomponent/API.llm.md \
	      packages/formspec-core/API.llm.md \
	      packages/formspec-chat/API.llm.md \
	      packages/formspec-mcp/API.llm.md \
	      packages/formspec-studio-core/API.llm.md

.PHONY: all spec-artifacts docs-check check docs html-docs api-docs build build-rust build-js build-python rebuild-python build-wasm submodules build-wos-spec build-trellis test test-unit test-engine-isolation test-python test-rust test-scripts test-e2e test-studio-e2e test-wos-spec test-trellis setup serve clean clean-wos-spec clean-trellis
