import type { FormspecItem } from 'formspec-engine';

export function findItemByKey(
    key: string,
    items: FormspecItem[],
): { item: FormspecItem; siblings: FormspecItem[]; index: number } | null {
    for (let i = 0; i < items.length; i++) {
        if (items[i].key === key) {
            return { item: items[i], siblings: items, index: i };
        }
        if (items[i].children) {
            const found = findItemByKey(key, items[i].children!);
            if (found) return found;
        }
    }
    return null;
}
