import path from 'path'
import fs from 'fs'
import babel from 'rollup-plugin-babel'
import resolve from 'rollup-plugin-node-resolve'
import builtins from 'rollup-plugin-node-builtins'
import commonjs from 'rollup-plugin-commonjs'
import json from 'rollup-plugin-json'

const nodeVersion = fs
    .readFileSync(path.join(__dirname, '.nvmrc'), 'utf8')
    .replace(/\s+/, '')

export default {
    input: 'cmdb.js',
    output: {
        file: 'dist/cmdb.js',
        format: 'cjs',
    },
    sourcemap: 'inline',
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
                            node: nodeVersion,
                        },
                    },
                ],
            ],
            plugins: ['external-helpers'],
            // Babel breaks if trying to transpile this node-fetch dependency
            exclude: 'node_modules/iconv-lite/**',
        }),
        // Needed for a node-fetch dependency
        json(),
        commonjs(),
        builtins(),
        resolve({
            browser: false,
            extensions: ['.js', '.json'],
        }),
    ],
}
