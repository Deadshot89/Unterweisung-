# Managed API runtime settings

The v0.36.1 preview deploys `frontend/` and `api/` to the same Static Web App so Microsoft authentication reaches the API. The managed API needs its own SQL and Blob configuration; settings on the standalone Function App do not configure it.

Until Azure management access is available, the SWA workflow prepares `api/runtime-settings.deploy.json` from the existing `SQL_CONNECTION_STRING` and `AZURE_STORAGE_CONNECTION_STRING` GitHub secrets immediately before deployment. Only the API package contains this file. It is ignored by Git, removed from the runner even after failure, and never uploaded as a workflow artifact or copied into `frontend/`. No authentication overrides or deployment credentials are packaged.

The SQL and Blob modules load these fallback values before using them. Existing nonempty Azure application settings take precedence. Rotate the GitHub secrets and redeploy to update packaged fallback credentials; changing a GitHub secret alone does not update an already deployed package.

The workflow requires a healthy SQL connection and Blob storage after deployment and checks that every stylesheet referenced by `frontend/index.html` is served as CSS with the expected content. A successful upload alone is insufficient. Signed-in user identity and application permissions still require an authenticated browser check.

When Azure management access becomes available, configure the managed API through SWA environment variables, remove the packaging step, and redeploy to remove the fallback file. Reference: https://learn.microsoft.com/en-us/azure/static-web-apps/application-settings

Validation: `npm test` includes packaged settings loading, Azure-setting precedence, exclusion of auth overrides, required-secret failure, JSON escaping, file permissions, and server-only packaging checks. No database migration or seed operation is part of this fix.
