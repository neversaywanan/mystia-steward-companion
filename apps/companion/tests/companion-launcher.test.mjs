import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const launcherSourceUrl = new URL('../../../mods/bepinex/src/Plugin/CompanionProcessLauncher.cs', import.meta.url);

test('packaged companion executable is preferred over a legacy root executable', async () => {
  const source = await readFile(launcherSourceUrl, 'utf8');
  const packagedCandidate = source.indexOf('Path.Combine("companion", "mystia-steward-companion.exe")');
  const legacyCandidate = source.indexOf('\n                "mystia-steward-companion.exe"');

  assert.notEqual(packagedCandidate, -1);
  assert.notEqual(legacyCandidate, -1);
  assert.ok(packagedCandidate < legacyCandidate);
});

test('an incompatible resident companion is stopped before launching the packaged executable', async () => {
  const source = await readFile(launcherSourceUrl, 'utf8');

  assert.match(source, /ControlVersionPrefix/);
  assert.match(source, /MystiaStewardCompanionPlugin\.PluginVersion/);
  assert.match(source, /WaitForControlServerExit/);
  assert.match(source, /SendControlMessage\(ControlExit\)/);
  assert.match(source, /didConnect\s*\?\s*ControlPeerStatus\.Incompatible/);
});
