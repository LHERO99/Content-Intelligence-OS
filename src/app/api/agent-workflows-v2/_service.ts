import { DefaultAgentWorkflowServiceV2 } from '@/application/agent-workflow-v2/service';
import {
  AirtableIntegrationSecretProviderV2,
  AirtableWorkflowRepositoryV2,
  LlmAgentModelRunnerV2,
} from '@/infrastructure/agent-workflow-v2/airtable-repositories';
import { PgWorkflowRunRepositoryV2 } from '@/infrastructure/agent-workflow-v2/pg-run-repository';

export const DEFAULT_TENANT_ID = 'default';

export function createAgentWorkflowServiceV2() {
  // Workflows + Versions still use the config-table JSON store (small, rarely change)
  const workflows = new AirtableWorkflowRepositoryV2();
  // Runs / Steps / Messages now use dedicated PostgreSQL tables — no size limits
  const runs = new PgWorkflowRunRepositoryV2();
  const secrets = new AirtableIntegrationSecretProviderV2();
  const modelRunner = new LlmAgentModelRunnerV2(secrets);

  return new DefaultAgentWorkflowServiceV2(workflows, runs, modelRunner);
}
