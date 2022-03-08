import { WrappedFunction } from "@bm/types";
import { getGlobalObject } from "./global";


const global = getGlobalObject<Window | NodeJS.Global>();


/** Prefix for logging strings */
const PREFIX = 'BM Logger ';

/** JSDoc */
interface ExtensibleConsole extends Console {
    [key: string]: any;
}

/**
 * 暂时解除对`console.log`和朋友的包装，以便使用原始方法执行给定的回调。
 * 回调完成后恢复包装。
 *
 * @param callback The function to run against the original `console` messages
 * @returns The results of the callback
 */
export function consoleSandbox(callback: () => any): any {
    const global = getGlobalObject<Window>();
    const levels = ['debug', 'info', 'warn', 'error', 'log', 'assert'];

    if (!('console' in global)) {
        return callback();
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const originalConsole = (global as any).console as ExtensibleConsole;
    const wrappedLevels: { [key: string]: any } = {};

    // Restore all wrapped console methods
    levels.forEach(level => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (level in (global as any).console && (originalConsole[level] as WrappedFunction).__bm_original__) {
            wrappedLevels[level] = originalConsole[level] as WrappedFunction;
            originalConsole[level] = (originalConsole[level] as WrappedFunction).__bm_original__;
        }
    });

    // Perform callback manipulations
    const result = callback();

    // Revert restoration to wrapped state
    Object.keys(wrappedLevels).forEach(level => {
        originalConsole[level] = wrappedLevels[level];
    });

    return result;
}


/** JSDoc */
class Logger {
    /** JSDoc */
    private _enabled: boolean;

    /** JSDoc */
    public constructor() {
        this._enabled = false;
    }

    /** JSDoc */
    public disable(): void {
        this._enabled = false;
    }

    /** JSDoc */
    public enable(): void {
        this._enabled = true;
    }

    /** JSDoc */
    public log(...args: any[]): void {
        if (!this._enabled) {
            return;
        }
        consoleSandbox(() => {
            (global as any).console.log(`${PREFIX}[Log]: ${args.join(' ')}`);
        });
    }

    /** JSDoc */
    public warn(...args: any[]): void {
        if (!this._enabled) {
            return;
        }
        consoleSandbox(() => {
            (global as any).console.warn(`${PREFIX}[Warn]: ${args.join(' ')}`);
        });
    }

    /** JSDoc */
    public error(...args: any[]): void {
        if (!this._enabled) {
            return;
        }
        consoleSandbox(() => {
            (global as any).console.error(`${PREFIX}[Error]: ${args.join(' ')}`);
        });
    }
}

// Ensure we only have a single logger instance, even if multiple versions of @sentry/utils are being used
global.__BM__ = global.__BM__ || {};
const logger = (global.__BM__.logger as Logger) || (global.__BM__.logger = new Logger());

export { logger };