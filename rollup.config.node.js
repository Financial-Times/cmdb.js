import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import builtins from 'rollup-plugin-node-builtins';

export default {
  input: 'cmdb.js',
  output: {
    file: 'dist/cmdb.js',
    format: 'cjs'
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
            targets: { node: '4.3.2' }
          }
        ]
      ],
      plugins: ['external-helpers']
    }),
    builtins(),
    resolve({
      browser: false,
      extensions: ['.js', '.json']
    })
  ],
  sourcemap: true
};
