/** @filedesc Ontology-aware profile matching for formspec-assist. */

import type { ConceptBinding, ProfileMatch, UserProfile } from './types.js';

function equivalentKey(system?: string, code?: string): string | null {
  if (!system || !code) {
    return null;
  }
  return `${system}#${code}`;
}

function confidenceForRelationship(type?: string): number {
  switch (type ?? 'exact') {
    case 'exact':
      return 0.95;
    case 'close':
      return 0.8;
    case 'broader':
    case 'narrower':
      return 0.6;
    case 'related':
      return 0.4;
    default:
      return 0.4;
  }
}

export class ProfileMatcher {
  public constructor(
    private readonly resolveConcept: (path: string) => ConceptBinding | undefined,
    private readonly threshold = 0.5,
  ) {}

  public match(profile: UserProfile | undefined, fieldPaths: string[]): ProfileMatch[] {
    if (!profile) {
      return [];
    }

    const matches: ProfileMatch[] = [];
    for (const path of fieldPaths) {
      const concept = this.resolveConcept(path);
      if (concept?.concept && profile.concepts[concept.concept]) {
        const entry = profile.concepts[concept.concept];
        matches.push({
          path,
          concept: concept.concept,
          value: entry.value,
          confidence: 1,
          relationship: 'exact',
          source: entry.source,
        });
        continue;
      }

      let equivalentMatch: ProfileMatch | undefined;
      for (const equivalent of concept?.equivalents ?? []) {
        const key = equivalent.concept ?? equivalentKey(equivalent.system, equivalent.code);
        if (!key || !profile.concepts[key]) {
          continue;
        }
        const entry = profile.concepts[key];
        equivalentMatch = {
          path,
          concept: key,
          value: entry.value,
          confidence: confidenceForRelationship(equivalent.type),
          relationship: equivalent.type ?? 'exact',
          source: entry.source,
        };
        break;
      }
      if (equivalentMatch && equivalentMatch.confidence >= this.threshold) {
        matches.push(equivalentMatch);
        continue;
      }

      const fieldEntry = profile.fields[path];
      if (fieldEntry && 0.3 >= this.threshold) {
        matches.push({
          path,
          value: fieldEntry.value,
          confidence: 0.3,
          relationship: 'field-key',
          source: fieldEntry.source,
        });
      }
    }

    return matches.sort((left, right) => right.confidence - left.confidence || left.path.localeCompare(right.path));
  }
}
