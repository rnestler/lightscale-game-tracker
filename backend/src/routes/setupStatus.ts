import { Router } from 'express';
import { configuredSocialProviders, emailDeliveryConfigured } from '../auth.js';

export const setupStatusRouter = Router();

function environmentConfigured(name: string): boolean {
  return (process.env[name] ?? '') !== '';
}

setupStatusRouter.get('/', (_request, response) => {
  response.json({
    emailDelivery: emailDeliveryConfigured(),
    socialProviders: configuredSocialProviders(),
    addressLookup: environmentConfigured('GOOGLE_MAPS_API_KEY'),
    mapDisplay: environmentConfigured('GOOGLE_MAPS_BROWSER_KEY'),
    capabilities: {
      passwordReset: true,
      emailVerification: true,
      twoFactor: true,
      passkeys: true,
    },
  });
});
