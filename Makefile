# Makefile for Formspec Documentation

PANDOC = pandoc
TEMPLATE = docs/template.html
DOCS_DIR = docs
SPECS_DIR = specs

all: docs

spec-artifacts:
	npm run docs:generate

docs-check:
	npm run docs:check

test-js:
	npm run test:unit

test-e2e:
	npm run test:e2e

test-studio-e2e:
	npm run test:studio:e2e

test-python:
	pytest

test: test-js test-python test-e2e test-studio-e2e

check: docs-check test

api-docs:
	PYTHONPATH=src python3 -m pdoc formspec --output-directory $(DOCS_DIR)/api/formspec
	npx typedoc --entryPoints packages/formspec-engine/src/index.ts --tsconfig packages/formspec-engine/tsconfig.json --out $(DOCS_DIR)/api/formspec-engine
	npx typedoc --entryPoints packages/formspec-webcomponent/src/index.ts --tsconfig packages/formspec-webcomponent/tsconfig.json --out $(DOCS_DIR)/api/formspec-webcomponent
	npm run --workspace=form-builder build:types
	npx typedoc --entryPoints form-builder/src/index.ts --tsconfig form-builder/tsconfig.docs.json --skipErrorChecking --out $(DOCS_DIR)/api/form-builder
	npm run --workspace=formspec-studio-core build || true
	PYTHONPATH=src python3 scripts/generate-api-markdown.py src/formspec/API.llm.md
	node scripts/generate-ts-api-markdown.mjs

docs: spec-artifacts \
      $(DOCS_DIR)/spec.html \
      $(DOCS_DIR)/mapping.html \
      $(DOCS_DIR)/fel-grammar.html \
      $(DOCS_DIR)/changelog.html \
      $(DOCS_DIR)/extension-registry.html \
      $(DOCS_DIR)/theme-spec.html \
      $(DOCS_DIR)/component-spec.html \
      $(DOCS_DIR)/grant-application.html \
      api-docs

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

$(DOCS_DIR)/grant-application.html: docs/grant-application-guide.md $(TEMPLATE)
	$(PANDOC) -s --toc --template=$(TEMPLATE) --metadata title="Grant Application — Formspec Walkthrough" -o $@ $<

setup:
	python3 -m venv .venv
	.venv/bin/pip install pre-commit
	.venv/bin/pre-commit install

serve:
	busybox httpd -f -p 8000 -h docs

clean:
	rm -f $(DOCS_DIR)/spec.html \
	      $(DOCS_DIR)/mapping.html \
	      $(DOCS_DIR)/fel-grammar.html \
	      $(DOCS_DIR)/changelog.html \
	      $(DOCS_DIR)/extension-registry.html \
	      $(DOCS_DIR)/theme-spec.html \
	      $(DOCS_DIR)/component-spec.html \
	      $(DOCS_DIR)/grant-application.html
	rm -rf $(DOCS_DIR)/api
	rm -f src/formspec/API.llm.md \
	      packages/formspec-engine/API.llm.md \
	      packages/formspec-webcomponent/API.llm.md \
	      form-builder/API.llm.md
	rm -rf form-builder/dist-types

.PHONY: all spec-artifacts docs-check check docs api-docs test test-js test-python test-e2e test-studio-e2e setup serve clean
