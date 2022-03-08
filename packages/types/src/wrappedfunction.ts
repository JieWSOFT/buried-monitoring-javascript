/** JSDoc */
export interface WrappedFunction extends Function {
  [key: string]: any;
  __BM_wrapped__?: WrappedFunction;
  __BM_original__?: WrappedFunction;
}
