/** @filedesc Narrow interface exposing only the internal Project surface needed by delegate modules. */
import type { IProjectCore } from '@formspec-org/core';
import type { CompNode } from './layout-helpers.js';
import type { ResolvedFieldType } from './field-type-aliases.js';
import type { FieldProps, HelperResult, PlacementOptions } from './helper-types.js';
import type { ScreenerDocument } from './types.js';

export interface ProjectInternals {
  readonly core: IProjectCore;
  readonly definition: Readonly<import('./types.js').FormDefinition>;

  _findPageNode(pageId: string): CompNode;
  _getPageNodes(): CompNode[];
  _resolvePageGroup(pageId?: string): string | undefined;
  _validateFEL(expression: string, contextPath?: string): void;
  _nodeRefForItem(target: string): { bind: string } | { nodeId: string };
  _ensureComponentNodeExistsForMove(sourceRef: { bind?: string; nodeId?: string }): void;
  _regionIndexOf(pageId: string, itemKey: string): number;
  _pageBoundChildren(page: CompNode): CompNode[];
  _resolveAuthoringFieldType(type: string): {
    resolved: ResolvedFieldType;
    extensionName?: string;
    combinedConstraintExpr?: string;
  };
  _getScreener(): ScreenerDocument;
  _validateScreenerItemKey(key: string): number;
  _validatePhaseRoute(phaseId: string, routeIndex: number): void;
  _uniqueLayoutItemKey(label: string, parentPath?: string, explicitKey?: string): string;
  _pageInsertIndex(targetIndex: number, movingPageId: string): number;

  addField(path: string, label: string, type: string, props?: FieldProps): HelperResult;
  placeOnPage(target: string, pageId: string, options?: PlacementOptions): HelperResult;
  addLayoutNode(parentNodeId: string, component: string): HelperResult;
}
