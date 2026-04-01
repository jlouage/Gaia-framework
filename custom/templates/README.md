# Custom Templates Directory

This directory is the user-owned location for custom workflow template files. It lives outside `_gaia/` so it **survives framework updates** — `gaia-install.sh update` only touches `_gaia/` contents.

## Usage

Place custom template files here. The workflow engine resolves templates from `custom/templates/` before falling back to the framework's built-in templates in `_gaia/lifecycle/templates/`.

### Custom template override

To override a built-in workflow template:

1. Copy the default template:
   ```
   cp _gaia/lifecycle/templates/story.md custom/templates/story.md
   ```
2. Edit `custom/templates/story.md` with your team's conventions
3. The workflow engine will automatically pick up the custom version

### New custom template

To add a template that doesn't exist in the framework:

1. Create the template file here (e.g., `spike.md`)
2. Reference it from your workflow configuration

## File Format

Custom template files should follow the same format as framework templates — markdown with YAML frontmatter.

## Version Control

This directory should be committed to your project's version control. Custom templates are team-specific configuration, not framework internals.

## Reference

- Built-in templates: `_gaia/lifecycle/templates/`
- Custom skills directory: `custom/skills/`
