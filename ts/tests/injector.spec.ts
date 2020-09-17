import {Autowired, FTest, getConstructor, Service, Test, TestUnit, XTest} from "../decorators";
import {Injector} from "../injector";

@Service()
class ServiceA {
    public id = 'A';
}

@Service()
class ServiceB {
    @Autowired(ServiceA) public a: ServiceA;

    public id = 'B';
}

@Service('my-service')
class ServiceC {
    public id = 'C'
}

@Service()
class ServiceD {
    @Autowired('service-f') public f;
}

@Service()
class ServiceE {
    @Autowired(ServiceD) public d: ServiceD;
}

@Service('service-f')
class ServiceF {
    @Autowired(ServiceE) public e: ServiceE;
}

@Service()
class ServiceG {
    @Autowired(ServiceB) public b: ServiceB;
}

@Service()
class ServiceH {
    @Autowired(ServiceG) public g: ServiceG;
    constructor(public customParam: string){}
}

@Service()
class ServiceI {
    @Autowired(ServiceH) public g: ServiceH;
}

@Service()
class ServiceJ {
    constructor(public b: ServiceB) {}
}

function FactoryJ(b: ServiceB): ServiceJ {
    return new ServiceJ(b);
}

const A = 'abc';

@TestUnit([
    {provide: ServiceI, useClass: ServiceH},
    {provide: ServiceJ, useFactory: <any>FactoryJ, dependencies: [ServiceB]},
    {provide: 'service-j', useClass: ServiceJ},
])
export class InjectorTestCase {
    @Autowired(ServiceI) public i: ServiceH;
    @Autowired(ServiceB) public b: ServiceB;
    @Autowired('my-service') public c: ServiceC;
    @Autowired(ServiceJ) public j: ServiceJ;
    @Autowired('service-j') public j2: ServiceJ;

    private _assertB(b: ServiceB) {
        expect(b).toBeDefined();
        expect(b.id).toEqual('B');
        expect(b instanceof ServiceB).toBeTrue();
    }

    @Test('testing simple, direct injection')
    public test1() {
        // Test simple, direct injection
        this._assertB(this.b);

        // Constructors comparisons

        // You can't compare the constructors directly.
        expect(this.constructor == InjectorTestCase.constructor).toBeFalse();

        // Instead you have to use the getConstructor provided function
        expect(getConstructor(this.b) == getConstructor(ServiceB)).toBeTrue();
        expect(getConstructor(this.b) == getConstructor(ServiceA)).toBeFalse();
        expect(getConstructor(this) == getConstructor(InjectorTestCase)).toBeTrue();
    }

    @Test('testing token injection')
    public test2() {
        // Test token injection
        expect(this.c instanceof ServiceC).toBeTrue();
        expect(this.c.id).toEqual('C');
    }

    private _assertG(g: ServiceG) {
        expect(g instanceof ServiceG).toBeTrue();
        expect(g.b.id).toEqual('B');
        expect(g.b instanceof ServiceB).toBeTrue();
        expect(g.b.id).toEqual('B')
        expect(g.b.a instanceof ServiceA).toBeTrue();
        expect(g.b.a.id).toEqual('A');
    }

    @Test('testing initialization of dependencies without a factory')
    public test3() {
        // Test no factory initialization
        const g = new ServiceG();
        this._assertG(g);
    }

    @Test('testing initialization of dependencies without a factory and with a custom parameter')
    public test4() {
        const h = new ServiceH('abc');
        expect(h instanceof ServiceH).toBeTrue();
        this._assertG(h.g);
        expect(h.customParam).toEqual('abc');
    }

    @Test('testing circular dependencies')
    public test5() {
        try {
            const f = new ServiceF();
        }
        catch (e) {
            expect(e.message).toEqual('CIRCULAR_DEPENDENCY_DETECTED');
            expect(Injector['_stack'].length).toEqual(0);
        }
    }

    @Test('testing dependency drop in replacement')
    public test6() {
        expect(this.i instanceof ServiceI).toBeFalse();
        expect(this.i instanceof ServiceH).toBeTrue();
        this._assertG(this.i.g);
    }

    @Test('testing factories')
    public test7() {
        expect(this.j instanceof ServiceJ).toBeTrue();
        this._assertB(this.j.b);
        expect(this.j2 instanceof ServiceJ).toBeTrue();
        expect(this.j2.b).toBeUndefined();
    }

    @Test('test manually providing and useValue also')
    public test8() {
        let a = Injector.resolve('A', true);
        expect(a).toBeNull();
        Injector.provide({provide: 'A', useValue: A});
        a = Injector.resolve('A');
        expect(a).toEqual('abc');
    }
}
