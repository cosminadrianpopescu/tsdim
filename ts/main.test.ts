require('reflect-metadata');
import * as fs from 'fs';
import * as jasmine from 'jasmine/lib/jasmine';
import {getTestcases, getTestunits} from '.';
import {Injector} from './injector';
// var jasmine = global['jasmine'];
var j = new jasmine({});

const loadFolder = function(path: string) {
    const files = fs.readdirSync(path);
    files
        .filter(f => f.match(/\.spec\.js$/g))
        .forEach(f => require(`${path}/${f.replace(/\.js$/g, '')}`));

    files
        .filter(f => fs.statSync(`${path}/${f}`).isDirectory())
        .forEach(f => loadFolder(`${path}/${f}`));
};
loadFolder('.');

const __describe__ = describe;

global.describe = function(description, specs) {
    return __describe__(description, () => {
        afterAll(() => {
            Injector.reset();
        });
        specs();
    });
}

const units = getTestunits();

units.forEach(unit => {
    describe(`Running ${unit.constructor.name}`, () => {
        const tests = getTestcases(unit);
        const instance = new (unit)();
        tests.forEach(t => {
            const tc = t.arg as any;
            const callback = tc.x ? xit : tc.f ? fit : it;
            callback(`Running test case ${tc.name || t.prop}`, instance[t.prop].bind(instance));
        });
    });
});

j.execute();
