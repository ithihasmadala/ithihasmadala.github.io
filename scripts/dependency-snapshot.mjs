import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const [root] = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const {GITHUB_SHA: sha, GITHUB_REF: ref, GITHUB_RUN_ID: run, GITHUB_REPOSITORY: repository} = process.env;
if (!/^[a-f0-9]{40}$/.test(sha ?? '') || ref !== 'refs/heads/main' || !run || !repository) {
    throw new Error('Dependency snapshots require an exact main build commit and GitHub run identity');
}

const resolved = {};
const visited = new Set();
function collect(name, node, scope, direct = false) {
    if (node.from !== name || !/^(@[^/]+\/)?[a-zA-Z0-9._-]+$/.test(name) || !/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(node.version)) {
        throw new Error(`Unsupported package identity: ${name}`);
    }
    const encoded = name.startsWith('@') ? `%40${name.slice(1)}` : encodeURIComponent(name);
    const url = `pkg:npm/${encoded}@${encodeURIComponent(node.version)}`;
    const dependency = resolved[url] ??= {package_url: url, relationship: 'indirect', scope, dependencies: []};
    if (direct) dependency.relationship = 'direct';
    if (scope === 'runtime') dependency.scope = 'runtime';
    const visit = `${url}:${scope}:${node.path ?? ""}`;
    if (visited.has(visit)) return url;
    visited.add(visit);
    const children = new Set(dependency.dependencies);
    for (const field of ['dependencies', 'optionalDependencies']) {
        for (const [childName, child] of Object.entries(node[field] ?? {})) {
            children.add(collect(childName, child, scope));
        }
    }
    dependency.dependencies = [...children].sort();
    return url;
}

for (const field of ['dependencies', 'optionalDependencies', 'devDependencies']) {
    for (const [name, dependency] of Object.entries(root[field] ?? {})) {
        collect(name, dependency, field === 'devDependencies' ? 'development' : 'runtime', true);
    }
}
if (!Object.keys(resolved).length) throw new Error('The frozen dependency tree is empty');
const manifests = Object.fromEntries(['package.json', 'pnpm-lock.yaml'].map(name => [name, {
    name, file: {source_location: name}, resolved
}]));
process.stdout.write(JSON.stringify({
    version: 0, sha, ref,
    job: {id: run, correlator: 'main-frozen-pnpm', html_url: `https://github.com/${repository}/actions/runs/${run}`},
    detector: {name: 'portfolio-pnpm-snapshot', version: '1.0.0', url: `https://github.com/${repository}/blob/${sha}/scripts/dependency-snapshot.mjs`},
    metadata: {lock_sha256: createHash('sha256').update(readFileSync('pnpm-lock.yaml')).digest('hex')},
    scanned: new Date().toISOString(), manifests
}, null, 2) + '\n');
