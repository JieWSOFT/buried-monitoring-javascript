import { Event, EventHint, Options, Session, Severity, Transport, } from "@bm/types";
import { BMError, isDebugBuild, logger } from "@bm/utils";
import { NoopTransport } from "./transports/noop";

/**
 * 内部平台依赖的BM SDK后端。
 *
 * 当{@link Client}包含SDK特有的业务逻辑时，后端提供了平台特有的低级操作。
 * 后台为低级别的操作提供特定的平台实现。
 * 这些都是持久化和加载信息，发送事件，以及钩住
 * 进入环境。
 *
 * 后端在其构造函数中接收到一个客户端的句柄。当一个
 * 后端自动生成事件时，它必须先把它们传递给
 * 客户端，以便首先进行验证和处理。
 *
 * 通常，客户端将是相应的类型，例如，NodeBackend
 * 接收NodeClient。然而，更高级别的SDK可以选择实例化
 * 多个后端并在它们之间委托任务。在这种情况下，一个事件
 * 由一个后端产生的事件很有可能被另一个后端所发送。
 *
 * 客户端还通过{@link Client.getOptions}提供对选项的访问。
 * @hidden
 */
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
 * 一个可以实例化后端对象的类对象。
 * @hidden
 */
export type BackendClass<B extends Backend, O extends Options> = new (options: O) => B;




export abstract class BaseBackend<O extends Options> implements Backend {
    /**传递给SDK的Options。*/
    protected readonly _options: O;

    /**内部使用的缓存传输。*/
    protected _transport: Transport;

    /** Creates a new backend instance. */
    public constructor(options: O) {
        this._options = options;
        if (!this._options.dsn) {
            logger.warn('No DSN provided, backend will not do anything.');
        }
        this._transport = this._setupTransport();
    }
    public eventFromException(_exception: any, _hint?: EventHint): PromiseLike<Event> {
        throw new BMError('Backend has to implement `eventFromException` method');
    }

    public eventFromMessage(_message: string, _level?: Severity, _hint?: EventHint): PromiseLike<Event> {
        throw new BMError('Backend has to implement `eventFromMessage` method');
    }

    sendEvent(event: Event): void {
        void this._transport.sendEvent(event).then(null, reason => {
            if (isDebugBuild()) {
                logger.error(`Error while sending event: ${reason}`);
            }
        });
    }
    sendSession(session: Session): void {
        if (!this._transport.sendSession) {
            if (isDebugBuild()) {
                logger.warn("Dropping session because custom transport doesn't implement sendSession");
            }
            return;
        }

        void this._transport.sendSession(session).then(null, reason => {
            if (isDebugBuild()) {
                logger.error(`Error while sending session: ${reason}`);
            }
        });
    }

    /**
   * @inheritDoc
   */
    public getTransport(): Transport {
        return this._transport;
    }

    /**
    * 设置传输，以便以后可以用来发送请求。
    */
    protected _setupTransport(): Transport {
        return new NoopTransport();
    }
}