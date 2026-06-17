'use client';

import { useEffect } from 'react';
import { redirectToAuth } from 'supertokens-auth-react';
import { EmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/emailpassword/prebuiltui';
import SuperTokens from 'supertokens-auth-react/ui';

export default function AuthPage() {
  useEffect(() => {
    if (SuperTokens.canHandleRoute([EmailPasswordPreBuiltUI]) === false) {
      redirectToAuth({ redirectBack: false });
    }
  }, []);

  return SuperTokens.getRoutingComponent([EmailPasswordPreBuiltUI]);
}
