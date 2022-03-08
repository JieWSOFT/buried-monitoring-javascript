import { DsnComponents, DsnLike, DsnProtocol } from '@bm/types';

import { isDebugBuild } from './env';
import { BMError } from './error';

/** Regular expression used to parse a Dsn. */
const DSN_REGEX = /^(?:(\w+):)\/\/(?:(\w+)(?::(\w+))?@)([\w.-]+)(?::(\d+))?\/(.+)/;

function isValidProtocol(protocol?: string): protocol is DsnProtocol {
  return protocol === 'http' || protocol === 'https';
}

/**
 * Renders the string representation of this Dsn.
 *
 * By default, this will render the public representation without the password
 * component. To get the deprecated private representation, set `withPassword`
 * to true.
 *
 * @param withPassword When set to true, the password will be included.
 */
export function dsnToString(dsn: DsnComponents, withPassword: boolean = false): string {
  const { host, path, pass, port, projectId, protocol, publicKey } = dsn;
  return (
    `${protocol}://${publicKey}${withPassword && pass ? `:${pass}` : ''}` +
    `@${host}${port ? `:${port}` : ''}/${path ? `${path}/` : path}${projectId}`
  );
}

function dsnFromString(str: string): DsnComponents {
  const match = DSN_REGEX.exec(str);

  if (!match) {
    throw new BMError('Invalid Dsn');
  }

  const [protocol, publicKey, pass = '', host, port = '', lastPath] = match.slice(1);
  let path = '';
  let projectId = lastPath;

  const split = projectId.split('/');
  if (split.length > 1) {
    path = split.slice(0, -1).join('/');
    projectId = split.pop() as string;
  }

  if (projectId) {
    const projectMatch = projectId.match(/^\d+/);
    if (projectMatch) {
      projectId = projectMatch[0];
    }
  }

  return dsnFromComponents({ host, pass, path, projectId, port, protocol: protocol as DsnProtocol, publicKey });
}

function dsnFromComponents(components: DsnComponents): DsnComponents {
  // TODO this is for backwards compatibility, and can be removed in a future version
  if ('user' in components && !('publicKey' in components)) {
    components.publicKey = components.user;
  }

  return {
    user: components.publicKey || '',
    protocol: components.protocol,
    publicKey: components.publicKey || '',
    pass: components.pass || '',
    host: components.host,
    port: components.port || '',
    path: components.path || '',
    projectId: components.projectId,
  };
}

function validateDsn(dsn: DsnComponents): boolean | void {
  if (!isDebugBuild()) {
    return;
  }

  const { port, projectId, protocol } = dsn;

  const requiredComponents: ReadonlyArray<keyof DsnComponents> = ['protocol', 'publicKey', 'host', 'projectId'];
  requiredComponents.forEach(component => {
    if (!dsn[component]) {
      throw new BMError(`Invalid Dsn: ${component} missing`);
    }
  });

  if (!projectId.match(/^\d+$/)) {
    throw new BMError(`Invalid Dsn: Invalid projectId ${projectId}`);
  }

  if (!isValidProtocol(protocol)) {
    throw new BMError(`Invalid Dsn: Invalid protocol ${protocol}`);
  }

  if (port && isNaN(parseInt(port, 10))) {
    throw new BMError(`Invalid Dsn: Invalid port ${port}`);
  }

  return true;
}

/** The Sentry Dsn, identifying a Sentry instance and project. */
export function makeDsn(from: DsnLike): DsnComponents {
  const components = typeof from === 'string' ? dsnFromString(from) : dsnFromComponents(from);

  validateDsn(components);

  return components;
}
