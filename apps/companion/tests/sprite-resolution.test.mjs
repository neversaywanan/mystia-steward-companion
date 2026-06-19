import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GITHUB_BEVERAGE_SPRITE_CONFIG,
  resolveGithubBeverageSprite,
} from '../src/lib/github-beverage-sprites.ts';
import {
  GITHUB_RECIPE_SPRITE_CONFIG,
  resolveGithubRecipeSprite,
} from '../src/lib/github-recipe-sprites.ts';
import { buildSpriteSheetLayout } from '../src/lib/sprite-sheet.ts';

test('beverage sprites resolve by runtime id before display name', () => {
  assert.equal(resolveGithubBeverageSprite({ id: 13, name: '错误名称' })?.name, '红魔馆红茶');
});

test('beverage sprites retain supported runtime name aliases', () => {
  assert.equal(resolveGithubBeverageSprite({ name: '冰镇果露' })?.beverageId, 27);
  assert.equal(resolveGithubBeverageSprite({ name: '红茶' })?.beverageId, 13);
  assert.equal(resolveGithubBeverageSprite({ name: '番茄汁' })?.beverageId, 8);
});

test('recipe sprites prefer food id, then recipe id, then exact name', () => {
  assert.equal(resolveGithubRecipeSprite({ id: 7, recipeId: 1, name: '错误名称' })?.name, '饭团');
  assert.equal(resolveGithubRecipeSprite({ recipeId: 35 })?.foodId, 7);
  assert.equal(resolveGithubRecipeSprite({ name: '惊吓万圣夜' })?.foodId, 11026);
});

test('unknown catalog items use the component fallback path', () => {
  assert.equal(resolveGithubBeverageSprite({ id: 99999, name: '未知酒水' }), null);
  assert.equal(resolveGithubRecipeSprite({ id: 99999, name: '未知料理' }), null);
});

test('sprite sheet geometry covers every mapped item', () => {
  assert.deepEqual(GITHUB_BEVERAGE_SPRITE_CONFIG, { columns: 10, cellSize: 26, rows: 5 });
  assert.deepEqual(GITHUB_RECIPE_SPRITE_CONFIG, { columns: 10, cellSize: 26, rows: 20 });
});

test('sprite sheet layout scales and offsets the selected source cell', () => {
  assert.deepEqual(buildSpriteSheetLayout({ columns: 10, rows: 20, spriteIndex: 189, tileSize: 40 }), {
    height: '2000%',
    transform: 'translate(-90%, -90%)',
    width: '1000%',
  });
});

test('sprite sheet layout rejects indexes outside configured geometry', () => {
  assert.equal(buildSpriteSheetLayout({ columns: 10, rows: 5, spriteIndex: -1, tileSize: 32 }), null);
  assert.equal(buildSpriteSheetLayout({ columns: 10, rows: 5, spriteIndex: 50, tileSize: 32 }), null);
});
