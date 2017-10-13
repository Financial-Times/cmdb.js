import babel from 'rollup-plugin-babel';
import cjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import resolve from 'rollup-plugin-node-resolve';
import builtins from 'rollup-plugin-node-builtins';

export default {
  input: 'cmdb.js',
  output: {
    file: 'dist/cmdb.mjs',
    format: 'es'
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
                'Edge >= 15'
              ]
            }
          }
        ]
      ],
      plugins: ['external-helpers']
    }),
    cjs(),
    builtins(),
    replace({ 'process.env.NODE_ENV': JSON.stringify('production') }),
    resolve({
      browser: true,
      extensions: ['.js', '.json'],
      preferBuiltins: false
    })
  ],
  sourcemap: true
};