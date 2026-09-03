import { DEMO_DATA } from './demo-data.js';
import { prepareDemoQualityData } from './demo-quality-data.js';
import { createDemoStore } from './demo-store.js';

const STORAGE_KEY = 'um-company-showcase-state-v1';
const PREMIUM_LEARNING_VERSION = 'premium-learning-2026-09-03-v1';

const store = createDemoStore(DEMO_DATA, globalThis.localStorage);
const state = store.getState();

if (state?.meta?.premiumLearningVersion !== PREMIUM_LEARNING_VERSION) {
  prepareDemoQualityData(state);
  state.meta = { ...state.meta, premiumLearningVersion: PREMIUM_LEARNING_VERSION };
  globalThis.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(state));
}
