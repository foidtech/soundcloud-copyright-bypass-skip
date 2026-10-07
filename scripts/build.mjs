import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const read = (path) => readFileSync(join(root, path), 'utf-8');

const pkg = JSON.parse(read('package.json'));
const skipper = read('src/skipper.js').trim();
const settings = runInNewContext(read('src/settings.js') + '\nSETTINGS;');

function fill(template, values) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
        if (!(name in values)) throw new Error(`No value for ${match}`);
        return values[name];
    });
}

function indent(text, spaces) {
    const pad = ' '.repeat(spaces);
    return text.replace(/^(?=.)/gm, pad);
}

function pluginConfig() {
    const lines = settings
        .filter((setting) => !setting.extensionOnly)
        .map((setting) => `    ${setting.key}: ${JSON.stringify(setting.default)},`);
    return '{\n' + lines.join('\n') + '\n}';
}

function defaults() {
    return JSON.stringify(Object.fromEntries(settings.map((setting) => [setting.key, setting.default])));
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'extension'), { recursive: true });

writeFileSync(join(dist, 'copyright-bypass-skip.js'), fill(read('src/plugin.js'), {
    VERSION: pkg.version,
    HOMEPAGE: pkg.homepage ? `\n * @homepage ${pkg.homepage}` : '',
    CONFIG: pluginConfig(),
    SKIPPER: skipper,
}));

const extension = join(dist, 'extension');
cpSync(join(root, 'src/extension'), extension, { recursive: true });
cpSync(join(root, 'src/settings.js'), join(extension, 'settings.js'));
writeFileSync(join(extension, 'manifest.json'), fill(read('src/extension/manifest.json'), { VERSION: pkg.version }));
writeFileSync(join(extension, 'page.js'), fill(read('src/extension/page.js'), {
    SKIPPER: indent(skipper, 4),
    DEFAULTS: defaults(),
}));

console.log(`Built v${pkg.version}`);
console.log('  dist/copyright-bypass-skip.js');
console.log('  dist/extension/');
