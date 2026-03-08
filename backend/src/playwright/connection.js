import logger from '../logger.js';
import utils from './utils.js';

const DEFAULT_MULTI_STEP_SELECTORS = {
  continueWithEmail: [
    'button:has-text("Continuer avec un email")',
    'button:has-text("Continuer avec un e-mail")',
    '[role="button"]:has-text("Continuer avec un email")',
    '[role="button"]:has-text("Continuer avec un e-mail")',
    'button:has-text("Continue with email")',
    '[role="button"]:has-text("Continue with email")',
  ],
  continueAfterUsername: [
    'button:has-text("Continuer")',
    'button:has-text("Continue")',
    'button:has-text("Suivant")',
    'button:has-text("Next")',
    'button[type="submit"]',
  ],
  submitPassword: [
    'button:has-text("Connexion")',
    'button:has-text("Se connecter")',
    'button:has-text("Continuer")',
    'button:has-text("Continue")',
    'button:has-text("Sign in")',
    'button:has-text("Log in")',
    'button[type="submit"]',
  ],
};

function ensureUsernameAvailable(config) {
  if (!config.username) {
    throw new Error('Authentication required but username/email is missing');
  }
}

function ensurePasswordAvailable(config) {
  if (!config.password) {
    if (config.persistSession === false) {
      throw new Error('Authentication required but password is missing');
    }

    throw new Error(
      'Persisted session expired or is unavailable. Provide the password once to refresh it'
    );
  }
}

async function waitForLoginCompletion(page, config, options = {}) {
  const {
    timeout = 120000,
    pollIntervalMs = 1000,
    method = 'manual',
  } = options;
  const startedAt = Date.now();

  logger.info('Waiting for login completion in browser window...', { method, timeout });

  while (Date.now() - startedAt < timeout) {
    const loginRequired = await checkIfLoginRequired(page, config);
    if (!loginRequired) {
      await utils.waitForNavigation(page, { timeout: 5000 }).catch(() => false);
      logger.info('Login completed successfully', { method });
      return { success: true, method };
    }

    await utils.wait(pollIntervalMs);
  }

  throw new Error(
    'Login was not completed in time. Finish the login/2FA flow in the browser window and retry'
  );
}

async function waitForManualLogin(page, config, reason = 'manual') {
  ensureUsernameAvailable(config);

  logger.warn('Automatic login unavailable, waiting for manual authentication', { reason });

  return await waitForLoginCompletion(page, config, {
    timeout: 180000,
    method: 'manual',
  });
}

function asSelectorList(...candidates) {
  return candidates.flat().filter(Boolean);
}

async function findFirstSelector(page, selectors, options = {}) {
  for (const selector of asSelectorList(selectors)) {
    const found = await utils.waitForElement(page, selector, options).catch(() => false);
    if (found) {
      return selector;
    }
  }

  return null;
}

async function clickFirstSelector(page, selectors, options = {}) {
  const selector = await findFirstSelector(page, selectors, options);
  if (!selector) {
    return null;
  }

  await page.click(selector);
  return selector;
}

async function fillRequiredField(page, selectors, value, fieldName, options = {}) {
  const selector = await findFirstSelector(page, selectors, options);
  if (!selector) {
    throw new Error(`${fieldName} input not found with selector: ${selectors[0]}`);
  }

  await page.fill(selector, value);
  return selector;
}

async function finishAuthenticatedLogin(page, config, method) {
  await utils.waitForNavigation(page, { timeout: 30000 });

  if (config.hasOTP) {
    return await waitForLoginCompletion(page, config, {
      timeout: 180000,
      method: 'otp',
    });
  }

  logger.info('Login completed successfully', { method });
  return { success: true, method };
}

async function performSimpleLogin(page, config) {
  logger.info('Performing simple login...');

  const { username, password, advancedSelectors } = config;
  
  try {
    ensureUsernameAvailable(config);

    if (!password) {
      return await waitForManualLogin(page, config, 'missing-password');
    }

    ensurePasswordAvailable(config);

    await fillRequiredField(
      page,
      [advancedSelectors.usernameInput],
      username,
      'Username',
      { timeout: 10000, visible: true }
    );
    logger.debug('Username filled');

    await fillRequiredField(
      page,
      [advancedSelectors.passwordInput],
      password,
      'Password',
      { timeout: 10000, visible: true }
    );
    logger.debug('Password filled');

    // Click submit button
    const submitSelector = await clickFirstSelector(
      page,
      [advancedSelectors.submitButton, DEFAULT_MULTI_STEP_SELECTORS.submitPassword],
      { timeout: 10000, visible: true }
    );

    if (!submitSelector) {
      throw new Error(`Submit button not found with selector: ${advancedSelectors.submitButton}`);
    }

    logger.debug('Submit button clicked');

    return await finishAuthenticatedLogin(page, config, 'simple');
  } catch (err) {
    logger.error('Simple login failed', { error: err.message });
    throw err;
  }
}

async function performMultiStepLogin(page, config) {
  logger.info('Performing multi-step login...');

  const { username, password, advancedSelectors } = config;
  const multiStepSelectors = {
    continueWithEmail: asSelectorList(
      advancedSelectors.emailFirstButton,
      DEFAULT_MULTI_STEP_SELECTORS.continueWithEmail
    ),
    continueAfterUsername: asSelectorList(
      advancedSelectors.continueAfterUsernameButton,
      DEFAULT_MULTI_STEP_SELECTORS.continueAfterUsername
    ),
    submitPassword: asSelectorList(
      advancedSelectors.finalSubmitButton,
      advancedSelectors.submitButton,
      DEFAULT_MULTI_STEP_SELECTORS.submitPassword
    ),
  };

  try {
    ensureUsernameAvailable(config);

    if (!password) {
      return await waitForManualLogin(page, config, 'missing-password');
    }

    ensurePasswordAvailable(config);

    const usernameSelector = await findFirstSelector(page, [advancedSelectors.usernameInput], {
      timeout: 3000,
      visible: true,
    });

    if (!usernameSelector) {
      const emailButton = await clickFirstSelector(
        page,
        multiStepSelectors.continueWithEmail,
        { timeout: 5000, visible: true }
      );

      if (!emailButton) {
        throw new Error(
          'Could not find the email-first login button. Open Advanced Settings or complete login manually'
        );
      }

      logger.debug('Clicked email-first login button', { selector: emailButton });
      await utils.waitForNavigation(page, { timeout: 10000 });
    }

    await fillRequiredField(
      page,
      [advancedSelectors.usernameInput],
      username,
      'Username',
      { timeout: 10000, visible: true }
    );
    logger.debug('Username filled');

    const passwordAlreadyVisible = await findFirstSelector(page, [advancedSelectors.passwordInput], {
      timeout: 1500,
      visible: true,
    });

    if (!passwordAlreadyVisible) {
      const nextSelector = await clickFirstSelector(
        page,
        [advancedSelectors.submitButton, multiStepSelectors.continueAfterUsername],
        { timeout: 10000, visible: true }
      );

      if (!nextSelector) {
        throw new Error('Could not find the continue button after entering username/email');
      }

      logger.debug('Clicked username continue button', { selector: nextSelector });
      await utils.waitForNavigation(page, { timeout: 10000 });
    }

    await fillRequiredField(
      page,
      [advancedSelectors.passwordInput],
      password,
      'Password',
      { timeout: 15000, visible: true }
    );
    logger.debug('Password filled');

    const submitSelector = await clickFirstSelector(
      page,
      [advancedSelectors.submitButton, multiStepSelectors.submitPassword],
      { timeout: 10000, visible: true }
    );

    if (!submitSelector) {
      throw new Error('Could not find the final submit button after entering password');
    }

    logger.debug('Final submit button clicked', { selector: submitSelector });
    return await finishAuthenticatedLogin(page, config, 'multi-step');
  } catch (err) {
    logger.error('Multi-step login failed', { error: err.message });
    throw err;
  }
}

async function performLoginWithOTP(page, config, otpCallback) {
  logger.info('Performing login with OTP requirement...');

  try {
    // First: simple login flow
    const result =
      config.loginStrategy === 'multi-step'
        ? await performMultiStepLogin(page, config)
        : await performSimpleLogin(page, config);

    // When OTP is handled manually in the visible browser, simple login already waits for it.
    if (!otpCallback) {
      return result;
    }

    // Check if OTP field appears
    await utils.wait(2000);

    const otpFieldVisible = await page
      .isVisible('input[type="text"][placeholder*="OTP"], input[type="text"][placeholder*="code"]')
      .catch(() => false);

    if (otpFieldVisible) {
      logger.info('OTP field detected, waiting for user input...');

      const otp = await otpCallback();
      if (!otp) {
        throw new Error('OTP required but not provided');
      }

      // Fill OTP
      await page.fill(
        'input[type="text"][placeholder*="OTP"], input[type="text"][placeholder*="code"]',
        otp
      );
      logger.debug('OTP filled');

      // Submit OTP form
      await page.click('button[type="submit"]');
      logger.debug('OTP submitted');

      return await waitForLoginCompletion(page, config, {
        timeout: 120000,
        method: 'otp',
      });
    }

    return result;
  } catch (err) {
    logger.error('OTP login failed', { error: err.message });
    throw err;
  }
}

async function checkIfLoginRequired(page, _config) {
  try {
    // Simple heuristics to detect login form
    const loginFormSelectors = [
      'form[action*="login"]',
      'form[action*="signin"]',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'button:has-text("Continuer avec un email")',
      'button:has-text("Continuer avec un e-mail")',
      'button:has-text("Continue with email")',
      'input[type="email"]',
      'input[type="password"]',
    ];

    for (const selector of loginFormSelectors) {
      try {
        const element = await page.$(selector).catch(() => null);
        if (element) {
          logger.debug('Login form detected');
          return true;
        }
      } catch {
        // Continue checking other selectors
      }
    }

    return false;
  } catch (err) {
    logger.warn('Could not determine if login is required', { error: err.message });
    return false;
  }
}

async function attemptLogin(page, config, otpCallback) {
  const loginRequired = await checkIfLoginRequired(page, config);

  if (!loginRequired) {
    logger.info('No login form detected, assuming already logged in');
    return { success: true, method: 'none' };
  }

  if (config.hasOTP && otpCallback) {
    return await performLoginWithOTP(page, config, otpCallback);
  }

  if (config.loginStrategy === 'multi-step') {
    return await performMultiStepLogin(page, config);
  }

  try {
    return await performSimpleLogin(page, config);
  } catch (err) {
    const shouldFallbackToMultiStep =
      err.message.includes('Username input not found') ||
      err.message.includes('Password input not found');

    if (!shouldFallbackToMultiStep) {
      throw err;
    }

    logger.info('Falling back to multi-step login strategy', { error: err.message });
    return await performMultiStepLogin(page, config);
  }
}

export default {
  performSimpleLogin,
  performMultiStepLogin,
  performLoginWithOTP,
  checkIfLoginRequired,
  attemptLogin,
};
