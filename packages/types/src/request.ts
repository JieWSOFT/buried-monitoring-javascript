/** Possible BMRequest types that can be used to make a distinction between BM features */
// NOTE(kamil): It would be nice if we make it a valid enum instead
export type BMRequestType = 'event' | 'transaction' | 'session' | 'attachment';

/** A generic client request. */
export interface BMRequest {
  body: string;
  type: BMRequestType;
  url: string;
}

/** Request data included in an event as sent to BM */
export interface Request {
  url?: string;
  method?: string;
  data?: any;
  query_string?: QueryParams;
  cookies?: { [key: string]: string };
  env?: { [key: string]: string };
  headers?: { [key: string]: string };
}

export type QueryParams = string | { [key: string]: string } | Array<[string, string]>;
