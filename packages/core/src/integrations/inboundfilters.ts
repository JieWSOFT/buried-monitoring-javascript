import { addGlobalEventProcessor } from "@bm/hub";
import { Integration } from "@bm/types";

// "Script error." is hard coded into browsers for errors that it can't read.
// this is the result of a script being pulled in from an external domain and CORS.
const DEFAULT_IGNORE_ERRORS = [/^Script error\.?$/, /^Javascript error: Script error\.? on line 0$/];

/** JSDoc */
interface InboundFiltersOptions {
    allowUrls: Array<string | RegExp>;
    denyUrls: Array<string | RegExp>;
    ignoreErrors: Array<string | RegExp>;
    ignoreInternal: boolean;

    /** @deprecated use {@link InboundFiltersOptions.allowUrls} instead. */
    whitelistUrls: Array<string | RegExp>;
    /** @deprecated use {@link InboundFiltersOptions.denyUrls} instead. */
    blacklistUrls: Array<string | RegExp>;
}

export class InboundFilters implements Integration {
    /**
      * @inheritDoc
      */
    public static id: string = 'InboundFilters';

    /**
     * @inheritDoc
     */
    public name: string = InboundFilters.id;


    public constructor(private readonly _options: Partial<InboundFiltersOptions> = {}) { }

    setupOnce(): void {
        console.log(this._options, DEFAULT_IGNORE_ERRORS)
        addGlobalEventProcessor
    }
}