export const environment = {
  production: false,
  sw: false,
  api: {
    host: location.origin,
    url: 'http://localhost:3333/api',
  },
  auth: {
    url: 'http://localhost:3333/api/auth',
  },
  sampleUser: {
    email: 'slim@demo.ch',
    password: '1234',
  },
};
