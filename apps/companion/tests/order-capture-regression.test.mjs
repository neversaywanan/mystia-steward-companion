import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const reflectionProviderPath = new URL(
  '../../../mods/bepinex/src/Save/NightBusinessReflectionProvider.cs',
  import.meta.url,
);
const runtimeCapturePath = new URL(
  '../../../mods/bepinex/src/Save/SpecialOrderRuntimeCapture.cs',
  import.meta.url,
);

test('runtime capture supplements reflection instead of disabling live order reads', async () => {
  const source = await readFile(reflectionProviderPath, 'utf8');

  assert.match(source, /OrderReadMode=Reflection\+RuntimeCapture/);
  assert.doesNotMatch(source, /preferRuntimeCapturedOrders/);
  assert.match(source, /ReadServePanelOrders\(servePanelContexts\)/);
  assert.match(source, /ReadOrderControllerOrders\(\)/);
  assert.match(source, /ReadHudOrders\(\)/);
  assert.match(source, /ReadControllerOrders\(controllers, source\.Source\)/);
});

test('fulfilled captured orders are rejected before an active guest can keep them alive', async () => {
  const source = await readFile(reflectionProviderPath, 'utf8');
  const method = source.slice(
    source.indexOf('private bool ShouldKeepCapturedOrder'),
    source.indexOf('private static bool HasCapturedOrderDetails'),
  );

  assert.ok(method.indexOf('captured.IsFulfilled') >= 0);
  assert.ok(method.indexOf('captured.IsFulfilled') < method.indexOf('MatchesActiveGuest'));
});

test('fulfilled reflection orders are rejected before they enter the merged order list', async () => {
  const source = await readFile(reflectionProviderPath, 'utf8');
  const method = source.slice(
    source.indexOf('private NightBusinessOrder? ReadOrder'),
    source.indexOf('private string? ReadCurrentPlace'),
  );

  assert.match(method, /if \(IsRuntimeOrderFulfilled\(readableOrder\)\)/);
  assert.match(method, /"order is fulfilled"/);
});

test('manual-order completion removes the exact order captured before the end callback', async () => {
  const source = await readFile(runtimeCapturePath, 'utf8');
  const methods = source.slice(
    source.indexOf('private static void OnManualOrderEnding'),
    source.indexOf('private static void AddOrder'),
  );
  const registration = source.slice(
    source.indexOf('private static void TryAttach'),
    source.indexOf('private static void OnManualOrderEnded'),
  );

  assert.match(registration, /nameof\(OnManualOrderEnding\), nameof\(OnManualOrderEnded\)/);
  assert.match(methods, /OnManualOrderEnding\(object __0, out CapturedRuntimeSpecialOrder\? __state\)/);
  assert.match(methods, /RemoveOrder\(__state is null \? null : __state with/);
  assert.doesNotMatch(methods, /RemoveOrderSlot/);
});
