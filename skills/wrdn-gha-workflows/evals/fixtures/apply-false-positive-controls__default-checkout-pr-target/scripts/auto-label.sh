#!/bin/bash
set -e
echo "Applying labels based on base repo rules"
gh pr edit "$PR_NUMBER" --add-label "needs-triage"
