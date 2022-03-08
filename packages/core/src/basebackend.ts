import { Event, EventHint, Options, Session, Severity, Transport, } from "@bm/types";

export interface Backend {
    /** Creates an {@link Event} from all inputs to `captureException` and non-primitive inputs to `captureMessage`. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eventFromException(exception: any, hint?: EventHint): PromiseLike<Event>;

    /** Creates an {@link Event} from primitive inputs to `captureMessage`. */
    eventFromMessage(message: string, level?: Severity, hint?: EventHint): PromiseLike<Event>;

    /** Submits the event to Sentry */
    sendEvent(event: Event): void;

    /** Submits the session to Sentry */
    sendSession(session: Session): void;

    /**
     * Returns the transport that is used by the backend.
     * Please note that the transport gets lazy initialized so it will only be there once the first event has been sent.
     *
     * @returns The transport.
     */
    getTransport(): Transport;
}

/**
 * A class object that can instantiate Backend objects.
 * @hidden
 */
export type BackendClass<B extends Backend, O extends Options> = new (options: O) => B;




export abstract class BaseBackend<O extends Options> implements Backend {
    /** Options passed to the SDK. */
    protected readonly _options: O;

    /** Creates a new backend instance. */
    public constructor(options: O) {
        this._options = options;
        // if (!this._options.dsn) {
        //     logger.warn('No DSN provided, backend will not do anything.');
        // }
    }
    eventFromException(exception: any, hint?: EventHint): PromiseLike<Event> {
        console.log(exception, hint)
        throw new Error("Method not implemented.");
    }
    eventFromMessage(message: string, level?: Severity, hint?: EventHint): PromiseLike<Event> {
        console.log(message, level, hint)
        throw new Error("Method not implemented.");
    }
    sendEvent(event: Event): void {
        console.log(event)

        throw new Error("Method not implemented.");
    }
    sendSession(session: Session): void {
        console.log(session)
        throw new Error("Method not implemented.");
    }
    getTransport(): Transport {
        throw new Error("Method not implemented.");
    }
}