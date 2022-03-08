import { Client, DsnComponents, Event, EventHint, Integration, IntegrationClass, Options, Scope, Severity } from "@bm/types";
import { checkOrSetAlreadyCaught, logger, makeDsn } from "@bm/utils";
import { Backend, BackendClass } from "./basebackend";
import { IntegrationIndex, setupIntegrations } from "./integration";

const ALREADY_SEEN_ERROR = "Not capturing exception because it's already been captured.";


export abstract class BaseClient<B extends Backend, O extends Options> implements Client<O> {
    /**
    * The backend used to physically interact in the environment. Usually, this
    * will correspond to the client. When composing SDKs, however, the Backend
    * from the root SDK will be used.
    */
    protected readonly _backend: B;

    /** Options passed to the SDK. */
    protected readonly _options: O;

    /** The client Dsn, if specified in options. Without this Dsn, the SDK will be disabled. */
    protected readonly _dsn?: DsnComponents;

    /** Array of used integrations. */
    protected _integrations: IntegrationIndex = {};

    /** Number of calls being processed */
    protected _numProcessing: number = 0;

    /**
    * Initializes this client instance.
    *
    * @param backendClass A constructor function to create the backend.
    * @param options Options for the client.
    */
    protected constructor(backendClass: BackendClass<B, O>, options: O) {
        this._backend = new backendClass(options);
        this._options = options;

        if (options.dsn) {
            this._dsn = makeDsn(options.dsn);
        }
    }
    captureException(exception: any, hint?: EventHint, scope?: Scope): string | undefined {
        // ensure we haven't captured this very object before
        if (checkOrSetAlreadyCaught(exception)) {
            logger.log(ALREADY_SEEN_ERROR);
            return;
        }

        let eventId: string | undefined = hint && hint.event_id;

        this._process(
            this._getBackend()
                .eventFromException(exception, hint)
                .then(event => this._captureEvent(event, hint, scope))
                .then(result => {
                    eventId = result;
                }),
        );

        return eventId;
    }
    captureMessage(message: string, level?: Severity, hint?: EventHint, scope?: Scope): string | undefined {
        console.log(message, level, hint, scope)
        throw new Error("Method not implemented.");
    }
    captureEvent(event: Event, hint?: EventHint, scope?: Scope): string | undefined {
        console.log(event, hint, scope)
        throw new Error("Method not implemented.");
    }
    getDsn(): DsnComponents | undefined {
        throw new Error("Method not implemented.");
    }
    close(timeout?: number): PromiseLike<boolean> {
        console.log(timeout)
        throw new Error("Method not implemented.");
    }
    flush(timeout?: number): PromiseLike<boolean> {
        console.log(timeout)
        throw new Error("Method not implemented.");
    }
    getIntegration<T extends Integration>(integration: IntegrationClass<T>): T | null {
        console.log(integration)
        throw new Error("Method not implemented.");
    }
    /** Determines whether this SDK is enabled and a valid Dsn is present. */
    protected _isEnabled(): boolean {
        return this.getOptions().enabled !== false && this._dsn !== undefined;
    }

    getOptions(): O {
        return this._options
    }

    setupIntegrations(): void {
        if (this._isEnabled() && !this._integrations.initialized) {
            this._integrations = setupIntegrations(this._options);
        }
    }

    /**
   * Processes the event and logs an error in case of rejection
   * @param event
   * @param hint
   * @param scope
   */
    protected _captureEvent(event: Event, hint?: EventHint, scope?: Scope): PromiseLike<string | undefined> {
        return this._processEvent(event, hint, scope).then(
            finalEvent => {
                return finalEvent.event_id;
            },
            reason => {
                logger.error(reason);
                return undefined;
            },
        );
    }

    /**
   * Processes an event (either error or message) and sends it to Sentry.
   *
   * This also adds breadcrumbs and context information to the event. However,
   * platform specific meta data (such as the User's IP address) must be added
   * by the SDK implementor.
   *
   *
   * @param event The event to send to Sentry.
   * @param hint May contain additional information about the original exception.
   * @param scope A scope containing event metadata.
   * @returns A SyncPromise that resolves with the event or rejects in case event was/will not be send.
   */
    protected _processEvent(event: Event, hint?: EventHint, scope?: Scope): PromiseLike<Event> {
        const { beforeSend, sampleRate } = this.getOptions();
    }

    /** Returns the current backend. */
    protected _getBackend(): B {
        return this._backend;
    }

    /**
   * Occupies the client with processing and event
   */
    protected _process<T>(promise: PromiseLike<T>): void {
        this._numProcessing += 1;
        void promise.then(
            value => {
                this._numProcessing -= 1;
                return value;
            },
            reason => {
                this._numProcessing -= 1;
                return reason;
            },
        );
    }
}
