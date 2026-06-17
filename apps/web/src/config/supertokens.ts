export const appInfo = {
  appName: 'Mimir',
  apiDomain: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  websiteDomain: process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000',
  apiBasePath: '/auth',
  websiteBasePath: '/auth',
};
