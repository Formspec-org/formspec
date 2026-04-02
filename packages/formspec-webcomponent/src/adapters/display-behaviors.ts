/** @filedesc Behavior payloads for display and special component adapter functions. */
import type { DisplayHostSlice } from './display-host';

export interface DisplayComponentBehavior {
    comp: any;
    host: DisplayHostSlice;
}
