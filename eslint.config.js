import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import eslintPluginAstro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['**/public', '**/dist', '**/dist/*', '**/tests/*', 'coverage', '.astro/*', 'node_modules/*'],
    },
    eslint.configs.recommended,
    tseslint.configs.recommended,
    eslintPluginAstro.configs.all,
    jsxA11y.flatConfigs.strict,
    prettierConfig,
    {
        plugins: {

        }
    },
    {
        rules: {
            "astro/semi": "off"
        }
    }
)