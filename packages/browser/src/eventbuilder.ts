import { Event, EventHint, Options, Severity } from '@bm/types';
import {
    addExceptionMechanism,
    addExceptionTypeValue,
    isDOMError,
    isDOMException,
    isError,
    isErrorEvent,
    isEvent,
    isPlainObject,
    resolvedSyncPromise,
} from '@bm/utils';

import { eventFromPlainObject, eventFromStacktrace, prepareFramesForEvent } from './parsers';
import { computeStackTrace } from './tracekit';

/**
 * 从`captureException`的所有输入和`captureMessage`的非原始输入创建一个{@link Event}。
 * @hidden
 */
export function eventFromException(options: Options, exception: unknown, hint?: EventHint): PromiseLike<Event> {
    const syntheticException = (hint && hint.syntheticException) || undefined;
    const event = eventFromUnknownInput(exception, syntheticException, {
        attachStacktrace: options.attachStacktrace,
    });
    addExceptionMechanism(event); // defaults to { type: 'generic', handled: true }
    event.level = Severity.Error;
    if (hint && hint.event_id) {
        event.event_id = hint.event_id;
    }
    return resolvedSyncPromise(event);
}

/**
 * Builds and Event from a Message
 * @hidden
 */
export function eventFromMessage(
    options: Options,
    message: string,
    level: Severity = Severity.Info,
    hint?: EventHint,
): PromiseLike<Event> {
    const syntheticException = (hint && hint.syntheticException) || undefined;
    const event = eventFromString(message, syntheticException, {
        attachStacktrace: options.attachStacktrace,
    });
    event.level = level;
    if (hint && hint.event_id) {
        event.event_id = hint.event_id;
    }
    return resolvedSyncPromise(event);
}

/**
 * @hidden
 */
export function eventFromUnknownInput(
    exception: unknown,
    syntheticException?: Error,
    options: {
        isRejection?: boolean;
        attachStacktrace?: boolean;
    } = {},
): Event {
    let event: Event;

    if (isErrorEvent(exception as ErrorEvent) && (exception as ErrorEvent).error) {
        // If it is an ErrorEvent with `error` property, extract it to get actual Error
        const errorEvent = exception as ErrorEvent;
        // eslint-disable-next-line no-param-reassign
        exception = errorEvent.error;
        event = eventFromStacktrace(computeStackTrace(exception as Error));
        return event;
    }

    // 如果它是一个`DOMError'（这是一个传统的API，但在一些浏览器中仍然支持），那么我们只是提取名称
    // 和消息，因为它没有提供其他东西。根据规范，所有的`DOMExceptions`也应该是
    // `Error`s，但在IE11中不是这样的，所以在这种情况下，我们把它和`DOMError`一样对待。
    //
    // https://developer.mozilla.org/en-US/docs/Web/API/DOMError
    // https://developer.mozilla.org/en-US/docs/Web/API/DOMException
    // https://webidl.spec.whatwg.org/#es-DOMException-specialness
    // @ts-ignore：现代浏览器没有DOMError对象定义
    if (isDOMError(exception as DOMError) || isDOMException(exception as DOMException)) {
        const domException = exception as DOMException;

        if ('stack' in (exception as Error)) {
            event = eventFromStacktrace(computeStackTrace(exception as Error));
        } else {
            const name = domException.name || (isDOMError(domException) ? 'DOMError' : 'DOMException');
            const message = domException.message ? `${name}: ${domException.message}` : name;
            event = eventFromString(message, syntheticException, options);
            addExceptionTypeValue(event, message);
        }
        if ('code' in domException) {
            event.tags = { ...event.tags, 'DOMException.code': `${domException.code}` };
        }

        return event;
    }
    if (isError(exception as Error)) {
        // we have a real Error object, do nothing
        event = eventFromStacktrace(computeStackTrace(exception as Error));
        return event;
    }
    if (isPlainObject(exception) || isEvent(exception)) {
        // If it's a plain object or an instance of `Event` (the built-in JS kind, not this SDK's `Event` type), serialize
        // it manually. This will allow us to group events based on top-level keys which is much better than creating a new
        // group on any key/value change.
        const objectException = exception as Record<string, unknown>;
        event = eventFromPlainObject(objectException, syntheticException, options.isRejection);
        addExceptionMechanism(event, {
            synthetic: true,
        });
        return event;
    }

    // If none of previous checks were valid, then it means that it's not:
    // - an instance of DOMError
    // - an instance of DOMException
    // - an instance of Event
    // - an instance of Error
    // - a valid ErrorEvent (one with an error property)
    // - a plain Object
    //
    // So bail out and capture it as a simple message:
    event = eventFromString(exception as string, syntheticException, options);
    addExceptionTypeValue(event, `${exception}`, undefined);
    addExceptionMechanism(event, {
        synthetic: true,
    });

    return event;
}

/**
 * @hidden
 */
export function eventFromString(
    input: string,
    syntheticException?: Error,
    options: {
        attachStacktrace?: boolean;
    } = {},
): Event {
    const event: Event = {
        message: input,
    };

    if (options.attachStacktrace && syntheticException) {
        const stacktrace = computeStackTrace(syntheticException);
        const frames = prepareFramesForEvent(stacktrace.stack);
        event.stacktrace = {
            frames,
        };
    }

    return event;
}
