import {
    Breadcrumb,
    CaptureContext,
    Context,
    Contexts,
    Event,
    EventHint,
    EventProcessor,
    Extras,
    Primitive,
    RequestSession,
    Scope as ScopeInterface,
    Severity,
    Span,
    Transaction,
    User,
} from "@bm/types"
import { getGlobalObject, isThenable, SyncPromise } from "@bm/utils";
import { Session } from ".";


export class Scope implements ScopeInterface {
    /** Flag if notifying is happening. */
    protected _notifyingListeners: boolean = false;

    /** Callback for client to receive scope changes. */
    protected _scopeListeners: Array<(scope: Scope) => void> = [];

    /** Callback list that will be called after {@link applyToEvent}. */
    protected _eventProcessors: EventProcessor[] = [];

    /** Array of breadcrumbs. */
    protected _breadcrumbs: Breadcrumb[] = [];

    /** User */
    protected _user: User = {};

    /** Tags */
    protected _tags: { [key: string]: Primitive } = {};

    /** Extra */
    protected _extra: Extras = {};

    /** Contexts */
    protected _contexts: Contexts = {};

    /** Fingerprint */
    protected _fingerprint?: string[];

    /** Severity */
    protected _level?: Severity;

    /** Transaction Name */
    protected _transactionName?: string;

    /** Span */
    protected _span?: Span;

    /** Session */
    protected _session?: Session;

    /** Request Mode Session Status */
    protected _requestSession?: RequestSession;

    /**
    * 一个存放数据的地方，这些数据在SDK的事件处理管道中的某个点是需要的，但不应该被送到
    * 发送给BM
    */
    protected _sdkProcessingMetadata?: { [key: string]: unknown } = {};

    /**
 * Inherit values from the parent scope.
 * @param scope to clone.
 */
    public static clone(scope?: Scope): Scope {
        const newScope = new Scope();
        if (scope) {
            newScope._breadcrumbs = [...scope._breadcrumbs];
            newScope._tags = { ...scope._tags };
            newScope._extra = { ...scope._extra };
            newScope._contexts = { ...scope._contexts };
            newScope._user = scope._user;
            newScope._level = scope._level;
            newScope._span = scope._span;
            newScope._session = scope._session;
            newScope._transactionName = scope._transactionName;
            newScope._fingerprint = scope._fingerprint;
            newScope._eventProcessors = [...scope._eventProcessors];
            newScope._requestSession = scope._requestSession;
        }
        return newScope;
    }

    /**
    * @inheritDoc
    */
    public addEventProcessor(callback: EventProcessor): this {
        this._eventProcessors.push(callback);
        return this;
    }

    public update(captureContext?: CaptureContext): this {
        if (!captureContext) {
            return this;
        }

        if (typeof captureContext === 'function') {
            const updatedScope = (captureContext as <T>(scope: T) => T)(this);
            return updatedScope instanceof Scope ? updatedScope : this;
        }
        return this
    }

    setSpan(span?: Span): this {
        console.log(span)
        throw new Error("Method not implemented.");
    }
    getSpan(): Span | undefined {
        throw new Error("Method not implemented.");
    }
    getTransaction(): Transaction | undefined {
        throw new Error("Method not implemented.");
    }
    addBreadcrumb(breadcrumb: Breadcrumb, maxBreadcrumbs?: number): this {
        console.log(breadcrumb, maxBreadcrumbs)
        throw new Error("Method not implemented.");
    }
    setUser(user: User | null): this {
        this._user = user || {};
        if (this._session) {
            this._session.update({ user });
        }
        this._notifyScopeListeners()
        return this;
    }
    getUser(): User | undefined {
        return this._user;
    }
    setTags(tags: { [key: string]: Primitive; }): this {
        console.log(tags)
        throw new Error("Method not implemented.");
    }
    setTag(key: string, value: Primitive): this {
        console.log(key, value)
        throw new Error("Method not implemented.");
    }
    setExtras(extras: Extras): this {
        console.log(extras)
        throw new Error("Method not implemented.");
    }
    setExtra(key: string, extra: unknown): this {
        console.log(key, extra)
        throw new Error("Method not implemented.");
    }
    setFingerprint(fingerprint: string[]): this {
        console.log(fingerprint)
        throw new Error("Method not implemented.");
    }
    setLevel(level: Severity): this {
        console.log(level)
        throw new Error("Method not implemented.");
    }
    setTransactionName(name?: string): this {
        console.log(name)
        throw new Error("Method not implemented.");
    }
    setContext(name: string, context: Context | null): this {
        console.log(name, context)
        throw new Error("Method not implemented.");
    }
    getSession(): Session | undefined {
        return this._session;
    }
    setSession(session?: Session): this {
        if (!session) {
            delete this._session;
        } else {
            this._session = session;
        }
        this._notifyScopeListeners();
        return this;
    }
    getRequestSession(): RequestSession | undefined {
        throw new Error("Method not implemented.");
    }
    setRequestSession(requestSession?: RequestSession): this {
        console.log(requestSession)
        throw new Error("Method not implemented.");
    }
    clear(): this {
        throw new Error("Method not implemented.");
    }
    clearBreadcrumbs(): this {
        throw new Error("Method not implemented.");
    }


    /**
    *将当前的上下文和指纹应用于事件。
   * 注意，面包屑将由客户端添加。
   * 如果事件已经有了面包屑，我们不会合并它们。
   * @param event Event
   * @param hint May contain additional information about the original exception.
   * @hidden
   */
    public applyToEvent(event: Event, hint?: EventHint): PromiseLike<Event | null> {
        if (this._extra && Object.keys(this._extra).length) {
            event.extra = { ...this._extra, ...event.extra };
        }
        if (this._tags && Object.keys(this._tags).length) {
            event.tags = { ...this._tags, ...event.tags };
        }
        if (this._user && Object.keys(this._user).length) {
            event.user = { ...this._user, ...event.user };
        }
        if (this._contexts && Object.keys(this._contexts).length) {
            event.contexts = { ...this._contexts, ...event.contexts };
        }
        if (this._level) {
            event.level = this._level;
        }
        if (this._transactionName) {
            event.transaction = this._transactionName;
        }
        // 我们要为普通事件设置跟踪上下文，只有当事件上还没有
        // 事件上有一个跟踪上下文。有一个产品特性，我们把
        // 错误与交易，它依赖于此。
        if (this._span) {
            event.contexts = { trace: this._span.getTraceContext(), ...event.contexts };
            const transactionName = this._span.transaction && this._span.transaction.name;
            if (transactionName) {
                event.tags = { transaction: transactionName, ...event.tags };
            }
        }

        this._applyFingerprint(event);

        event.breadcrumbs = [...(event.breadcrumbs || []), ...this._breadcrumbs];
        event.breadcrumbs = event.breadcrumbs.length > 0 ? event.breadcrumbs : undefined;

        event.sdkProcessingMetadata = this._sdkProcessingMetadata;

        return this._notifyEventProcessors([...getGlobalEventProcessors(), ...this._eventProcessors], event, hint);
    }

    /**
    *这将在{@link applyToEvent}完成后被调用。
    */
    protected _notifyEventProcessors(
        processors: EventProcessor[],
        event: Event | null,
        hint?: EventHint,
        index: number = 0,
    ): PromiseLike<Event | null> {
        return new SyncPromise<Event | null>((resolve, reject) => {
            const processor = processors[index];
            if (event === null || typeof processor !== 'function') {
                resolve(event);
            } else {
                const result = processor({ ...event }, hint) as Event | null;
                if (isThenable(result)) {
                    void (result as PromiseLike<Event | null>)
                        .then(final => this._notifyEventProcessors(processors, final, hint, index + 1).then(resolve))
                        .then(null, reject);
                } else {
                    void this._notifyEventProcessors(processors, result, hint, index + 1)
                        .then(resolve)
                        .then(null, reject);
                }
            }
        });
    }

    /**
    * 这将在每一次集合调用时被调用。 
    */
    protected _notifyScopeListeners(): void {
        // 我们需要这个检查，以便this._notifyingListeners能够在更新期间对作用域进行工作。
        // 如果这个检查不在这里，当对作用域做某些事情时，我们会产生无休止的递归。
        // 在回调过程中。
        if (!this._notifyingListeners) {
            this._notifyingListeners = true;
            this._scopeListeners.forEach(callback => {
                callback(this);
            });
            this._notifyingListeners = false;
        }
    }

    /**
    * 如果有指纹的话，将范围中的指纹应用到事件中。
    * 如果有的话就用消息代替，或者去掉空的指纹。
    */
    private _applyFingerprint(event: Event): void {
        // Make sure it's an array first and we actually have something in place
        event.fingerprint = event.fingerprint
            ? Array.isArray(event.fingerprint)
                ? event.fingerprint
                : [event.fingerprint]
            : [];

        // If we have something on the scope, then merge it with event
        if (this._fingerprint) {
            event.fingerprint = event.fingerprint.concat(this._fingerprint);
        }

        // If we have no data at all, remove empty array default
        if (event.fingerprint && !event.fingerprint.length) {
            delete event.fingerprint;
        }
    }
}


/**
 * Returns the global event processors.
 */
function getGlobalEventProcessors(): EventProcessor[] {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access  */
    const global = getGlobalObject<any>();
    global.__BM__ = global.__BM__ || {};
    global.__BM__.globalEventProcessors = global.__BM__.globalEventProcessors || [];
    return global.__BM__.globalEventProcessors;
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
}

/**
 * Add a EventProcessor to be kept globally.
 * @param callback EventProcessor to add
 */
export function addGlobalEventProcessor(callback: EventProcessor): void {
    getGlobalEventProcessors().push(callback);
}