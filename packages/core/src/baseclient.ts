
import { Scope, Session } from '@bm/hub';
import { Client, DsnComponents, Event, EventHint, Integration, IntegrationClass, Options, Severity, Transport } from "@bm/types";
import { BMError, checkOrSetAlreadyCaught, dateTimestampInSeconds, isDebugBuild, isPlainObject, isThenable, logger, makeDsn, normalize, rejectedSyncPromise, resolvedSyncPromise, truncate, uuid4 } from "@bm/utils";
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

    /**
   * @inheritDoc
   */
    public captureSession(session: Session): void {
        if (!this._isEnabled()) {
            if (isDebugBuild()) {
                logger.warn('SDK not enabled, will not capture session.');
            }
            return;
        }

        if (!(typeof session.release === 'string')) {
            if (isDebugBuild()) {
                logger.warn('Discarded session because of missing or non-string release');
            }
        } else {
            this._sendSession(session);
            // After sending, we set init false to indicate it's not the first occurrence
            session.update({ init: false });
        }
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

    getOptions(): O {
        return this._options
    }

    /**
    * @inheritDoc
    */
    public getTransport(): Transport {
        return this._getBackend().getTransport();
    }

    setupIntegrations(): void {
        if (this._isEnabled() && !this._integrations.initialized) {
            this._integrations = setupIntegrations(this._options);
        }
    }


    /** Returns the current backend. */
    protected _getBackend(): B {
        return this._backend;
    }

    /** Determines whether this SDK is enabled and a valid Dsn is present. */
    protected _isEnabled(): boolean {
        return this.getOptions().enabled !== false && this._dsn !== undefined;
    }


    /**????????????????????????????????????????????? */
    protected _updateSessionFromEvent(session: Session, event: Event): void {
        let crashed = false;
        let errored = false;
        const exceptions = event.exception && event.exception.values;

        if (exceptions) {
            errored = true;

            for (const ex of exceptions) {
                const mechanism = ex.mechanism;
                if (mechanism && mechanism.handled === false) {
                    crashed = true;
                    break;
                }
            }
        }

        // A session is updated and that session update is sent in only one of the two following scenarios:
        // 1. Session with non terminal status and 0 errors + an error occurred -> Will set error count to 1 and send update
        // 2. Session with non terminal status and 1 error + a crash occurred -> Will set status crashed and send update
        const sessionNonTerminal = session.status === 'ok';
        const shouldUpdateAndSend = (sessionNonTerminal && session.errors === 0) || (sessionNonTerminal && crashed);

        if (shouldUpdateAndSend) {
            session.update({
                ...(crashed && { status: 'crashed' }),
                errors: session.errors || Number(errored || crashed),
            });
            this.captureSession(session);
        }
    }

    /** Deliver captured session to Sentry */
    protected _sendSession(session: Session): void {
        this._getBackend().sendSession(session);
    }

    /**
    *  ?????????????????????????????????
    *  ???????????????????????? "?????? "???????????????????????????`dist`,
    *  ??????????????????????????????
    * @param event event instance to be enhanced
    */
    protected _applyClientOptions(event: Event): void {
        const options = this.getOptions();
        const { environment, release, dist, maxValueLength = 250 } = options;

        if (!('environment' in event)) {
            event.environment = 'environment' in options ? environment : 'production';
        }

        if (event.release === undefined && release !== undefined) {
            event.release = release;
        }

        if (event.dist === undefined && dist !== undefined) {
            event.dist = dist;
        }

        if (event.message) {
            event.message = truncate(event.message, maxValueLength);
        }

        const exception = event.exception && event.exception.values && event.exception.values[0];
        if (exception && exception.value) {
            exception.value = truncate(exception.value, maxValueLength);
        }

        const request = event.request;
        if (request && request.url) {
            request.url = truncate(request.url, maxValueLength);
        }
    }


    /**
    * ????????????????????????????????????????????????????????????SDK?????????
    * @param event The event that will be filled with all integrations.
    */
    protected _applyIntegrationsMetadata(event: Event): void {
        const integrationsArray = Object.keys(this._integrations);
        if (integrationsArray.length > 0) {
            event.sdk = event.sdk || {};
            event.sdk.integrations = [...(event.sdk.integrations || []), ...integrationsArray];
        }
    }
    /**
    * ??????????????????????????????
    *
    * ????????????????????????`options`?????????????????????????????????????????????????????????????????????????????????????????????
    *
    * ????????????????????????????????????????????????????????????  ?????????????????????????????????????????????
    *
    * @param event The original event.
    * @param hint May contain additional information about the original exception.
    * @param scope A scope containing event metadata.
    * @returns A new event with more information.
    */
    protected _prepareEvent(event: Event, scope?: Scope, hint?: EventHint): PromiseLike<Event | null> {
        const { normalizeDepth = 3 } = this.getOptions();
        const prepared: Event = {
            ...event,
            event_id: event.event_id || (hint && hint.event_id ? hint.event_id : uuid4()),
            timestamp: event.timestamp || dateTimestampInSeconds(),
        };

        this._applyClientOptions(prepared);
        this._applyIntegrationsMetadata(prepared);

        // ??????????????????????????????????????????????????????????????????????????????
        // ??????????????????`captureContext'??????????????????????????????????????????????????????
        let finalScope = scope;
        if (hint && hint.captureContext) {
            finalScope = Scope.clone(finalScope).update(hint.captureContext);
        }

        // ????????????????????????????????????????????????????????????
        let result = resolvedSyncPromise<Event | null>(prepared);

        // ????????????????????????????????????????????????????????????
        // {@link Hub.addEventProcessor}??????????????????????????????
        if (finalScope) {
            // In case we have a hub we reassign it.
            result = finalScope.applyToEvent(prepared, hint);
        }

        return result.then(evt => {
            if (typeof normalizeDepth === 'number' && normalizeDepth > 0) {
                return this._normalizeEvent(evt, normalizeDepth);
            }
            return evt;
        });
    }

    /**
    * ?????????????????????????????????
    * @param event The Sentry event to send
    */
    protected _sendEvent(event: Event): void {
        this._getBackend().sendEvent(event);
    }

    /**
    * ??????????????????????????????????????????????????????
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
    * ????????????????????????????????????????????????????????????????????????BM
    *
    * ???????????????????????????????????????????????????????????????
    * ???????????????????????????????????????IP??????????????????SDK??????????????????
    * ???SDK??????????????????
    *
    *
    * @param event The event to send to BM.
    * @param hint May contain additional information about the original exception.
    * @param scope A scope containing event metadata.
    * @returns A SyncPromise that resolves with the event or rejects in case event was/will not be send.
    */
    protected _processEvent(event: Event, hint?: EventHint, scope?: Scope): PromiseLike<Event> {
        const { beforeSend, sampleRate } = this.getOptions();
        const transport = this.getTransport();

        type RecordLostEvent = NonNullable<Transport['recordLostEvent']>;
        type RecordLostEventParams = Parameters<RecordLostEvent>;

        function recordLostEvent(outcome: RecordLostEventParams[0], category: RecordLostEventParams[1]): void {
            if (transport.recordLostEvent) {
                transport.recordLostEvent(outcome, category);
            }
        }

        if (!this._isEnabled()) {
            return rejectedSyncPromise(new BMError('SDK not enabled, will not capture event.'));
        }

        const isTransaction = event.type === 'transaction';

        if (!isTransaction && typeof sampleRate === 'number' && Math.random() > sampleRate) {
            recordLostEvent('sample_rate', 'event');
            return rejectedSyncPromise(
                new BMError(
                    `Discarding event because it's not included in the random sample (sampling rate = ${sampleRate})`,
                ),
            );
        }

        return this._prepareEvent(event, scope, hint)
            .then(prepared => {
                if (prepared === null) {
                    recordLostEvent('event_processor', event.type || 'event');
                    throw new BMError('An event processor returned null, will not send event.');
                }

                const isInternalException = hint && hint.data && (hint.data as { __sentry__: boolean }).__sentry__ === true;
                if (isInternalException || isTransaction || !beforeSend) {
                    return prepared;
                }

                const beforeSendResult = beforeSend(prepared, hint);
                return _ensureBeforeSendRv(beforeSendResult);
            })
            .then(processedEvent => {
                if (processedEvent === null) {
                    recordLostEvent('before_send', event.type || 'event');
                    throw new BMError('`beforeSend` returned `null`, will not send event.');
                }

                const session = scope && scope.getSession && scope.getSession();
                if (!isTransaction && session) {
                    this._updateSessionFromEvent(session, processedEvent);
                }

                this._sendEvent(processedEvent);
                return processedEvent;
            })
            .then(null, reason => {
                if (reason instanceof BMError) {
                    throw reason;
                }

                this.captureException(reason, {
                    data: {
                        __sentry__: true,
                    },
                    originalException: reason as Error,
                });
                throw new BMError(
                    `Event processing pipeline threw an error, original event will not be sent. Details have been sent as a new event.\nReason: ${reason}`,
                );
            });

    }

    /**
    * ???????????? "?????? "??????????????? "????????? "??????????????????????????????????????????
    * ??????????????????
    * - `breadcrumbs.data`.
    * - `??????'???
    * - `contexts'??????????????????
    * - `extra'???
    *@param event ??????
    *@returns ???????????????
    */
    protected _normalizeEvent(event: Event | null, depth: number): Event | null {
        if (!event) {
            return null;
        }

        const normalized = {
            ...event,
            ...(event.breadcrumbs && {
                breadcrumbs: event.breadcrumbs.map(b => ({
                    ...b,
                    ...(b.data && {
                        data: normalize(b.data, depth),
                    }),
                })),
            }),
            ...(event.user && {
                user: normalize(event.user, depth),
            }),
            ...(event.contexts && {
                contexts: normalize(event.contexts, depth),
            }),
            ...(event.extra && {
                extra: normalize(event.extra, depth),
            }),
        };
        // event.contexts.trace stores information about a Transaction. Similarly,
        // event.spans[] stores information about child Spans. Given that a
        // Transaction is conceptually a Span, normalization should apply to both
        // Transactions and Spans consistently.
        // For now the decision is to skip normalization of Transactions and Spans,
        // so this block overwrites the normalized event to add back the original
        // Transaction information prior to normalization.
        if (event.contexts && event.contexts.trace) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            normalized.contexts.trace = event.contexts.trace;
        }

        const { _experiments = {} } = this.getOptions();
        if (_experiments.ensureNoCircularStructures) {
            return normalize(normalized);
        }

        return normalized;
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


/**
 * ???????????????`beforeSend'???????????????????????????????????????
 */
function _ensureBeforeSendRv(rv: PromiseLike<Event | null> | Event | null): PromiseLike<Event | null> | Event | null {
    const nullErr = '`beforeSend` method has to return `null` or a valid event.';
    if (isThenable(rv)) {
        return rv.then(
            event => {
                if (!(isPlainObject(event) || event === null)) {
                    throw new BMError(nullErr);
                }
                return event;
            },
            e => {
                throw new BMError(`beforeSend rejected with ${e}`);
            },
        );
    } else if (!(isPlainObject(rv) || rv === null)) {
        throw new BMError(nullErr);
    }
    return rv;
}
