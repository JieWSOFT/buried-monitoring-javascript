import { captureException, withScope } from "@bm/core";
import { Mechanism, Scope, WrappedFunction, Event as BMEvent } from "@bm/types";
import { addExceptionMechanism, addExceptionTypeValue, addNonEnumerableProperty, getOriginalFunction, markFunctionWrapped } from "@bm/utils";

// const global = getGlobalObject<Window>();
let ignoreOnError: number = 0;

/**
 * @hidden
 */
export function shouldIgnoreOnError(): boolean {
    return ignoreOnError > 0;
}

/**
 * @hidden
 */
export function ignoreNextOnError(): void {
    // onerror should trigger before setTimeout
    ignoreOnError += 1;
    setTimeout(() => {
        ignoreOnError -= 1;
    });
}


export function wrap(
    fn: WrappedFunction,
    options: {
        mechanism?: Mechanism;
    } = {},
    before?: WrappedFunction,
) {
    if (typeof fn !== 'function') {
        return fn;
    }

    try {
        // if we're dealing with a function that was previously wrapped, return
        // the original wrapper.
        const wrapper = fn.__bm_wrapped__;
        if (wrapper) {
            return wrapper;
        }

        // We don't wanna wrap it twice
        if (getOriginalFunction(fn)) {
            return fn;
        }
    } catch (e) {
        return fn
    }


    const bmWrapped: WrappedFunction = function (this: any): void {
        const args = Array.prototype.slice.call(arguments);
        try {
            if (before && typeof before === 'function') {
                before.apply(this, arguments);
            }
            const wrappedArguments = args.map((arg: any) => wrap(arg, options));
            return fn.apply(this, wrappedArguments);
        } catch (ex) {
            ignoreNextOnError();

            withScope((scope: Scope) => {
                scope.addEventProcessor((event: BMEvent) => {
                    if (options.mechanism) {
                        addExceptionTypeValue(event, undefined, undefined);
                        addExceptionMechanism(event, options.mechanism);
                    }

                    event.extra = {
                        ...event.extra,
                        arguments: args,
                    };

                    return event;
                })
                captureException(ex);
            })

            throw ex
        }
    }

    try {
        for (const property in fn) {
            if (Object.prototype.hasOwnProperty.call(fn, property)) {
                bmWrapped[property] = fn[property];
            }
        }
    } catch (_oO) { } // eslint-disable-line no-empty


    markFunctionWrapped(bmWrapped, fn);

    addNonEnumerableProperty(fn, '__bm_wrapped__', bmWrapped);


    // Restore original function name (not all browsers allow that)
    try {
        const descriptor = Object.getOwnPropertyDescriptor(bmWrapped, 'name') as PropertyDescriptor;
        if (descriptor.configurable) {
            Object.defineProperty(bmWrapped, 'name', {
                get(): string {
                    return fn.name;
                },
            });
        }
        // eslint-disable-next-line no-empty
    } catch (_oO) { }

    return bmWrapped;
}