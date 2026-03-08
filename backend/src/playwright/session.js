import { chromium } from 'playwright';
import logger from '../logger.js';
import connection from './connection.js';
import scrolling from './scrolling.js';
import utils from './utils.js';
import storageState from '../storage/storageState.js';

function resolveBooleanSetting(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function hasDisplayServer() {
  return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
}

function shouldForceHeadlessWithoutDisplay() {
  return process.platform === 'linux' && !hasDisplayServer();
}

function resolvePlaywrightLaunchOptions() {
  const requestedHeadless = resolveBooleanSetting(
    process.env.PLAYWRIGHT_HEADLESS,
    process.env.NODE_ENV === 'production'
  );
  const disableSandbox = resolveBooleanSetting(process.env.PLAYWRIGHT_DISABLE_SANDBOX, false);
  const headless = shouldForceHeadlessWithoutDisplay() ? true : requestedHeadless;

  return {
    headless,
    args: disableSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  };
}

class PlaywrightSession {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
    this.context = null;
    this.isRunning = false;
    this.isAuthenticated = false;
    this.storageStatePath = storageState.getStorageStatePath(config);
    this.loadedPersistedState = false;
  }

  async initialize() {
    try {
      logger.info('Initializing Playwright browser...');
      const launchOptions = resolvePlaywrightLaunchOptions();
      if (shouldForceHeadlessWithoutDisplay() && launchOptions.headless) {
        logger.info('No Linux display server detected, forcing Playwright to run headless');
      }
      this.browser = await chromium.launch(launchOptions);
      this.context = await this.createContext();
      this.page = await this.context.newPage();
      logger.info('Playwright browser initialized', launchOptions);
      return true;
    } catch (err) {
      logger.error('Failed to initialize Playwright', { error: err.message });
      throw err;
    }
  }

  async navigate(url) {
    try {
      logger.info(`Navigating to ${url}`);
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      logger.info('Navigation completed');
      return true;
    } catch (err) {
      logger.error('Navigation failed', { error: err.message });
      throw err;
    }
  }

  async performLogin(otpCallback = null) {
    try {
      logger.info('Starting login process...');
      const result = await connection.attemptLogin(this.page, this.config, otpCallback);
      this.isAuthenticated = Boolean(
        result?.success && (result?.method !== 'none' || this.loadedPersistedState)
      );
      logger.info('Login process completed', result);
      return result;
    } catch (err) {
      this.isAuthenticated = false;
      logger.error('Login failed', { error: err.message });
      throw err;
    }
  }

  async testLogin() {
    // Used for connection testing without full session
    try {
      logger.info('Testing login configuration...');
      await this.initialize();
      await this.navigate(this.config.baseUrl);
      await utils.wait(this.config.waitBeforeScroll || 2000);
      const result = await this.performLogin();
      await this.close();
      return result;
    } catch (err) {
      await this.close();
      throw err;
    }
  }

  async testScrollTarget() {
    // Used for scroll target testing without full session
    try {
      logger.info('Testing scroll target configuration...');
      await this.initialize();
      await this.navigate(this.config.baseUrl);
      await utils.wait(this.config.waitBeforeScroll || 2000);
      const loginResult = await this.performLogin();
      if (loginResult?.method !== 'none') {
        await utils.wait(2000);
      }

      const resolvedTarget = await utils.resolveHorizontalScrollTarget(
        this.page,
        this.config.scrollSelector
      );

      if (!resolvedTarget.exists || !resolvedTarget.selector) {
        throw new Error(`Element not found: ${this.config.scrollSelector}`);
      }

      if (!resolvedTarget.isHorizontallyScrollable) {
        throw new Error(
          `Element is not horizontally scrollable. ScrollWidth: ${resolvedTarget.scrollWidth}, ClientWidth: ${resolvedTarget.clientWidth}`
        );
      }

      logger.info('Scroll target is valid and scrollable', resolvedTarget);
      await this.close();
      return {
        success: true,
        scrollInfo: resolvedTarget,
      };
    } catch (err) {
      await this.close();
      throw err;
    }
  }

  async close() {
    try {
      await this.saveStorageState();
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
      logger.info('Playwright session closed');
    } catch (err) {
      logger.warn('Error closing Playwright session', { error: err.message });
    }
  }

  getPage() {
    return this.page;
  }

  getBrowser() {
    return this.browser;
  }

  getContext() {
    return this.context;
  }

  async waitBeforeAction() {
    const delay = this.config.waitBeforeScroll || 2000;
    logger.info(`Waiting ${delay}ms before scroll...`);
    await utils.wait(delay);
  }

  async performScrollSequence() {
    await this.waitBeforeAction();

    if (this.config.manualScrollMode) {
      const duration = this.config.manualScrollDuration || 20000;
      logger.info('Manual scroll mode enabled. Waiting for user-driven scrolling...', {
        duration,
      });
      await utils.wait(duration);
      return { mode: 'manual', duration };
    }

    return await scrolling.performScrolling(this.page, this.config);
  }

  async createContext() {
    if (!this.storageStatePath || !storageState.hasStorageState(this.config)) {
      this.loadedPersistedState = false;
      return await this.browser.newContext();
    }

    try {
      const context = await this.browser.newContext({ storageState: this.storageStatePath });
      this.loadedPersistedState = true;
      logger.info('Loaded persisted session state', { storageStatePath: this.storageStatePath });
      return context;
    } catch (err) {
      this.loadedPersistedState = false;
      logger.warn('Failed to load persisted session state, starting fresh context', {
        error: err.message,
        storageStatePath: this.storageStatePath,
      });
      return await this.browser.newContext();
    }
  }

  async saveStorageState() {
    if (!this.storageStatePath || !this.context || !this.isAuthenticated) {
      return;
    }

    await this.context.storageState({ path: this.storageStatePath });
    logger.info('Persisted session state updated', { storageStatePath: this.storageStatePath });
  }
}

export default PlaywrightSession;
