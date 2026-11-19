import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_MODELS,
  DEFAULT_MODEL_ID,
  getAllModels,
  getModelById,
  getAvailableModels,
} from '../../src/server/ai/registry.ts';
import { SovereignEGAdapter } from '../../src/server/ai/adapters/sovereigneg-adapter.ts';

test('AI Registry: contains all requested and verified models', () => {
  const models = getAllModels();
  assert.ok(models.length >= 8, 'Should have at least 8 models');

  // Verify exact models requested in prompt
  const luna = getModelById('gpt-6-luna');
  assert.ok(luna, 'gpt-6-luna must be present');
  assert.equal(luna.apiModelId, 'gpt-6-luna');
  assert.equal(luna.providerName, 'OpenAI');
  assert.equal(luna.category, 'Fast');
  assert.equal(luna.status, 'live');
  assert.equal(luna.capabilities.requiresMaxCompletionTokensOnly, true);
  assert.equal(luna.capabilities.supportsTemperature, false);

  const oss20 = getModelById('gpt-oss-20b');
  assert.ok(oss20, 'gpt-oss-20b must be present');
  assert.equal(oss20.apiModelId, 'gpt-oss-20b');
  assert.equal(oss20.providerName, 'OpenAI');
  assert.equal(oss20.category, 'General');
  assert.equal(oss20.status, 'live');

  const oss120 = getModelById('gpt-oss-120b');
  assert.ok(oss120, 'gpt-oss-120b must be present');
  assert.equal(oss120.apiModelId, 'gpt-oss-120b');
  assert.equal(oss120.providerName, 'OpenAI');
  assert.equal(oss120.category, 'Advanced');
  assert.equal(oss120.status, 'live');

  const argon = getModelById('gemini-4-argon');
  assert.ok(argon, 'gemini-4-argon must be present');
  assert.equal(argon.apiModelId, 'gemini-4-argon');
  assert.equal(argon.providerName, 'Google');
  assert.equal(argon.status, 'live');

  const qwenFlash = getModelById('qwen3.8-flash');
  assert.ok(qwenFlash, 'qwen3.8-flash must be present');
  assert.equal(qwenFlash.apiModelId, 'qwen3.8-flash');
  assert.equal(qwenFlash.providerName, 'Alibaba Qwen');
  assert.equal(qwenFlash.category, 'Fast');
  assert.equal(qwenFlash.status, 'live');

  const sonnet = getModelById('claude-sonnet-5.5');
  assert.ok(sonnet, 'claude-sonnet-5.5 must be present');
  assert.equal(sonnet.providerName, 'Anthropic');
  assert.equal(sonnet.category, 'Writing');
  assert.equal(sonnet.status, 'live');

  // Verify Claude 3.5 negative verification
  const claude35 = getModelById('claude-3-5-sonnet');
  assert.ok(claude35, 'claude-3-5-sonnet entry must exist for verification');
  assert.equal(claude35.status, 'unavailable', 'Claude 3.5 must be marked unavailable');
  assert.ok(claude35.statusNote, 'Must provide an explanation note for unavailable status');
});

test('AI Registry: DEFAULT_MODEL_ID is valid and points to a live model', () => {
  const defaultModel = getModelById(DEFAULT_MODEL_ID);
  assert.ok(defaultModel, 'Default model must exist');
  assert.equal(defaultModel.status, 'live', 'Default model must be live');
});

test('AI Registry: verified pricing is accurate and non-zero for live models', () => {
  const available = getAvailableModels();
  for (const m of available) {
    assert.ok(m.pricing, `Live model ${m.id} should have verified pricing`);
    assert.ok(m.pricing.inputPer1mEgp > 0, `${m.id} should have positive input pricing`);
    assert.ok(m.pricing.outputPer1mEgp > 0, `${m.id} should have positive output pricing`);
    assert.equal(m.pricing.currency, 'EGP');
  }
});

test('AI Adapter: SovereignEG adapter initializes and detects environment key', () => {
  const adapter = new SovereignEGAdapter();
  assert.equal(adapter.providerId, 'sovereigneg');
  // In this test environment, SOVEREIGNEG_API_KEY is configured in process.env
  assert.equal(adapter.isConfigured(), true);
});

test('AI Service: routes catalog models through the adapter that serves them', async () => {
  process.env.SOVEREIGNEG_API_KEY = process.env.SOVEREIGNEG_API_KEY || 'test-sovereigneg-key';
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key';
  const { aiService } = await import('../../src/server/ai/service.ts');

  const sovereign = aiService.resolveModelAndAdapter('gpt-6-luna');
  assert.equal(sovereign.adapter.providerId, 'sovereigneg', 'SovereignEG models must use the gateway adapter');

  const gemini = aiService.resolveModelAndAdapter('gemini-3.8-flash');
  assert.equal(gemini.adapter.providerId, 'gemini', 'Direct Gemini models must use the Gemini adapter');
});
