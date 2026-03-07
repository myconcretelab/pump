import { create } from 'zustand';

const useStore = create((set) => ({
  config: {
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
    loginStrategy: 'simple',
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
  },

  setConfig: (config) => set({ config }),

  updateConfig: (updates) =>
    set((state) => ({
      config: { ...state.config, ...updates },
    })),

  updateFilterRules: (rules) =>
    set((state) => ({
      config: {
        ...state.config,
        filterRules: rules,
      },
    })),

  resetConfig: () =>
    set({
      config: {
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
        loginStrategy: 'simple',
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
      },
    }),
}));

export default useStore;
