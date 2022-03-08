
import { Session as SessionInterface, SessionContext, SessionStatus } from '@bm/types';
import { dropUndefinedKeys, timestampInSeconds, uuid4 } from '@bm/utils';

/**
 * @inheritdoc
 */
export class Session implements SessionInterface {
    public userAgent?: string;
    public errors: number = 0;
    public release?: string;
    public sid: string = uuid4();
    public did?: string;
    public timestamp: number;
    public started: number;
    public duration?: number = 0;
    public status: SessionStatus = 'ok';
    public environment?: string;
    public ipAddress?: string;
    public init: boolean = true;
    public ignoreDuration: boolean = false;

    public constructor(context?: Omit<SessionContext, 'started' | 'status'>) {
        // Both timestamp and started are in seconds since the UNIX epoch.
        const startingTime = timestampInSeconds();
        this.timestamp = startingTime;
        this.started = startingTime;
        if (context) {
            this.update(context);
        }
    }

    update(context: SessionContext = {}): void {
        if (context.user) {
            if (!this.ipAddress && context.user.ip_address) {
                this.ipAddress = context.user.ip_address;
            }

            if (!this.did && !context.did) {
                this.did = context.user.id || context.user.email || context.user.username;
            }
        }
        this.timestamp = context.timestamp || timestampInSeconds();
        if (context.ignoreDuration) {
            this.ignoreDuration = context.ignoreDuration;
        }
        if (context.sid) {
            // Good enough uuid validation. — Kamil
            this.sid = context.sid.length === 32 ? context.sid : uuid4();
        }
        if (context.init !== undefined) {
            this.init = context.init;
        }
        if (!this.did && context.did) {
            this.did = `${context.did}`;
        }
        if (typeof context.started === 'number') {
            this.started = context.started;
        }
        if (this.ignoreDuration) {
            this.duration = undefined;
        } else if (typeof context.duration === 'number') {
            this.duration = context.duration;
        } else {
            const duration = this.timestamp - this.started;
            this.duration = duration >= 0 ? duration : 0;
        }
        if (context.release) {
            this.release = context.release;
        }
        if (context.environment) {
            this.environment = context.environment;
        }
        if (!this.ipAddress && context.ipAddress) {
            this.ipAddress = context.ipAddress;
        }
        if (!this.userAgent && context.userAgent) {
            this.userAgent = context.userAgent;
        }
        if (typeof context.errors === 'number') {
            this.errors = context.errors;
        }
        if (context.status) {
            this.status = context.status;
        }
    }
    close(status?: SessionStatus): void {
        if (status) {
            this.update({ status });
        } else if (this.status === 'ok') {
            this.update({ status: 'exited' });
        } else {
            this.update();
        }
    }

    toJSON(): { init: boolean; sid: string; did?: string | undefined; timestamp: string; started: string; duration?: number | undefined; status: SessionStatus; errors: number; attrs?: { release?: string | undefined; environment?: string | undefined; user_agent?: string | undefined; ip_address?: string | undefined; } | undefined; } {
        return dropUndefinedKeys({
            sid: `${this.sid}`,
            init: this.init,
            // Make sure that sec is converted to ms for date constructor
            started: new Date(this.started * 1000).toISOString(),
            timestamp: new Date(this.timestamp * 1000).toISOString(),
            status: this.status,
            errors: this.errors,
            did: typeof this.did === 'number' || typeof this.did === 'string' ? `${this.did}` : undefined,
            duration: this.duration,
            attrs: {
                release: this.release,
                environment: this.environment,
                ip_address: this.ipAddress,
                user_agent: this.userAgent,
            },
        });
    }
}