import {
    Breadcrumb,
    BreadcrumbHint,
    Client,
    CustomSamplingContext,
    Event,
    EventHint,
    Extras,
    Hub as HubInterface, Integration, IntegrationClass, Primitive, SessionContext, Severity, Span, SpanContext, Transaction, TransactionContext, User
} from "@bm/types"
import { getGlobalObject, uuid4 } from "@bm/utils";
import { Scope } from "./scope";
import { Session } from "./session";

/**
 * API compatibility version of this hub.
 *
 * WARNING: This number should only be increased when the global interface
 * changes and new methods are introduced.
 *
 * @hidden
 */
export const API_VERSION = 1;

/**
 * An object that contains a hub and maintains a scope stack.
 * @hidden
 */
export interface Carrier {
    __BM__?: {
        hub?: Hub;
        /**
            * Extra Hub properties injected by various SDKs
        */
        integrations?: Integration[];
        extensions?: {
            /** Hack to prevent bundlers from breaking our usage of the domain package in the cross-platform Hub package */
            domain?: { [key: string]: any };
        } & {
            /** Extension methods for the hub, which are bound to the current Hub instance */
            [key: string]: Function;
        }
    }
}

/**
 * A layer in the process stack.
 * @hidden
 */
export interface Layer {
    client?: Client;
    scope?: Scope;
}

/**
 * @hidden
 * @deprecated Can be removed once `Hub.getActiveDomain` is removed.
 */
export interface DomainAsCarrier extends Carrier {
    members: { [key: string]: any }[];
}

export class Hub implements HubInterface {

    /** Is a {@link Layer}[] containing the client and scope */
    private readonly _stack: Layer[] = [{}];

    /** Contains the last event id of a captured event.  */
    private _lastEventId?: string;

    public constructor(client?: Client, scope: Scope = new Scope(), private readonly _version: number = API_VERSION) {
        this.getStackTop().scope = scope;
        if (client) {
            this.bindClient(client);
        }
    }
    /**
    * @inheritDoc
    */
    public isOlderThan(version: number): boolean {
        return this._version < version;
    }

    /**
    * @inheritDoc
    */
    public bindClient(client?: Client): void {
        const top = this.getStackTop();
        top.client = client;
        if (client && client.setupIntegrations) {
            client.setupIntegrations();
        }
    }

    /**
   * @inheritDoc
   */
    public getClient<C extends Client>(): C | undefined {
        return this.getStackTop().client as C;
    }

    /** Returns the scope of the top stack. */
    public getScope(): Scope | undefined {
        return this.getStackTop().scope;
    }

    /** Returns the scope stack for domains or the process. */
    public getStack(): Layer[] {
        return this._stack;
    }

    /** Returns the topmost scope layer in the order domain > local > process. */
    public getStackTop(): Layer {
        return this._stack[this._stack.length - 1];
    }


    addBreadcrumb(breadcrumb: Breadcrumb, hint?: BreadcrumbHint): void {
        console.log(breadcrumb, hint)
        throw new Error("Method not implemented.");
    }
    startSpan(context: SpanContext): Span {
        console.log(context)
        throw new Error("Method not implemented.");
    }
    startTransaction(context: TransactionContext, customSamplingContext?: CustomSamplingContext): Transaction {
        console.log(context, customSamplingContext)
        throw new Error("Method not implemented.");
    }
    pushScope(): Scope {
        // We want to clone the content of prev scope
        const scope = Scope.clone(this.getScope());
        this.getStack().push({
            client: this.getClient(),
            scope,
        });
        return scope;
    }
    popScope(): boolean {
        if (this.getStack().length <= 1) return false;
        return !!this.getStack().pop();
    }
    withScope(callback: (scope: Scope) => void): void {
        const scope = this.pushScope();
        try {
            callback(scope);
        } finally {
            this.popScope();
        }
    }
    captureException(exception: any, hint?: EventHint): string {
        const eventId = (this._lastEventId = uuid4());
        console.log(this._lastEventId, eventId)
        let finalHint = hint;

        // If there's no explicit hint provided, mimic the same thing that would happen
        // in the minimal itself to create a consistent behavior.
        // We don't do this in the client, as it's the lowest level API, and doing this,
        // would prevent user from having full control over direct calls.
        if (!hint) {
            let syntheticException: Error;
            try {
                throw new Error('BM syntheticException');
            } catch (exception) {
                syntheticException = exception as Error;
            }
            finalHint = {
                originalException: exception,
                syntheticException,
            };
        }
        this._invokeClient('captureException', exception, {
            ...finalHint,
            event_id: eventId,
        });
        return eventId;
    }
    captureMessage(message: string, level?: Severity, hint?: EventHint): string {
        console.log(message, level, hint)
        throw new Error("Method not implemented.");
    }
    captureEvent(event: Event, hint?: EventHint): string {
        console.log(event, hint)
        throw new Error("Method not implemented.");
    }
    lastEventId(): string | undefined {
        throw new Error("Method not implemented.");
    }
    setUser(user: User | null): void {
        console.log(user)
        throw new Error("Method not implemented.");
    }
    setTags(tags: { [key: string]: Primitive; }): void {
        console.log(tags)
        throw new Error("Method not implemented.");
    }
    setTag(key: string, value: Primitive): void {
        console.log(key, value)
        throw new Error("Method not implemented.");
    }
    setExtra(key: string, extra: unknown): void {
        console.log(key, extra)
        throw new Error("Method not implemented.");
    }
    setExtras(extras: Extras): void {
        console.log(extras)
        throw new Error("Method not implemented.");
    }
    setContext(name: string, context: { [key: string]: any; } | null): void {
        console.log(name, context)
        throw new Error("Method not implemented.");
    }
    configureScope(callback: (scope: Scope) => void): void {
        console.log(callback)
        throw new Error("Method not implemented.");
    }
    run(callback: (hub: HubInterface) => void): void {
        console.log(callback)
        throw new Error("Method not implemented.");
    }
    getIntegration<T extends Integration>(integration: IntegrationClass<T>): T | null {
        console.log(integration)
        throw new Error("Method not implemented.");
    }
    traceHeaders(): { [key: string]: string; } {
        throw new Error("Method not implemented.");
    }
    startSession(context?: SessionContext): Session {
        const { scope, client } = this.getStackTop();
        const { release, environment } = (client && client.getOptions()) || {};

        // Will fetch userAgent if called from browser sdk
        const global = getGlobalObject<{ navigator?: { userAgent?: string } }>();
        const { userAgent } = global.navigator || {};

        const session = new Session({
            release,
            environment,
            ...(scope && { user: scope.getUser() }),
            ...(userAgent && { userAgent }),
            ...context,
        });
        if (scope) {
            // End existing session if there's one
            const currentSession = scope.getSession && scope.getSession();
            if (currentSession && currentSession.status === 'ok') {
                currentSession.update({ status: 'exited' });
            }
            this.endSession();

            // Afterwards we set the new session on the scope
            scope.setSession(session);
        }
        return session
    }
    endSession(): void {
        const layer = this.getStackTop();
        const scope = layer && layer.scope;
        const session = scope && scope.getSession();
        if (session) {
            session.close();
        }
        this._sendSessionUpdate();

        // the session is over; take it off of the scope
        if (scope) {
            scope.setSession();
        }
    }

    /**
    * Sends the current Session on the scope
    */
    private _sendSessionUpdate(): void {
        const { scope, client } = this.getStackTop();
        if (!scope) return;

        const session = scope.getSession && scope.getSession();
        if (session) {
            if (client && client.captureSession) {
                client.captureSession(session);
            }
        }
    }

    captureSession(endSession?: boolean): void {
        // both send the update and pull the session from the scope
        if (endSession) {
            return this.endSession();
        }

        // only send the update
        this._sendSessionUpdate();
    }


    /**
  * Internal helper function to call a method on the top client if it exists.
  *
  * @param method The method to call on the client.
  * @param args Arguments to pass to the client function.
  */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _invokeClient<M extends keyof Client>(method: M, ...args: any[]): void {
        const { scope, client } = this.getStackTop();
        if (client && client[method]) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
            (client as any)[method](...args, scope);
        }
    }
}

/**
 * Returns the global shim registry.
 *
 * FIXME: This function is problematic, because despite always returning a valid Carrier,
 * it has an optional `__BM__` property, which then in turn requires us to always perform an unnecessary check
 * at the call-site. We always access the carrier through this function, so we can guarantee that `__BM__` is there.
 **/
export function getMainCarrier(): Carrier {
    const carrier = getGlobalObject();
    carrier.__BM__ = carrier.__BM__ || {
        extensions: {},
        hub: undefined,
    };
    return carrier;
}

/**
 * Returns the default hub instance.
 *
 * If a hub is already registered in the global carrier but this module
 * contains a more recent version, it replaces the registered version.
 * Otherwise, the currently registered hub will be returned.
 */
export function getCurrentHub() {
    // Get main carrier (global for every environment)
    const registry = getMainCarrier();

    // If there's no hub, or its an old API, assign a new one
    if (!hasHubOnCarrier(registry) || getHubFromCarrier(registry).isOlderThan(API_VERSION)) {
        setHubOnCarrier(registry, new Hub());
    }
    // Return hub that lives on a global object
    return getHubFromCarrier(registry);
}

/**
 * This will tell whether a carrier has a hub on it or not
 * @param carrier object
 */
function hasHubOnCarrier(carrier: Carrier): boolean {
    return !!(carrier && carrier.__BM__ && carrier.__BM__.hub);
}

/**
 * This will create a new {@link Hub} and add to the passed object on
 * __BM__.hub.
 * @param carrier object
 * @hidden
 */
export function getHubFromCarrier(carrier: Carrier): Hub {
    if (carrier && carrier.__BM__ && carrier.__BM__.hub) return carrier.__BM__.hub;
    carrier.__BM__ = carrier.__BM__ || {};
    carrier.__BM__.hub = new Hub();
    return carrier.__BM__.hub;
}

/**
 * This will set passed {@link Hub} on the passed object's __BM__.hub attribute
 * @param carrier object
 * @param hub Hub
 * @returns A boolean indicating success or failure
 */
export function setHubOnCarrier(carrier: Carrier, hub: Hub): boolean {
    if (!carrier) return false;
    carrier.__BM__ = carrier.__BM__ || {};
    carrier.__BM__.hub = hub;
    return true;
}