import type { Cash } from 'cash-dom';

export function range(size: number, startAt: number = 0): ReadonlyArray<number> {
    return [...Array(size).keys()].map(i => i + startAt);
}

export function get_val(selected: Cash): number {
    let val = selected.val();
    if (val == "") {
        return Number.NaN;
    }
    return Number(val);
}
