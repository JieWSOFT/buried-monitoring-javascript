/** Supported BM transport protocols in a Dsn. */
export type DsnProtocol = 'http' | 'https';

/** Primitive components of a Dsn. */
export interface DsnComponents {
  /** Protocol used to connect to BM. */
  protocol: DsnProtocol;
  /** Public authorization key (deprecated, renamed to publicKey). */
  user?: string;
  /** Public authorization key. */
  publicKey?: string;
  /** Private authorization key (deprecated, optional). */
  pass?: string;
  /** Hostname of the BM instance. */
  host: string;
  /** Port of the BM instance. */
  port?: string;
  /** Sub path/ */
  path?: string;
  /** Project ID */
  projectId: string;
}

/** Anything that can be parsed into a Dsn. */
export type DsnLike = string | DsnComponents;
