import { Type } from "./type";

export class Provider {
    provide: string | Type<any>;
    useClass?: Type<any>;
    useFactory?: (...dependencies: Array<string | Type<any>>) => Type<any>;
    useValue?: any;
    dependencies?: Array<string | Type<any>> = [];
}
