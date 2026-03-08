import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { resolveDataPath } from '../runtime/paths.js';

const dataDir = resolveDataPath('configs');

// Ensure directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const DEFAULT_CONFIG = {
  baseUrl: '',
  username: '',
  password: '',
  hasOTP: false,
  persistSession: true,
  manualScrollMode: false,
  manualScrollDuration: 20000,
  scrollSelector: '',
  scrollCount: 5,
  scrollDistance: 500,
  scrollDelay: 1000,
  waitBeforeScroll: 2000,
  enableHAR: false,
  outputFolder: '',
  filterRules: {
    inclusive: [],
    exclusive: [],
  },
  loginStrategy: 'simple', // simple, multi-step
  advancedSelectors: {
    usernameInput: 'input[type="email"], input[type="text"][placeholder*="email"], input[name*="email"]',
    passwordInput: 'input[type="password"]',
    submitButton: 'button[type="submit"], button:contains("Login"), button:contains("Sign in")',
    emailFirstButton:
      'button:has-text("Continuer avec un email"), button:has-text("Continuer avec un e-mail"), button:has-text("Continue with email")',
    continueAfterUsernameButton:
      'button:has-text("Continuer"), button:has-text("Continue"), button:has-text("Suivant"), button:has-text("Next"), button[type="submit"]',
    finalSubmitButton:
      'button:has-text("Connexion"), button:has-text("Se connecter"), button:has-text("Continuer"), button:has-text("Continue"), button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]',
  },
};

const configPath = join(dataDir, 'last.json');

function loadConfig() {
  if (existsSync(configPath)) {
    try {
      const data = readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        filterRules: {
          ...DEFAULT_CONFIG.filterRules,
          ...parsed.filterRules,
        },
        advancedSelectors: {
          ...DEFAULT_CONFIG.advancedSelectors,
          ...parsed.advancedSelectors,
        },
      };
    } catch (err) {
      console.error('Error loading config:', err);
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config) {
  try {
    const safeConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      password: '',
      filterRules: {
        ...DEFAULT_CONFIG.filterRules,
        ...config.filterRules,
      },
      advancedSelectors: {
        ...DEFAULT_CONFIG.advancedSelectors,
        ...config.advancedSelectors,
      },
    };
    writeFileSync(configPath, JSON.stringify(safeConfig, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    throw new Error(`Failed to save config: ${err.message}`);
  }
}

function getConfigPath() {
  return configPath;
}

export default {
  loadConfig,
  saveConfig,
  getConfigPath,
  DEFAULT_CONFIG,
};
