'use client';

import { appInfo } from '@/config/supertokens';
import SuperTokens from 'supertokens-auth-react';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword';
import Session from 'supertokens-auth-react/recipe/session';

if (typeof window !== 'undefined') {
  SuperTokens.init({
    appInfo,
    recipeList: [EmailPassword.init(), Session.init()],
  });
}

export function SupertokensInit({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
