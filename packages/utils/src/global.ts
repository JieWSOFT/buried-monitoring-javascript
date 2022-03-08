import { Integration } from "@bm/types"

import { isNodeEnv } from './node';

interface BmGlobal {
    Bm?: {
        Integrations?: Integration[];
    };
    __BM__: {
        globalEventProcessors: any;
        hub: any;
        logger: any;
    };
}



const fallbackGlobalObject = {};

/**
 * Safely get global scope object
 *
 * @returns Global scope object
 */
export function getGlobalObject<T>(): T & BmGlobal {
    return (isNodeEnv()
        ? global
        : typeof window !== 'undefined' // eslint-disable-line no-restricted-globals
            ? window // eslint-disable-line no-restricted-globals
            : typeof self !== 'undefined'
                ? self
                : fallbackGlobalObject) as T & BmGlobal;
}