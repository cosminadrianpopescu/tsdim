import 'reflect-metadata';
import {AUTOGEN_KEY, Injector, __getBaseCtor} from './injector';
import {Provider} from './providers';
import {Type} from './type';

type TestCase = {name: string, x: boolean, f: boolean};
const TESTS_KEY = '__testcases__';
const INJ_KEY = '__injectors__';

type AutowireParam = {type: Type<any> | string, optional: boolean};

type DecoratorParameterType = Type<any> | string | TestCase | Array<Provider> | AutowireParam;
type DecoratorMetadata = {prop: string, arg: DecoratorParameterType};

function __decorateProperty(decorationName: string, arg: DecoratorParameterType) {
    return function(ctor: any, property: string) {
        Reflect.defineProperty(ctor, property, {enumerable: true, writable: true});
        return Reflect.defineMetadata(decorationName, {prop: property, arg: arg}, __getBaseCtor(ctor), property);
    }
}

function __getDecorations(proto: any, key: string): Array<DecoratorMetadata> {
    const result: Array<DecoratorMetadata> = [];
    for (let p of Object.getOwnPropertyNames(proto)) {
        result.push(Reflect.getMetadata(key, proto, p));
    }

    return result.filter(r => !!r);
}

function __getInjectors(ctor: Function): Array<DecoratorMetadata> {
    return __getDecorations(ctor.prototype, INJ_KEY);
}

export function getTestunits(): Array<Type<any>> {
    return Reflect.getOwnMetadata(TESTS_KEY, Object) || [];
}

export function getTestcases(instance: Function): Array<DecoratorMetadata> {
    return __getDecorations(Object.getPrototypeOf(instance.prototype), TESTS_KEY);
}

export function Autowired(type: Type<any> | string, optional: boolean = false) {
    return __decorateProperty(INJ_KEY, <AutowireParam>{optional: optional, type: type});
}

export function getConstructor(instance: any): any {
    return instance._constructor || instance.prototype._constructor || instance.constructor;
}

function __swapConstructor(ctor: any) {
    const result = class extends ctor {
        constructor(...args) {
            ctor.prototype['_constructor'] = ctor;
            __getInjectors(ctor).forEach(i => {
                const p: AutowireParam = i.arg as AutowireParam;
                ctor.prototype[i.prop] = Injector.resolve(__getBaseCtor(p.type), p.optional);
            });
            super(...args);
        };
    }

    Reflect.defineMetadata(AUTOGEN_KEY, true, result);

    return result;
}

export function Service(provide?: Type<any> | string) {
    return function (ctor: Function) {
        const result = __swapConstructor(ctor);
        Injector.provide(<Provider>{provide: provide || ctor, useClass: result});
        return <any>result;
    }
}

// TRUST -> Antisocial

export function TestUnit(providers?: Array<Provider | Type<any>>) {
    return function (ctor: {new(...args: any): any; prototype: any;}) {
        const result = __swapConstructor(ctor);
        providers.forEach(p => {
            if (typeof(p) == 'object') {
                p.provide = __getBaseCtor(p.provide);
                p.dependencies = (p.dependencies || []).map(d => __getBaseCtor(d));
            }
            Injector.provide(p);
        });
        const tests = Reflect.getOwnMetadata(TESTS_KEY, Object) || [];
        tests.push(result);
        Reflect.defineMetadata(TESTS_KEY, tests, Object);
        return <any>result;
    }
}

export function Test(name?: string) {
    return __decorateProperty(TESTS_KEY, <TestCase>{name: name, x: false, f: false});
}

export function FTest(name?: string) {
    return __decorateProperty(TESTS_KEY, <TestCase>{name: name, x: false, f: true});
}

export function XTest(name?: string) {
    return __decorateProperty(TESTS_KEY, <TestCase>{name: name, x: true, f: false});
}

