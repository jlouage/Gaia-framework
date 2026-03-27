---
name: 'change-request'
description: 'DEPRECATED — Redirects to /gaia-add-feature. Use /gaia-add-feature directly.'
model: opus
---

> **DEPRECATED:** `/gaia-change-request` has been replaced by `/gaia-add-feature`.
> This command now redirects to the add-feature workflow automatically.
>
> **Note:** SIGNIFICANT or larger changes are fully supported by the add-feature workflow,
> which classifies changes as patch/enhancement/feature and cascades accordingly.

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS:

<steps CRITICAL="TRUE">
1. LOAD the FULL {project-root}/_gaia/core/engine/workflow.xml
2. READ its entire contents — this is the CORE OS
3. Pass {project-root}/_gaia/lifecycle/workflows/cross-phase/add-feature/workflow.yaml as 'workflow-config'
4. Follow workflow.xml instructions EXACTLY
5. Save outputs after EACH section
</steps>

$ARGUMENTS
