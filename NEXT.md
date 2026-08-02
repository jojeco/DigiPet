# Next improvements for DigiPet

- Check whether `lodash`, `moment`, and `react-native-sound` are imported/used anywhere — they appear in dependencies but `expo-av` replaced sound, so unused deps can be removed
- Move `eslint` and `prettier` from `dependencies` to `devDependencies`, add an `.eslintrc` and `lint`/`format` npm scripts
- Fix the `AppEntry.js` pathing hack in README by adding a proper root `index.js` with `registerRootComponent` and pointing `package.json` `main` at it
- Add a happiness-state visual (color-coded bar or mood text at sad/content/happy thresholds) so the game gives richer feedback; consider a second inventory item type
