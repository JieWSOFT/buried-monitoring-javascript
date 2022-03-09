import { BaseBackend } from "@bm/core";
import { Event, EventHint, Options, Severity } from "@bm/types";
import { eventFromException, eventFromMessage } from "./eventBuilder";

/**
 * BM Browser SDK的配置选项。
 * @see BrowserClient for more information.
 */
export interface BrowserOptions extends Options {
    /**
     * 一个错误URL的模式，它应该被专门发送给BM。
     * 这与{@link Options.denyUrls}相反。
     * 默认情况下，所有的错误都将被发送。
     */
    allowUrls?: Array<string | RegExp>;

    /**
     * 错误URL的模式，不应该被发送到BM。
     * 要允许某些错误，请使用{@link Options.allowUrls}。
     * 默认情况下，所有的错误都将被发送。
     */
    denyUrls?: Array<string | RegExp>;

    /** @deprecated use {@link Options.allowUrls} instead. */
    whitelistUrls?: Array<string | RegExp>;

    /** @deprecated use {@link Options.denyUrls} instead. */
    blacklistUrls?: Array<string | RegExp>;
}

/**
 * The BM Browser SDK Backend.
 * @hidden
 */
export class BrowserBackend extends BaseBackend<BrowserOptions>{
    /**
    * @inheritDoc
    */
    public eventFromException(exception: unknown, hint?: EventHint): PromiseLike<Event> {
        return eventFromException(this._options, exception, hint);
    }
    /**
     * @inheritDoc
     */
    public eventFromMessage(message: string, level: Severity = Severity.Info, hint?: EventHint): PromiseLike<Event> {
        return eventFromMessage(this._options, message, level, hint);
    }
}