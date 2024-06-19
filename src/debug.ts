import debug from 'debug';

export function createDebug(name: string): debug.Debugger {
    return debug(`@map-colonies/config:${name}`);
}