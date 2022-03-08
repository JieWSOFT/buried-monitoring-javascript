import { getCurrentHub } from "@bm/hub";
import { Client, Options } from "@bm/types";
import { logger } from '@bm/utils';

/** A class object that can instantiate Client objects. */
export type ClientClass<F extends Client, O extends Options> = new (options: O) => F;

export function initAndBind<F extends Client, O extends Options>(clientClass: ClientClass<F, O>, options: O) {
    if (options.debug === true) {
        logger.enable();
    }
    const hub = getCurrentHub();
    const scope = hub.getScope();
    if (scope) {
        scope.update(options.initialScope);
    }
    const client = new clientClass(options);
    hub.bindClient(client)
}