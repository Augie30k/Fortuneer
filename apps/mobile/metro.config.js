// Monorepo-aware Metro config. The repo root is the Next.js web app (kept
// untouched); @fortuneer/shared re-exports platform-neutral modules from the
// web app's lib/, so Metro must watch both folders. Hierarchical lookup is
// disabled so every bare import — including from packages/ and lib/ — resolves
// from THIS app's node_modules, guaranteeing a single copy of react,
// supabase-js, etc. in the bundle (the standard Expo monorepo recipe).
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const repoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [
  path.resolve(repoRoot, 'packages'),
  path.resolve(repoRoot, 'lib'),
]
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')]
config.resolver.disableHierarchicalLookup = true

module.exports = config
