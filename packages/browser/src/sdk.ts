import { initAndBind } from "@bm/core";
import { getCurrentHub, Hub } from "@bm/hub";
import { addInstrumentationHandler, getGlobalObject, isDebugBuild, logger } from '@bm/utils'
import { BrowserOptions } from "./backend";
import { BrowserClient } from "./client";
import { TryCatch } from "./integrations";


export const defaultIntegrations = [
    new TryCatch()
]


export function init(options: BrowserOptions = {}): void {
    if (options.defaultIntegrations === undefined) {
        options.defaultIntegrations = defaultIntegrations;
    }

    if (options.autoSessionTracking === undefined) {
        options.autoSessionTracking = true;
    }

    initAndBind(BrowserClient, options)

    if (options.autoSessionTracking) {
        startSessionTracking()
    }
}

function startSessionOnHub(hub: Hub): void {
    hub.startSession({ ignoreDuration: true });
    hub.captureSession();
}

/**
 * Enable automatic Session Tracking for the initial page load.
 */
function startSessionTracking(): void {
    const window = getGlobalObject<Window>();
    const document = window.document;
    if (typeof document === 'undefined') {
        if (isDebugBuild()) {
            logger.warn('Session tracking in non-browser environment with @bm/browser is not supported.');
        }
        return;
    }

    const hub = getCurrentHub();

    if (!hub.captureSession) {
        return;
    }

    // The session duration for browser sessions does not track a meaningful
    // concept that can be used as a metric.
    // Automatically captured sessions are akin to page views, and thus we
    // discard their duration.
    startSessionOnHub(hub);

    // We want to create a session for every navigation as well
    addInstrumentationHandler('history', ({ from, to }) => {
        // Don't create an additional session for the initial route or if the location did not change
        if (!(from === undefined || from === to)) {
            startSessionOnHub(getCurrentHub());
        }
    });


}