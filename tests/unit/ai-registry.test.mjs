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
  const live = getAvailableModels();
  assert.ok(models.length >= 30, 'Should expose a broad curated catalog');

  const providers = new Set(live.map((model) => model.providerId));
  for (const provider of ['openai', 'anthropic', 'google']) {
    assert.ok(providers.has(provider), `${provider} models must be available`);
  }

  const liveByProvider = (provider) => live.filter((model) => model.providerId === provider);
  assert.ok(liveByProvider('openai').length >= 10, 'OpenAI family must be well represented');
  assert.ok(liveByProvider('anthropic').length >= 8, 'Anthropic Claude family must be well represented');
  assert.ok(liveByProvider('google').length >= 9, 'Google Gemini family must be well represented');

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

  const geminiFlash = getModelById('gemini-3.8-flash');
  assert.ok(geminiFlash, 'gemini-3.8-flash must be present');
  assert.equal(geminiFlash.apiModelId, 'gemini-3.8-flash');
  assert.equal(geminiFlash.name, 'Gemini 3.8 Flash');
  assert.equal(geminiFlash.inferencePlatform, 'SovereignEG');
  assert.equal(geminiFlash.providerId, 'google');
  assert.equal(geminiFlash.status, 'live');

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

test('AI Registry: ids are unique and match the provider model ids', () => {
  const ids = AI_MODELS.map((model) => model.id);
  assert.equal(new Set(ids).size, ids.length, 'registry model ids must be unique');

  for (const model of getAvailableModels()) {
    assert.equal(model.apiModelId, model.id, `${model.id} must pass the verified API id through`);
    assert.equal(model.inferencePlatform, 'SovereignEG');
    assert.equal(model.status, 'live');
  }
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

test('AI Registry: every model is served through SovereignEG only', () => {
  for (const model of AI_MODELS) {
    assert.equal(
      model.inferencePlatform,
      'SovereignEG',
      `${model.id} must be routed exclusively through SovereignEG`,
    );
  }
  assert.ok(
    AI_MODELS.every((model) => model.providerId !== 'gemini'),
    'No catalog entry may use the direct Gemini adapter as its provider',
  );
});

test('AI Registry: every live model declares multimodal capabilities from provider metadata', () => {
  for (const model of getAvailableModels()) {
    assert.ok(
      model.capabilities.contextWindow && model.capabilities.contextWindow > 0,
      `${model.id} must declare a context window`,
    );
    assert.ok(
      model.capabilities.maxOutputTokens && model.capabilities.maxOutputTokens > 0,
      `${model.id} must declare an output limit`,
    );
    assert.equal(model.capabilities.supportsStreaming, true);
  }

  for (const id of ['gpt-6-luna', 'claude-opus-5.5', 'gemini-3.8-flash']) {
    const model = getModelById(id);
    assert.equal(model.status, 'live');
    assert.equal(model.capabilities.supportsVision, true, `${id} must accept images`);
    assert.equal(model.capabilities.supportsFiles, true, `${id} must accept PDF files`);
  }

  for (const id of ['gpt-oss-20b', 'gpt-oss-120b']) {
    const model = getModelById(id);
    assert.equal(model.capabilities.supportsVision, false, `${id} is text-only`);
    assert.equal(model.capabilities.supportsFiles, false, `${id} is text-only`);
  }
});

test('AI Service: routes catalog models through the adapter that serves them', async () => {
  process.env.SOVEREIGNEG_API_KEY = process.env.SOVEREIGNEG_API_KEY || 'test-sovereigneg-key';
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key';
  const { aiService } = await import('../../src/server/ai/service.ts');

  const sovereign = aiService.resolveModelAndAdapter('gpt-6-luna');
  assert.equal(sovereign.adapter.providerId, 'sovereigneg', 'SovereignEG models must use the gateway adapter');

  const gemini = aiService.resolveModelAndAdapter('gemini-3.8-flash');
  assert.equal(
    gemini.adapter.providerId,
    'sovereigneg',
    'Gemini 3.8 Flash must use the SovereignEG gateway adapter',
  );
  assert.equal(gemini.model.inferencePlatform, 'SovereignEG');
});

test('AI Adapter: Gemini 3.8 Flash calls SovereignEG with the exact model id', async () => {
  const adapter = new SovereignEGAdapter();
  const model = getModelById('gemini-3.8-flash');
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SOVEREIGNEG_API_KEY;
  process.env.SOVEREIGNEG_API_KEY = 'test-sovereigneg-key';
  let captured = null;

  try {
    globalThis.fetch = async (url, init) => {
      captured = { url: String(url), body: JSON.parse(init.body) };
      return new Response(
        JSON.stringify({
          model: 'gemini-3.8-flash',
          choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const result = await adapter.chatCompletion(model, {
      modelId: model.id,
      messages: [{ role: 'user', content: 'hi' }],
    });

    assert.match(captured.url, /sovereigneg\.com\/v1\/chat\/completions$/);
    assert.equal(captured.body.model, 'gemini-3.8-flash');
    assert.equal(captured.body.stream, false);
    assert.equal(result.content, 'ok');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.SOVEREIGNEG_API_KEY = originalKey;
  }
});

test('AI Adapter: SovereignEG surfaces provider errors for Gemini 3.8 Flash', async () => {
  const adapter = new SovereignEGAdapter();
  const model = getModelById('gemini-3.8-flash');
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SOVEREIGNEG_API_KEY;
  process.env.SOVEREIGNEG_API_KEY = 'test-sovereigneg-key';

  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ error: { message: 'Monthly spend cap on this API key has been reached.' } }),
        { status: 402, headers: { 'content-type': 'application/json' } },
      );

    await assert.rejects(
      () => adapter.chatCompletion(model, { modelId: model.id, messages: [{ role: 'user', content: 'hi' }] }),
      /Monthly spend cap/,
    );
    await assert.rejects(
      () => adapter.streamChatCompletion(
        model,
        { modelId: model.id, messages: [{ role: 'user', content: 'hi' }] },
        () => {},
      ),
      /Monthly spend cap/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env.SOVEREIGNEG_API_KEY = originalKey;
  }
});

test('AI Adapter: Gemini 3.8 Flash is rejected when the SovereignEG key is missing', async () => {
  const adapter = new SovereignEGAdapter();
  const model = getModelById('gemini-3.8-flash');
  const originalKey = process.env.SOVEREIGNEG_API_KEY;
  delete process.env.SOVEREIGNEG_API_KEY;

  try {
    assert.equal(adapter.isConfigured(), false);
    await assert.rejects(
      () => adapter.chatCompletion(model, { modelId: model.id, messages: [{ role: 'user', content: 'hi' }] }),
      /SovereignEG API key is not configured/,
    );
  } finally {
    if (originalKey === undefined) delete process.env.SOVEREIGNEG_API_KEY;
    else process.env.SOVEREIGNEG_API_KEY = originalKey;
  }
});
