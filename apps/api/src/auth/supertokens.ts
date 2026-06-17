import supertokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import { loadConfig } from '../config';

export function initSupertokens(): void {
  const config = loadConfig();

  supertokens.init({
    framework: 'fastify',
    supertokens: {
      connectionURI: config.supertokens.connectionUri,
      apiKey: config.supertokens.apiKey,
    },
    appInfo: {
      appName: 'Mimir',
      apiDomain: config.authDomain,
      websiteDomain: config.webAppDomain,
      apiBasePath: '/auth',
      websiteBasePath: '/auth',
    },
    recipeList: [EmailPassword.init(), Session.init()],
  });
}

export { supertokens };
