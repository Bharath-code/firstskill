// Test-only resolver: lets node --test load app modules that use
// extensionless relative imports (bundler-style, as Next resolves them).
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        // fall through to the original specifier
      }
    }
    return next(specifier, context);
  },
});
