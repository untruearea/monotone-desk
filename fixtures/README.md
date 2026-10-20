# Fixture provenance

`input.json` is an original, fictional, non-PII fixture under the package MIT license. Its byte length is 405 and SHA256 is `478c62b9364cb6c0048636fbce6e8356487e2652e93026acb02a571f3d69455f`. It uses LF UTF8 without BOM; publishing must preserve those exact bytes. `source.json.test_url` is only a synthetic mocked HTTP test locator. There is no published fixture URL yet.

`studio-constructor-reference.json` is a minimal public receipt-shape reference copied from the parent-observed Studio61999 constructor evidence. Its provenance field records the actual observation. Its hash/address are neither this project's deployment nor business-flow proof; do not configure them as such. It is used only for adapter/helper/formatter tests. Public RPC transport is mocked during local frontend tests.
