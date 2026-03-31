/** @filedesc Shared types for screener authoring components. */

export interface ScreenerRoute {
  condition: string;
  target: string;
  label?: string;
  message?: string;
}

export interface ScreenerQuestion {
  key: string;
  type: string;
  dataType?: string;
  label?: string;
  helpText?: string;
  [k: string]: unknown;
}
