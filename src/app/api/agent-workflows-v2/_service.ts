import { DefaultAgentWorkflowServiceV2 } from '@/application/agent-workflow-v2/service';
import {
  AirtableIntegrationSecretProviderV2,
  AirtableWorkflowRepositoryV2,
  AirtableWorkflowRunRepositoryV2,
  LlmAgentModelRunnerV2,
} from '@/infrastructure/agent-workflow-v2/airtable-repositories';

export const DEFAULT_TENANT_ID = 'default';

export function createAgentWorkflowServiceV2() {
  const workflows = new AirtableWorkflowRepositoryV2();
  const runs = new AirtableWorkflowRunRepositoryV2();
  const secrets = new AirtableIntegrationSecretProviderV2();
  const modelRunner = new LlmAgentModelRunnerV2(secrets);

  return new DefaultAgentWorkflowServiceV2(workflows, runs, modelRunner);
}
