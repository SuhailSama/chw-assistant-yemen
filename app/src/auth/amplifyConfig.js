import { Amplify } from 'aws-amplify';

// These values come from `terraform output` after you run `terraform apply`
// IMPORTANT: Replace the placeholders below with your actual values
// They are NOT secrets — they're safe to put in frontend code
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'me-south-1_REPLACE_ME';
const CLIENT_ID    = import.meta.env.VITE_COGNITO_CLIENT_ID    || 'REPLACE_ME';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: USER_POOL_ID,
      userPoolClientId: CLIENT_ID,
      // No hosted UI — we build our own login form
      loginWith: {
        username: true,
      },
    },
  },
});
