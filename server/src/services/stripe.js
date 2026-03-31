'use strict';

const { getConfig } = require('../config');
const { createLogger } = require('../logger');

const logger = createLogger('Stripe');

let _stripe = null;

/**
 * Returns a lazily-initialised Stripe client.
 * Throws a clear error if the secret key has not been configured.
 */
function getStripe() {
  if (_stripe) return _stripe;

  const { stripeSecretKey } = getConfig();

  if (!stripeSecretKey || stripeSecretKey.includes('REPLACE')) {
    throw new Error(
      'Stripe secret key is not configured. ' +
      'Set "stripeSecretKey" in config.json to your sk_test_... key.'
    );
  }

  // Require stripe lazily so the app can start even if the package
  // isn't installed yet (developer will run npm install).
  try {
    const Stripe = require('stripe');
    _stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-04-10',
      telemetry: false,          // optional: disable Stripe telemetry
    });
    logger.info('Stripe client initialised (test mode)');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'The "stripe" package is not installed. Run: npm install stripe'
      );
    }
    throw err;
  }

  return _stripe;
}

module.exports = { getStripe };
