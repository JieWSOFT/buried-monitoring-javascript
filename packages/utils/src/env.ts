/**
 * 这个模块主要是为了在构建过程中通过rollup和terser进行优化。 
 * 我们定义了一些全局常数，这些常数通常是未定义的。 
 * 然而，terser用全局定义覆盖了这些常量，这些常量可以在静态分析器中进行评估。
 * 创建一个捆绑包时，可以通过静态分析器进行评估。
 *
 * In turn the `isDebugBuild` and `isBrowserBundle` functions are pure
 * and can help us remove unused code from the bundles.
 */

declare const __BM_BROWSER_BUNDLE__: boolean | undefined;
declare const __BM_NO_DEBUG__: boolean | undefined;

/**
 * Figures out if we're building with debug functionality.
 *
 * @returns true if this is a debug build
 */
export function isDebugBuild(): boolean {
  return typeof __BM_NO_DEBUG__ !== 'undefined' && !__BM_BROWSER_BUNDLE__;
}

/**
 * Figures out if we're building a browser bundle.
 *
 * @returns true if this is a browser bundle build.
 */
export function isBrowserBundle(): boolean {
  return typeof __BM_BROWSER_BUNDLE__ !== 'undefined' && !!__BM_BROWSER_BUNDLE__;
}
