import { AuxCompiler } from './AuxCompiler';

describe('AuxCompiler', () => {
    let compiler: AuxCompiler;

    beforeEach(() => {
        compiler = new AuxCompiler();
    });

    describe('compile()', () => {
        it('should return a function that executes the given code', () => {
            const func = compiler.compile('return 1 + 2');

            expect(func()).toEqual(3);
        });

        it('should make the given variables available to the script', () => {
            const func = compiler.compile('return num1 + num2', {
                variables: {
                    num1: () => 10,
                    num2: () => 5,
                },
            });

            expect(func()).toEqual(15);
        });

        it('should bind the given "this" variable to the script', () => {
            const func = compiler.compile('return this + num', {
                variables: {
                    num: () => 10,
                    this: () => 'hello',
                },
            });

            expect(func()).toEqual('hello10');
        });

        it('should support using a context object to derive variables', () => {
            const func = compiler.compile('return this + num', {
                variables: {
                    num: (ctx: any) => ctx.num,
                    this: () => 'hello',
                },
                context: {
                    num: 5,
                },
            });

            expect(func()).toEqual('hello5');
        });

        it('should support running arbitrary code before execution', () => {
            const context = {
                num: 0,
            };

            const func = compiler.compile('return num', {
                variables: {
                    num: (ctx: any) => ctx.num,
                },
                before: (ctx: any) => (ctx.num += 1),
                context,
            });

            expect(func()).toEqual(1);
            expect(func()).toEqual(2);

            expect(context).toEqual({
                num: 2,
            });
        });

        it('should support running arbitrary code after execution', () => {
            const context = {
                num: 0,
            };

            const func = compiler.compile('return num', {
                variables: {
                    num: (ctx: any) => ctx.num,
                },
                after: (ctx: any) => (ctx.num += 1),
                context,
            });

            expect(func()).toEqual(0);
            expect(func()).toEqual(1);

            expect(context).toEqual({
                num: 2,
            });
        });

        it('should allow redefining variables in the script', () => {
            const context = {
                num: 5,
            };

            const func = compiler.compile('let num = -1; return num;', {
                variables: {
                    num: (ctx: any) => ctx.num,
                },
                context,
            });

            expect(func()).toEqual(-1);
        });

        it('should not allow reassigning a constant value', () => {
            const func = compiler.compile('num = 1; return num;', {
                constants: {
                    num: -5,
                },
            });

            expect(() => {
                func();
            }).toThrow();
        });

        it('should not allow reassigning a variable', () => {
            const func = compiler.compile('num = 1; return num;', {
                variables: {
                    num: () => -5,
                },
            });

            expect(() => {
                func();
            }).toThrow();
        });

        it('should support constant values compiled into the script', () => {
            const func = compiler.compile('return num;', {
                constants: {
                    num: -5,
                },
            });

            expect(func()).toEqual(-5);
        });

        it('should support constant values compiled into the script', () => {
            const func = compiler.compile('return num;', {
                constants: {
                    num: -5,
                },
            });

            expect(func()).toEqual(-5);
        });

        it('should return metadata for the compiled script', () => {
            const script = 'return str + num + abc;';
            const func = compiler.compile(script, {
                constants: {
                    num: -5,
                    str: 'abc',
                },
                variables: {
                    abc: () => 'def',
                },
                before: () => {},
                after: () => {},
            });

            // Contants + variables + extras + lines added by the JS spec
            // See https://tc39.es/ecma262/#sec-createdynamicfunction
            expect(func.metadata.scriptLineOffset).toEqual(7);
        });

        it('should transpile the user code to include energy checks', () => {
            function __energyCheck() {
                throw new Error('Energy Check Hit!');
            }

            const script = 'let num = 0; while(num === 0) { num += 1; }';
            const func = compiler.compile(script, {
                constants: {
                    __energyCheck,
                },
            });

            expect(() => {
                func();
            }).toThrow(new Error('Energy Check Hit!'));
        });

        it('should support listen scripts', () => {
            const func = compiler.compile('@return 1 + 2');

            expect(func()).toEqual(3);
        });

        it('should support arguments in listeners', () => {
            const func = compiler.compile('return args.length');

            expect(func(1, 2, 3, 4, 5)).toEqual(5);
        });

        it('should support mapping arguments to variable names', () => {
            const func = compiler.compile('return abc + def + args.length', {
                arguments: ['abc', 'def'],
            });

            expect(func(1, 2, 3, 4, 5)).toEqual(3 + 5);
        });

        it('should support mapping multiple variable names to a single argument', () => {
            const func = compiler.compile('return abc + def + args.length', {
                arguments: [['abc', 'def']],
            });

            expect(func(1, 2, 3, 4, 5)).toEqual(2 + 5);
        });

        it('should support wrapping the invocation with another function', () => {
            const test = jest.fn();
            const context = {
                abc: 'def',
            };
            const func = compiler.compile('return 1 + 2 + abc + this.def;', {
                invoke(fn, ctx) {
                    test(ctx);
                    return fn();
                },
                context: context,
                arguments: [['abc']],
                variables: {
                    this: () => ({
                        def: 4,
                    }),
                },
            });

            expect(func(3)).toBe(10);
            expect(test).toBeCalledWith(context);
        });

        it('should support running some code when an error occurs', () => {
            let errors = [] as any[];
            const func = compiler.compile('throw new Error("abc")', {
                onError(err: any) {
                    errors.push(err);
                },
            });

            func();
            expect(errors).toEqual([new Error('abc')]);
        });

        it('should rethrow the error by default', () => {
            const func = compiler.compile('throw new Error("abc")', {
                before() {},
            });

            expect(() => {
                func();
            }).toThrow(new Error('abc'));
        });

        it('should return an AsyncFunction when the script contains await', async () => {
            const func = compiler.compile('return await abc;', {
                variables: {
                    abc: () => 100,
                },
            });

            const AsyncFunction = (async () => {}).constructor;
            expect(func).toBeInstanceOf(AsyncFunction);

            const result = func();
            expect(result).toBeInstanceOf(Promise);

            const final = await result;
            expect(final).toEqual(100);
        });

        it('should support wrapping the native promise with a global promise if theyre not the same', async () => {
            const DefaultPromise = Promise;
            try {
                class CustomPromise {}
                Promise = <any>CustomPromise;

                const func = compiler.compile('return await abc;', {
                    variables: {
                        abc: () => 100,
                    },
                });

                const AsyncFunction = (async () => {}).constructor;
                expect(func).toBeInstanceOf(AsyncFunction);

                const result = func();
                expect(result).toBeInstanceOf(CustomPromise);
            } finally {
                Promise = DefaultPromise;
            }
        });
    });
});
