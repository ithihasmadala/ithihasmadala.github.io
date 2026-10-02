import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./dependency-snapshot.mjs', import.meta.url));
function snapshot(tree, ref = 'refs/heads/main') {
    const directory = mkdtempSync(join(tmpdir(), 'portfolio-snapshot-'));
    try {
        writeFileSync(join(directory, 'tree.json'), JSON.stringify([tree]));
        writeFileSync(join(directory, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
        return spawnSync(process.execPath, [script, 'tree.json'], {
            cwd: directory, encoding: 'utf8',
            env: {...process.env, GITHUB_SHA: 'a'.repeat(40), GITHUB_REF: ref,
                GITHUB_RUN_ID: '123', GITHUB_REPOSITORY: 'owner/portfolio'}
        });
    } finally {
        rmSync(directory, {recursive: true, force: true});
    }
}
const node = (name, path, dependencies = {}) => ({from: name, version: '1.0.0', path, dependencies});

test('uses one lockfile manifest and normalizes scoped and legacy package names', () => {
    const result = snapshot({dependencies: {JSONStream: node('JSONStream', '/json'), '@scope/package': node('@scope/package', '/scope')}});
    assert.equal(result.status, 0, result.stderr);
    const {manifests} = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(manifests), ['pnpm-lock.yaml']);
    assert.deepEqual(Object.keys(manifests['pnpm-lock.yaml'].resolved).sort(), [
        'pkg:npm/%40scope/package@1.0.0', 'pkg:npm/jsonstream@1.0.0'
    ]);
});

test('keeps dependencies from repeated peer contexts and runtime precedence', () => {
    const c = node('c', '/c');
    const innerA = node('a', '/a-peer', {c});
    const b = node('b', '/b', {a: innerA});
    const result = snapshot({dependencies: {a: node('a', '/a', {b})}, devDependencies: {c}});
    assert.equal(result.status, 0, result.stderr);
    const resolved = JSON.parse(result.stdout).manifests['pnpm-lock.yaml'].resolved;
    assert.deepEqual(resolved['pkg:npm/a@1.0.0'].dependencies, ['pkg:npm/b@1.0.0', 'pkg:npm/c@1.0.0']);
    assert.deepEqual(resolved['pkg:npm/b@1.0.0'].dependencies, ['pkg:npm/a@1.0.0']);
    assert.equal(resolved['pkg:npm/c@1.0.0'].scope, 'runtime');
    assert.equal(resolved['pkg:npm/c@1.0.0'].relationship, 'direct');
});

test('rejects an untrusted ref without emitting a snapshot', () => {
    const result = snapshot({dependencies: {a: node('a', '/a')}}, 'refs/pull/4/merge');
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /exact main build commit/);
});
