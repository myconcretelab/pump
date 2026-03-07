import express from 'express';
import configManager from '../config/configManager.js';
import validation from '../config/validation.js';
import logger from '../logger.js';

const router = express.Router();

// GET current config
router.get('/', (req, res) => {
  try {
    const config = configManager.loadConfig();
    // Don't send sensitive data
    const safeConfig = {
      ...config,
      password: '',
    };
    res.json(safeConfig);
  } catch (err) {
    logger.error('Failed to load config', { error: err.message });
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// POST save config
router.post('/save', (req, res) => {
  try {
    const config = req.body;
    config.password = '';

    // Validate config
    const validation_result = validation.validateConfig(config);
    if (!validation_result.valid) {
      logger.warn('Invalid configuration', { errors: validation_result.errors });
      return res.status(400).json({
        error: 'Invalid configuration',
        details: validation_result.errors,
      });
    }

    // Save config
    configManager.saveConfig(config);
    logger.info('Configuration saved');

    res.json({ success: true, message: 'Configuration saved successfully' });
  } catch (err) {
    logger.error('Failed to save config', { error: err.message });
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// POST validate config
router.post('/validate', (req, res) => {
  try {
    const config = req.body;
    const validation_result = validation.validateConfig(config);

    res.json({
      valid: validation_result.valid,
      errors: validation_result.errors,
    });
  } catch (err) {
    logger.error('Validation error', { error: err.message });
    res.status(500).json({ error: 'Validation failed' });
  }
});

export default router;
