# Version Tags

Tags are semantic labels attached to application versions (e.g., RELEASE, SNAPSHOT, STABLE).

See specification: [docs/specs/017-version-tags.md](https://github.com/stubborn-sh/stubborn/blob/main/docs/specs/017-version-tags.md)

## Endpoints

**`PUT /api/v1/applications/{name}/versions/{version}/tags/{tag}`**
Add a tag to a version.

**`DELETE /api/v1/applications/{name}/versions/{version}/tags/{tag}`**
Remove a tag from a version.

**`GET /api/v1/applications/{name}/versions/{version}/tags`**
List all tags for a version.

**`GET /api/v1/applications/{name}/versions/latest?tag={tag}`**
Get the latest version with a specific tag.

## Use Case

Tags allow teams to mark releases and query for the latest stable version without tracking
exact version numbers. Consumer version selectors can reference tags to determine which
contracts to verify against.

![Tags](/images/demo-tags.png)
