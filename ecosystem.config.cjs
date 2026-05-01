module.exports = {
  apps: [
    {
      name: 'covclasses',
      cwd: __dirname,
      script: '.output/server/index.mjs',
      interpreter: 'node',
      node_args: '--env-file=.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '3004',
      },
    },
  ],
}
