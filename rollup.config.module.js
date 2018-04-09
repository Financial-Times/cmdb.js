import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import builtins from 'rollup-plugin-node-builtins';
import commonjs from 'rollup-plugin-commonjs';

export default {
    input: 'index.js',
    output: {
        file: 'dist/cmdb.mjs',
        format: 'es',
        sourcemap: true,
    },
    plugins: [
        babel({
            babelrc: false,
            presets: [
                [
                    'env',
                    {
                        modules: false,
                        useBuiltIns: true,
                        targets: {
                            browsers: [
                                'Chrome >= 60',
                                'Safari >= 10.1',
                                'iOS >= 10.3',
                                'Firefox >= 54',
                                'Edge >= 15',
                            ],
                        },
                    },
                ],
            ],
            plugins: ['external-helpers'],
        }),
        commonjs(),
        builtins(),
        resolve({
            browser: true,
            extensions: ['.js', '.json'],
            preferBuiltins: false,
        }),
    ],
};
