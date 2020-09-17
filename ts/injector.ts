import {Type} from "./type";
import {Provider} from "./providers";

type KeyType = string | Type<any>;
class Dependency {
    value: any;
    provider: Provider;
}

export class Injector {
    private static _map: Map<KeyType, Dependency> = new Map<KeyType, Dependency>();
    private static _stack: Array<Dependency> = [];

    private static _throw(err: string) {
        this._stack = [];
        throw new Error(err);
    }

    public static resolve(key: KeyType, optional: boolean = false): any {
        if (!Injector._map.has(key)) {
            if (optional) {
                Injector._stack.pop();
                return null;
            }
            console.error('dependency not found for', key);
            console.log('map is', this._map);
            Injector._throw('DEPENDENCY_NOT_FOUND');
        }

        const dep = Injector._map.get(key);

        if (Injector._stack.indexOf(dep) != -1) {
            console.error('circular dependency detected', Injector._stack.map(d => d.provider.provide).join(' -> '));
            Injector._throw('CIRCULAR_DEPENDENCY_DETECTED');
        }

        if (dep.value) {
            Injector._stack.pop();
            return dep.value;
        }

        Injector._stack.push(dep);

        if (dep.provider.useValue) {
            dep.value = dep.provider.useValue;
            Injector._stack.pop();
            return dep.value;
        }

        if (dep.provider.useFactory) {
            dep.value = dep.provider.useFactory(...(dep.provider.dependencies || []).map(d => Injector.resolve(d)));
            Injector._stack.pop();
            return dep.value;
        }

        dep.value = new dep.provider.useClass();
        Injector._stack.pop();
        return dep.value;
    }

    public static provide(provider: Provider | Type<any>) {
        let p = provider;
        if (typeof(p) == 'function') {
            p = <Provider>{provide: provider, useClass: p};
        }

        if (!Injector._map.has(p.provide)) {
            const dep = new Dependency();
            dep.provider = p;
            Injector._map.set(p.provide, dep);
            return ;
        }
        Injector._map.get(p.provide).provider = p;
    }

    public static reset() {
        Injector._map = new Map<KeyType, Dependency>();
        Injector._stack = [];
    }
}
