# GitHub + Packagist publishing checklist

1. Decide the GitHub account/organization that should own the repository, and confirm you intend to publish this source as **public MIT-licensed code**.
2. Create an empty public repository, preferably named `flarum-wiki-reader`, and upload **the contents of this directory as repository root**. The `composer.json`, `extend.php`, `js/`, `src/`, `less/`, and `migrations/` must appear at the GitHub root. Do not upload the original one-click installer or Docker Compose files into this Composer package.
3. Check PHP and JS lint, review the source, and test enabling the extension and its Wiki UI on a cloned Flarum 2.x + LR Wiki instance.
4. Commit to `main`. Create tag `v0.1.0-beta.2` from that reviewed commit and push it. Avoid creating a stable tag before integration checks pass.
5. Sign in to Packagist.org (GitHub authentication is supported), select `Submit`, and submit the exact **public** GitHub repository URL. Check that package name is `startpro/wiki-reader` and version `v0.1.0-beta.2` appears.
6. Set up the Packagist GitHub integration so newly created tags trigger package updates. Never paste your GitHub or Packagist tokens into a chat or public repository.
7. Docker installation: `extension require 'startpro/wiki-reader:^0.1@beta'`, then enable it in Flarum admin, run migrations/cache clear, and verify `/data/extensions/list`.
8. Test two independent users and resume/bookmark behavior on a backup clone before production rollout.

If you later release `v0.1.0`, install with `extension require 'startpro/wiki-reader:^0.1'` after Packagist indexes the stable tag.

### Beta 3 notice

The beta.3 tag contains the JavaScript CommonJS export fix. Beta.1 and beta.2 should stay published for history but must not be enabled on a production forum. Before beta.3 activation, back up the database and have a known-good disable command ready.
