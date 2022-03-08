import {
    Breadcrumb,
    CaptureContext,
    Context,
    Contexts,
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
import { Session } from "@bm/types/dist/session";
import { getGlobalObject } from "@bm/utils";


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
   * This will be called on every set call.
   */
    protected _notifyScopeListeners(): void {
        // We need this check for this._notifyingListeners to be able to work on scope during updates
        // If this check is not here we'll produce endless recursion when something is done with the scope
        // during the callback.
        if (!this._notifyingListeners) {
            this._notifyingListeners = true;
            this._scopeListeners.forEach(callback => {
                callback(this);
            });
            this._notifyingListeners = false;
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