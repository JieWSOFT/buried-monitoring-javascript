import { DsnLike } from './dsn';
import { Event } from './event';
import { BMRequestType } from './request';
import { Response } from './response';
import { SdkMetadata } from './sdkmetadata';
import { Session, SessionAggregates } from './session';

export type Outcome =
  | 'before_send'
  | 'event_processor'
  | 'network_error'
  | 'queue_overflow'
  | 'ratelimit_backoff'
  | 'sample_rate';

/** Transport used sending data to BM */
export interface Transport {
  /**
   * Sends the event to the Store endpoint in BM.
   *
   * @param event Event that should be sent to BM.
   */
  sendEvent(event: Event): PromiseLike<Response>;

  /**
   * Sends the session to the Envelope endpoint in BM.
   *
   * @param session Session that should be sent to BM | Session Aggregates that should be sent to BM.
   */
  sendSession?(session: Session | SessionAggregates): PromiseLike<Response>;

  /**
   * Wait for all events to be sent or the timeout to expire, whichever comes first.
   *
   * @param timeout Maximum time in ms the transport should wait for events to be flushed. Omitting this parameter will
   *   cause the transport to wait until all events are sent before resolving the promise.
   * @returns A promise that will resolve with `true` if all events are sent before the timeout, or `false` if there are
   * still events in the queue when the timeout is reached.
   */
  close(timeout?: number): PromiseLike<boolean>;

  /**
   * Increment the counter for the specific client outcome
   */
  recordLostEvent?(type: Outcome, category: BMRequestType): void;
}

/** JSDoc */
export type TransportClass<T extends Transport> = new (options: TransportOptions) => T;

/** JSDoc */
export interface TransportOptions {
  /** BM DSN */
  dsn: DsnLike;
  /** Define custom headers */
  headers?: { [key: string]: string };
  /** Set a HTTP proxy that should be used for outbound requests. */
  httpProxy?: string;
  /** Set a HTTPS proxy that should be used for outbound requests. */
  httpsProxy?: string;
  /** HTTPS proxy certificates path */
  caCerts?: string;
  /** Fetch API init parameters */
  fetchParameters?: { [key: string]: string };
  /** The envelope tunnel to use. */
  tunnel?: string;
  /** Send SDK Client Reports. Enabled by default. */
  sendClientReports?: boolean;
  /**
   * Set of metadata about the SDK that can be internally used to enhance envelopes and events,
   * and provide additional data about every request.
   * */
  _metadata?: SdkMetadata;
}
