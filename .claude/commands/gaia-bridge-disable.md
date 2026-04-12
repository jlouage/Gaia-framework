---
name: 'bridge-disable'
description: 'Disable the Test Execution Bridge in global.yaml.'
model: sonnet
---

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS:

<steps CRITICAL="TRUE">
1. LOAD the FULL {project-root}/_gaia/core/engine/workflow.xml
2. READ its entire contents — this is the CORE OS
3. Pass {project-root}/_gaia/core/workflows/bridge-toggle/workflow.yaml as 'workflow-config'
4. Set parameter: --mode disable
5. Follow workflow.xml instructions EXACTLY
6. Save outputs after EACH section
</steps>

$ARGUMENTS
