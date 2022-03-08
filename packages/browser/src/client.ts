import { BaseClient } from "@bm/core";
import { BrowserBackend, BrowserOptions } from "./backend";

export class BrowserClient extends BaseClient<BrowserBackend, BrowserOptions> {
    /**
       * Creates a new Browser SDK instance.
       *
       * @param options Configuration options for this SDK.
       */
    public constructor(options: BrowserOptions = {}) {
        super(BrowserBackend, options);
    }
}