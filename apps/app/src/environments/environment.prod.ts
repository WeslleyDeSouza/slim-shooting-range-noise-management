export const environment = {
  production: true,
  sw: false,
  api: {
    host: location.origin,
    url: '/api',
  },
  auth: {
    url: '/api/auth',
  },
  sampleUser: <{ email: string; password: string } | undefined>undefined,
};
