export const environment = {
  production: true,
  debug: true,
  googleProject: {
    id: 'memes-sandbox',
    locationId: 'us-central1',
    registryId: 'memes-registry'
  },
  registrationAuthToken: 'ocgcpDemo',
  registrationURL: `https://registration-dot-${this.googleProject.id}.appspot.com/`
};
